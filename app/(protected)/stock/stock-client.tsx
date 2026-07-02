"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, PackagePlus, PackageMinus, ArrowLeftRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  stockInSchema,
  stockOutSchema,
  type StockInInput,
  type StockOutInput,
} from "@/lib/validations/stock-transaction"
import { recordStockIn, recordStockOut } from "@/actions/stock-transactions"

interface Product {
  id: string
  name: string
  sku: string
}

interface RecentTransaction {
  id: string
  type: "STOCK_IN" | "STOCK_OUT"
  quantity: number
  reason: string
  createdAt: Date
  product: { name: string; sku: string }
  createdBy: { name: string | null }
}

interface StockClientProps {
  recentTransactions: RecentTransaction[]
  products: Product[]
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

export default function StockClient({ recentTransactions, products }: StockClientProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Record Stock</h1>
      </div>

      <div className="flex gap-3 mb-8">
        <RecordStockInDialog products={products} />
        <RecordStockOutDialog products={products} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 160 }}>Date / Time</TableHead>
                <TableHead>Product</TableHead>
                <TableHead style={{ width: 72 }}>Type</TableHead>
                <TableHead style={{ width: 64 }} className="text-right">Qty</TableHead>
                <TableHead style={{ width: 160 }}>Reason</TableHead>
                <TableHead style={{ width: 128 }}>Recorded By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex flex-col items-center py-12 text-center">
                      <ArrowLeftRight className="w-8 h-8 text-muted-foreground/30 mb-3" />
                      <p className="text-sm font-medium">No transactions yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Record a stock movement to see it here.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                recentTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">{formatDateTime(tx.createdAt)}</TableCell>
                    <TableCell className="text-sm font-medium">{tx.product.name}</TableCell>
                    <TableCell>
                      <Badge className={getTypeBadgeClass(tx.type)}>
                        {tx.type === "STOCK_IN" ? "IN" : "OUT"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">{tx.quantity}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.reason}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
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

// ── Record Stock In Dialog ───────────────────────────────────────────────────

function RecordStockInDialog({ products }: { products: Product[] }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<StockInInput>({
    resolver: zodResolver(stockInSchema) as any,
    defaultValues: { productId: "", quantity: 1, reason: "Purchase Received", notes: "" },
  })

  async function onSubmit(values: StockInInput) {
    setServerError(null)
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => fd.append(k, String(v ?? "")))
    const result = await recordStockIn(fd)
    if (result && "error" in result && result.error) {
      setServerError(typeof result.error === "string" ? result.error : "An error occurred.")
      return
    }
    form.reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="default">
            <PackagePlus className="h-4 w-4 mr-2" />
            Record Stock In
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Stock In</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} placeholder="Enter quantity" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Purchase Received">Purchase Received</SelectItem>
                        <SelectItem value="Return">Return</SelectItem>
                        <SelectItem value="Manual Adjustment">Manual Adjustment</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Optional notes" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline">Discard</Button>} />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  "Record Stock In"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Record Stock Out Dialog ──────────────────────────────────────────────────

function RecordStockOutDialog({ products }: { products: Product[] }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<StockOutInput>({
    resolver: zodResolver(stockOutSchema) as any,
    defaultValues: { productId: "", quantity: 1, reason: "Sale", notes: "" },
  })

  async function onSubmit(values: StockOutInput) {
    setServerError(null)
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => fd.append(k, String(v ?? "")))
    const result = await recordStockOut(fd)
    if (result && "error" in result && result.error) {
      setServerError(typeof result.error === "string" ? result.error : "An error occurred.")
      return
    }
    form.reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="default">
            <PackageMinus className="h-4 w-4 mr-2" />
            Record Stock Out
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Stock Out</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} placeholder="Enter quantity" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sale">Sale</SelectItem>
                        <SelectItem value="Manual Adjustment">Manual Adjustment</SelectItem>
                        <SelectItem value="Write-Off">Write-Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Optional notes" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline">Discard</Button>} />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  "Record Stock Out"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
