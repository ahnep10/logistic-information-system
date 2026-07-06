# Phase 5: Dashboard - Research

**Researched:** 2026-07-06
**Domain:** Server-rendered KPI dashboard with a first-time Recharts integration, cross-column Prisma filtering, and URL-param-driven drill-down navigation (Next.js 15 App Router)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The low-stock KPI links to `/products?stock=low`, NOT `/inventory`. `/inventory` is stock-transaction history (Phase 3) with no severity concept; `/products` already has the Critical/Warning/OK severity badges (02-CONTEXT D-06) that "low-stock" means. REQUIREMENTS.md's phrasing ("inventory list") refers to the product-with-severity view conceptually, not the literal `/inventory` route.
- **D-02:** `/products` gains server-side URL-param filtering: when `?stock=low` is present, the page's Prisma query adds `currentStock <= reorderThreshold` (raw `Prisma.sql`/`$queryRaw` comparison across two columns, since Prisma's fluent API can't compare one column to another — use a raw `WHERE "currentStock" <= "reorderThreshold"` fragment, or fetch all active products and filter in the Server Component before passing to the client). This matches the URL-driven filtering convention already established on `/inventory` (03-CONTEXT).
- **D-03:** The combined "low-stock" definition is already locked from Phase 2 (02-CONTEXT D-07): `currentStock <= reorderThreshold` (Warning + Critical tiers combined). Do not re-derive; reuse `getSeverityBadge` from `lib/utils/severity.ts` for tier display, and the same `<=` comparison for the count query.
- **D-04:** Both the low-stock KPI count and the `?stock=low` filtered list include **active products only** (`isActive: true`) — consistent with the "total active products" tile and the Phase 2/3 convention of excluding deactivated products from operational views.
- **D-05:** When `?stock=low` is active, `/products` shows a banner/badge above the table (e.g., "Showing N low-stock products" with a link/button back to `/products` with no query params) so the filtered state is visually obvious, not silent.
- **D-06:** Single page, top-to-bottom: 4 KPI tiles in a responsive grid row, PO status summary panel below.
- **D-07:** KPI tiles reuse the existing `Card` component (`components/ui/card.tsx`) in a 4-column grid (collapsing responsively), each with a Lucide icon (e.g., `Package` for products, `Truck` for suppliers, `Activity` for movements today, `AlertTriangle` for low-stock) alongside the number and label — consistent with existing icon usage.
- **D-08:** PO status summary is a Recharts pie chart (3 slices: Draft/Ordered/Received) rather than plain count badges — Recharts is already in the stack (for Phase 6 reports) and this is its first use in the app.
- **D-09:** Pie chart slices are clickable — clicking a slice navigates to `/purchase-orders?status={STATUS}`, mirroring the low-stock drill-down pattern. `/purchase-orders` already supports Tabs-based status filtering (04-CONTEXT D-18); this adds a URL param that pre-selects the matching tab on load.
- **D-10:** "Stock movements recorded today" uses **UTC calendar day** boundaries (`createdAt >= T00:00:00.000Z` and `<= T23:59:59.999Z` for the current UTC date) — the exact convention already used by `/inventory`'s date-range filters (03-CONTEXT), for consistency across the app. Not local server time, not a rolling 24h window.
- **D-11:** KPI counts: total active products = `Product.count({ isActive: true })`; total active suppliers = `Supplier.count({ isActive: true })`; movements today = `StockTransaction.count({ createdAt: { gte, lte } })` (today's UTC boundaries, D-10); low-stock count = active products where `currentStock <= reorderThreshold` (D-03/D-04). PO status summary = `PurchaseOrder.groupBy(['status'], { _count: true })`.

### Claude's Discretion

- Exact Prisma query shape for the cross-column `currentStock <= reorderThreshold` comparison (raw SQL fragment vs. fetch-then-filter in the Server Component) — pick whichever is simplest given Prisma 6's current API; dataset size is SME-scale so in-memory filtering after `findMany` is acceptable if raw SQL comparison proves awkward.
- Exact KPI tile icon choices (as long as they're from `lucide-react`, already a dependency) and Recharts pie chart color/legend styling — follow the existing severity-badge color conventions (red/amber/green-family) where there's a natural mapping, otherwise pick colors consistent with the app's existing palette.
- Whether the `/products` "back to full list" link (D-05) is a Button, a plain link, or an "X" dismiss affordance — pick whichever fits the existing banner/alert patterns in the codebase, or introduce a simple one if none exists.
- Grid breakpoints/responsive collapse behavior for the 4-tile row — follow whatever responsive Tailwind conventions are already used elsewhere.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. (DASH-V2-01 auto-refresh and DASH-V2-02 sparklines were already tracked as v2 deferrals in REQUIREMENTS.md prior to this discussion, not new deferrals from this session.)

**Research note on D-02:** Research below supersedes the raw-SQL default in D-02 with a superior third option Claude's Discretion explicitly permits ("pick whichever is simplest given Prisma 6's current API"): Prisma's native `<model>.fields.<column>` FieldRef comparison, confirmed present and fully typed in this project's installed Prisma 6.19.3 client. It requires neither `$queryRaw` nor fetch-then-filter. See "Standard Stack" and "Code Examples" below.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Manager sees a dashboard with real-time KPIs: total active products, total active suppliers, stock movements recorded today, and count of low-stock items | Prisma `count()` queries confirmed against actual schema field names (`Product.isActive`, `Supplier.isActive`, `StockTransaction.createdAt`); UTC day-boundary pattern copied verbatim from `/inventory` page.tsx (verified by direct read) |
| DASH-02 | Low-stock item count on dashboard is clickable and drills into the filtered inventory list showing only low-stock products | `prisma.product.fields.reorderThreshold` FieldRef comparison (verified in installed client types) for both the count and the `/products?stock=low` filtered query; URL-param pattern copied from `/inventory` page.tsx |
| DASH-03 | Dashboard shows a PO status summary (count of POs in each status: Draft, Ordered, Received) | `PurchaseOrder.groupBy(['status'], { _count: true })` (verified `groupBy` exists on generated client); Recharts 3.9.2 PieChart pattern with click-to-navigate; color mapping reused from `lib/utils/po-status.ts` |
</phase_requirements>

## Summary

Phase 5 is a read-only aggregation page: four Prisma `count()`/`groupBy()` queries in a Server Component, rendered as KPI tiles and a pie chart, with two drill-down links into pages this phase also modifies (`/products`, `/purchase-orders`) to accept new URL filter params. No schema changes, no new Server Actions, no new mutations — the primary risk areas are (1) correctly implementing the two-column Prisma comparison for low-stock, (2) correctly wiring the Recharts Server→Client Component split for the pie chart's click-to-navigate behavior (Recharts' first use in this codebase), and (3) reconciling CONTEXT.md's assumption that `/purchase-orders` "already supports" URL-param status filtering — it does not; it currently only has client-side `useState` Tabs filtering with no `searchParams` read at all.

The most significant finding supersedes CONTEXT.md D-02's raw-SQL default: this project's installed Prisma Client (6.19.3, generated from `prisma/schema.prisma`) already exposes `prisma.product.fields.reorderThreshold` as a fully-typed `FieldRef`, confirmed directly in `node_modules/.prisma/client/index.d.ts`. This lets `currentStock <= reorderThreshold` be expressed as a normal, type-safe `where` filter — `where: { currentStock: { lte: prisma.product.fields.reorderThreshold } }` — with zero raw SQL and zero fetch-then-filter overhead. This works identically in `findMany` and `count()` since `ProductCountArgs` is built from the same `ProductWhereInput`. This has been available since Prisma 4.3.0, so it is not a version risk.

Recharts is listed in `package.json`'s intended stack (CLAUDE.md) but is **not yet an installed dependency** (`npm ls recharts` returns empty) — this phase must run `npm install recharts` before use. The latest published version, 3.9.2, declares `react`/`react-dom`/`react-is` peer dependencies covering React 19 (`^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0`), so it installs cleanly against this project's React 19.1.0 without `--legacy-peer-deps`. The click-to-navigate pattern needs a Client Component boundary: the dashboard page.tsx (Server Component) fetches all KPI + PO-status data via Prisma, and a new `dashboard-client.tsx` (or a scoped `po-status-chart.tsx`) receives the grouped counts as props and renders `<PieChart>` with an `onClick` handler on `<Pie>`/`<Cell>` that calls `useRouter().push()` from `next/navigation`.

**Primary recommendation:** Use `prisma.product.fields.reorderThreshold` FieldRef comparisons (not raw SQL, not fetch-then-filter) for the low-stock KPI and `/products?stock=low` filter; install `recharts@3.9.2` and isolate it inside a small `"use client"` component that only receives serialized PO-status counts as props; and treat `/purchase-orders` status-param support as new work (add `searchParams` reading to `page.tsx`, thread an `initialFilter` prop into `purchase-orders-client.tsx`), not an existing capability.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| KPI count aggregation (products, suppliers, movements today, low-stock) | API/Backend (Server Component + Prisma) | Database | Prisma queries run server-side in `page.tsx`; PostgreSQL executes the actual `COUNT`/comparison. No client-side aggregation. |
| PO status grouping | API/Backend (Server Component + Prisma `groupBy`) | Database | Same pattern — aggregation happens in the DB via `GROUP BY status`, not in JS. |
| Pie chart rendering + click interaction | Browser/Client (Recharts Client Component) | — | Recharts renders SVG and needs DOM event handlers (`onClick`); cannot run in a Server Component. |
| Drill-down navigation (`router.push`) | Browser/Client | Frontend Server (Next.js router match) | Client-side `useRouter().push()` triggers a Next.js App Router navigation, which re-runs the target Server Component with new `searchParams`. |
| URL-param filter parsing (`?stock=low`, `?status=DRAFT`) | API/Backend (Server Component reads `searchParams`) | — | Established `/inventory` pattern: the Server Component, not the client, rebuilds the Prisma `where` clause from `searchParams` on every navigation. |
| Access control (dashboard manager-only) | Frontend Server (middleware) | — | Already enforced by `middleware.ts`'s `MANAGER_ROUTES` list — no phase work needed here. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.9.2 | PO status pie chart | `[VERIFIED: npm registry]` Latest stable per `npm view recharts version`. Declares React 19 in `peerDependencies` (`^16.8.0 \|\| ^17.0.0 \|\| ^18.0.0 \|\| ^19.0.0` for react/react-dom/react-is per `npm view recharts@3.9.2 peerDependencies`) — installs cleanly with this project's React 19.1.0, no `--legacy-peer-deps` needed. Already the locked stack choice (CLAUDE.md, D-08); this is its first actual `npm install` and first usage in the codebase. |
| @prisma/client | 6.19.3 (already installed) | FieldRef-based cross-column comparison for low-stock | `[VERIFIED: installed node_modules types]` `prisma.product.fields.reorderThreshold` confirmed present in `node_modules/.prisma/client/index.d.ts` (`ProductFieldRefs` interface); `IntFilter.lte` accepts `number \| IntFieldRefInput<$PrismaModel>`. No new install needed — this is the already-installed client, just a previously-unused feature of it. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 1.22.0 (installed), 1.23.0 latest | KPI tile icons (`Package`, `Truck`, `Activity`, `AlertTriangle`) | `[VERIFIED: npm registry]` Already a dependency; no install needed. Current installed version is one minor behind latest — not worth bumping for this phase. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `prisma.product.fields.reorderThreshold` FieldRef | `$queryRaw`/`Prisma.sql` raw SQL (CONTEXT.md D-02's stated default) | Raw SQL works but loses type safety, requires manually mapping raw rows back to typed objects, and is unnecessary now that the FieldRef API is confirmed present in this exact installed Prisma version. Use raw SQL only if a future requirement needs a comparison Prisma's FieldRef API doesn't support (e.g., comparing across two different rows). |
| `prisma.product.fields.reorderThreshold` FieldRef | Fetch-all-then-filter in the Server Component (CONTEXT.md's stated fallback) | Acceptable at SME scale per CONTEXT.md's own discretion note, but strictly worse than the FieldRef approach: it fetches every active product's full row just to filter in JS, and duplicates the `<=` comparison logic in two places (query filter + display severity badge) instead of one. |
| Recharts `<PieChart>` | Plain count badges/table (no chart) | CONTEXT.md D-08 explicitly locks the pie chart choice to establish Recharts usage ahead of Phase 6 reports — not a discretion point. |

**Installation:**
```bash
npm install recharts@3.9.2
```

**Version verification:** Confirmed via `npm view recharts version` → `3.9.2` (registry lookup performed this session, 2026-07-06). `npm view recharts@3.9.2 peerDependencies` confirms React 19 support. `npm ls recharts` in the project returns empty — it is not yet installed despite being listed in CLAUDE.md's tech stack table, so this phase's plan must include the install step.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| recharts | npm | 10 years (first published 2015-08-07 per `npm view recharts time.created`) | 51.3M/week | github.com/recharts/recharts (official org) | SUS (automated: "too-new") | Approved with note — see below |

**Automated flag context:** `gsd-tools query package-legitimacy check` flagged `recharts` as `SUS` with reason `too-new`. Investigation shows this is a **false-positive signal**: the flag is triggered by the *latest patch version* (3.9.2) having been published 2026-07-04 — two days before this research — not by the package itself being new. The package's actual registry history spans 10 years (created 2015-08-07), it has 51.3M weekly downloads, and its repository is the official `recharts/recharts` GitHub org referenced throughout Recharts' own documentation and this project's CLAUDE.md tech stack rationale. There is no `postinstall` script (`signals.postinstall: null`).

**Recommendation:** Treat this as approved for use given the corroborating age/downloads/repo signals, but the planner should still insert a lightweight `checkpoint:human-verify` before `npm install recharts@3.9.2` per the SUS-verdict protocol, since the automated check did not clear it outright. This is a process safeguard, not a signal of actual risk.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** recharts (see note above — recommend approval with a lightweight verify checkpoint, not a full stop)

## Architecture Patterns

### System Architecture Diagram

```
Browser (manager navigates to /dashboard)
        │
        ▼
middleware.ts ── MANAGER_ROUTES check (already enforces /dashboard is manager-only)
        │ (pass)
        ▼
app/(protected)/dashboard/page.tsx  [Server Component]
        │
        ├─ prisma.product.count({ isActive: true })                          → total active products
        ├─ prisma.supplier.count({ isActive: true })                         → total active suppliers
        ├─ prisma.stockTransaction.count({ createdAt: {gte,lte} })           → movements today (UTC day)
        ├─ prisma.product.count({ isActive:true, currentStock:{lte: fields.reorderThreshold} }) → low-stock count
        ├─ prisma.purchaseOrder.groupBy(['status'], {_count:true})          → PO status breakdown
        │
        ▼ (serialize counts as plain numbers/objects — no Decimal fields involved)
DashboardClient.tsx  [Client Component, "use client"]
        │
        ├─ 4× KPI <Card> tiles (Package/Truck/Activity/AlertTriangle icons)
        │     └─ low-stock tile wrapped in <Link href="/products?stock=low">
        │
        └─ <PieChart><Pie data={...} onClick={handleSliceClick}/></PieChart>
                 │
                 └─ handleSliceClick → useRouter().push(`/purchase-orders?status=${STATUS}`)

                                    │
                                    ▼
              ┌─────────────────────────────────────────┐
              │  Drill-down targets (existing pages,      │
              │  extended this phase to read searchParams)│
              └─────────────────────────────────────────┘
                     │                              │
                     ▼                              ▼
   /products?stock=low                    /purchase-orders?status=DRAFT
   page.tsx reads searchParams.stock       page.tsx reads searchParams.status
   → adds currentStock<=fields.threshold   → passes initialFilter to client
   → products-client.tsx shows banner      → purchase-orders-client.tsx seeds
     "Showing N low-stock products"          useState(filter) from prop instead
     (D-05)                                  of hardcoded "all" (NEW — see Pitfall 1)
```

### Recommended Project Structure
```
app/(protected)/dashboard/
├── page.tsx              # Server Component: 5 Prisma queries, serializes, passes to client
└── dashboard-client.tsx  # "use client": KPI tiles + Recharts pie chart + click-to-navigate

app/(protected)/products/
├── page.tsx              # MODIFY: add searchParams: Promise<{stock?: string}>, build where clause
└── products-client.tsx   # MODIFY: accept isLowStockFiltered + count props, render banner (D-05)

app/(protected)/purchase-orders/
├── page.tsx                    # MODIFY: add searchParams: Promise<{status?: string}>, pass initialFilter
└── purchase-orders-client.tsx  # MODIFY: seed useState(filter) from initialFilter prop, validate enum
```

### Pattern 1: URL-param-driven Server Component filtering (established, replicate exactly)
**What:** The Server Component's `page.tsx` accepts a `searchParams: Promise<SearchParams>` prop (Next.js 15 makes `searchParams` async), awaits it, and conditionally builds the Prisma `where` object before querying — never filtering client-side.
**When to use:** Every drill-down target this phase touches (`/products?stock=low`, `/purchase-orders?status=X`).
**Example (from this codebase, `app/(protected)/inventory/page.tsx`, verified by direct read):**
```typescript
// Existing pattern — /inventory, Phase 3 — replicate for /products and /purchase-orders
type SearchParams = { productId?: string; from?: string; to?: string; type?: string }
type Props = { searchParams: Promise<SearchParams> }

export default async function InventoryPage({ searchParams }: Props) {
  const params = await searchParams
  const where: Prisma.StockTransactionWhereInput = {}
  if (params.type === "STOCK_IN") { where.type = "STOCK_IN" }
  // ... UTC day-boundary date filter for consistency ...
}
```

### Pattern 2: Prisma cross-column comparison via FieldRef (Prisma 4.3.0+, confirmed present in this project's 6.19.3 client)
**What:** Compare two columns of the same row without raw SQL, using `<model>.fields.<column>` as the right-hand side of a filter operator.
**When to use:** DASH-01/DASH-02 low-stock count and `/products?stock=low` filter.
**Example:**
```typescript
// Source: verified against node_modules/.prisma/client/index.d.ts (ProductFieldRefs, IntFilter.lte)
// and corroborated by Prisma's official troubleshooting article on comparing columns
// (prisma.io/docs/guides/database/troubleshooting-orm/help-articles/comparing-columns-through-raw-queries)
const lowStockCount = await prisma.product.count({
  where: {
    isActive: true,
    currentStock: { lte: prisma.product.fields.reorderThreshold },
  },
})

// Same filter reused for the /products?stock=low list query:
const lowStockProducts = await prisma.product.findMany({
  where: {
    isActive: true,
    currentStock: { lte: prisma.product.fields.reorderThreshold },
  },
  include: { category: { select: { id: true, name: true, isActive: true } } },
})
```

### Pattern 3: Server Component → Client Component split for Recharts (first use in this codebase)
**What:** Recharts components require the DOM and event handlers, so they must live behind a `"use client"` boundary. The Server Component does all data fetching/aggregation and passes only plain serializable data (numbers, strings) as props.
**When to use:** The PO status pie chart (D-08/D-09).
**Example:**
```typescript
// app/(protected)/dashboard/page.tsx (Server Component)
import { prisma } from "@/lib/prisma"
import DashboardClient from "./dashboard-client"

export default async function DashboardPage() {
  const today = new Date()
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0))
  const todayEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999))

  const [totalProducts, totalSuppliers, movementsToday, lowStockCount, poStatusGroups] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.supplier.count({ where: { isActive: true } }),
    prisma.stockTransaction.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.product.count({
      where: { isActive: true, currentStock: { lte: prisma.product.fields.reorderThreshold } },
    }),
    prisma.purchaseOrder.groupBy({ by: ["status"], _count: { status: true } }),
  ])

  const poStatusCounts = { DRAFT: 0, ORDERED: 0, RECEIVED: 0 }
  for (const g of poStatusGroups) poStatusCounts[g.status] = g._count.status

  return (
    <DashboardClient
      totalProducts={totalProducts}
      totalSuppliers={totalSuppliers}
      movementsToday={movementsToday}
      lowStockCount={lowStockCount}
      poStatusCounts={poStatusCounts}
    />
  )
}
```
```typescript
// app/(protected)/dashboard/dashboard-client.tsx ("use client")
"use client"
import { useRouter } from "next/navigation"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Package, Truck, Activity, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Card } from "@/components/ui/card"

const STATUS_COLORS = { DRAFT: "#64748b", ORDERED: "#3b82f6", RECEIVED: "#22c55e" } // matches lib/utils/po-status.ts badge colors

export default function DashboardClient({ totalProducts, totalSuppliers, movementsToday, lowStockCount, poStatusCounts }: Props) {
  const router = useRouter()
  const pieData = [
    { name: "Draft", status: "DRAFT", value: poStatusCounts.DRAFT },
    { name: "Ordered", status: "ORDERED", value: poStatusCounts.ORDERED },
    { name: "Received", status: "RECEIVED", value: poStatusCounts.RECEIVED },
  ]

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-3">
          <Package className="h-8 w-8 text-muted-foreground" />
          <div><p className="text-2xl font-semibold">{totalProducts}</p><p className="text-sm text-muted-foreground">Active Products</p></div>
        </Card>
        {/* Truck / suppliers, Activity / movements-today tiles follow same shape */}
        <Link href="/products?stock=low">
          <Card className="p-4 flex items-center gap-3 hover:bg-muted/50 cursor-pointer">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
            <div><p className="text-2xl font-semibold">{lowStockCount}</p><p className="text-sm text-muted-foreground">Low Stock Items</p></div>
          </Card>
        </Link>
      </div>

      <Card className="p-4">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              onClick={(entry) => router.push(`/purchase-orders?status=${entry.status}`)}
              cursor="pointer"
            >
              {pieData.map((entry) => (
                <Cell key={entry.status} fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Fetching all products and computing low-stock count in JS when the FieldRef API is available:** Adds an unnecessary full-table scan and duplicated comparison logic. Only fall back to this if the FieldRef approach is somehow blocked at execution time (it should not be — verified against the installed client).
- **Rendering `<PieChart>` directly inside `page.tsx`:** `page.tsx` is an `async` Server Component; Recharts requires client-side rendering and event handlers. Attempting this will fail at build/runtime with a "can't use hooks/event handlers in Server Component" style error.
- **Assuming `/purchase-orders` already reads `?status=` from the URL:** It does not (see Pitfall 1 below) — CONTEXT.md's phrasing "already supports... this adds a URL param" undersells the actual work needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-column comparison (`currentStock <= reorderThreshold`) | Custom raw-SQL builder or manual JS filter-after-fetch | `prisma.product.fields.reorderThreshold` FieldRef | Already built into the installed Prisma client; type-safe; works in both `findMany` and `count()`. |
| Pie chart rendering/SVG math | Hand-rolled SVG arcs/percentages | Recharts `<PieChart>`/`<Pie>` | Recharts already computes slice angles, hover states, and legend layout; it's the already-locked stack choice for this exact purpose. |
| PO status counting | Fetch all POs and `.reduce()` in JS | `prisma.purchaseOrder.groupBy(['status'], { _count: true })` | `GROUP BY` in Postgres is the correct place for this aggregation; already used implicitly as the standard Prisma idiom for status breakdowns. |

**Key insight:** Every technical unknown flagged for this phase (Recharts integration, cross-column Prisma filtering) already has a first-party, already-installed-dependency solution — no third-party charting-math libraries or SQL-fragment builders are needed.

## Common Pitfalls

### Pitfall 1: CONTEXT.md overstates existing `/purchase-orders` URL-param support
**What goes wrong:** CONTEXT.md D-09 says "`/purchase-orders` already supports Tabs-based status filtering... this adds a URL param that pre-selects the matching tab on load," implying the URL-param wiring is new but the underlying filtering plumbing exists. In reality, `purchase-orders-client.tsx` filters purely via a local `useState<FilterTab>("all")` with **no `searchParams` read anywhere** — `page.tsx` doesn't even declare a `searchParams` prop today.
**Why it happens:** The Tabs UI and filter *logic* exist (client-side), which can look like "the feature is done" — but the URL-param entry point genuinely does not exist yet.
**How to avoid:** Treat this as two changes, not one: (1) `page.tsx` must add `searchParams: Promise<{status?: string}>`, await it, validate against the `POStatus` enum (`DRAFT`/`ORDERED`/`RECEIVED`), and pass it as an `initialFilter` prop; (2) `purchase-orders-client.tsx`'s `useState<FilterTab>` must be seeded from that prop (lowercased to match `FilterTab`'s `"draft"|"ordered"|"received"|"all"` type) instead of the hardcoded `"all"`.
**Warning signs:** If a plan only touches `dashboard-client.tsx` and assumes clicking a pie slice will "just work" via existing Tabs state, the drill-down will silently land on the unfiltered `/purchase-orders` page with no active tab selected.

### Pitfall 2: Unvalidated query-param values reaching Prisma (repeat of a tracked Phase 3 issue)
**What goes wrong:** STATE.md already tracks an open, non-blocking issue (T-03-11) where `/inventory`'s `from`/`to` date params crash with an unhandled 500 on malformed input (`new Date("invalid")`). This phase introduces two more URL-driven filters (`?stock=low`, `?status=X`) with the same class of risk if arbitrary string values reach Prisma unchecked.
**Why it happens:** Copying the `/inventory` pattern verbatim also copies its lack of validation.
**How to avoid:** For `?stock=`, only branch behavior when the value is exactly the literal string `"low"` — any other value (or absence) falls through to the unfiltered default, no error possible. For `?status=`, validate against the `POStatus` union (`"DRAFT"|"ORDERED"|"RECEIVED"`) before using it in a Prisma `where` clause or passing it to the client; an invalid value should fall back to `"all"`, not throw.
**Warning signs:** A hand-crafted URL like `/purchase-orders?status=garbage` returning a 500 instead of the unfiltered list.

### Pitfall 3: Passing `PurchaseOrder.totalAmount` (a `Decimal`) into a Client Component unserialized
**What goes wrong:** 04-CONTEXT D-23 (referenced in this phase's CONTEXT.md "Established Patterns") already documents that Prisma `Decimal` fields must be converted with `.toNumber()` before crossing the Server→Client boundary, or Next.js throws a serialization error. This phase's PO-status aggregation only needs counts, not `totalAmount`, so the risk is avoiding accidentally `include`-ing or `select`-ing it.
**Why it happens:** Copy-pasting a `findMany`/`include` block from `purchase-orders/page.tsx` (which does select `totalAmount`) instead of writing a narrow `groupBy` that only touches `status`.
**How to avoid:** Use `prisma.purchaseOrder.groupBy({ by: ["status"], _count: { status: true } })` — this query shape never touches `totalAmount` at all, sidestepping the issue entirely.
**Warning signs:** A Next.js "Only plain objects can be passed to Client Components from Server Components" runtime error mentioning a Decimal-like object.

### Pitfall 4: No existing "banner"/inline-alert component in this codebase
**What goes wrong:** D-05 requires a "Showing N low-stock products" banner above the `/products` table. Searching `components/ui/` shows no `alert.tsx` — only `alert-dialog.tsx` (a modal, not an inline banner). A plan that assumes an `<Alert>` component exists will fail at import time.
**Why it happens:** shadcn/ui's `alert-dialog` and `alert` are separate components; only the dialog variant was ever added (`npx shadcn add alert-dialog` in an earlier phase, not `alert`).
**How to avoid:** Either (a) build a simple inline `<div>`/`<Card>` banner styled consistently with existing badge/severity color conventions (no new dependency, matches Claude's Discretion note in CONTEXT.md), or (b) explicitly add `npx shadcn add alert` as a plan step if a dedicated component is preferred. Recommend (a) for scope minimization — this is a one-off, low-complexity UI element.

## Code Examples

Verified patterns from this codebase and official sources (see inline `Source:` comments above in Architecture Patterns).

### UTC day-boundary calculation (for "movements today")
```typescript
// Pattern already established in app/(protected)/inventory/page.tsx for from/to params —
// this phase needs the *current* UTC day rather than a user-supplied range.
const now = new Date()
const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))
const movementsToday = await prisma.stockTransaction.count({
  where: { createdAt: { gte: todayStart, lte: todayEnd } },
})
```

### PO status groupBy → dashboard-friendly shape
```typescript
const groups = await prisma.purchaseOrder.groupBy({
  by: ["status"],
  _count: { status: true },
})
// groups: [{status: "DRAFT", _count: {status: 3}}, {status: "ORDERED", _count: {status: 1}}, ...]
// Note: statuses with zero POs are OMITTED by groupBy — must default-fill all three statuses to 0 first:
const poStatusCounts: Record<"DRAFT"|"ORDERED"|"RECEIVED", number> = { DRAFT: 0, ORDERED: 0, RECEIVED: 0 }
for (const g of groups) poStatusCounts[g.status] = g._count.status
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Raw SQL / `$queryRaw` for same-row column comparisons | `<model>.fields.<column>` FieldRef in normal `where` filters | Prisma 4.3.0 (2022) | This project's Prisma 6.19.3 has had this for years — CONTEXT.md's raw-SQL default (D-02) is outdated guidance; use the FieldRef approach instead. |
| Recharts 2.x (React 16-18 peer range) | Recharts 3.x (React 16-19 peer range) | Recharts 3.0 major (2025) | Installing `recharts@3.9.2` (npm `latest` tag) avoids the React 19 peer-dependency friction that affected Recharts 2.x. |

**Deprecated/outdated:**
- CONTEXT.md D-02's raw-SQL/fetch-then-filter framing for the cross-column comparison — superseded by the FieldRef API already available in this project's installed Prisma version (see Research note in User Constraints above).

## Runtime State Inventory

Not applicable — this is a greenfield feature phase (new dashboard page + additive query-param filters on two existing pages), not a rename/refactor/migration phase. No stored data, service config, OS-registered state, secrets, or build artifacts need auditing.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recharts `<Pie>`'s `onClick` handler receives an object shaped like `{ name, status, value, ... }` matching the `data` array entry, allowing `entry.status` access in the handler | Code Examples / Pattern 3 | Low — Recharts' documented `onClick` payload is the data-point object plus index/event; if the exact property path differs slightly (e.g., `payload.status` nesting), it's a one-line fix caught immediately in manual UAT (clicking a slice and observing the URL). |
| A2 | `Pie`'s `onClick` prop (rather than requiring a per-`Cell` `onClick`) is sufficient for click detection on individual slices in Recharts 3.x | Architecture Patterns / Pattern 3 | Low-Medium — Recharts has historically supported both `Pie`-level and `Cell`-level click handlers; if `Pie`-level `onClick` doesn't fire per-slice as expected in 3.x, `Cell`-level `onClick={() => ...}` (already sketched as an alternative in Code Examples) is the documented fallback. |

**If this table is empty:** N/A — see above; both entries are low-risk implementation-detail assumptions about the newly-installed Recharts library's exact event API, not architectural or business-logic assumptions. The core technical unknowns (Prisma FieldRef availability, Recharts/React 19 compatibility, Server/Client split necessity) were all directly verified against this project's installed code or the npm registry this session.

## Open Questions (RESOLVED)

1. **Exact Recharts `onClick` event payload shape in v3.9.2** — RESOLVED at planning time
   - What we know: Recharts click handlers receive the data entry (and typically an index/event) — confirmed via general Recharts API knowledge and WebSearch, not a full official-docs fetch (WebFetch attempts against `recharts.org`'s docs pages did not return usable content this session).
   - What's unclear: Whether to read `entry.status` directly or `entry.payload.status` in Recharts 3.x specifically (API shape has shifted across major versions).
   - Resolution: 05-01-PLAN.md Task 2 wires the click handler defensively — `data?.payload?.status ?? data?.status` — so either payload shape resolves correctly at runtime without further research (confirmed by gsd-plan-checker, 05-VERIFICATION.md).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | All Prisma queries (KPIs, groupBy) | Assumed ✓ (per STATE.md: Docker container `logistic-postgres` used in Phase 4) | 16.x | — |
| recharts (npm package) | PO status pie chart (D-08) | ✗ not yet installed | install `3.9.2` | None viable — chart is a locked decision (D-08), not optional |
| Node.js / npm | `npm install recharts` | ✓ (project already builds/runs) | — | — |

**Missing dependencies with no fallback:**
- `recharts` must be installed (`npm install recharts@3.9.2`) before this phase's chart component can be built. Not a blocker — trivial install step, just must be sequenced as the first task.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (installed, `vitest.config.ts` present) |
| Config file | `vitest.config.ts` (jsdom environment, `tests/setup.ts`, `passWithNoTests: true`) |
| Quick run command | `npx vitest run tests/dashboard.test.ts` |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | UTC day-boundary calculation produces correct `gte`/`lte` Date objects for "today" | unit | `npx vitest run tests/dashboard.test.ts -t "UTC day boundary"` | ❌ Wave 0 |
| DASH-01 | KPI count queries use correct Prisma filter shape (`isActive: true`, etc.) — verify via mocked Prisma client | unit | `npx vitest run tests/dashboard.test.ts -t "KPI queries"` | ❌ Wave 0 |
| DASH-02 | Low-stock FieldRef filter (`currentStock: {lte: fields.reorderThreshold}`) is applied identically in both the count query and the `?stock=low` list query | unit (mocked prisma) | `npx vitest run tests/dashboard.test.ts -t "low-stock filter"` | ❌ Wave 0 |
| DASH-02 | `/products?stock=low` searchParams parsing: `"low"` → filter applied; any other value or absent → unfiltered | unit | `npx vitest run tests/products.test.ts -t "stock param"` | ❌ Wave 0 (new test file or extend existing `catalog.test.ts`) |
| DASH-03 | `PurchaseOrder.groupBy` result correctly default-fills zero-count statuses (DRAFT/ORDERED/RECEIVED all present even if some are 0) | unit | `npx vitest run tests/dashboard.test.ts -t "groupBy zero-fill"` | ❌ Wave 0 |
| DASH-03 | `/purchase-orders?status=X` searchParams validated against `POStatus` enum; invalid values fall back to `"all"` | unit | `npx vitest run tests/purchase-orders.test.ts -t "status param"` | ❌ Wave 0 (extend existing `purchase-orders.test.ts`) |
| DASH-02/03 | Manual UAT: clicking low-stock tile navigates to `/products?stock=low` and shows correct banner; clicking a pie slice navigates to `/purchase-orders?status={STATUS}` and pre-selects the matching Tab | manual (browser) | — | N/A — requires visual/click verification, not automatable without e2e tooling (none installed) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/dashboard.test.ts` (and whichever of `products.test.ts`/`purchase-orders.test.ts` was touched)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/dashboard.test.ts` — new file; covers DASH-01/02/03 unit-testable logic (UTC boundary calc, FieldRef filter shape, groupBy zero-fill). Follow the existing `vi.mock("@/lib/prisma", ...)` pattern from `tests/purchase-orders.test.ts` for any test that needs to assert on the Prisma call shape rather than hit a real DB.
- [ ] Extend `tests/catalog.test.ts` (or create a `products.test.ts`) — covers the `?stock=low` searchParams validation branch.
- [ ] Extend `tests/purchase-orders.test.ts` — covers the `?status=X` searchParams validation branch and `FilterTab` seeding from `initialFilter`.
- [ ] No new framework/config needed — Vitest + jsdom + existing `vi.mock` conventions fully cover this phase's testable surface.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No (new work) | Already enforced app-wide via Auth.js v5 session — no changes this phase |
| V3 Session Management | No (new work) | Unchanged this phase |
| V4 Access Control | Yes (verify only, no new work) | `/dashboard` is already in `middleware.ts`'s `MANAGER_ROUTES` — confirmed by direct read of `middleware.ts`. `/products` and `/purchase-orders` are NOT manager-only (staff can view them per AUTH-03), which is correct and unchanged — the new `?stock=`/`?status=` params don't need additional role gating since they only filter an already-visible list, they don't expose new data. |
| V5 Input Validation | Yes | Validate `?stock=` against the literal string `"low"` (anything else = unfiltered, no error path); validate `?status=` against the `POStatus` union (`DRAFT`/`ORDERED`/`RECEIVED`) with fallback to `"all"` on invalid input — see Pitfall 2. Zod is available (`zod@4.4.3`) if a schema-based validation is preferred over a manual string check, though a manual check is proportionate for two single-string enum-like params. |
| V6 Cryptography | No | Not applicable — no new crypto surface this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Malformed/unexpected query-param value causing unhandled exception (500) reaching the client | Denial of Service (minor) | Whitelist-validate `?stock=`/`?status=` values before use in Prisma `where` clauses; fall back to the unfiltered/default view on any unrecognized value rather than throwing. This mirrors the fix STATE.md already recommends for the analogous, still-open `/inventory` date-param issue (T-03-11) — do not repeat that gap here. |
| Information disclosure via low-stock/PO-status counts to unauthorized roles | Information Disclosure | Not a new risk this phase — `/products` and `/purchase-orders` are already visible to both STAFF and MANAGER roles per AUTH-03 and existing middleware; the new params only filter, they don't add new fields or new access. `/dashboard` itself is already MANAGER-only. |

## Sources

### Primary (HIGH confidence)
- This project's installed Prisma Client type definitions (`node_modules/.prisma/client/index.d.ts`) — directly grepped this session to confirm `ProductFieldRefs`, `IntFilter.lte` accepting `IntFieldRefInput`, `ProductCountArgs` reuse of `ProductFindManyArgs`/`ProductWhereInput`, and `groupBy` operation presence on `PurchaseOrder`.
- This project's actual source files, read directly this session: `app/(protected)/dashboard/page.tsx`, `app/(protected)/products/page.tsx`, `app/(protected)/products/products-client.tsx`, `app/(protected)/inventory/page.tsx`, `app/(protected)/purchase-orders/page.tsx`, `app/(protected)/purchase-orders/purchase-orders-client.tsx`, `lib/utils/severity.ts`, `lib/utils/po-status.ts`, `lib/prisma.ts`, `prisma/schema.prisma`, `middleware.ts`, `package.json`, `vitest.config.ts`, `tests/purchase-orders.test.ts`, `tests/catalog.test.ts`.
- `npm view recharts version` / `npm view recharts@3.9.2 peerDependencies` / `npm view recharts time.created` — registry lookups performed this session (2026-07-06).

### Secondary (MEDIUM confidence)
- Prisma's official troubleshooting article on comparing columns via raw queries (title and URL surfaced via WebSearch: "Compare columns of the same table with raw queries", prisma.io/docs/guides/database/troubleshooting-orm/help-articles/comparing-columns-through-raw-queries) — corroborates the `<model>.fields.<column>` FieldRef syntax and the "since 4.3.0" version claim; WebFetch against the live URL this session returned an unrelated cached page, so this is cited via WebSearch snippet rather than a full page fetch, but is independently corroborated by the direct type-definition grep above (Primary).

### Tertiary (LOW confidence)
- WebSearch results on "Recharts PieChart onClick slice navigate Next.js App Router" — general pattern confirmation (Client Component + `useRouter().push()`), no single canonical code sample found; the Code Examples section's exact `onClick`/`Cell` wiring is a reasonable synthesis flagged in Open Questions/Assumptions Log for a quick manual check during implementation.
- WebSearch results on "Recharts React 19 compatibility peer dependency" — corroborated and superseded by the direct `npm view` peerDependencies check (Primary), which is authoritative for the exact installed-candidate version.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — recharts version/peer-deps confirmed via npm registry; Prisma FieldRef API confirmed via direct grep of installed client types, not just training knowledge or web search.
- Architecture: HIGH — Server/Client split pattern is a direct extension of this codebase's own established `/inventory` and `/purchase-orders` conventions, verified by reading the actual files.
- Pitfalls: HIGH — Pitfall 1 (purchase-orders URL-param gap) and Pitfall 4 (no Alert component) were discovered by direct codebase inspection this session, not assumed; Pitfall 2 references an already-tracked, still-open issue in STATE.md (T-03-11).

**Research date:** 2026-07-06
**Valid until:** 2026-08-05 (30 days — stable stack, no fast-moving dependencies; recharts version pin should be re-checked if this phase's execution is delayed past that window)
