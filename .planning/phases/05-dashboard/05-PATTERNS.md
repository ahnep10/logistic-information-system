# Phase 5: Dashboard - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 6 (2 new, 4 modified)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/(protected)/dashboard/page.tsx` | route/controller (Server Component) | CRUD (read-only aggregation) | `app/(protected)/inventory/page.tsx` (searchParams+Prisma pattern) + `app/(protected)/purchase-orders/page.tsx` (parallel-fetch + serialize-then-pass-to-client) | role-match |
| `app/(protected)/dashboard/dashboard-client.tsx` | component (new) | request-response (client render + click-navigate) | `app/(protected)/purchase-orders/purchase-orders-client.tsx` (Server→Client props split, `useRouter`/`Link` navigation) | role-match |
| `app/(protected)/products/page.tsx` | route/controller | CRUD, URL-param filtering | `app/(protected)/inventory/page.tsx` | exact (same searchParams pattern to replicate) |
| `app/(protected)/products/products-client.tsx` | component | request-response | itself (existing file, extend in place) — banner styling borrows badge/severity color conventions from `lib/utils/severity.ts` | exact |
| `app/(protected)/purchase-orders/page.tsx` | route/controller | CRUD, URL-param filtering | `app/(protected)/inventory/page.tsx` (searchParams pattern to newly add here) | role-match |
| `app/(protected)/purchase-orders/purchase-orders-client.tsx` | component | request-response | itself (existing file, extend `useState` seed) | exact |

No new utility files are required this phase — `lib/utils/severity.ts` and `lib/utils/po-status.ts` are reused as-is (per CONTEXT.md D-03/D-11), not created/modified.

## Pattern Assignments

### `app/(protected)/dashboard/page.tsx` (Server Component, new full implementation replacing stub)

**Analogs:** `app/(protected)/inventory/page.tsx` (searchParams/Prisma query shape), `app/(protected)/purchase-orders/page.tsx` (parallel fetch + Decimal-safe serialize pattern)

**Current stub** (`app/(protected)/dashboard/page.tsx`, full file, 3 lines):
```tsx
export default function DashboardPage() {
  return <h1 className="text-2xl font-semibold">Dashboard</h1>
}
```
This is a synchronous, non-async component — must be converted to `async function DashboardPage()` (no `searchParams` needed here, unlike products/purchase-orders).

**Parallel-fetch + serialize pattern** (`app/(protected)/purchase-orders/page.tsx` lines 4-19):
```tsx
export default async function PurchaseOrdersPage() {
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  })

  const serialized = purchaseOrders.map((po) => ({
    ...po,
    totalAmount: po.totalAmount.toNumber(),
  }))

  return <PurchaseOrdersClient purchaseOrders={serialized} />
}
```
Dashboard should mirror the `Promise.all([...])` shape already used in `app/(protected)/inventory/page.tsx` lines 45-60 (two parallel Prisma calls) — extend to 5 parallel calls (product count, supplier count, stockTransaction count, low-stock count, purchaseOrder groupBy). No `Decimal` fields are touched (all counts), so no `.toNumber()` conversion is needed here — but follow the same "compute plain-object props before returning JSX" discipline as the PO page's `serialized` variable.

**Import pattern** (`app/(protected)/products/page.tsx` lines 1-3):
```tsx
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import ProductsClient from "./products-client"
```
Dashboard needs only `prisma` (no `auth()` call needed in the page body — manager-only access is already enforced by `middleware.ts`'s `MANAGER_ROUTES`, verified, no new code required).

**Prisma FieldRef cross-column comparison** (new pattern for this codebase, confirmed by RESEARCH.md against installed Prisma 6.19.3 types — no existing codebase analog to copy from verbatim since this is the first use, but the shape is a direct extension of the `where` object pattern in `app/(protected)/inventory/page.tsx` lines 20-43):
```typescript
const lowStockCount = await prisma.product.count({
  where: {
    isActive: true,
    currentStock: { lte: prisma.product.fields.reorderThreshold },
  },
})
```

**UTC day-boundary pattern** (extend `app/(protected)/inventory/page.tsx` lines 31-38's `from`/`to` boundary style to "today" instead of a param range):
```typescript
// inventory/page.tsx style (params.from/params.to → gte/lte with T00:00:00.000Z / T23:59:59.999Z)
if (params.from) { where.createdAt.gte = new Date(`${params.from}T00:00:00.000Z`) }
if (params.to) { where.createdAt.lte = new Date(`${params.to}T23:59:59.999Z`) }
// Dashboard variant — no params, always "today" in UTC:
const now = new Date()
const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))
```

**groupBy zero-fill pattern** (new, no existing analog — first `groupBy` use in codebase; write as):
```typescript
const groups = await prisma.purchaseOrder.groupBy({ by: ["status"], _count: { status: true } })
const poStatusCounts: Record<"DRAFT"|"ORDERED"|"RECEIVED", number> = { DRAFT: 0, ORDERED: 0, RECEIVED: 0 }
for (const g of groups) poStatusCounts[g.status] = g._count.status
```

---

### `app/(protected)/dashboard/dashboard-client.tsx` (new file, `"use client"`)

**Analog:** `app/(protected)/purchase-orders/purchase-orders-client.tsx` (imports convention, `Link`/`useRouter`-style navigation, Card usage)

**Imports pattern** (`purchase-orders-client.tsx` lines 1-21):
```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { PackagePlus, ClipboardList } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { getStatusBadge, type POStatus } from "@/lib/utils/po-status"
```
Dashboard-client swaps `Table`/`Tabs` imports for `recharts` (`PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer`) and adds `useRouter` from `next/navigation` (not present in this analog — new for this phase, per RESEARCH.md Pattern 3). Reuse `Card` from `@/components/ui/card` (see Card excerpt below) and `getStatusBadge`'s color families from `lib/utils/po-status.ts` (NOT the function itself — pie chart needs solid hex, not Tailwind classes; see Shared Patterns below).

**Card component surface** (`components/ui/card.tsx` lines 5-21, exported as plain `<Card className=...>`):
```tsx
function Card({ className, size = "default", ...props }: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn("group/card flex flex-col gap-(--card-spacing) ... ring-1 ring-foreground/10 ...", className)}
      {...props}
    />
  )
}
```
KPI tiles use bare `<Card className="p-4 flex items-center gap-3">...</Card>` — no `CardHeader`/`CardContent` subcomponents needed for the tile shape (UI-SPEC confirms this flat layout).

**Click-to-navigate pattern (KPI tile, real Link — not client push):**
```tsx
<Link href="/products?stock=low">
  <Card className="p-4 flex items-center gap-3 hover:bg-muted/50 cursor-pointer transition-colors">
    <AlertTriangle className="h-8 w-8 text-amber-600" />
    <div>
      <p className="text-2xl font-semibold">{lowStockCount}</p>
      <p className="text-sm text-muted-foreground">Low Stock Items</p>
    </div>
  </Card>
</Link>
```

**Pie chart click-to-navigate (client-side `router.push`, new pattern — RESEARCH.md Pattern 3 verbatim):**
```tsx
"use client"
import { useRouter } from "next/navigation"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"

const STATUS_COLORS = { DRAFT: "#64748b", ORDERED: "#3b82f6", RECEIVED: "#22c55e" }

const router = useRouter()
const pieData = [
  { name: "Draft", status: "DRAFT", value: poStatusCounts.DRAFT },
  { name: "Ordered", status: "ORDERED", value: poStatusCounts.ORDERED },
  { name: "Received", status: "RECEIVED", value: poStatusCounts.RECEIVED },
]
<PieChart>
  <Pie data={pieData} dataKey="value" nameKey="name"
       onClick={(entry) => router.push(`/purchase-orders?status=${entry.status}`)}
       cursor="pointer">
    {pieData.map((entry) => (<Cell key={entry.status} fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS]} />))}
  </Pie>
  <Tooltip /><Legend />
</PieChart>
```
Note (RESEARCH.md Open Question A1/A2): verify the exact `onClick` payload shape (`entry.status` vs `entry.payload.status`) with a one-time `console.log` during implementation — Recharts 3.x event shape not 100% confirmed from docs.

**Empty-state pattern to mirror** (`purchase-orders-client.tsx` uses `ClipboardList` icon for empty PO state — reuse identical icon/copy per UI-SPEC Screen 1):
```tsx
<div className="flex flex-col items-center py-12 text-center">
  <ClipboardList className="w-8 h-8 text-muted-foreground/30 mb-3" />
  <p className="text-sm font-medium">No purchase orders yet</p>
  <p className="text-sm text-muted-foreground mt-1">Create a purchase order to see status breakdown here.</p>
</div>
```

---

### `app/(protected)/products/page.tsx` (MODIFY — add `?stock=low` searchParams filtering)

**Analog:** `app/(protected)/inventory/page.tsx` (canonical searchParams + Prisma `where`-building pattern)

**Full analog searchParams pattern to replicate** (`inventory/page.tsx` lines 6-44):
```tsx
type SearchParams = { productId?: string; from?: string; to?: string; type?: string }
type Props = { searchParams: Promise<SearchParams> }

export default async function InventoryPage({ searchParams }: Props) {
  const params = await searchParams
  const where: Prisma.StockTransactionWhereInput = {}
  if (params.productId) { where.productId = params.productId }
  if (params.type === "STOCK_IN") { where.type = "STOCK_IN" }
  else if (params.type === "STOCK_OUT") { where.type = "STOCK_OUT" }
  // ... date-range building ...
}
```
Products page equivalent: `type SearchParams = { stock?: string }`, `type Props = { searchParams: Promise<SearchParams> }`, whitelist-check `params.stock === "low"` exactly (RESEARCH.md Pitfall 2 — any other value/absence = unfiltered, never throw).

**Current products/page.tsx to extend** (full file, lines 1-40 — note: NOT currently async-destructured searchParams, and fetches ALL products unfiltered by `isActive`; must add `isActive: true` + conditional `currentStock` FieldRef filter when `stock=low`):
```tsx
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import ProductsClient from "./products-client"

export default async function ProductsPage() {
  const [products, categories, session] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "asc" },
      include: { category: { select: { id: true, name: true, isActive: true } } },
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    auth(),
  ])

  return (
    <ProductsClient
      products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, categoryId: p.categoryId,
        categoryName: p.category.name, categoryIsActive: p.category.isActive,
        reorderThreshold: p.reorderThreshold, currentStock: p.currentStock, isActive: p.isActive }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      isManager={session?.user?.role === "MANAGER"}
    />
  )
}
```
Add `searchParams: Promise<{stock?: string}>` param, conditionally add `where: { isActive: true, currentStock: { lte: prisma.product.fields.reorderThreshold } }` to the `findMany` call when `stock === "low"`, and pass `isLowStockFiltered` + `lowStockCount` (a separate `.count()` call, or `products.length` post-filter) down to `ProductsClient`.

---

### `app/(protected)/products/products-client.tsx` (MODIFY — add low-stock banner)

**Analog:** itself (extend existing file's own conventions)

**Import block already present** (lines 1-56) — reuse `Card`, `Badge`, `getSeverityBadge` already imported; add `AlertTriangle` and `Link` from `lucide-react`/`next/link` (not currently imported per lines 1-56, must add):
```tsx
"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, EyeOff, Eye, Loader2, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { getSeverityBadge, SeverityBadgeProps } from "@/lib/utils/severity"
```

**Banner markup** (new, per 05-UI-SPEC.md Component Inventory — no existing `Alert` component in this codebase; build inline):
```tsx
<div className="flex items-center justify-between p-4 mb-4 rounded-md border border-amber-200 bg-amber-50">
  <div className="flex items-center gap-2">
    <AlertTriangle className="h-4 w-4 text-amber-600" />
    <p className="text-sm text-amber-800">
      Showing {count} low-stock product{count === 1 ? "" : "s"}
    </p>
  </div>
  <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/products" />}>
    View all products
  </Button>
</div>
```
Note: `render={<Link .../>}` + `nativeButton={false}` is this codebase's `@base-ui/react` trigger convention (per 05-UI-SPEC.md Design System — NEVER `asChild`).

**Existing empty-state pattern to mirror for filtered-empty case** (`products-client.tsx` line 6 imports `Package` icon for empty state — exact icon/copy structure confirmed present, reuse for "No low-stock products" variant per UI-SPEC).

---

### `app/(protected)/purchase-orders/page.tsx` (MODIFY — add `?status=` searchParams)

**Analog:** `app/(protected)/inventory/page.tsx` (searchParams pattern — this page currently has NONE, confirmed by direct read; RESEARCH.md Pitfall 1)

**Current file to extend** (full file, lines 1-19):
```tsx
import { prisma } from "@/lib/prisma"
import PurchaseOrdersClient from "./purchase-orders-client"

export default async function PurchaseOrdersPage() {
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { supplier: { select: { name: true } }, createdBy: { select: { name: true } } },
  })
  const serialized = purchaseOrders.map((po) => ({ ...po, totalAmount: po.totalAmount.toNumber() }))
  return <PurchaseOrdersClient purchaseOrders={serialized} />
}
```
Add `searchParams: Promise<{status?: string}>` (mirroring `inventory/page.tsx`'s `Props`/`searchParams` typing), validate against `"DRAFT"|"ORDERED"|"RECEIVED"` (case-sensitive), lowercase the validated value, and pass as new `initialFilter` prop to `PurchaseOrdersClient` — fetch/query itself does NOT need a `where` change (filtering stays client-side via existing Tabs `useState`, per UI-SPEC Screen 3).

---

### `app/(protected)/purchase-orders/purchase-orders-client.tsx` (MODIFY — seed filter from prop)

**Analog:** itself

**Current state to change** (lines 33-46):
```tsx
interface PurchaseOrdersClientProps {
  purchaseOrders: PurchaseOrder[]
}

type FilterTab = "all" | "draft" | "ordered" | "received"

export default function PurchaseOrdersClient({ purchaseOrders }: PurchaseOrdersClientProps) {
  const [filter, setFilter] = useState<FilterTab>("all")
```
Change to:
```tsx
interface PurchaseOrdersClientProps {
  purchaseOrders: PurchaseOrder[]
  initialFilter?: FilterTab
}

export default function PurchaseOrdersClient({ purchaseOrders, initialFilter }: PurchaseOrdersClientProps) {
  const [filter, setFilter] = useState<FilterTab>(initialFilter ?? "all")
```
Tabs UI itself (lines 63-74) is unchanged:
```tsx
<Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)} ...>
  <TabsList>
    <TabsTrigger value="all">All</TabsTrigger>
    <TabsTrigger value="draft">Draft</TabsTrigger>
    <TabsTrigger value="ordered">Ordered</TabsTrigger>
    <TabsTrigger value="received">Received</TabsTrigger>
  </TabsList>
</Tabs>
```

## Shared Patterns

### URL-param-driven Server Component filtering
**Source:** `app/(protected)/inventory/page.tsx` lines 6-44
**Apply to:** `app/(protected)/products/page.tsx` (`?stock=low`), `app/(protected)/purchase-orders/page.tsx` (`?status=X`)
```tsx
type SearchParams = { /* ...page-specific fields... */ }
type Props = { searchParams: Promise<SearchParams> }
export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  // whitelist-validate each param before using in a Prisma where clause or typed variable
}
```

### Whitelist validation (no error path — silent fallback)
**Source:** RESEARCH.md Pitfall 2, corroborated by the still-open `/inventory` `T-03-11` issue this phase must NOT repeat
**Apply to:** `?stock=` (only exact `"low"` triggers filter) and `?status=` (only `"DRAFT"|"ORDERED"|"RECEIVED"` accepted) — any other value silently falls back to the unfiltered/default view, never throws.

### Severity color/tier reuse (NOT re-derived)
**Source:** `lib/utils/severity.ts` lines 11-31 (`getSeverityBadge`)
**Apply to:** Low-stock KPI tile icon color (`text-amber-600`, matching the "Warning" tier's amber family) and the `/products` banner's amber styling. Do not reinvent the color mapping — reuse the same amber family already locked in this file.

### PO status color family reuse (badge classes → solid hex for chart)
**Source:** `lib/utils/po-status.ts` lines 11-28 (`getStatusBadge`)
**Apply to:** Dashboard pie chart `STATUS_COLORS` map — same slate/blue/green family as the existing badges, but as solid hex (`#64748b`/`#3b82f6`/`#22c55e`) since Recharts SVG `fill` doesn't reliably support the Tailwind/CSS-variable classes the badges use.

### Card component for KPI tiles and panel container
**Source:** `components/ui/card.tsx` lines 5-21
**Apply to:** All 4 KPI tiles and the PO status panel wrapper in `dashboard-client.tsx` — bare `<Card className="p-4 ...">`, no subcomponents needed.

### Decimal-safe Server→Client boundary
**Source:** `app/(protected)/purchase-orders/page.tsx` lines 13-16 (`po.totalAmount.toNumber()`)
**Apply to:** Dashboard's PO status aggregation — use `groupBy({ by: ["status"], _count: { status: true } })` which never selects `totalAmount`, sidestepping the Decimal-serialization issue entirely (no `.toNumber()` call needed because the field is never fetched).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Recharts `<PieChart>` click-to-navigate wiring (inside `dashboard-client.tsx`) | component (chart) | event-driven | First use of Recharts anywhere in this codebase — no prior chart component to copy from; pattern sourced from RESEARCH.md's synthesized Code Example instead (flagged there as an Open Question re: exact `onClick` payload shape). |
| `prisma.product.fields.reorderThreshold` FieldRef comparison | query pattern | CRUD | First use of Prisma's FieldRef API in this codebase — no prior cross-column `where` filter exists to copy from; pattern sourced from RESEARCH.md's direct grep of installed Prisma client types. |
| Inline banner `<div>` (low-stock filter indicator) | component | request-response | No `Alert`/inline-banner shadcn component exists anywhere in this codebase (only `alert-dialog`, a modal) — built fresh per RESEARCH.md Pitfall 4 and 05-UI-SPEC.md, following the amber color family from `lib/utils/severity.ts` but with no structural analog to copy layout from beyond generic flex/div conventions already used in empty-states.

## Metadata

**Analog search scope:** `app/(protected)/inventory/`, `app/(protected)/products/`, `app/(protected)/purchase-orders/`, `app/(protected)/dashboard/`, `lib/utils/`, `components/ui/`
**Files scanned:** 9 (inventory/page.tsx, products/page.tsx, products-client.tsx, purchase-orders/page.tsx, purchase-orders-client.tsx, dashboard/page.tsx, severity.ts, po-status.ts, card.tsx)
**Pattern extraction date:** 2026-07-06
