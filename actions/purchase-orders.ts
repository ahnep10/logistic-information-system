"use server"
import { auth } from "@/lib/auth"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  createPurchaseOrderSchema,
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
