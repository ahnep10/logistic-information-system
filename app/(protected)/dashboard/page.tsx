import { prisma } from "@/lib/prisma"
import { getTodayUtcRange, fillPoStatusCounts } from "@/lib/utils/dashboard"
import DashboardClient from "./dashboard-client"

export default async function DashboardPage() {
  const { start, end } = getTodayUtcRange()

  const [totalProducts, totalSuppliers, movementsToday, lowStockCount, poStatusGroups] =
    await Promise.all([
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
    ])

  const poStatusCounts = fillPoStatusCounts(poStatusGroups)

  return (
    <DashboardClient
      totalProducts={totalProducts}
      totalSuppliers={totalSuppliers}
      movementsToday={movementsToday}
      lowStockCount={lowStockCount}
      poStatusCounts={poStatusCounts}
    />
  )
}
