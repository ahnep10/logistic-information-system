"use client"

// This file combines a server-fetched data layer (via a parent server component)
// with client-side dialogs. We use a single client component approach for the full
// page since dialogs require client state.

// NOTE: Because Next.js App Router requires server components to be async and client
// components to handle interactivity, this page is split into:
//   - UsersPage (default export) — server component fetching data
//   - UsersClient — client component rendering table + dialogs

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import UsersClient from "./users-client"

export default async function UsersPage() {
  const [users, session] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    auth(),
  ])

  return (
    <UsersClient
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as "MANAGER" | "STAFF",
        isActive: u.isActive,
      }))}
      currentUserId={session?.user?.id ?? ""}
    />
  )
}
