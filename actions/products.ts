"use server"
import { auth } from "@/lib/auth"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  createProductSchema,
  updateProductSchema,
} from "@/lib/validations/product"

async function requireManager(): Promise<{ error: string } | null> {
  const session = await auth()
  if (session?.user?.role !== "MANAGER") {
    return { error: "Unauthorized" }
  }
  return null
}

export async function createProduct(formData: FormData) {
  const authError = await requireManager()
  if (authError) return authError

  const parsed = createProductSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    categoryId: formData.get("categoryId"),
    reorderThreshold: formData.get("reorderThreshold"),
  })
  if (!parsed.success) {
    return { error: "Invalid input. Please check all fields." }
  }

  // SKU uniqueness check
  const existingSku = await prisma.product.findUnique({
    where: { sku: parsed.data.sku },
  })
  if (existingSku) {
    return { error: "SKU already exists." }
  }

  // Active category validation (race-condition guard after Zod parse)
  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
  })
  if (!category || !category.isActive) {
    return { error: "Selected category is not available." }
  }

  try {
    await prisma.product.create({
      data: {
        name: parsed.data.name,
        sku: parsed.data.sku,
        categoryId: parsed.data.categoryId,
        reorderThreshold: parsed.data.reorderThreshold,
        // currentStock intentionally excluded — @default(0) handles it (D-04)
      },
    })
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { error: "SKU already exists." }
    }
    return { error: "Failed to create product. Please try again." }
  }

  revalidatePath("/products")
  return { success: true }
}

export async function updateProduct(formData: FormData) {
  const authError = await requireManager()
  if (authError) return authError

  const parsed = updateProductSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    sku: formData.get("sku"),
    categoryId: formData.get("categoryId"),
    reorderThreshold: formData.get("reorderThreshold"),
  })
  if (!parsed.success) {
    return { error: "Invalid input. Please check all fields." }
  }

  // SKU uniqueness check excluding current product (NOT: { id } pattern)
  const existingSku = await prisma.product.findFirst({
    where: { sku: parsed.data.sku, NOT: { id: parsed.data.id } },
  })
  if (existingSku) {
    return { error: "SKU already exists." }
  }

  // Active category validation
  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
  })
  if (!category || !category.isActive) {
    return { error: "Selected category is not available." }
  }

  try {
    await prisma.product.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        sku: parsed.data.sku,
        categoryId: parsed.data.categoryId,
        reorderThreshold: parsed.data.reorderThreshold,
        // currentStock intentionally excluded — managed exclusively by Phase 3 (D-04)
      },
    })
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { error: "Product not found." }
    }
    return { error: "Failed to update product. Please try again." }
  }

  revalidatePath("/products")
  return { success: true }
}

export async function toggleProductActive(id: string, isActive: boolean) {
  const authError = await requireManager()
  if (authError) return authError

  try {
    await prisma.product.update({
      where: { id },
      data: { isActive },
    })
  } catch {
    return { error: "Failed to update product." }
  }

  revalidatePath("/products")
  return { success: true }
}
