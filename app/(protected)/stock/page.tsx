import { prisma } from "@/lib/prisma"
import StockClient from "./stock-client"

export default async function StockPage() {
  const [recentTransactions, activeProducts] = await Promise.all([
    prisma.stockTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
  ])

  return (
    <StockClient
      recentTransactions={recentTransactions}
      products={activeProducts}
    />
  )
}
