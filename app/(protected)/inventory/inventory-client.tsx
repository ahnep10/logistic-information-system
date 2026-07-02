"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SearchX, ArrowLeftRight } from "lucide-react"

interface TransactionProduct {
  id: string
  name: string
  sku: string
}

interface TransactionUser {
  name: string | null
}

interface Transaction {
  id: string
  type: "STOCK_IN" | "STOCK_OUT"
  quantity: number
  reason: string
  notes: string | null
  createdAt: Date
  product: TransactionProduct
  createdBy: TransactionUser
}

interface FilterProduct {
  id: string
  name: string
}

interface CurrentParams {
  productId?: string
  from?: string
  to?: string
  type?: string
}

interface InventoryClientProps {
  transactions: Transaction[]
  products: FilterProduct[]
  currentParams: CurrentParams
}

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

export default function InventoryClient({
  transactions,
  products,
  currentParams,
}: InventoryClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateFilter(key: string, value: string | null) {
    const newParams = new URLSearchParams(searchParams.toString())
    if (value && value !== "all") {
      newParams.set(key, value)
    } else {
      newParams.delete(key)
    }
    router.push(`${pathname}?${newParams.toString()}`)
  }

  const hasActiveFilters = Boolean(
    currentParams.productId ||
      currentParams.from ||
      currentParams.to ||
      (currentParams.type && currentParams.type !== "all")
  )

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="text-xs font-semibold mb-1 block">Product</label>
          <Select
            value={currentParams.productId ?? "all"}
            onValueChange={(v) => updateFilter("productId", v)}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All Products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold mb-1 block">From</label>
          <Input
            type="date"
            className="w-40"
            value={currentParams.from ?? ""}
            onChange={(e) => updateFilter("from", e.target.value || null)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold mb-1 block">To</label>
          <Input
            type="date"
            className="w-40"
            value={currentParams.to ?? ""}
            onChange={(e) => updateFilter("to", e.target.value || null)}
          />
        </div>

        <Tabs
          value={currentParams.type ?? "all"}
          onValueChange={(v) => updateFilter("type", v)}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="STOCK_IN">Stock In</TabsTrigger>
            <TabsTrigger value="STOCK_OUT">Stock Out</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 170 }}>Date / Time</TableHead>
                <TableHead>Product</TableHead>
                <TableHead style={{ width: 110 }}>SKU</TableHead>
                <TableHead style={{ width: 72 }}>Type</TableHead>
                <TableHead style={{ width: 64 }} className="text-right">Qty</TableHead>
                <TableHead style={{ width: 160 }}>Reason</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead style={{ width: 120 }}>Recorded By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    {hasActiveFilters ? (
                      <div className="flex flex-col items-center py-12 text-center">
                        <SearchX className="w-8 h-8 text-muted-foreground/30 mb-3" />
                        <p className="text-sm font-medium">No transactions found</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Try adjusting the filters or date range.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-12 text-center">
                        <ArrowLeftRight className="w-8 h-8 text-muted-foreground/30 mb-3" />
                        <p className="text-sm font-medium">No transactions recorded yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Stock movements will appear here after the first transaction.
                        </p>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm w-[170px]">{formatDateTime(tx.createdAt)}</TableCell>
                    <TableCell className="text-sm font-medium">{tx.product.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono w-[110px]">
                      {tx.product.sku}
                    </TableCell>
                    <TableCell className="w-[72px]">
                      <Badge className={getTypeBadgeClass(tx.type)}>
                        {tx.type === "STOCK_IN" ? "IN" : "OUT"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold w-16">{tx.quantity}</TableCell>
                    <TableCell className="text-sm w-[160px]">{tx.reason}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tx.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground w-[120px]">
                      {tx.createdBy.name ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
