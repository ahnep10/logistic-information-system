"use server"
import { auth } from "@/lib/auth"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "@/lib/validations/supplier"

async function requireManager(): Promise<{ error: string } | null> {
  const session = await auth()
  if (session?.user?.role !== "MANAGER") {
    return { error: "Unauthorized" }
  }
  return null
}

export async function createSupplier(formData: FormData) {
  const authError = await requireManager()
  if (authError) return authError

  const parsed = createSupplierSchema.safeParse({
    name: formData.get("name"),
    contactPerson: formData.get("contactPerson"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
  })
  if (!parsed.success) {
    return { error: "Invalid input. Please check all fields." }
  }

  try {
    await prisma.supplier.create({
      data: {
        name: parsed.data.name,
        contactPerson: parsed.data.contactPerson,
        phone: parsed.data.phone,
        email: parsed.data.email,
        address: parsed.data.address,
      },
    })
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { error: "A supplier with this information already exists." }
    }
    return { error: "Failed to create supplier. Please try again." }
  }

  revalidatePath("/suppliers")
  return { success: true }
}

export async function updateSupplier(formData: FormData) {
  const authError = await requireManager()
  if (authError) return authError

  const parsed = updateSupplierSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    contactPerson: formData.get("contactPerson"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
  })
  if (!parsed.success) {
    return { error: "Invalid input. Please check all fields." }
  }

  try {
    await prisma.supplier.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        contactPerson: parsed.data.contactPerson,
        phone: parsed.data.phone,
        email: parsed.data.email,
        address: parsed.data.address,
      },
    })
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { error: "Supplier not found." }
    }
    return { error: "Failed to update supplier. Please try again." }
  }

  revalidatePath("/suppliers")
  return { success: true }
}

export async function toggleSupplierActive(id: string, isActive: boolean) {
  const authError = await requireManager()
  if (authError) return authError

  try {
    await prisma.supplier.update({
      where: { id },
      data: { isActive },
    })
  } catch {
    return { error: "Failed to update supplier." }
  }

  revalidatePath("/suppliers")
  return { success: true }
}
