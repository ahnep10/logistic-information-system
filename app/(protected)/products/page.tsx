import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import ProductsClient from "./products-client"

type SearchParams = {
  stock?: string
}

type Props = {
  searchParams: Promise<SearchParams>
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams

  // DASH-02 | RESEARCH.md Pitfall 2: whitelist match on the exact literal "low" only —
  // any other value (wrong case, unrelated truthy string) or absence falls back to the
  // unfiltered default, never throws.
  const isLowStockFiltered = params.stock === "low"

  const productWhere: Prisma.ProductWhereInput = isLowStockFiltered
    ? {
        isActive: true,
        currentStock: { lte: prisma.product.fields.reorderThreshold },
      }
    : {}

  const [products, categories, session] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
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
      isLowStockFiltered={isLowStockFiltered}
      lowStockCount={products.length}
    />
  )
}
