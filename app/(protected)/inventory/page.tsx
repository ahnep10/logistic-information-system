import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import InventoryClient from "./inventory-client"

type SearchParams = {
  productId?: string
  from?: string
  to?: string
  type?: string
}

type Props = {
  searchParams: Promise<SearchParams>
}

export default async function InventoryPage({ searchParams }: Props) {
  const params = await searchParams

  const where: Prisma.StockTransactionWhereInput = {}

  if (params.productId) {
    where.productId = params.productId
  }
  if (params.type === "STOCK_IN") {
    where.type = "STOCK_IN"
  } else if (params.type === "STOCK_OUT") {
    where.type = "STOCK_OUT"
  }

  if (params.from || params.to) {
    where.createdAt = {}
    if (params.from) {
      where.createdAt.gte = new Date(`${params.from}T00:00:00.000Z`)
    }
    if (params.to) {
      where.createdAt.lte = new Date(`${params.to}T23:59:59.999Z`)
    }
  } else {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    where.createdAt = { gte: thirtyDaysAgo }
  }

  const [transactions, products] = await Promise.all([
    prisma.stockTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Inventory History</h1>
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
        <InventoryClient
          transactions={transactions}
          products={products}
          currentParams={params}
        />
      </Suspense>
    </div>
  )
}
