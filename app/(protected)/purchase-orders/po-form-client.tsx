"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  createPurchaseOrderSchema,
  type CreatePurchaseOrderInput,
} from "@/lib/validations/purchase-order"
import {
  createDraftPurchaseOrder,
  updateDraftPurchaseOrder,
} from "@/actions/purchase-orders"

interface Supplier {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  sku: string
}

interface ExistingPurchaseOrder {
  id: string
  supplierId: string
  lineItems: { productId: string; quantity: number; unitPrice: number }[]
}

interface PurchaseOrderFormProps {
  mode: "create" | "edit"
  suppliers: Supplier[]
  products: Product[]
  purchaseOrder?: ExistingPurchaseOrder
}

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
})

export default function PurchaseOrderForm({
  mode,
  suppliers,
  products,
  purchaseOrder,
}: PurchaseOrderFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CreatePurchaseOrderInput>({
    resolver: zodResolver(createPurchaseOrderSchema) as any,
    defaultValues:
      mode === "edit" && purchaseOrder
        ? { supplierId: purchaseOrder.supplierId, lineItems: purchaseOrder.lineItems }
        : { supplierId: "", lineItems: [] },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  })

  // Inline add-line row — separate controlled state, not part of the RHF form itself.
  const [draftProductId, setDraftProductId] = useState("")
  const [draftQuantity, setDraftQuantity] = useState("")
  const [draftUnitPrice, setDraftUnitPrice] = useState("")

  const draftQuantityNum = Number(draftQuantity)
  const draftUnitPriceNum = Number(draftUnitPrice)
  const isAddLineDisabled =
    !draftProductId ||
    draftQuantity === "" ||
    !Number.isFinite(draftQuantityNum) ||
    draftQuantityNum < 1 ||
    draftUnitPrice === "" ||
    !Number.isFinite(draftUnitPriceNum) ||
    draftUnitPriceNum < 0

  function handleAddLine() {
    if (isAddLineDisabled) return
    append({
      productId: draftProductId,
      quantity: draftQuantityNum,
      unitPrice: draftUnitPriceNum,
    })
    setDraftProductId("")
    setDraftQuantity("")
    setDraftUnitPrice("")
  }

  const liveTotal = fields.reduce(
    (sum, field) => sum + field.quantity * field.unitPrice,
    0
  )

  async function onSubmit(values: CreatePurchaseOrderInput) {
    setServerError(null)
    const fd = new FormData()
    fd.append("supplierId", values.supplierId)
    fd.append("lineItems", JSON.stringify(values.lineItems))

    try {
      const result =
        mode === "create"
          ? await createDraftPurchaseOrder(fd)
          : await updateDraftPurchaseOrder(purchaseOrder!.id, fd)

      if (result && "error" in result && result.error) {
        setServerError(typeof result.error === "string" ? result.error : "An error occurred.")
        return
      }

      if (mode === "create" && result && "id" in result && result.id) {
        router.push(`/purchase-orders/${result.id}`)
      }
      // mode === "edit": rely on the caller's own re-render (04-04).
    } catch {
      setServerError("Failed to save purchase order. Please try again.")
    }
  }

  function productLabel(productId: string) {
    const product = products.find((p) => p.id === productId)
    return product ? `${product.name} (${product.sku})` : productId
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier</FormLabel>
                  <FormControl>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Line Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex gap-3 p-4 border-b">
              <div className="flex-1">
                <Label className="text-xs font-semibold mb-1 block">Product</Label>
                <Select
                  value={draftProductId}
                  onValueChange={(v) => setDraftProductId(v ?? "")}
                >
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
              </div>
              <div className="w-24">
                <Label className="text-xs font-semibold mb-1 block">Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={draftQuantity}
                  onChange={(e) => setDraftQuantity(e.target.value)}
                />
              </div>
              <div className="w-36">
                <Label className="text-xs font-semibold mb-1 block">Unit Price</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Unit price"
                  value={draftUnitPrice}
                  onChange={(e) => setDraftUnitPrice(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isAddLineDisabled}
                  onClick={handleAddLine}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
              </div>
            </div>

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
                  <TableHead style={{ width: 48 }} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex flex-col items-center py-8 text-center">
                        <p className="text-sm font-medium">No line items added yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Use the fields above to add a product line.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell className="text-sm">{productLabel(field.productId)}</TableCell>
                      <TableCell className="text-right text-sm">{field.quantity}</TableCell>
                      <TableCell className="text-right text-sm">
                        {currencyFormatter.format(field.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {currencyFormatter.format(field.quantity * field.unitPrice)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove line item"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex justify-end items-center gap-3 py-4">
          <span className="text-sm font-semibold text-muted-foreground">Total</span>
          <span className="text-xl font-semibold">{currencyFormatter.format(liveTotal)}</span>
        </div>

        {serverError && <p className="text-sm text-destructive mb-4 text-right">{serverError}</p>}

        <div className="flex justify-end gap-3">
          <Button variant="outline" nativeButton={false} render={<Link href="/purchase-orders" />}>
            Cancel
          </Button>
          <Button type="submit" className="bg-primary" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Draft"
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}
