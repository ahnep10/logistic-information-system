// lib/prisma.ts — Prisma Client singleton
// Prevents multiple PrismaClient instances during Next.js development hot reload
// Source: prisma.io/docs/orm/more/troubleshooting/nextjs
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
