"use server"
import { signIn, signOut } from "@/lib/auth"
import { loginSchema } from "@/lib/validations/auth"
import { AuthError } from "next-auth"
import { redirect } from "next/navigation"

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { error: "Invalid email or password. Please check your credentials." }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password. Please check your credentials." }
    }
    throw error
  }

  redirect("/") // middleware intercepts and routes to /dashboard (MANAGER) or /inventory (STAFF)
}

export async function logout() {
  await signOut({ redirectTo: "/login" })
}
