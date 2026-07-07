"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Download, Package, ArrowLeftRight, ClipboardList } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { getSeverityBadge } from "@/lib/utils/severity"
import { getStatusBadge, type POStatus } from "@/lib/utils/po-status"
import { formatPONumber } from "@/lib/utils/po-number"

// Duplicated verbatim from purchase-orders-client.tsx's own currencyFormatter
// instance, per UI-SPEC's explicit sanction rather than sharing a new util for
// one constant.
const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
})

// Duplicated verbatim from inventory-client.tsx (Don't Hand-Roll sanctions this
// exact duplication since neither is exported from a shared module).
function getTypeBadgeClass(type: "STOCK_IN" | "STOCK_OUT") {
  return type === "STOCK_IN"
    ? "bg-green-100 text-green-700 border border-green-200 hover:bg-green-100"
    : "bg-red-100 text-red-700 border border-red-200 hover:bg-red-100"
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export interface InventoryRow {
  id: string
  name: string
  sku: string
  categoryName: string
  reorderThreshold: number
  currentStock: number
  isActive: boolean
}

export interface MovementTransaction {
  id: string
  type: "STOCK_IN" | "STOCK_OUT"
  quantity: number
  reason: string
  notes: string | null
  createdAt: Date
  createdBy: { name: string | null }
}

export interface MovementGroup {
  productId: string
  productName: string
  sku: string
  transactions: MovementTransaction[]
}

export interface PurchaseOrderRow {
  id: string
  poNumber: number
  status: POStatus
  totalAmount: number
  createdAt: Date
  supplier: { name: string }
  createdBy: { name: string | null }
}

interface ReportsClientProps {
  activeType: "inventory" | "movements" | "purchase-orders"
  currentParams: { from?: string; to?: string }
  inventoryRows: InventoryRow[]
  movementGroups: MovementGroup[]
  purchaseOrderRows: PurchaseOrderRow[]
}

export default function ReportsClient({
  activeType,
  currentParams,
  inventoryRows,
  movementGroups,
  purchaseOrderRows,
}: ReportsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Duplicated from inventory-client.tsx's updateFilter() body shape — reads
  // useSearchParams(), sets/deletes the key, router.push to the same pathname
  // with the new query string (the existing ?type=movements param is preserved
  // automatically since it's already in the current search string).
  function updateFilter(key: string, value: string) {
    const newParams = new URLSearchParams(searchParams.toString())
    if (value) {
      newParams.set(key, value)
    } else {
      newParams.delete(key)
    }
    router.push(`${pathname}?${newParams.toString()}`)
  }

  return (
    <div>
      <Tabs
        value={activeType}
        onValueChange={(v) => router.push(`/reports?type=${v}`)}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeType === "movements" && (
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="text-xs font-semibold mb-1 block">From</label>
            <Input
              type="date"
              className="w-40"
              value={currentParams.from ?? ""}
              onChange={(e) => updateFilter("from", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block">To</label>
            <Input
              type="date"
              className="w-40"
              value={currentParams.to ?? ""}
              onChange={(e) => updateFilter("to", e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-end mb-4">
        {activeType === "inventory" && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href="/api/reports/inventory" download />}
          >
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        )}
        {activeType === "movements" && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a
                href={`/api/reports/movements?from=${currentParams.from ?? ""}&to=${currentParams.to ?? ""}`}
                download
              />
            }
          >
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        )}
        {activeType === "purchase-orders" && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href="/api/reports/purchase-orders" download />}
          >
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        )}
      </div>

      {activeType === "movements" &&
        (movementGroups.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center py-12 text-center">
              <ArrowLeftRight className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">
                No transactions in this date range
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Try a different date range, or check the Inventory report for
                current stock levels.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {movementGroups.map((group) => (
              <Card key={group.productId}>
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold">
                      {group.productName}
                    </span>
                    <span className="text-sm text-muted-foreground font-mono ml-2">
                      {group.sku}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {group.transactions.length} transaction
                    {group.transactions.length === 1 ? "" : "s"}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead style={{ width: 170 }}>Date / Time</TableHead>
                      <TableHead style={{ width: 72 }}>Type</TableHead>
                      <TableHead style={{ width: 64 }} className="text-right">
                        Qty
                      </TableHead>
                      <TableHead style={{ width: 160 }}>Reason</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead style={{ width: 120 }}>
                        Recorded By
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm w-[170px]">
                          {formatDateTime(tx.createdAt)}
                        </TableCell>
                        <TableCell className="w-[72px]">
                          <Badge className={getTypeBadgeClass(tx.type)}>
                            {tx.type === "STOCK_IN" ? "IN" : "OUT"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold w-16">
                          {tx.quantity}
                        </TableCell>
                        <TableCell className="text-sm w-[160px]">
                          {tx.reason}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.notes ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground w-[120px]">
                          {tx.createdBy.name ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ))}
          </div>
        ))}

      {activeType === "inventory" && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead style={{ width: 120 }}>SKU</TableHead>
                <TableHead style={{ width: 140 }}>Category</TableHead>
                <TableHead style={{ width: 80 }} className="text-right">
                  Threshold
                </TableHead>
                <TableHead style={{ width: 80 }} className="text-right">
                  Stock
                </TableHead>
                <TableHead style={{ width: 100 }}>Severity</TableHead>
                <TableHead style={{ width: 100 }}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventoryRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="flex flex-col items-center py-12 text-center">
                      <Package className="w-8 h-8 text-zinc-300 mb-3" />
                      <p className="text-sm font-medium text-zinc-900">
                        No products yet
                      </p>
                      <p className="text-sm text-zinc-500 mt-1">
                        Create a product to start tracking inventory.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                inventoryRows.map((row) => {
                  const severity = getSeverityBadge(
                    row.currentStock,
                    row.reorderThreshold
                  )
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm font-medium">
                        {row.name}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-500 font-mono">
                        {row.sku}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.categoryName}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.reorderThreshold}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {row.currentStock}
                      </TableCell>
                      <TableCell>
                        <Badge className={severity.className}>
                          {severity.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={row.isActive ? "default" : "secondary"}
                        >
                          {row.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {activeType === "purchase-orders" && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 100 }}>PO #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead style={{ width: 100 }}>Status</TableHead>
                <TableHead style={{ width: 140 }} className="text-right">
                  Total
                </TableHead>
                <TableHead style={{ width: 140 }}>Created</TableHead>
                <TableHead style={{ width: 120 }}>Created By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrderRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex flex-col items-center py-12 text-center">
                      <ClipboardList className="w-8 h-8 text-muted-foreground/30 mb-3" />
                      <p className="text-sm font-medium">
                        No purchase orders yet
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Create a purchase order to start tracking procurement.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                purchaseOrderRows.map((po) => {
                  const badge = getStatusBadge(po.status)
                  return (
                    <TableRow key={po.id}>
                      <TableCell className="text-sm font-medium">
                        {formatPONumber(po.poNumber)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {po.supplier.name}
                      </TableCell>
                      <TableCell>
                        <Badge className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {currencyFormatter.format(po.totalAmount)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(po.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {po.createdBy.name ?? "—"}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
