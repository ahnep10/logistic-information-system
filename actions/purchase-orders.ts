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

  try {
    const totalAmount = computeTotalAmount(parsed.data.lineItems)

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

  const lineItems = parseLineItems(formData.get("lineItems"))
  const parsed = createPurchaseOrderSchema.safeParse({
    supplierId: formData.get("supplierId"),
    lineItems,
  })
  if (!parsed.success) {
    return { error: "Invalid input. Please check all fields." }
  }

  try {
    const totalAmount = computeTotalAmount(parsed.data.lineItems)

    await prisma.$transaction(async (tx) => {
      // Re-check status inside the same transaction that performs the write —
      // an earlier findUnique-then-mutate pattern is a TOCTOU race (CR-01).
      const { count } = await tx.purchaseOrder.updateMany({
        where: { id, status: "DRAFT" },
        data: {
          supplierId: parsed.data.supplierId,
          totalAmount,
        },
      })
      if (count === 0) {
        throw new Error("Only Draft purchase orders can be edited.")
      }

      await tx.purchaseOrderLineItem.deleteMany({
        where: { purchaseOrderId: id },
      })
      if (parsed.data.lineItems.length > 0) {
        await tx.purchaseOrderLineItem.createMany({
          data: parsed.data.lineItems.map((li) => ({
            purchaseOrderId: id,
            productId: li.productId,
            quantity: li.quantity,
            unitPrice: new Prisma.Decimal(li.unitPrice),
          })),
        })
      }
    })

    revalidatePath("/purchase-orders")
    revalidatePath(`/purchase-orders/${id}`)
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Only Draft purchase orders can be edited.") {
      return { error: err.message }
    }
    return { error: "Failed to save purchase order. Please try again." }
  }
}

export async function confirmPurchaseOrder(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  try {
    await prisma.$transaction(async (tx) => {
      // Row lock MUST be the first statement, and every validation below
      // must read data taken AFTER acquiring it. A plain (unlocked) read
      // followed by a later write lets a concurrent updateDraftPurchaseOrder
      // land in between — silently confirming a PO whose D-08 (line item
      // count) / D-16 (active supplier/product) validation ran against
      // line items that have since been replaced (Phase 04 UAT test 4).
      const rows = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT "status" FROM purchase_orders WHERE id = ${id} FOR UPDATE
      `
      if (rows.length === 0) throw new Error("Purchase order not found.")

      const status = rows[0].status
      try {
        assertPOEditable(status)
      } catch (err) {
        throw err instanceof Error
          ? err
          : new Error("This purchase order has already been received.")
      }
      if (status !== "DRAFT") {
        throw new Error("Only Draft purchase orders can be confirmed.")
      }

      const po = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: {
          supplier: { select: { name: true, isActive: true } },
          lineItems: {
            include: { product: { select: { name: true, isActive: true } } },
          },
        },
      })

      const parsed = confirmPurchaseOrderSchema.safeParse({
        lineItems: po.lineItems.map((li) => ({
          productId: li.productId,
          quantity: li.quantity,
          unitPrice: li.unitPrice.toNumber(),
        })),
      })
      if (!parsed.success) {
        throw new Error(
          parsed.error.issues[0]?.message ??
            "Invalid input. Please check all fields."
        )
      }

      if (!po.supplier.isActive) {
        throw new Error(
          `Cannot confirm — ${po.supplier.name} has been deactivated. Update this purchase order before confirming.`
        )
      }
      const inactiveLine = po.lineItems.find((li) => !li.product.isActive)
      if (inactiveLine) {
        throw new Error(
          `Cannot confirm — ${inactiveLine.product.name} has been deactivated. Update this purchase order before confirming.`
        )
      }

      // Defense-in-depth (CR-01 pattern): the row lock above already
      // guarantees status is still DRAFT at this point, but the explicit
      // status filter keeps this write consistent with updateDraftPurchaseOrder
      // and deletePurchaseOrder's atomic-guard convention.
      const { count } = await tx.purchaseOrder.updateMany({
        where: { id, status: "DRAFT" },
        data: { status: "ORDERED" },
      })
      if (count === 0) {
        throw new Error("Only Draft purchase orders can be confirmed.")
      }
    })
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to confirm purchase order. Please try again.",
    }
  }

  revalidatePath("/purchase-orders")
  revalidatePath(`/purchase-orders/${id}`)
  return { success: true }
}

export async function deletePurchaseOrder(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  try {
    // Guard the mutation itself, not an earlier read — deleteMany with a
    // status filter is atomic, closing the TOCTOU race described in CR-01.
    const { count } = await prisma.purchaseOrder.deleteMany({
      where: { id, status: "DRAFT" },
    })
    if (count === 0) {
      return { error: "Only Draft purchase orders can be deleted." }
    }
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

      // Load the PO's FULL line-item set (not just the submitted ids) so we
      // can require the payload to cover every line before marking the PO
      // RECEIVED (WR-03), and so we can bound receivedQuantity against the
      // originally ordered quantity (WR-04).
      const dbLineItems = await tx.purchaseOrderLineItem.findMany({
        where: { purchaseOrderId: id },
        select: { id: true, productId: true, quantity: true },
      })
      const dbLineItemById = new Map(dbLineItems.map((li) => [li.id, li]))

      if (parsed.data.lineItems.length !== dbLineItems.length) {
        throw new Error(
          "All line items must be included when receiving this purchase order."
        )
      }

      for (const line of parsed.data.lineItems) {
        const dbLineItem = dbLineItemById.get(line.lineItemId)
        if (!dbLineItem) throw new Error("Line item not found.")
        if (line.receivedQuantity > dbLineItem.quantity) {
          throw new Error(
            "Received quantity cannot exceed the ordered quantity."
          )
        }

        const productId = dbLineItem.productId

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
