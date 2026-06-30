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
