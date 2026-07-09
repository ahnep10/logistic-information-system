import { prisma } from "@/lib/prisma"
import { getTodayUtcRange, fillPoStatusCounts } from "@/lib/utils/dashboard"
import DashboardClient from "./dashboard-client"

export default async function DashboardPage() {
  const { start, end } = getTodayUtcRange()

  const [
    totalProducts,
    totalSuppliers,
    movementsToday,
    lowStockCount,
    poStatusGroups,
    topSellingGroups,
  ] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.supplier.count({ where: { isActive: true } }),
    prisma.stockTransaction.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.product.count({
      where: {
        isActive: true,
        currentStock: { lte: prisma.product.fields.reorderThreshold },
      },
    }),
    prisma.purchaseOrder.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.stockTransaction.groupBy({
      by: ["productId"],
      where: { type: "STOCK_OUT" },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 6,
    }),
  ])

  const poStatusCounts = fillPoStatusCounts(poStatusGroups)

  const topSellingProductIds = topSellingGroups.map((g) => g.productId)
  const topSellingProductRecords =
    topSellingProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: topSellingProductIds } },
          select: { id: true, name: true },
        })
      : []
  const productNameById = new Map(topSellingProductRecords.map((p) => [p.id, p.name]))
  const topSellingProducts = topSellingGroups.map((g) => ({
    productId: g.productId,
    name: productNameById.get(g.productId) ?? "",
    totalSold: g._sum.quantity ?? 0,
  }))

  return (
    <DashboardClient
      totalProducts={totalProducts}
      totalSuppliers={totalSuppliers}
      movementsToday={movementsToday}
      lowStockCount={lowStockCount}
      poStatusCounts={poStatusCounts}
      topSellingProducts={topSellingProducts}
    />
  )
}
