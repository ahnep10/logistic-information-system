"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hash, compare } from "bcryptjs"
import {
  createUserSchema,
  editUserSchema,
  changePasswordSchema,
} from "@/lib/validations/user"
import { revalidatePath } from "next/cache"

async function requireManager() {
  const session = await auth()
  if (session?.user?.role !== "MANAGER") {
    throw new Error("Unauthorized — Manager role required")
  }
  return session
}

export async function createUser(formData: FormData) {
  await requireManager()

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { error: "Invalid input. Please check all fields." }
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  })
  if (existing) {
    return { error: "Email already in use." }
  }

  const passwordHash = await hash(parsed.data.password, 12)
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash,
    },
  })

  revalidatePath("/users")
  return { success: true }
}

export async function updateUser(formData: FormData) {
  await requireManager()

  const parsed = editUserSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    newPassword: formData.get("newPassword") || undefined,
  })
  if (!parsed.success) {
    return { error: "Invalid input. Please check all fields." }
  }

  const updateData: {
    name: string
    email: string
    role: "MANAGER" | "STAFF"
    passwordHash?: string
  } = {
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
  }

  if (parsed.data.newPassword) {
    updateData.passwordHash = await hash(parsed.data.newPassword, 12)
  }

  await prisma.user.update({
    where: { id: parsed.data.id },
    data: updateData,
  })

  revalidatePath("/users")
  return { success: true }
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  await requireManager()

  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  })

  revalidatePath("/users")
  return { success: true }
}

export async function changeOwnPassword(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthenticated")
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user) {
    return { error: "User not found." }
  }

  const valid = await compare(parsed.data.currentPassword, user.passwordHash)
  if (!valid) {
    return { error: { currentPassword: ["Current password is incorrect."] } }
  }

  const passwordHash = await hash(parsed.data.newPassword, 12)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  })

  return { success: true }
}
