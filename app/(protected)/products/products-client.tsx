"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, EyeOff, Eye, Loader2, Package } from "lucide-react"

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { getSeverityBadge, SeverityBadgeProps } from "@/lib/utils/severity"
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/lib/validations/product"
import {
  createProduct,
  updateProduct,
  toggleProductActive,
} from "@/actions/products"

interface Product {
  id: string
  name: string
  sku: string
  categoryId: string
  categoryName: string
  categoryIsActive: boolean
  reorderThreshold: number
  currentStock: number
  isActive: boolean
}

interface Category {
  id: string
  name: string
}

interface ProductsClientProps {
  products: Product[]
  categories: Category[]
  isManager: boolean
}

export default function ProductsClient({
  products,
  categories,
  isManager,
}: ProductsClientProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Products</h1>
        {isManager && <CreateProductDialog categories={categories} />}
      </div>

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
              <TableHead style={{ width: 80 }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
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
              products.map((product) => {
                const severity: SeverityBadgeProps = getSeverityBadge(
                  product.currentStock,
                  product.reorderThreshold
                )
                return (
                  <TableRow key={product.id}>
                    <TableCell className="text-sm font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-500 font-mono">
                      {product.sku}
                    </TableCell>
                    <TableCell className="text-sm">
                      {product.categoryName}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {product.reorderThreshold}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      {product.currentStock}
                    </TableCell>
                    <TableCell>
                      <Badge className={severity.className}>
                        {severity.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={product.isActive ? "default" : "secondary"}
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isManager && (
                        <div className="flex items-center gap-1">
                          <EditProductDialog
                            product={product}
                            categories={categories}
                          />
                          {product.isActive ? (
                            <DeactivateProductDialog product={product} />
                          ) : (
                            <ReactivateProductDialog product={product} />
                          )}
                        </div>
                      )}
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

// ── Create Product Dialog ───────────────────────────────────────────────────

function CreateProductDialog({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CreateProductInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createProductSchema) as any,
    defaultValues: { name: "", sku: "", categoryId: "", reorderThreshold: 0 },
  })

  async function onSubmit(values: CreateProductInput) {
    setServerError(null)
    const fd = new FormData()
    fd.append("name", values.name)
    fd.append("sku", values.sku)
    fd.append("categoryId", values.categoryId)
    fd.append("reorderThreshold", String(values.reorderThreshold))
    const result = await createProduct(fd)
    if (result?.error) {
      if (result.error === "SKU already exists.") {
        form.setError("sku", { message: "SKU already exists" })
      } else {
        setServerError(result.error)
      }
      return
    }
    form.reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create product</Button>} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create product</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Product name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. PROD-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  {categories.length === 0 ? (
                    <>
                      <Select disabled>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No active categories" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent />
                      </Select>
                      <p className="text-xs text-zinc-500">
                        No active categories — create a category first
                      </p>
                    </>
                  ) : (
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reorderThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder threshold</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      {...field}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? 0 : Number(e.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="outline">
                    Discard
                  </Button>
                }
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create product
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Edit Product Dialog ─────────────────────────────────────────────────────

function EditProductDialog({
  product,
  categories,
}: {
  product: Product
  categories: Category[]
}) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<UpdateProductInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(updateProductSchema) as any,
    defaultValues: {
      id: product.id,
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId,
      reorderThreshold: product.reorderThreshold,
    },
  })

  // Check if the product's current category is in the active categories list
  const currentCategoryInActive = categories.find(
    (c) => c.id === product.categoryId
  )

  async function onSubmit(values: UpdateProductInput) {
    setServerError(null)
    const fd = new FormData()
    fd.append("id", values.id)
    fd.append("name", values.name)
    fd.append("sku", values.sku)
    fd.append("categoryId", values.categoryId)
    fd.append("reorderThreshold", String(values.reorderThreshold))
    const result = await updateProduct(fd)
    if (result?.error) {
      if (result.error === "SKU already exists.") {
        form.setError("sku", { message: "SKU already exists" })
      } else {
        setServerError(result.error)
      }
      return
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Edit product">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit product</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Product name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. PROD-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* Show inactive current category as disabled option if not in active list */}
                      {!currentCategoryInActive && (
                        <SelectItem value={product.categoryId} disabled>
                          {product.categoryName} (inactive)
                        </SelectItem>
                      )}
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reorderThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder threshold</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      {...field}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? 0 : Number(e.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="outline">
                    Discard changes
                  </Button>
                }
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Deactivate Product AlertDialog ──────────────────────────────────────────

function DeactivateProductDialog({ product }: { product: Product }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Deactivate product"
          >
            <EyeOff className="h-4 w-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate {product.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This product will be excluded from stock transactions and will no
            longer appear in transaction dropdowns. All stock history is
            preserved. You can reactivate it at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep active</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              await toggleProductActive(product.id, false)
            }}
          >
            Deactivate product
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Reactivate Product AlertDialog ──────────────────────────────────────────

function ReactivateProductDialog({ product }: { product: Product }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reactivate product"
          >
            <Eye className="h-4 w-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reactivate {product.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This product will appear again in stock transaction dropdowns.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              await toggleProductActive(product.id, true)
            }}
          >
            Reactivate product
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
