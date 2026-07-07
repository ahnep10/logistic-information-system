"use client"

import { useRouter } from "next/navigation"
import { Download, Package } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
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
  status: "DRAFT" | "ORDERED" | "RECEIVED"
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
  inventoryRows,
}: ReportsClientProps) {
  const router = useRouter()

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
      </div>

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
    </div>
  )
}
