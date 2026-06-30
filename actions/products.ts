"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  createProductSchema,
  updateProductSchema,
} from "@/lib/validations/product"

async function requireManager() {
  const session = await auth()
  if (session?.user?.role !== "MANAGER") {
    throw new Error("Unauthorized — Manager role required")
  }
  return session
}

export async function createProduct(formData: FormData) {
  await requireManager()

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

  await prisma.product.create({
    data: {
      name: parsed.data.name,
      sku: parsed.data.sku,
      categoryId: parsed.data.categoryId,
      reorderThreshold: parsed.data.reorderThreshold,
      // currentStock intentionally excluded — @default(0) handles it (D-04)
    },
  })

  revalidatePath("/products")
  return { success: true }
}

export async function updateProduct(formData: FormData) {
  await requireManager()

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

  revalidatePath("/products")
  return { success: true }
}

export async function toggleProductActive(id: string, isActive: boolean) {
  await requireManager()

  await prisma.product.update({
    where: { id },
    data: { isActive },
  })

  revalidatePath("/products")
  return { success: true }
}
