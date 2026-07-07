# Phase 6: Reports - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 6 (1 modified page, 1 new client, 3 new Route Handlers, 1 optional shared util)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `app/(protected)/reports/page.tsx` | route (Server Component page) | CRUD (read, single-query-by-searchParam) | `app/(protected)/purchase-orders/page.tsx` (Tabs/searchParam validation) + `app/(protected)/inventory/page.tsx` (date-range where-clause shape) | exact (composite of two analogs) |
| `app/(protected)/reports/reports-client.tsx` | component (client, Tabs + tables) | request-response | `app/(protected)/purchase-orders/purchase-orders-client.tsx` | exact |
| `app/api/reports/inventory/route.ts` | route (API Route Handler, file-streaming) | file-I/O | `app/api/auth/[...nextauth]/route.ts` | poor (see note below) — RESEARCH.md Pattern 3 code example is the real analog |
| `app/api/reports/movements/route.ts` | route (API Route Handler, file-streaming) | file-I/O | `app/api/auth/[...nextauth]/route.ts` | poor (see note below) |
| `app/api/reports/purchase-orders/route.ts` | route (API Route Handler, file-streaming) | file-I/O | `app/api/auth/[...nextauth]/route.ts` | poor (see note below) |
| `lib/utils/reports.ts` (optional shared helper) | utility | transform | `lib/utils/severity.ts` / `lib/utils/po-status.ts` (small pure-function utility file shape) | role-match |

**Note on the Route Handler analog:** `app/api/auth/[...nextauth]/route.ts` is the *only* Route Handler that exists in this codebase today, but it is a poor pattern match for `/api/reports/*`. It is a 2-line re-export of NextAuth's own `handlers` object — it does no session/role check itself (login must be reachable *without* a session), does no Prisma query, and streams no binary body. None of that transfers to this phase's need. Do **not** copy its shape. Instead:
- **Auth pattern to copy:** `requireManager()` from `actions/products.ts` (Server Action convention) — but note it returns `{ error: string }`, not an HTTP `Response`. Route Handlers need a variant that returns `new Response(..., { status: 401/403 })` instead. Write this as new code (RESEARCH.md Pitfall 2 confirms `middleware.ts`'s matcher excludes all `/api/*`, so this check is NOT inherited).
- **Query-re-derivation pattern to copy:** `app/(protected)/purchase-orders/page.tsx` (Prisma query + `.toNumber()` Decimal serialization) and `app/(protected)/inventory/page.tsx` (date-range `where` clause construction, but with the T-03-11 date bug fixed per D-08 — do not copy its unguarded `new Date(params.from)` forward).
- **Binary-streaming shape:** No in-repo precedent exists; use RESEARCH.md's "Pattern 3" and "Code Examples" sections verbatim (`XLSX.utils.json_to_sheet` → `XLSX.write(wb, {type:"buffer", bookType:"xlsx"})` → `new Response(buffer, {headers: {...}})`).

## Pattern Assignments

### `app/(protected)/reports/page.tsx` (route, CRUD read)

**Analogs:** `app/(protected)/purchase-orders/page.tsx` (whitelist + searchParams shape) and `app/(protected)/inventory/page.tsx` (date-range where-clause + `Suspense` wrap + `Prisma` where-type import)

**Whitelist-then-fallback searchParam pattern** (`app/(protected)/purchase-orders/page.tsx` lines 4-16):
```typescript
const VALID_STATUSES = ["DRAFT", "ORDERED", "RECEIVED"] as const

type SearchParams = { status?: string }
type Props = { searchParams: Promise<SearchParams> }

export default async function PurchaseOrdersPage({ searchParams }: Props) {
  const params = await searchParams
  const isValidStatus = (VALID_STATUSES as readonly string[]).includes(
    params.status ?? ""
  )
  const initialFilter = isValidStatus
    ? (params.status!.toLowerCase() as "draft" | "ordered" | "received")
    : undefined
```
Apply the identical shape for `?type=` → `["inventory", "movements", "purchase-orders"]`, default `"inventory"` (D-02). This is the base pattern the entire page's control flow hangs off — only run the one Prisma query matching the resolved type (D-03).

**Decimal serialization before passing to client** (`app/(protected)/purchase-orders/page.tsx` lines 26-29):
```typescript
const serialized = purchaseOrders.map((po) => ({
  ...po,
  totalAmount: po.totalAmount.toNumber(),
}))
```
Reuse verbatim for the Purchase Orders tab's query. `totalAmount` must be read from this stored column — never recomputed from line items (RESEARCH.md Anti-Pattern, Don't Hand-Roll).

**Date-range where-clause shape — copy the STRUCTURE, NOT the validation** (`app/(protected)/inventory/page.tsx` lines 31-43):
```typescript
if (params.from || params.to) {
  where.createdAt = {}
  if (params.from) {
    where.createdAt.gte = new Date(`${params.from}T00:00:00.000Z`)
  }
  if (params.to) {
    where.createdAt.lte = new Date(`${params.to}T23:59:59.999Z`)
  }
} else {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  where.createdAt = { gte: thirtyDaysAgo }
}
```
**This is T-03-11: `new Date(params.from)` here is unguarded** — a malformed string produces `Invalid Date`, which Prisma rejects with an unhandled 500 (confirmed in `03-SECURITY.md`). D-08 requires the movement report to NOT inherit this bug. Replace the inner `new Date(...)` calls with the regex-guarded `resolveDateRange()` helper from RESEARCH.md Pattern 2:
```typescript
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function resolveDateRange(from?: string, to?: string) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const gte = from && DATE_RE.test(from) ? new Date(`${from}T00:00:00.000Z`) : thirtyDaysAgo
  const lte = to && DATE_RE.test(to) ? new Date(`${to}T23:59:59.999Z`) : new Date()

  return { gte, lte }
}
```
Same helper must be duplicated (or shared via `lib/utils/reports.ts`) in the movements Route Handler, since it re-derives its own query independently (Pattern 3, D-04).

**Product query for inventory tab** — mirror `app/(protected)/products/page.tsx` lines 29-42 (`prisma.product.findMany` + `category: { select }`), but per the UI-SPEC's resolved discretion, do NOT filter to `isActive: true` only — include all products (active + inactive), matching REPT-01's literal "for all products" wording.

---

### `app/(protected)/reports/reports-client.tsx` (component, request-response)

**Analog:** `app/(protected)/purchase-orders/purchase-orders-client.tsx`

**Imports pattern** (lines 1-21):
```typescript
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
For reports-client.tsx, swap `PackagePlus` (unused — no create CTA per UI-SPEC's "no primary CTA this phase") for `Download` (export icon), and add `getSeverityBadge` (severity.ts) + `getTypeBadgeClass`/`formatDateTime` (copy these two small functions out of `inventory-client.tsx` lines 64-78, since they are not currently exported from a shared util — either import if made shared, or duplicate verbatim, matching Don't Hand-Roll).

**Tabs pattern, seeded from validated prop — this is the D-01/D-02 shape to copy exactly** (lines 33, 46-47, 64-75):
```typescript
type FilterTab = "all" | "draft" | "ordered" | "received"

interface PurchaseOrdersClientProps {
  purchaseOrders: PurchaseOrder[]
  initialFilter?: FilterTab
}

export default function PurchaseOrdersClient({ purchaseOrders, initialFilter }: PurchaseOrdersClientProps) {
  const [filter, setFilter] = useState<FilterTab>(initialFilter ?? "all")
  ...
  <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)} className="mb-4">
    <TabsList>
      <TabsTrigger value="all">All</TabsTrigger>
      ...
```
IMPORTANT deviation for reports: D-03 requires tab switching to be a **full server navigation** (`router.push` triggering a new page load with a new `?type=`), NOT a client-side `useState` filter of already-fetched data as `purchase-orders-client.tsx` does. Use `useRouter()` + `router.push(`/reports?type=${value}`)` in `onValueChange` instead of a bare `setState`. `inventory-client.tsx`'s `updateFilter()` (referenced in RESEARCH.md Interaction Contracts) is the actual reference for this router-push-on-change mechanic — read that function's exact body when implementing (it was not included in this pattern excerpt; grep `updateFilter` in `inventory-client.tsx` at execution time).

**Empty state markup shape** (lines 92-116) — copy the `TableCell colSpan={N}` + centered icon + two-line-copy structure verbatim, substituting `ClipboardList`/`Package`/`ArrowLeftRight` icons and copy per UI-SPEC's three empty-state definitions.

**Currency formatter** (lines 40-44):
```typescript
const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
})
```
Reuse verbatim for the PO report's Total column — do not redefine a second instance with different options.

**Export link markup (D-06)** — new pattern, not in this analog; use the exact `render={<a href download>}` shape already specified in `06-UI-SPEC.md` Component Inventory section (`Button variant="outline" nativeButton={false} render={<a href=... download />}`). No `onClick`, no `useState` for loading.

---

### `app/api/reports/{inventory,movements,purchase-orders}/route.ts` (route, file-I/O)

**No usable in-repo analog** (see File Classification note above — `app/api/auth/[...nextauth]/route.ts` is a 2-line re-export and does not exercise any of: role-gating, Prisma queries, or binary responses). Build these three files from three separate sources combined:

**1. Auth gate — adapt, don't copy verbatim** (`actions/products.ts` lines 11-17):
```typescript
async function requireManager(): Promise<{ error: string } | null> {
  const session = await auth()
  if (session?.user?.role !== "MANAGER") {
    return { error: "Unauthorized" }
  }
  return null
}
```
This returns a plain object for Server Action callers. Route Handlers need an HTTP-response-returning variant:
```typescript
const session = await auth()
if (session?.user?.role !== "MANAGER") {
  return new Response("Unauthorized", { status: 403 })
}
```
This MUST be the first statement in every `/api/reports/*` `GET`, since `middleware.ts`'s `config.matcher` (`["/((?!api|_next/static|_next/image|favicon.ico).*)"]`) explicitly excludes `/api/*` — there is zero inherited protection here (RESEARCH.md Pitfall 2, confirmed by direct read of `middleware.ts` line 47).

**2. Query re-derivation — copy shape from page.tsx queries**, independently re-parsing `request.nextUrl.searchParams` rather than trusting any client state (Pattern 3). Do not import/reuse the page's query result.

**3. Workbook construction + streaming response — RESEARCH.md Pattern 3 code example (full, verified-against-SheetJS-docs shape)**:
```typescript
import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== "MANAGER") {
    return new Response("Unauthorized", { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const { gte, lte } = resolveDateRange(
    searchParams.get("from") ?? undefined,
    searchParams.get("to") ?? undefined
  )

  const transactions = await prisma.stockTransaction.findMany({
    where: { createdAt: { gte, lte } },
    orderBy: [{ product: { name: "asc" } }, { createdAt: "desc" }],
    include: { product: { select: { name: true, sku: true } }, createdBy: { select: { name: true } } },
  })

  const rows = transactions.map((t) => ({
    Product: t.product.name,
    SKU: t.product.sku,
    Type: t.type,
    Quantity: t.quantity,
    Reason: t.reason,
    Date: t.createdAt.toISOString().slice(0, 10),
    "Recorded By": t.createdBy.name,
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, "Movements")
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="movements-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
```
This is the `movements` handler; `inventory` and `purchase-orders` follow the identical GET-handler skeleton (auth gate → query → row-map → workbook → Response), swapping the Prisma query and row-shape per report. For the PO report, `Total` row value must be `po.totalAmount.toNumber()` (Decimal → number, per Pitfall 4) — never recomputed.

**Error handling pattern:** None of the existing analogs (`purchase-orders/page.tsx`, `inventory/page.tsx`) wrap their Prisma calls in try/catch — there is no error boundary anywhere under `app/` (confirmed in RESEARCH.md Pitfall 3). Match this convention: no try/catch around the Prisma query itself; the only defensive code is the whitelist/regex-then-fallback validation happening BEFORE the query runs, so the query itself never receives malformed input.

---

### `lib/utils/reports.ts` (optional, utility/transform)

**Analog:** `lib/utils/severity.ts` / `lib/utils/po-status.ts` — small, single-purpose pure-function files with a one-line header comment citing their originating phase/decision:
```typescript
// Severity tier logic — source: 02-CONTEXT.md D-06 + 02-UI-SPEC.md Color section
// Shared between Phase 2 (Products page) and Phase 3 (Warehouse inventory screens)

export type SeverityTier = "Critical" | "Warning" | "OK"
...
export function getSeverityBadge(currentStock: number, reorderThreshold: number): SeverityBadgeProps { ... }
```
If created, `lib/utils/reports.ts` should follow this exact shape: header comment citing `06-CONTEXT.md`/`06-RESEARCH.md`, named exports only (no default export), pure functions with explicit param/return types. Candidates to extract here (used 3x across Route Handlers + page.tsx): `resolveDateRange()` (Pattern 2), an Excel filename builder (`{type}-report-{date}.xlsx` per UI-SPEC Copywriting Contract), and a `DATE_RE` constant.

---

## Shared Patterns

### Whitelist-then-fallback searchParam validation
**Source:** `app/(protected)/purchase-orders/page.tsx` lines 4-16
**Apply to:** `reports/page.tsx` (`?type=`) and all three Route Handlers + `reports/page.tsx` again (`?from=`/`?to=`, extended with the `DATE_RE` regex per Pattern 2)
```typescript
const isValidStatus = (VALID_STATUSES as readonly string[]).includes(params.status ?? "")
```

### Manager-only route protection
**Source (page-level, already inherited automatically):** `middleware.ts` lines 10, 36-41 — `MANAGER_ROUTES` array includes `/reports`, no new work needed on the page itself.
**Source (Route-Handler-level, NOT inherited — new code required):** `actions/products.ts` lines 11-17 `requireManager()`, adapted to return `new Response(..., {status})` instead of `{error}`.
**Apply to:** All three `/api/reports/*` Route Handlers — this is the single most important shared pattern in this phase per RESEARCH.md Pitfall 2/Security Domain V4.

### Severity / status / type badge reuse
**Source:** `lib/utils/severity.ts` (`getSeverityBadge`), `lib/utils/po-status.ts` (`getStatusBadge`), `inventory-client.tsx` lines 64-68 (`getTypeBadgeClass`)
**Apply to:** Inventory tab (severity), Purchase Orders tab (status), Movements tab (stock in/out type) — reuse verbatim, do not reimplement (RESEARCH.md Don't Hand-Roll).

### Decimal → number serialization before client/export boundary
**Source:** `app/(protected)/purchase-orders/page.tsx` lines 26-29 (`po.totalAmount.toNumber()`)
**Apply to:** Purchase Orders tab query in `page.tsx` AND independently again in `app/api/reports/purchase-orders/route.ts` (Route Handler re-runs its own query, so this conversion must happen a second time there — Pitfall 4).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/api/reports/*/route.ts` (binary xlsx streaming body) | route | file-I/O | No prior Route Handler in this codebase streams a binary file or builds an in-memory workbook — `app/api/auth/[...nextauth]/route.ts` is the only Route Handler and is a pure re-export with no query/auth/streaming logic. Use RESEARCH.md's Pattern 3 / Code Examples sections (third-party-sourced, `[CITED]` not `[VERIFIED]`) as the primary reference instead of an in-repo analog. |

## Metadata

**Analog search scope:** `app/(protected)/purchase-orders/`, `app/(protected)/inventory/`, `app/(protected)/products/`, `app/api/auth/[...nextauth]/`, `lib/utils/`, `actions/products.ts`, `middleware.ts`, `lib/auth.ts`
**Files scanned:** 9 read directly this session (plus prior RESEARCH.md's own direct-read list, cross-referenced)
**Pattern extraction date:** 2026-07-07
