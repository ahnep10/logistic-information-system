// auth.config.ts — Edge-safe. NO bcrypt, NO prisma imports.
// This file is imported by middleware.ts which runs on the Edge runtime.
// Source: authjs.dev/guides/edge-compatibility
import type { NextAuthConfig } from "next-auth"

export default {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth }) {
      // This runs in middleware to check JWT validity only
      const isLoggedIn = !!auth?.user
      return isLoggedIn
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  providers: [], // Credentials provider goes in lib/auth.ts — NOT here
} satisfies NextAuthConfig
