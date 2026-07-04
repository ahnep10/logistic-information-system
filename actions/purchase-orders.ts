"use server"
import { auth } from "@/lib/auth"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  createPurchaseOrderSchema,
  confirmPurchaseOrderSchema,
  receivePurchaseOrderSchema,
  assertPOEditable,
  type LineItemInput,
} from "@/lib/validations/purchase-order"

function computeTotalAmount(lineItems: LineItemInput[]): Prisma.Decimal {
  return lineItems.reduce(
    (sum, li) => sum.plus(new Prisma.Decimal(li.quantity).times(li.unitPrice)),
    new Prisma.Decimal(0)
  )
}

function parseLineItems(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string") return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export async function createDraftPurchaseOrder(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const lineItems = parseLineItems(formData.get("lineItems"))
  const parsed = createPurchaseOrderSchema.safeParse({
    supplierId: formData.get("supplierId"),
    lineItems,
  })
  if (!parsed.success) {
    return { error: "Invalid input. Please check all fields." }
  }

  const totalAmount = computeTotalAmount(parsed.data.lineItems)

  try {
    const po = await prisma.purchaseOrder.create({
      data: {
        supplierId: parsed.data.supplierId,
        status: "DRAFT",
        totalAmount,
        createdById: session.user.id,
        lineItems: {
          create: parsed.data.lineItems.map((li) => ({
            productId: li.productId,
            quantity: li.quantity,
            unitPrice: new Prisma.Decimal(li.unitPrice),
          })),
        },
      },
    })

    revalidatePath("/purchase-orders")
    return { success: true, id: po.id }
  } catch {
    return { error: "Failed to save purchase order. Please try again." }
  }
}

export async function updateDraftPurchaseOrder(id: string, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!existing || existing.status !== "DRAFT") {
    return { error: "Only Draft purchase orders can be edited." }
  }

  const lineItems = parseLineItems(formData.get("lineItems"))
  const parsed = createPurchaseOrderSchema.safeParse({
    supplierId: formData.get("supplierId"),
    lineItems,
  })
  if (!parsed.success) {
    return { error: "Invalid input. Please check all fields." }
  }

  const totalAmount = computeTotalAmount(parsed.data.lineItems)

  try {
    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrderLineItem.deleteMany({
        where: { purchaseOrderId: id },
      })
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: parsed.data.supplierId,
          totalAmount,
          lineItems: {
            create: parsed.data.lineItems.map((li) => ({
              productId: li.productId,
              quantity: li.quantity,
              unitPrice: new Prisma.Decimal(li.unitPrice),
            })),
          },
        },
      })
    })

    revalidatePath("/purchase-orders")
    revalidatePath(`/purchase-orders/${id}`)
    return { success: true }
  } catch {
    return { error: "Failed to save purchase order. Please try again." }
  }
}

export async function confirmPurchaseOrder(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: { select: { name: true, isActive: true } },
      lineItems: {
        include: { product: { select: { name: true, isActive: true } } },
      },
    },
  })
  if (!po) return { error: "Purchase order not found." }

  try {
    assertPOEditable(po.status)
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "This purchase order has already been received.",
    }
  }

  if (po.status !== "DRAFT") {
    return { error: "Only Draft purchase orders can be confirmed." }
  }

  const parsed = confirmPurchaseOrderSchema.safeParse({
    lineItems: po.lineItems.map((li) => ({
      productId: li.productId,
      quantity: li.quantity,
      unitPrice: li.unitPrice.toNumber(),
    })),
  })
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Invalid input. Please check all fields.",
    }
  }

  if (!po.supplier.isActive) {
    return {
      error: `Cannot confirm — ${po.supplier.name} has been deactivated. Update this purchase order before confirming.`,
    }
  }
  const inactiveLine = po.lineItems.find((li) => !li.product.isActive)
  if (inactiveLine) {
    return {
      error: `Cannot confirm — ${inactiveLine.product.name} has been deactivated. Update this purchase order before confirming.`,
    }
  }

  try {
    await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "ORDERED" },
    })
  } catch {
    return { error: "Failed to confirm purchase order. Please try again." }
  }

  revalidatePath("/purchase-orders")
  revalidatePath(`/purchase-orders/${id}`)
  return { success: true }
}

export async function deletePurchaseOrder(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!existing || existing.status !== "DRAFT") {
    return { error: "Only Draft purchase orders can be deleted." }
  }

  try {
    await prisma.purchaseOrder.delete({ where: { id } })
  } catch {
    return { error: "Failed to delete purchase order. Please try again." }
  }

  revalidatePath("/purchase-orders")
  revalidatePath(`/purchase-orders/${id}`)
  return { success: true }
}

export async function receivePurchaseOrder(id: string, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const lineItems = parseLineItems(formData.get("lineItems"))
  const parsed = receivePurchaseOrderSchema.safeParse({ lineItems })
  if (!parsed.success) {
    return { error: "Invalid input. Please check all fields." }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Row lock MUST be the first statement — the status re-check below must
      // happen strictly after it returns, before any other read or write.
      // This ordering is the entire mitigation for the double-receipt race (D-22).
      const rows = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT "status" FROM purchase_orders WHERE id = ${id} FOR UPDATE
      `
      if (rows.length === 0) throw new Error("Purchase order not found.")
      if (rows[0].status !== "ORDERED") {
        throw new Error("This purchase order has already been received.")
      }

      const lineItemIds = parsed.data.lineItems.map((li) => li.lineItemId)
      const dbLineItems = await tx.purchaseOrderLineItem.findMany({
        where: { id: { in: lineItemIds }, purchaseOrderId: id },
        select: { id: true, productId: true },
      })
      const productIdByLineItemId = new Map(
        dbLineItems.map((li) => [li.id, li.productId])
      )

      for (const line of parsed.data.lineItems) {
        const productId = productIdByLineItemId.get(line.lineItemId)
        if (!productId) throw new Error("Line item not found.")

        await tx.product.update({
          where: { id: productId },
          data: { currentStock: { increment: line.receivedQuantity } },
        })

        await tx.stockTransaction.create({
          data: {
            type: "STOCK_IN",
            productId,
            quantity: line.receivedQuantity,
            reason: "Purchase Received",
            purchaseOrderId: id,
            createdById: session.user.id,
          },
        })

        await tx.purchaseOrderLineItem.update({
          where: { id: line.lineItemId },
          data: { receivedQuantity: line.receivedQuantity },
        })
      }

      await tx.purchaseOrder.update({
        where: { id },
        data: { status: "RECEIVED" },
      })
    })
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : "Failed to receive purchase order. Please try again."
    return { error: msg }
  }

  revalidatePath("/purchase-orders")
  revalidatePath(`/purchase-orders/${id}`)
  revalidatePath("/inventory")
  revalidatePath("/stock")
  revalidatePath("/products")
  return { success: true }
}
