// types/next-auth.d.ts — TypeScript module augmentation for Auth.js v5
// Extends session.user with id and role so they are strongly typed throughout the codebase
import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    role: string
  }
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
  }
}
