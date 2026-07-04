"use client"

import { useState } from "react"
import Link from "next/link"
import { PackagePlus, ClipboardList } from "lucide-react"

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

import { getStatusBadge, type POStatus } from "@/lib/utils/po-status"
import { formatPONumber } from "@/lib/utils/po-number"

interface PurchaseOrder {
  id: string
  poNumber: number
  status: POStatus
  totalAmount: number
  createdAt: Date
  supplier: { name: string }
  createdBy: { name: string }
}

interface PurchaseOrdersClientProps {
  purchaseOrders: PurchaseOrder[]
}

type FilterTab = "all" | "draft" | "ordered" | "received"

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
})

export default function PurchaseOrdersClient({ purchaseOrders }: PurchaseOrdersClientProps) {
  const [filter, setFilter] = useState<FilterTab>("all")

  const visiblePurchaseOrders = purchaseOrders.filter((po) => {
    if (filter === "all") return true
    return po.status.toLowerCase() === filter
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Purchase Orders</h1>
        <Button className="bg-primary" nativeButton={false} render={<Link href="/purchase-orders/new" />}>
          <PackagePlus className="h-4 w-4 mr-2" />
          Create Purchase Order
        </Button>
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as FilterTab)}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="ordered">Ordered</TabsTrigger>
          <TabsTrigger value="received">Received</TabsTrigger>
        </TabsList>
      </Tabs>

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
            {visiblePurchaseOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-center py-12 text-center">
                    <ClipboardList className="w-8 h-8 text-muted-foreground/30 mb-3" />
                    {purchaseOrders.length === 0 ? (
                      <>
                        <p className="text-sm font-medium">No purchase orders yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Create a purchase order to start tracking procurement.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">
                          No {filter} purchase orders
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Try a different filter tab.
                        </p>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              visiblePurchaseOrders.map((po) => {
                const badge = getStatusBadge(po.status)
                return (
                  <TableRow key={po.id} className="cursor-pointer hover:bg-muted/50 p-0">
                    <TableCell className="p-0">
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="block px-4 py-3 text-sm font-medium"
                      >
                        {formatPONumber(po.poNumber)}
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="block px-4 py-3 text-sm font-medium"
                      >
                        {po.supplier.name}
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="flex items-center px-4 py-3"
                      >
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="p-0 text-right">
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="block px-4 py-3 text-sm font-semibold"
                      >
                        {currencyFormatter.format(po.totalAmount)}
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="block px-4 py-3 text-sm text-muted-foreground"
                      >
                        {new Date(po.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="block px-4 py-3 text-sm text-muted-foreground"
                      >
                        {po.createdBy.name}
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
