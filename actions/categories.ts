"use server"
import { auth } from "@/lib/auth"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/validations/category"

async function requireManager(): Promise<{ error: string } | null> {
  const session = await auth()
  if (session?.user?.role !== "MANAGER") {
    return { error: "Unauthorized" }
  }
  return null
}

export async function createCategory(formData: FormData) {
  const authError = await requireManager()
  if (authError) return authError

  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
  })
  if (!parsed.success) {
    return { error: "Invalid input. Please check all fields." }
  }

  const existing = await prisma.category.findFirst({
    where: { name: { equals: parsed.data.name, mode: "insensitive" } },
  })
  if (existing) {
    return { error: "Category name already exists." }
  }

  try {
    await prisma.category.create({
      data: { name: parsed.data.name },
    })
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { error: "Category name already exists." }
    }
    return { error: "Failed to create category. Please try again." }
  }

  revalidatePath("/categories")
  return { success: true }
}

export async function updateCategory(formData: FormData) {
  const authError = await requireManager()
  if (authError) return authError

  const parsed = updateCategorySchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  })
  if (!parsed.success) {
    return { error: "Invalid input. Please check all fields." }
  }

  const existing = await prisma.category.findFirst({
    where: {
      name: { equals: parsed.data.name, mode: "insensitive" },
      NOT: { id: parsed.data.id },
    },
  })
  if (existing) {
    return { error: "Category name already exists." }
  }

  try {
    await prisma.category.update({
      where: { id: parsed.data.id },
      data: { name: parsed.data.name },
    })
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { error: "Category not found." }
    }
    return { error: "Failed to update category. Please try again." }
  }

  revalidatePath("/categories")
  return { success: true }
}

export async function toggleCategoryActive(id: string, isActive: boolean) {
  const authError = await requireManager()
  if (authError) return authError

  try {
    await prisma.category.update({
      where: { id },
      data: { isActive },
    })
  } catch {
    return { error: "Failed to update category." }
  }

  revalidatePath("/categories")
  return { success: true }
}
