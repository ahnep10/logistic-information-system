import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import { resolveReportType } from "@/lib/utils/reports"
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
  const movementGroups: MovementGroup[] = []
  const purchaseOrderRows: PurchaseOrderRow[] = []

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
