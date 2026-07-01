"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { stockInSchema, stockOutSchema } from "@/lib/validations/stock-transaction"

export async function recordStockIn(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const parsed = stockInSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
    notes: formData.get("notes") || undefined,
  })
  if (!parsed.success) return { error: "Invalid input. Please check all fields." }

  try {
    await prisma.$transaction(async (tx) => {
      // SELECT FOR UPDATE serializes concurrent writes on the same product row.
      // Without this, a concurrent stock-out could race the implicit read inside
      // the increment UPDATE and produce an inconsistent audit trail.
      const rows = await tx.$queryRaw<Array<{ currentStock: number }>>`
        SELECT "currentStock" FROM products WHERE id = ${parsed.data.productId} FOR UPDATE
      `
      if (rows.length === 0) throw new Error("Product not found.")

      await tx.product.update({
        where: { id: parsed.data.productId },
        data: { currentStock: { increment: parsed.data.quantity } },
      })

      await tx.stockTransaction.create({
        data: {
          type: "STOCK_IN",
          productId: parsed.data.productId,
          quantity: parsed.data.quantity,
          reason: parsed.data.reason,
          notes: parsed.data.notes ?? null,
          createdById: session.user.id,
        },
      })
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record transaction."
    return { error: msg }
  }

  revalidatePath("/stock")
  revalidatePath("/inventory")
  revalidatePath("/products")
  return { success: true }
}

export async function recordStockOut(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const parsed = stockOutSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
    notes: formData.get("notes") || undefined,
  })
  if (!parsed.success) return { error: "Invalid input. Please check all fields." }

  try {
    await prisma.$transaction(async (tx) => {
      // SELECT FOR UPDATE acquires an exclusive row lock before the stock check.
      // This prevents the TOCTOU race where two concurrent stock-outs both read
      // the same currentStock value, both pass the application check, and both
      // decrement — triggering the DB CHECK constraint with a generic error
      // instead of the clean D-18 "Insufficient stock" message.
      const rows = await tx.$queryRaw<Array<{ currentStock: number }>>`
        SELECT "currentStock" FROM products WHERE id = ${parsed.data.productId} FOR UPDATE
      `
      if (rows.length === 0) throw new Error("Product not found.")

      const { currentStock } = rows[0]
      if (currentStock < parsed.data.quantity) {
        throw new Error(
          `Insufficient stock. Current stock: ${currentStock} units.`
        )
      }

      await tx.product.update({
        where: { id: parsed.data.productId },
        data: { currentStock: { decrement: parsed.data.quantity } },
      })

      await tx.stockTransaction.create({
        data: {
          type: "STOCK_OUT",
          productId: parsed.data.productId,
          quantity: parsed.data.quantity,
          reason: parsed.data.reason,
          notes: parsed.data.notes ?? null,
          createdById: session.user.id,
        },
      })
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record transaction."
    return { error: msg }
  }

  revalidatePath("/stock")
  revalidatePath("/inventory")
  revalidatePath("/products")
  return { success: true }
}
