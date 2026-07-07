import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import {
  resolveReportType,
  resolveDateRange,
  groupTransactionsByProduct,
} from "@/lib/utils/reports"
import ReportsClient, {
  type InventoryRow,
  type MovementGroup,
  type PurchaseOrderRow,
} from "./reports-client"

type SearchParams = { type?: string; from?: string; to?: string }
type Props = { searchParams: Promise<SearchParams> }

export default async function ReportsPage({ searchParams }: Props) {
  const params = await searchParams
  const activeType = resolveReportType(params.type)

  let inventoryRows: InventoryRow[] = []
  let movementGroups: MovementGroup[] = []
  let purchaseOrderRows: PurchaseOrderRow[] = []

  if (activeType === "inventory") {
    // REPT-01: all products, active and inactive — no isActive filter (D-Claude's
    // Discretion, matches REPT-01's literal "for all products" wording).
    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
      include: { category: { select: { name: true } } },
    })

    inventoryRows = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      categoryName: p.category.name,
      reorderThreshold: p.reorderThreshold,
      currentStock: p.currentStock,
      isActive: p.isActive,
    }))
  } else if (activeType === "movements") {
    // REPT-02/D-07/D-08: malformed from/to silently falls back to the 30-day
    // default (closes T-03-11 for this new surface) — never throws.
    const { gte, lte } = resolveDateRange(params.from, params.to)

    const transactions = await prisma.stockTransaction.findMany({
      where: { createdAt: { gte, lte } },
      orderBy: [{ product: { name: "asc" } }, { createdAt: "desc" }],
      include: {
        product: { select: { id: true, name: true, sku: true } },
        createdBy: { select: { name: true } },
      },
    })

    movementGroups = groupTransactionsByProduct(transactions)
  } else {
    // REPT-03/D-10/D-11: all three statuses always included, no status filter.
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        supplier: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    })

    purchaseOrderRows = purchaseOrders.map((po) => ({
      ...po,
      totalAmount: po.totalAmount.toNumber(),
    }))
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Reports</h1>
      <Suspense
        fallback={
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        }
      >
        <ReportsClient
          activeType={activeType}
          currentParams={params}
          inventoryRows={inventoryRows}
          movementGroups={movementGroups}
          purchaseOrderRows={purchaseOrderRows}
        />
      </Suspense>
    </div>
  )
}
