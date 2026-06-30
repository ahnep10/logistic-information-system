"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "@/lib/validations/supplier"

async function requireManager() {
  const session = await auth()
  if (session?.user?.role !== "MANAGER") {
    throw new Error("Unauthorized — Manager role required")
  }
  return session
}

export async function createSupplier(formData: FormData) {
  await requireManager()

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

  await prisma.supplier.create({
    data: {
      name: parsed.data.name,
      contactPerson: parsed.data.contactPerson,
      phone: parsed.data.phone,
      email: parsed.data.email,
      address: parsed.data.address,
    },
  })

  revalidatePath("/suppliers")
  return { success: true }
}

export async function updateSupplier(formData: FormData) {
  await requireManager()

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

  revalidatePath("/suppliers")
  return { success: true }
}

export async function toggleSupplierActive(id: string, isActive: boolean) {
  await requireManager()

  await prisma.supplier.update({
    where: { id },
    data: { isActive },
  })

  revalidatePath("/suppliers")
  return { success: true }
}
