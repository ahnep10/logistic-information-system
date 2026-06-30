"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/validations/category"

async function requireManager() {
  const session = await auth()
  if (session?.user?.role !== "MANAGER") {
    throw new Error("Unauthorized — Manager role required")
  }
  return session
}

export async function createCategory(formData: FormData) {
  await requireManager()

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

  await prisma.category.create({
    data: { name: parsed.data.name },
  })

  revalidatePath("/categories")
  return { success: true }
}

export async function updateCategory(formData: FormData) {
  await requireManager()

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

  await prisma.category.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  })

  revalidatePath("/categories")
  return { success: true }
}

export async function toggleCategoryActive(id: string, isActive: boolean) {
  await requireManager()

  await prisma.category.update({
    where: { id },
    data: { isActive },
  })

  revalidatePath("/categories")
  return { success: true }
}
