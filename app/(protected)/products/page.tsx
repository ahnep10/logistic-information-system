import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import ProductsClient from "./products-client"

export default async function ProductsPage() {
  const [products, categories, session] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        category: { select: { id: true, name: true, isActive: true } },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    auth(),
  ])

  return (
    <ProductsClient
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        categoryId: p.categoryId,
        categoryName: p.category.name,
        categoryIsActive: p.category.isActive,
        reorderThreshold: p.reorderThreshold,
        currentStock: p.currentStock,
        isActive: p.isActive,
      }))}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
      }))}
      isManager={session?.user?.role === "MANAGER"}
    />
  )
}
