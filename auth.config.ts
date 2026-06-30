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
  },
  providers: [], // Credentials provider goes in lib/auth.ts — NOT here
} satisfies NextAuthConfig
