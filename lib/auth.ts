// lib/auth.ts — Full Auth.js instance. Node.js only.
// Has bcrypt, prisma, Credentials provider.
// NEVER import this file from middleware.ts — use auth.config.ts there instead.
// Source: authjs.dev/reference/nextjs
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import authConfig from "@/auth.config"
import { loginSchema } from "@/lib/validations/auth"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        })
        // D-03: deactivated users cannot log in (T-1-04 mitigation)
        if (!user || !user.isActive) return null

        const passwordValid = await compare(
          parsed.data.password,
          user.passwordHash
        )
        if (!passwordValid) return null

        // Return only safe fields — NEVER include passwordHash (T-1-04 mitigation)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role, // Forward role for RBAC
        }
      },
    }),
  ],
})
