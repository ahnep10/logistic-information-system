"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, PackageCheck, Loader2 } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import { getStatusBadge, type POStatus } from "@/lib/utils/po-status"
import { formatPONumber } from "@/lib/utils/po-number"
import {
  confirmPurchaseOrder,
  deletePurchaseOrder,
  receivePurchaseOrder,
} from "@/actions/purchase-orders"
import PurchaseOrderForm from "../po-form-client"

interface Supplier {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  sku: string
}

interface DetailLineItem {
  id: string
  productId: string
  product: { id: string; name: string; sku: string; isActive: boolean }
  quantity: number
  unitPrice: number
  receivedQuantity: number | null
}

interface DetailPO {
  id: string
  poNumber: number
  status: POStatus
  supplierId: string
  supplier: { name: string }
  createdBy: { name: string }
  createdAt: string | Date
  totalAmount: number
  lineItems: DetailLineItem[]
}

interface PurchaseOrderDetailClientProps {
  po: DetailPO
  suppliers: Supplier[]
  products: Product[]
}

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
})

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function productLabel(product: { name: string; sku: string }) {
  return `${product.name} (${product.sku})`
}

// ── Confirm Order AlertDialog ───────────────────────────────────────────────

function ConfirmOrderDialog({
  poId,
  onError,
}: {
  poId: string
  onError: (msg: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleConfirm() {
    setPending(true)
    onError(null)
    try {
      const result = await confirmPurchaseOrder(poId)
      if (result && "error" in result && result.error) {
        onError(result.error)
      }
    } catch {
      onError("Failed to confirm purchase order. Please try again.")
    } finally {
      setPending(false)
      setOpen(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button className="bg-primary">Confirm Order</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm this purchase order?</AlertDialogTitle>
          <AlertDialogDescription>
            Once confirmed, line items can no longer be edited. You can still adjust
            received quantities later when the goods arrive.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction className="bg-primary" onClick={handleConfirm} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Order
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Delete Draft AlertDialog ─────────────────────────────────────────────────

function DeleteDraftDialog({
  poId,
  onError,
}: {
  poId: string
  onError: (msg: string | null) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    setPending(true)
    onError(null)
    try {
      const result = await deletePurchaseOrder(poId)
      if (result && "error" in result && result.error) {
        onError(result.error)
        return
      }
      router.push("/purchase-orders")
      return
    } catch {
      onError("Failed to delete purchase order. Please try again.")
    } finally {
      setPending(false)
      setOpen(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Draft
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this purchase order?</AlertDialogTitle>
          <AlertDialogDescription>
            This draft has not been ordered yet. Deleting it is permanent and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Draft
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PurchaseOrderDetailClient({
  po,
  suppliers,
  products,
}: PurchaseOrderDetailClientProps) {
  const router = useRouter()
  const [actionError, setActionError] = useState<string | null>(null)
  const [receiveMode, setReceiveMode] = useState(false)
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const badge = getStatusBadge(po.status)

  function enterReceiveMode() {
    setActionError(null)
    setReceivedQuantities(
      Object.fromEntries(po.lineItems.map((li) => [li.id, String(li.quantity)]))
    )
    setReceiveMode(true)
  }

  function cancelReceive() {
    setActionError(null)
    setReceiveMode(false)
  }

  async function handleConfirmReceipt() {
    setSubmitting(true)
    setActionError(null)

    const fd = new FormData()
    fd.append(
      "lineItems",
      JSON.stringify(
        po.lineItems.map((li) => ({
          lineItemId: li.id,
          receivedQuantity: Number(receivedQuantities[li.id] ?? 0),
        }))
      )
    )

    try {
      const result = await receivePurchaseOrder(po.id, fd)
      if (result && "error" in result && result.error) {
        setActionError(result.error)
        return
      }
      router.refresh()
    } catch {
      setActionError("Failed to receive purchase order. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const orderedTotal = po.lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPrice,
    0
  )

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <h1 className="text-2xl font-semibold">{formatPONumber(po.poNumber)}</h1>
          <Badge className={`${badge.className} ml-3`}>{badge.label}</Badge>
        </div>
        <div className="flex items-center gap-3">
          {po.status === "DRAFT" && (
            <>
              <DeleteDraftDialog poId={po.id} onError={setActionError} />
              <ConfirmOrderDialog poId={po.id} onError={setActionError} />
            </>
          )}
          {po.status === "ORDERED" && !receiveMode && (
            <Button className="bg-primary" onClick={enterReceiveMode}>
              <PackageCheck className="h-4 w-4 mr-2" />
              Receive Goods
            </Button>
          )}
        </div>
      </div>

      {actionError && <p className="text-sm text-destructive mb-4">{actionError}</p>}

      {po.status === "DRAFT" ? (
        <PurchaseOrderForm
          mode="edit"
          purchaseOrder={{
            id: po.id,
            supplierId: po.supplierId,
            lineItems: po.lineItems.map((li) => ({
              productId: li.productId,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
            })),
          }}
          suppliers={suppliers}
          products={products}
        />
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Supplier</p>
                <p className="text-sm">{po.supplier.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Created</p>
                <p className="text-sm">
                  {formatDate(po.createdAt)} by {po.createdBy.name}
                </p>
              </div>
            </CardContent>
          </Card>

          {po.status === "ORDERED" && !receiveMode && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Line Items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right" style={{ width: 100 }}>
                        Quantity
                      </TableHead>
                      <TableHead className="text-right" style={{ width: 140 }}>
                        Unit Price
                      </TableHead>
                      <TableHead className="text-right" style={{ width: 140 }}>
                        Subtotal
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.lineItems.map((li) => (
                      <TableRow key={li.id}>
                        <TableCell className="text-sm">{productLabel(li.product)}</TableCell>
                        <TableCell className="text-right text-sm">{li.quantity}</TableCell>
                        <TableCell className="text-right text-sm">
                          {currencyFormatter.format(li.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold">
                          {currencyFormatter.format(li.quantity * li.unitPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {po.status === "ORDERED" && receiveMode && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Line Items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right" style={{ width: 120 }}>
                        Ordered Qty
                      </TableHead>
                      <TableHead className="text-right" style={{ width: 140 }}>
                        Received Qty
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.lineItems.map((li) => (
                      <TableRow key={li.id}>
                        <TableCell className="text-sm">{productLabel(li.product)}</TableCell>
                        <TableCell className="text-right text-sm">{li.quantity}</TableCell>
                        <TableCell className="text-right">
                          <Label htmlFor={`received-qty-${li.id}`} className="sr-only">
                            Received quantity for {li.product.name}
                          </Label>
                          <Input
                            id={`received-qty-${li.id}`}
                            type="number"
                            min={0}
                            className="text-right ml-auto w-28"
                            value={receivedQuantities[li.id] ?? ""}
                            onChange={(e) =>
                              setReceivedQuantities((prev) => ({
                                ...prev,
                                [li.id]: e.target.value,
                              }))
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <div className="flex justify-end gap-3 p-4 border-t">
                <Button variant="outline" onClick={cancelReceive} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary"
                  onClick={handleConfirmReceipt}
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Receipt
                </Button>
              </div>
            </Card>
          )}

          {po.status === "RECEIVED" && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Line Items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right" style={{ width: 110 }}>
                        Ordered Qty
                      </TableHead>
                      <TableHead className="text-right" style={{ width: 110 }}>
                        Received Qty
                      </TableHead>
                      <TableHead className="text-right" style={{ width: 140 }}>
                        Unit Price
                      </TableHead>
                      <TableHead className="text-right" style={{ width: 140 }}>
                        Subtotal
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.lineItems.map((li) => (
                      <TableRow key={li.id}>
                        <TableCell className="text-sm">{productLabel(li.product)}</TableCell>
                        <TableCell className="text-right text-sm">{li.quantity}</TableCell>
                        <TableCell className="text-right text-sm">
                          {li.receivedQuantity ?? 0}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {currencyFormatter.format(li.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold">
                          {currencyFormatter.format(li.quantity * li.unitPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {!receiveMode && (
            <div className="flex justify-end items-center gap-3 py-4">
              <span className="text-sm font-semibold text-muted-foreground">Total</span>
              <span className="text-xl font-semibold">
                {currencyFormatter.format(po.status === "RECEIVED" ? po.totalAmount : orderedTotal)}
              </span>
            </div>
          )}
        </>
      )}
    </>
  )
}
