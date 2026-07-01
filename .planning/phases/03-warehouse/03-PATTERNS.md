# Phase 3: Warehouse - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 8
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `actions/stock-transactions.ts` | server-action | request-response (atomic) | `actions/products.ts` | exact (already exists — verify & extend) |
| `lib/validations/stock-transaction.ts` | zod-schema | transform | `lib/validations/product.ts` | exact (already exists — complete) |
| `app/(protected)/stock/page.tsx` | server-component | request-response | `app/(protected)/products/page.tsx` | exact |
| `app/(protected)/stock/stock-client.tsx` | client-component | request-response | `app/(protected)/suppliers/suppliers-client.tsx` | exact |
| `app/(protected)/inventory/page.tsx` | server-component | request-response + URL searchParams | `app/(protected)/products/page.tsx` | role-match (new: async searchParams) |
| `app/(protected)/inventory/inventory-client.tsx` | client-component | event-driven (URL filter push) | `app/(protected)/suppliers/suppliers-client.tsx` | role-match (new: useRouter filter) |
| `prisma/schema.prisma` | schema | CRUD | self | self-extend |
| `tests/warehouse.test.ts` | test | unit + integration-stub | `tests/catalog.test.ts` | exact |

---

## Pattern Assignments

### `actions/stock-transactions.ts` (server-action, atomic request-response)

**Status: FILE ALREADY EXISTS** at `actions/stock-transactions.ts` (lines 1–113). Read before any edit.

**Analog:** `actions/products.ts`

**Key deviation from analog — no `requireManager()`:**
The analog uses `requireManager()` (lines 11–17 of `actions/products.ts`). Stock transaction actions must NOT use this. Use a bare session check instead (D-12):
```typescript
// actions/stock-transactions.ts lines 8-9 (already implemented correctly)
const session = await auth()
if (!session?.user?.id) return { error: "Unauthorized" }
```

**Key deviation — `prisma.$transaction()` with `$queryRaw` SELECT FOR UPDATE:**
The analog calls plain `prisma.product.create()`. Stock mutations use a Prisma interactive transaction with a raw SELECT FOR UPDATE lock (already implemented in the file):
```typescript
// actions/stock-transactions.ts lines 20-44 (recordStockIn — already implemented)
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
```

**Key deviation — triple revalidatePath:**
Analog calls `revalidatePath("/products")` once. Stock actions call it three times (lines 50–52):
```typescript
revalidatePath("/stock")
revalidatePath("/inventory")
revalidatePath("/products")
```

**Error handling pattern** (lines 45–48, same shape as analog lines 59–67):
```typescript
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : "Failed to record transaction."
  return { error: msg }
}
```

**Imports pattern** (lines 1–5):
```typescript
"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { stockInSchema, stockOutSchema } from "@/lib/validations/stock-transaction"
```

Note: The file does NOT import `{ Prisma }` from `@prisma/client` (unlike `actions/products.ts` line 3) — error handling catches generic `Error`, not `PrismaClientKnownRequestError`.

---

### `lib/validations/stock-transaction.ts` (zod-schema, transform)

**Status: FILE ALREADY EXISTS** at `lib/validations/stock-transaction.ts` (lines 1–24). Complete — no changes needed.

**Analog:** `lib/validations/product.ts`

**Core pattern** (lines 1–24 — the entire file, already complete):
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

export const stockOutSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: quantityField,
  reason: z.enum(["Sale", "Manual Adjustment", "Write-Off"]),
  notes: z.string().optional(),
})

export type StockInInput = z.infer<typeof stockInSchema>
export type StockOutInput = z.infer<typeof stockOutSchema>
```

**Key deviation from product.ts analog:** Uses `z.preprocess()` for numeric coercion (not `z.coerce.number()`) — matches RESEARCH.md Pitfall 6. The shared `quantityField` constant avoids duplication between the two schemas.

---

### `app/(protected)/stock/page.tsx` (server-component, request-response)

**Status: STUB — replace entirely.** Current file (3 lines) is a non-functional placeholder.

**Analog:** `app/(protected)/products/page.tsx` (lines 1–40)

**Imports pattern** (copy from analog, adapt imports):
```typescript
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import StockClient from "./stock-client"
```

**Core pattern — parallel Prisma fetch + pass to client** (analog lines 1–40):
```typescript
export default async function StockPage() {
  const [recentTransactions, activeProducts] = await Promise.all([
    prisma.stockTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
  ])

  return (
    <StockClient
      recentTransactions={recentTransactions}
      products={activeProducts}
    />
  )
}
```

**Key deviations from analog:**
- No `auth()` call in page — stock actions check session themselves (D-12, both roles allowed)
- Fetches `StockTransaction` (with product+createdBy includes) + active products for dropdown
- No `isManager` prop needed (both Staff and Manager see the same page)
- `take: 10` for recent transactions (D-11)

---

### `app/(protected)/stock/stock-client.tsx` (client-component, request-response)

**Status: NEW FILE.**

**Analog:** `app/(protected)/suppliers/suppliers-client.tsx` (full file, 558 lines)

**Imports pattern** (adapt from analog lines 1–61):
```typescript
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

import {
  stockInSchema, stockOutSchema,
  type StockInInput, type StockOutInput,
} from "@/lib/validations/stock-transaction"
import { recordStockIn, recordStockOut } from "@/actions/stock-transactions"
```

**Dialog open/close state pattern** (analog lines 193–213 — CreateSupplierDialog):
```typescript
function RecordStockInDialog({ products }: { products: Product[] }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<StockInInput>({
    resolver: zodResolver(stockInSchema),
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
  // ...
}
```

**DialogTrigger render prop pattern** (analog lines 217, 297 — base-ui pattern, NOT asChild):
```typescript
<DialogTrigger render={<Button>Record Stock In</Button>} />
// ...
<DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
```

**Select field inside RHF Form** (from `products-client.tsx` lines 48–54 for import, pattern from suppliers Select):
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

**Inline server error display** (analog line 293–295 — inside Dialog, no toast):
```typescript
{serverError && (
  <p className="text-sm text-destructive">{serverError}</p>
)}
```

**Recent transactions table** — follow analog Table structure (lines 108–186 of suppliers-client.tsx). Type badge: `<Badge variant="default">IN</Badge>` (green) and `<Badge variant="destructive">OUT</Badge>` (red).

**Key deviations from analog:**
- Two separate Dialog components (RecordStockInDialog + RecordStockOutDialog), triggered by two top-level buttons side-by-side (D-08)
- No edit/toggle actions (transactions are immutable per D-01)
- No Tabs filter (tabs belong on the `/inventory` page)
- Product Select uses `{ isActive: true }` filtered list passed as prop from page.tsx
- Stock Out Dialog's serverError prop is the primary D-18 negative-stock UX path

---

### `app/(protected)/inventory/page.tsx` (server-component, URL searchParams)

**Status: STUB — replace entirely.**

**Analog:** `app/(protected)/products/page.tsx` (structure) + RESEARCH.md Pattern 3 (searchParams)

**Critical deviation — async searchParams (Next.js 15):**
Unlike the products page analog (no searchParams), inventory page MUST await searchParams:
```typescript
type Props = {
  searchParams: Promise<{
    productId?: string
    from?: string
    to?: string
    type?: string
  }>
}

export default async function InventoryPage({ searchParams }: Props) {
  const params = await searchParams  // MUST await — Next.js 15 breaking change
```

**Prisma where-clause build pattern** (RESEARCH.md Pattern 4):
```typescript
  const where: Prisma.StockTransactionWhereInput = {}
  if (params.productId) where.productId = params.productId
  if (params.type === "STOCK_IN") where.type = "STOCK_IN"
  if (params.type === "STOCK_OUT") where.type = "STOCK_OUT"

  if (params.from || params.to) {
    where.createdAt = {}
    if (params.from) where.createdAt.gte = new Date(`${params.from}T00:00:00.000Z`)
    if (params.to)   where.createdAt.lte = new Date(`${params.to}T23:59:59.999Z`)
  } else {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    where.createdAt = { gte: thirtyDaysAgo }
  }
```

**Suspense boundary (required):** Wrap InventoryClient in `<Suspense>` (RESEARCH.md Pitfall 2):
```typescript
import { Suspense } from "react"

return (
  <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading...</div>}>
    <InventoryClient
      transactions={transactions}
      products={products}
      currentParams={params}
    />
  </Suspense>
)
```

**Parallel fetch pattern** (analog products/page.tsx lines 6–18):
```typescript
  const [transactions, products] = await Promise.all([
    prisma.stockTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])
```

---

### `app/(protected)/inventory/inventory-client.tsx` (client-component, URL filter push)

**Status: NEW FILE.**

**Analog:** `app/(protected)/suppliers/suppliers-client.tsx` (Table + Tabs pattern)

**Imports — URL filter additions** (no analog; new for this phase):
```typescript
"use client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
// ... all Table, Badge, Tabs, Select, Input imports same as suppliers-client.tsx
import { getSeverityBadge } from "@/lib/utils/severity"
```

**URL push filter pattern** (RESEARCH.md Pattern 3 — no codebase analog yet):
```typescript
function FilterControls({ products, currentParams }: FilterControlsProps) {
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

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {/* Product select */}
      <Select
        value={currentParams.productId ?? "all"}
        onValueChange={(v) => updateFilter("productId", v)}
      >...</Select>
      {/* From/To date inputs */}
      <Input type="date" value={currentParams.from ?? ""} onChange={(e) => updateFilter("from", e.target.value)} />
      <Input type="date" value={currentParams.to ?? ""} onChange={(e) => updateFilter("to", e.target.value)} />
      {/* Type filter */}
      <Tabs value={currentParams.type ?? "all"} onValueChange={(v) => updateFilter("type", v)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="STOCK_IN">In</TabsTrigger>
          <TabsTrigger value="STOCK_OUT">Out</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
```

**Tabs pattern** (analog suppliers-client.tsx lines 96–106 — directly reusable):
```typescript
<Tabs value={filter} onValueChange={(v) => updateFilter("type", v)} className="mb-4">
  <TabsList>
    <TabsTrigger value="all">All</TabsTrigger>
    <TabsTrigger value="STOCK_IN">Stock In</TabsTrigger>
    <TabsTrigger value="STOCK_OUT">Stock Out</TabsTrigger>
  </TabsList>
</Tabs>
```

**Type badge pattern** — use existing Badge variants (D-17 / Claude's Discretion):
```typescript
<Badge variant={tx.type === "STOCK_IN" ? "default" : "destructive"}>
  {tx.type === "STOCK_IN" ? "IN" : "OUT"}
</Badge>
```

**Date formatting** (RESEARCH.md Don't Hand-Roll):
```typescript
new Intl.DateTimeFormat("en-US", {
  year: "numeric", month: "short", day: "numeric",
  hour: "2-digit", minute: "2-digit",
}).format(new Date(tx.createdAt))
// Produces: "Jul 1, 2026, 14:32"
```

**Key deviations from suppliers-client.tsx analog:**
- FilterControls uses `useRouter().push()` for URL-based state (not `useState`)
- History table is read-only — no edit/toggle actions columns
- Severity badge displayed alongside currentStock (import `getSeverityBadge` from `@/lib/utils/severity`)
- Table columns (D-14): Date/Time | Product Name | SKU | Type | Quantity | Reason | Notes | Recorded By

---

### `prisma/schema.prisma` (schema extension, CRUD)

**Status: EXTEND existing file.** Current schema ends at line 70 (Supplier model). No `StockTransaction` or `TransactionType` yet.

**Analog:** Self (current schema lines 13–55 show enum + model patterns)

**Enum pattern** (copy Role enum at lines 13–16, adapt):
```prisma
enum TransactionType {
  STOCK_IN
  STOCK_OUT
}
```

**New model** (follow Product model pattern lines 42–55 — @id cuid, @map, relations):
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

**Relation additions to existing models** (D-03):
```prisma
// Add to User model (after updatedAt line 28):
stockTransactions StockTransaction[]

// Add to Product model (after updatedAt line 52):
stockTransactions StockTransaction[]
```

**Custom migration SQL to append** (D-04 — after `npx prisma migrate dev --create-only`):
```sql
ALTER TABLE "products"
  ADD CONSTRAINT "products_current_stock_non_negative"
  CHECK ("currentStock" >= 0);
```

---

### `tests/warehouse.test.ts` (test, unit + integration-stub)

**Status: NEW FILE.**

**Analog:** `tests/catalog.test.ts` (lines 1–154)

**File header pattern** (analog lines 1–10):
```typescript
/**
 * Warehouse tests — covers INVT-01, INVT-02, INVT-03
 *
 * Implementation notes:
 *   - Unit tests for Zod schema validation (stockInSchema, stockOutSchema)
 *   - Integration test stubs (it.todo) for Server Actions — require prisma mocking
 *   - No @prisma/client imports — all tests are pure logic, no DB connection needed
 */
```

**Import pattern** (analog lines 11–15 — import only schema/utils, no prisma):
```typescript
import { stockInSchema, stockOutSchema } from "@/lib/validations/stock-transaction"
```

**Describe + it pattern** (analog lines 48–95 — Product Validation describe block):
```typescript
describe("Stock In Validation — lib/validations/stock-transaction.ts", () => {
  // INVT-01: quantity must be >= 1
  it("stockInSchema rejects quantity less than 1", () => {
    const result = stockInSchema.safeParse({
      productId: "prod-123",
      quantity: 0,
      reason: "Purchase Received",
    })
    expect(result.success).toBe(false)
  })

  // INVT-01: productId required
  it("stockInSchema rejects missing productId", () => {
    const result = stockInSchema.safeParse({
      productId: "",
      quantity: 5,
      reason: "Purchase Received",
    })
    expect(result.success).toBe(false)
  })

  // INVT-01: string quantity is coerced (Pitfall 6)
  it("stockInSchema coerces string quantity '5' to number 5", () => {
    const result = stockInSchema.safeParse({
      productId: "prod-123",
      quantity: "5",
      reason: "Purchase Received",
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.quantity).toBe(5)
  })
})

describe("Stock Out Validation — lib/validations/stock-transaction.ts", () => {
  // INVT-02: invalid reason rejected
  it("stockOutSchema rejects invalid reason", () => {
    const result = stockOutSchema.safeParse({
      productId: "prod-123",
      quantity: 3,
      reason: "not-a-valid-reason",
    })
    expect(result.success).toBe(false)
  })
})

describe("Stock Actions — actions/stock-transactions.ts", () => {
  // INVT-03: insufficient stock guard
  it.todo("recordStockOut with quantity exceeding currentStock returns error with stock count")
  it.todo("recordStockIn increments currentStock and creates StockTransaction record")
})
```

---

## Shared Patterns

### Authentication (session-only check — D-12)
**Source:** `actions/stock-transactions.ts` lines 8–9
**Apply to:** Both `recordStockIn` and `recordStockOut` in `actions/stock-transactions.ts`
```typescript
const session = await auth()
if (!session?.user?.id) return { error: "Unauthorized" }
```
Note: Do NOT use `requireManager()` from `actions/products.ts`. Both Staff and Manager roles can record transactions.

### Dialog Trigger (base-ui render prop)
**Source:** `app/(protected)/suppliers/suppliers-client.tsx` lines 217, 297, 349–355
**Apply to:** All Dialog/AlertDialog triggers in `stock-client.tsx`
```typescript
// CORRECT (base-ui pattern used in this project):
<DialogTrigger render={<Button>Record Stock In</Button>} />
<DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />

// WRONG (Radix asChild — do NOT use):
// <DialogTrigger asChild><Button>...</Button></DialogTrigger>
```

### Form Submission to Server Action
**Source:** `app/(protected)/suppliers/suppliers-client.tsx` lines 202–213
**Apply to:** `RecordStockInDialog.onSubmit`, `RecordStockOutDialog.onSubmit` in `stock-client.tsx`
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

### Inline Server Error (no toast)
**Source:** `app/(protected)/suppliers/suppliers-client.tsx` lines 293–295
**Apply to:** Both stock dialogs in `stock-client.tsx` (D-18 requires inline error, form stays open)
```typescript
{serverError && (
  <p className="text-sm text-destructive">{serverError}</p>
)}
```

### isActive Product Filter
**Source:** `app/(protected)/products/page.tsx` line 12 (categories filter), extended here
**Apply to:** All Prisma product queries that populate form dropdowns
```typescript
prisma.product.findMany({
  where: { isActive: true },
  orderBy: { name: "asc" },
  select: { id: true, name: true, sku: true },
})
```

### Severity Badge Reuse
**Source:** `app/(protected)/products/products-client.tsx` lines 56, 139–143
**Apply to:** `inventory-client.tsx` history table rows (INVT-06)
```typescript
import { getSeverityBadge, SeverityBadgeProps } from "@/lib/utils/severity"
// In table row:
const severity = getSeverityBadge(product.currentStock, product.reorderThreshold)
<Badge variant={severity.variant}>{severity.label}</Badge>
```

---

## No Analog Found

All files have close codebase analogs. The URL-filter push pattern (`useRouter` + `useSearchParams` for inventory filters) has no existing codebase example but is fully documented in RESEARCH.md Pattern 3 with a concrete code excerpt.

---

## Metadata

**Analog search scope:** `actions/`, `lib/validations/`, `app/(protected)/`, `tests/`, `prisma/`
**Files scanned:** 14 source files read
**Pattern extraction date:** 2026-07-01
