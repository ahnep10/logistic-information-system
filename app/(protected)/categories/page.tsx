import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import CategoriesClient from "./categories-client"

export default async function CategoriesPage() {
  const [categories, session] = await Promise.all([
    prisma.category.findMany({ orderBy: { createdAt: "asc" } }),
    auth(),
  ])

  return (
    <CategoriesClient
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        isActive: c.isActive,
      }))}
      isManager={session?.user?.role === "MANAGER"}
    />
  )
}
