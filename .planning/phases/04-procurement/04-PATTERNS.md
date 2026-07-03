# Phase 4: Procurement - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 11 (new/modified)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `prisma/schema.prisma` (add `POStatus`, `PurchaseOrder`, `PurchaseOrderLineItem`, FK on `StockTransaction`) | model | CRUD | existing `Supplier`/`StockTransaction` models in same file | exact (same file, additive) |
| `lib/validations/purchase-order.ts` | utility (validation) | request-response | `lib/validations/stock-transaction.ts` | exact |
| `actions/purchase-orders.ts` — `createDraftPurchaseOrder`/`updateDraftPurchaseOrder` | service (Server Action) | CRUD | `actions/suppliers.ts` (`createSupplier`/`updateSupplier`) | exact |
| `actions/purchase-orders.ts` — `confirmPurchaseOrder` | service (Server Action) | CRUD + validation | `actions/suppliers.ts` (`toggleSupplierActive`) for simple status-flip shape; D-16 re-validation is novel | role-match |
| `actions/purchase-orders.ts` — `receivePurchaseOrder` | service (Server Action) | event-driven / atomic-transaction | `actions/stock-transactions.ts` (`recordStockIn`) | exact |
| `actions/purchase-orders.ts` — `deletePurchaseOrder` | service (Server Action) | CRUD (hard delete) | `actions/suppliers.ts` shape (auth+prisma+revalidate), but hard-delete is a new sub-pattern (no exact hard-delete analog exists) | role-match |
| `app/(protected)/purchase-orders/page.tsx` | route/controller (Server Component) | request-response | `app/(protected)/inventory/page.tsx` (fetch + pass to client) and stub itself (file being replaced) | exact |
| `app/(protected)/purchase-orders/purchase-orders-client.tsx` | component (client) | request-response | `app/(protected)/suppliers/suppliers-client.tsx` (Tabs filter + table + badges) | exact |
| `app/(protected)/purchase-orders/new/page.tsx` | route/controller (Server Component) | request-response | `app/(protected)/inventory/page.tsx` (fetch active suppliers/products, pass as props) | role-match |
| `app/(protected)/purchase-orders/new/po-form-client.tsx` | component (client, form) | request-response | `app/(protected)/stock/stock-client.tsx` (RHF + Zod + Select + FormField pattern); `useFieldArray` itself is novel (first repeating-array form in codebase) | role-match |
| `app/(protected)/purchase-orders/[id]/page.tsx` + `po-detail-client.tsx` | route/controller + component | request-response | `app/(protected)/suppliers/suppliers-client.tsx` (status-conditional action buttons, AlertDialog delete) | role-match |

## Pattern Assignments

### `prisma/schema.prisma`

**Analog:** same file — `Supplier`, `Product`, `StockTransaction` models (lines 64-91)

**Core pattern to copy** — model shape, `@map`, relation style:
```prisma
model StockTransaction {
  id          String          @id @default(cuid())
  type        TransactionType
  productId   String
  product     Product         @relation(fields: [productId], references: [id])
  quantity    Int
  reason      String
  notes       String?
  createdById String
  createdBy   User            @relation(fields: [createdById], references: [id])
  createdAt   DateTime        @default(now())

  @@map("stock_transactions")
}
```
Apply the same `id/@default(cuid())`, FK + relation pair, `@@map(snake_case_plural)` convention to `PurchaseOrder`/`PurchaseOrderLineItem`. Existing enums (`Role`, `TransactionType`) show the enum-declaration convention to follow for `POStatus`. Use `onDelete: Cascade` on `PurchaseOrderLineItem.purchaseOrder` relation per RESEARCH.md Pattern/Code Example (not present elsewhere in schema yet — first cascade relation in this codebase, add explicitly).

---

### `lib/validations/purchase-order.ts`

**Analog:** `lib/validations/stock-transaction.ts` (full file, 24 lines)

**Full pattern to copy:**
```typescript
import { z } from "zod"

const quantityField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().min(1, "Quantity must be at least 1.")
)

export const stockInSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: quantityField,
  reason: z.enum(["Purchase Received", "Return", "Manual Adjustment"]),
  notes: z.string().optional(),
})

export type StockInInput = z.infer<typeof stockInSchema>
```
Apply this `z.preprocess` numeric-coercion pattern to `quantity`/`unitPrice`/`receivedQuantity` fields (per RESEARCH.md Open Question, use `.min(0)` not `.min(1)` for `receivedQuantity` to allow legitimate zero-receipt lines). Define `createPurchaseOrderSchema` (lineItems array, `.min(0)` for draft save), `confirmPurchaseOrderSchema` (lineItems `.min(1)`), `receivePurchaseOrderSchema` (per-line `receivedQuantity`). Export `z.infer` types exactly as shown.

---

### `actions/purchase-orders.ts` — draft create/update/delete

**Analog:** `actions/suppliers.ts` (full file, 115 lines)

**Imports + auth pattern** (lines 1-17):
```typescript
"use server"
import { auth } from "@/lib/auth"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { createSupplierSchema, updateSupplierSchema } from "@/lib/validations/supplier"
```
NOTE: Do NOT copy the `requireManager()` gate (lines 11-17) — D-14 explicitly requires session-only guard (`if (!session?.user?.id) return { error: "Unauthorized" }`), matching `actions/stock-transactions.ts`'s auth pattern instead, not `suppliers.ts`'s Manager-only gate. This is a documented pitfall (Security Domain V4) to watch for.

**Core CRUD pattern** (lines 19-56, `createSupplier`):
```typescript
export async function createSupplier(formData: FormData) {
  const authError = await requireManager() // ← replace with session check per D-14
  if (authError) return authError

  const parsed = createSupplierSchema.safeParse({ ...formData fields... })
  if (!parsed.success) return { error: "Invalid input. Please check all fields." }

  try {
    await prisma.supplier.create({ data: { ... } })
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "A supplier with this information already exists." }
    }
    return { error: "Failed to create supplier. Please try again." }
  }

  revalidatePath("/suppliers")
  return { success: true }
}
```

**Hard-delete pattern (new sub-pattern, D-15)** — model on `toggleSupplierActive`'s shape (lines 99-114) but use `prisma.purchaseOrder.delete()` instead of an `update`, guarded by `status === "DRAFT"` check before the delete call:
```typescript
export async function deletePurchaseOrder(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const po = await prisma.purchaseOrder.findUnique({ where: { id }, select: { status: true } })
  if (!po) return { error: "Purchase order not found." }
  if (po.status !== "DRAFT") return { error: "Only Draft purchase orders can be deleted." }

  try {
    await prisma.purchaseOrder.delete({ where: { id } }) // cascades to line items
  } catch {
    return { error: "Failed to delete purchase order." }
  }

  revalidatePath("/purchase-orders")
  return { success: true }
}
```

---

### `actions/purchase-orders.ts` — `receivePurchaseOrder` (the critical atomic path)

**Analog:** `actions/stock-transactions.ts` — `recordStockIn` (full function, lines 7-54)

**Full pattern to extend** (imports lines 1-5, atomic transaction lines 19-54):
```typescript
"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function recordStockIn(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const parsed = stockInSchema.safeParse({ ... })
  if (!parsed.success) return { error: "Invalid input. Please check all fields." }

  try {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ currentStock: number }>>`
        SELECT "currentStock" FROM products WHERE id = ${parsed.data.productId} FOR UPDATE
      `
      if (rows.length === 0) throw new Error("Product not found.")

      await tx.product.update({
        where: { id: parsed.data.productId },
        data: { currentStock: { increment: parsed.data.quantity } },
      })

      await tx.stockTransaction.create({
        data: {
          type: "STOCK_IN",
          productId: parsed.data.productId,
          quantity: parsed.data.quantity,
          reason: parsed.data.reason,
          notes: parsed.data.notes ?? null,
          createdById: session.user.id,
        },
      })
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record transaction."
    return { error: msg }
  }

  revalidatePath("/stock")
  revalidatePath("/inventory")
  revalidatePath("/products")
  return { success: true }
}
```

**Extension for `receivePurchaseOrder`** — add PO row lock BEFORE the per-product loop (D-22), per RESEARCH.md Pattern 3:
```typescript
await prisma.$transaction(async (tx) => {
  const rows = await tx.$queryRaw<Array<{ status: string }>>`
    SELECT "status" FROM purchase_orders WHERE id = ${purchaseOrderId} FOR UPDATE
  `
  if (rows.length === 0) throw new Error("Purchase order not found.")
  if (rows[0].status !== "ORDERED") {
    throw new Error("This purchase order has already been received.")
  }

  for (const line of lineItems) {
    await tx.product.update({
      where: { id: line.productId },
      data: { currentStock: { increment: line.receivedQuantity } },
    })
    await tx.stockTransaction.create({
      data: {
        type: "STOCK_IN",
        productId: line.productId,
        quantity: line.receivedQuantity,
        reason: "Purchase Received",
        purchaseOrderId,
        createdById: session.user.id,
      },
    })
  }

  await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: "RECEIVED" } })
})
```
Same `try/catch` + generic error-message fallback pattern as `recordStockIn`/`recordStockOut` (lines 45-48/103-106). Revalidate `/purchase-orders`, `/inventory`, `/stock`, `/products` (extend `recordStockIn`'s revalidate list).

---

### `app/(protected)/purchase-orders/page.tsx` (list) + `new/page.tsx` (create)

**Analog:** `app/(protected)/inventory/page.tsx` (full file, 75 lines)

**Core Server Component fetch pattern** (lines 17-74):
```typescript
export default async function InventoryPage({ searchParams }: Props) {
  const params = await searchParams
  // ... build Prisma where clause from params ...
  const [transactions, products] = await Promise.all([
    prisma.stockTransaction.findMany({ where, orderBy: { createdAt: "desc" }, take: 200,
      include: { product: { select: {...} }, createdBy: { select: { name: true } } } }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: {...} }),
  ])

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Inventory History</h1>
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
        <InventoryClient transactions={transactions} products={products} currentParams={params} />
      </Suspense>
    </div>
  )
}
```
For `/purchase-orders/page.tsx`: fetch `prisma.purchaseOrder.findMany({ include: { supplier, createdBy, lineItems } })`, then **map every Decimal field via `.toNumber()` before passing to the client component** (D-23 — see RESEARCH.md Pattern 2, no existing analog for this since no Decimal fields exist elsewhere in the codebase yet — this is the one genuinely new conversion step, apply it explicitly).

For `/purchase-orders/new/page.tsx`: fetch active suppliers + active products (`where: { isActive: true }`), same `Promise.all` shape, pass as props to `po-form-client.tsx`.

---

### `app/(protected)/purchase-orders/purchase-orders-client.tsx` (list + status filter)

**Analog:** `app/(protected)/suppliers/suppliers-client.tsx` (full file, 558 lines — extract Tabs filter section lines 78-106, table section lines 108-189)

**Tabs filter pattern** (lines 78-106):
```typescript
type FilterTab = "all" | "active" | "inactive"

export default function SuppliersClient({ suppliers, isManager }: SuppliersClientProps) {
  const [filter, setFilter] = useState<FilterTab>("all")
  const visibleSuppliers = suppliers.filter((s) => {
    if (filter === "active") return s.isActive
    if (filter === "inactive") return !s.isActive
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        {isManager && <CreateSupplierDialog />}
      </div>
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card>
        <Table>{/* ... */}</Table>
      </Card>
    </div>
  )
}
```
Apply directly for `FilterTab = "all" | "draft" | "ordered" | "received"` (D-18). No `isManager` gate needed (D-14 — Create button always shown to any authenticated user, no CreateSupplierDialog-style role check).

**Badge pattern for status column** (from `suppliers-client.tsx` line 165-167, and `stock-client.tsx` lines 75-79/138-140 for the color-mapping-function convention):
```typescript
function getTypeBadgeClass(type: "STOCK_IN" | "STOCK_OUT") {
  return type === "STOCK_IN"
    ? "bg-green-100 text-green-700 border border-green-200 hover:bg-green-100"
    : "bg-red-100 text-red-700 border border-red-200 hover:bg-red-100"
}
// usage: <Badge className={getTypeBadgeClass(tx.type)}>{tx.type === "STOCK_IN" ? "IN" : "OUT"}</Badge>
```
Write an analogous `getPOStatusBadgeClass(status)` returning neutral/blue/green classes for DRAFT/ORDERED/RECEIVED (per CONTEXT.md Claude's Discretion).

**Empty-state pattern** (lines 125-156) — copy the `flex flex-col items-center py-12 text-center` empty-state block per filter tab, swap icon (e.g. `FileText`/`ClipboardList` instead of `Truck`) and copy.

---

### `app/(protected)/purchase-orders/new/po-form-client.tsx`

**Analog:** `app/(protected)/stock/stock-client.tsx` — `RecordStockInDialog` (lines 160-291)

**Imports + RHF/Zod setup pattern** (lines 1-52, 164-167):
```typescript
"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
// ... shadcn/ui imports ...

const form = useForm<StockInInput>({
  resolver: zodResolver(stockInSchema) as any,   // ← as any cast convention, copy exactly (Pitfall 3)
  defaultValues: { productId: "", quantity: 1, reason: "Purchase Received", notes: "" },
})
```

**Select + FormField pattern for product dropdown** (lines 198-221):
```typescript
<FormField
  control={form.control}
  name="productId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Product</FormLabel>
      <FormControl>
        <Select onValueChange={field.onChange} defaultValue={field.value}>
          <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```
Reuse per line-item row for product select. `useFieldArray` itself has no in-codebase analog — follow RESEARCH.md Pattern 4 verbatim (official RHF API), since this is the first repeating-array form in the project:
```typescript
const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" })
// key={field.id} on TableRow — NOT array index (Anti-Pattern warning)
```

**Submit pattern** (lines 169-180):
```typescript
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
```
Note: for a full-page form (not Dialog, per D-05) this becomes a page-level submit with `router.push` on success instead of `setOpen(false)` — no direct analog for the non-Dialog submit-then-navigate flow, use Next.js `useRouter().push("/purchase-orders/[id]")` idiomatically.

---

### `app/(protected)/purchase-orders/[id]/page.tsx` + `po-detail-client.tsx`

**Analog:** `app/(protected)/suppliers/suppliers-client.tsx` — `DeactivateSupplierDialog` (lines 456-505) for the AlertDialog delete-confirm pattern (D-15); status-conditional rendering pattern from lines 169-180 (`isManager && ...` ternary showing Edit/Deactivate/Reactivate buttons conditionally).

**AlertDialog delete-confirm pattern** (lines 456-505):
```typescript
function DeactivateSupplierDialog({ supplier }: { supplier: Supplier }) {
  const [pending, setPending] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  async function handleDeactivate() {
    setPending(true)
    setToggleError(null)
    try {
      const result = await toggleSupplierActive(supplier.id, false)
      if (result && "error" in result && result.error) setToggleError(result.error)
    } catch {
      setToggleError("Failed to deactivate supplier. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon" aria-label="Deactivate supplier"><EyeOff className="h-4 w-4" /></Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate {supplier.name}?</AlertDialogTitle>
          <AlertDialogDescription>...</AlertDialogDescription>
        </AlertDialogHeader>
        {toggleError && <p className="text-sm text-destructive px-1">{toggleError}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Keep active</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeactivate} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Deactivate supplier
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```
Apply directly for "Delete Draft PO" (D-15), swapping `toggleSupplierActive` for `deletePurchaseOrder(po.id)` and adding a `router.push("/purchase-orders")` on success (no page to stay on after delete, unlike toggle-in-place).

**Status-conditional button rendering** (line pattern from 169-180 `isManager && (...)`): replace the `isManager` condition with a `status`-keyed conditional — `status === "DRAFT" && <EditButton/><ConfirmButton/><DeleteDialog/>`, `status === "ORDERED" && <ReceiveButton/>`, `status === "RECEIVED" && <Badge>Received</Badge>` only (D-17 UI convenience layer).

## Shared Patterns

### Session-only auth guard (no Manager gate)
**Source:** `actions/stock-transactions.ts` lines 8-9
**Apply to:** All `actions/purchase-orders.ts` exports (create/update/confirm/receive/delete) per D-14
```typescript
const session = await auth()
if (!session?.user?.id) return { error: "Unauthorized" }
```
**Do NOT copy:** `actions/suppliers.ts`'s `requireManager()` (lines 11-17) — that gate is specific to Supplier/Product mutations and must not leak into PO actions.

### Zod safeParse + generic error response
**Source:** `actions/stock-transactions.ts` lines 11-17, `actions/suppliers.ts` lines 23-32
**Apply to:** All PO Server Actions
```typescript
const parsed = someSchema.safeParse({ ...formData fields... })
if (!parsed.success) return { error: "Invalid input. Please check all fields." }
```

### Prisma error → user message mapping
**Source:** `actions/suppliers.ts` lines 44-52 (P2002 unique constraint), `actions/stock-transactions.ts` lines 45-48/103-106 (generic catch)
**Apply to:** `createDraftPurchaseOrder` (unlikely constraint conflicts, but keep generic catch), `receivePurchaseOrder`/`confirmPurchaseOrder` (use thrown `Error` message directly, matching stock-transactions' `err instanceof Error ? err.message : "..."` pattern so the D-22 "already been received" message surfaces verbatim to the client).

### revalidatePath fan-out
**Source:** `actions/stock-transactions.ts` lines 50-52/108-110
**Apply to:** `receivePurchaseOrder` (revalidate `/purchase-orders`, `/purchase-orders/[id]`, `/inventory`, `/stock`, `/products` — since it mutates `Product.currentStock` exactly like stock-transactions); other PO actions revalidate `/purchase-orders` and `/purchase-orders/[id]` only.

### Decimal Server→Client conversion (new pattern, no existing analog — first money field in codebase)
**Source:** RESEARCH.md Pattern 2 (cited from Prisma docs/discussion, not an existing codebase file)
**Apply to:** `/purchase-orders/page.tsx`, `/purchase-orders/[id]/page.tsx`, receive-quantity UI
```typescript
const serialized = purchaseOrders.map((po) => ({
  ...po,
  totalAmount: po.totalAmount.toNumber(),
  lineItems: po.lineItems.map((li) => ({ ...li, unitPrice: li.unitPrice.toNumber() })),
}))
```
Reconstruct on the way back in: `new Prisma.Decimal(formData.get("unitPrice") as string)`.

### zodResolver `as any` cast
**Source:** `app/(protected)/stock/stock-client.tsx` lines 165, 300
**Apply to:** `po-form-client.tsx`, receive-quantity-editing form — any `useForm` call whose schema uses `z.preprocess` numeric coercion.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `useFieldArray` repeating line-item table (within `po-form-client.tsx`) | component sub-pattern | request-response | First repeating-array RHF form in this codebase (RESEARCH.md confirms: "first repeating-array form in the project, so there's no legacy pattern to migrate away from"). Use RESEARCH.md Pattern 4 (official RHF docs) as the source instead. |
| Hard-delete Server Action (`deletePurchaseOrder`) | service | CRUD | Every existing delete-like action (`toggleSupplierActive`, product/category deactivate) is a soft-delete `update`; this phase introduces the codebase's first true `prisma.*.delete()` call. Modeled on `toggleSupplierActive`'s auth/try-catch/revalidate shape with the mutation swapped. |
| Decimal `.toNumber()` RSC boundary conversion | transform | transform | No existing Prisma field in the schema is a `Decimal` type (first money field in codebase). RESEARCH.md Pattern 2 (Prisma official docs) is the sole source. |

## Metadata

**Analog search scope:** `actions/`, `app/(protected)/`, `lib/validations/`, `components/ui/`, `prisma/schema.prisma`
**Files scanned:** `actions/stock-transactions.ts`, `actions/suppliers.ts`, `lib/validations/stock-transaction.ts`, `prisma/schema.prisma`, `app/(protected)/purchase-orders/page.tsx` (stub), `app/(protected)/inventory/page.tsx`, `app/(protected)/suppliers/suppliers-client.tsx`, `app/(protected)/stock/stock-client.tsx`, `components/ui/badge.tsx`
**Pattern extraction date:** 2026-07-03
