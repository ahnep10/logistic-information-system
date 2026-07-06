# Phase 5: Dashboard - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a single `/dashboard` page (replacing the Phase 1 stub at `app/(protected)/dashboard/page.tsx`) that gives managers an at-a-glance view of operational health: four live KPI tiles (total active products, total active suppliers, stock movements recorded today, count of low-stock items) plus a PO status summary panel (Draft/Ordered/Received counts). The low-stock KPI drills into the existing `/products` page pre-filtered to show only low-stock products. The PO status panel drills into `/purchase-orders` pre-filtered by status. No auto-refresh (DASH-V2-01 is deferred to v2) — data is fetched fresh on each page load/navigation like every other Server Component page in this app.

</domain>

<decisions>
## Implementation Decisions

### Low-Stock Drill-In (DASH-02)

- **D-01:** The low-stock KPI links to `/products?stock=low`, NOT `/inventory`. `/inventory` is stock-transaction history (Phase 3) with no severity concept; `/products` already has the Critical/Warning/OK severity badges (02-CONTEXT D-06) that "low-stock" means. REQUIREMENTS.md's phrasing ("inventory list") refers to the product-with-severity view conceptually, not the literal `/inventory` route.
- **D-02:** `/products` gains server-side URL-param filtering: when `?stock=low` is present, the page's Prisma query adds `currentStock <= reorderThreshold` (raw `Prisma.sql`/`$queryRaw` comparison across two columns, since Prisma's fluent API can't compare one column to another — use a raw `WHERE "currentStock" <= "reorderThreshold"` fragment, or fetch all active products and filter in the Server Component before passing to the client). This matches the URL-driven filtering convention already established on `/inventory` (03-CONTEXT).
- **D-03:** The combined "low-stock" definition is already locked from Phase 2 (02-CONTEXT D-07): `currentStock <= reorderThreshold` (Warning + Critical tiers combined). Do not re-derive; reuse `getSeverityBadge` from `lib/utils/severity.ts` for tier display, and the same `<=` comparison for the count query.
- **D-04:** Both the low-stock KPI count and the `?stock=low` filtered list include **active products only** (`isActive: true`) — consistent with the "total active products" tile and the Phase 2/3 convention of excluding deactivated products from operational views.
- **D-05:** When `?stock=low` is active, `/products` shows a banner/badge above the table (e.g., "Showing N low-stock products" with a link/button back to `/products` with no query params) so the filtered state is visually obvious, not silent.

### Dashboard Layout & Visual Style

- **D-06:** Single page, top-to-bottom: 4 KPI tiles in a responsive grid row, PO status summary panel below.
- **D-07:** KPI tiles reuse the existing `Card` component (`components/ui/card.tsx`) in a 4-column grid (collapsing responsively), each with a Lucide icon (e.g., `Package` for products, `Truck` for suppliers, `Activity` for movements today, `AlertTriangle` for low-stock) alongside the number and label — consistent with existing icon usage (`Package` already used in `products-client.tsx`'s empty state).
- **D-08:** PO status summary is a Recharts pie chart (3 slices: Draft/Ordered/Received) rather than plain count badges — Recharts is already in the stack (for Phase 6 reports) and this is its first use in the app.
- **D-09:** Pie chart slices are clickable — clicking a slice navigates to `/purchase-orders?status={STATUS}`, mirroring the low-stock drill-down pattern. `/purchase-orders` already supports Tabs-based status filtering (04-CONTEXT D-18); this adds a URL param that pre-selects the matching tab on load.

### KPI Data & "Today" Definition

- **D-10:** "Stock movements recorded today" uses **UTC calendar day** boundaries (`createdAt >= T00:00:00.000Z` and `<= T23:59:59.999Z` for the current UTC date) — the exact convention already used by `/inventory`'s date-range filters (03-CONTEXT), for consistency across the app. Not local server time, not a rolling 24h window.
- **D-11:** KPI counts: total active products = `Product.count({ isActive: true })`; total active suppliers = `Supplier.count({ isActive: true })`; movements today = `StockTransaction.count({ createdAt: { gte, lte } })` (today's UTC boundaries, D-10); low-stock count = active products where `currentStock <= reorderThreshold` (D-03/D-04). PO status summary = `PurchaseOrder.groupBy(['status'], { _count: true })`.

### Claude's Discretion

- Exact Prisma query shape for the cross-column `currentStock <= reorderThreshold` comparison (raw SQL fragment vs. fetch-then-filter in the Server Component) — pick whichever is simplest given Prisma 6's current API; dataset size is SME-scale so in-memory filtering after `findMany` is acceptable if raw SQL comparison proves awkward.
- Exact KPI tile icon choices (as long as they're from `lucide-react`, already a dependency) and Recharts pie chart color/legend styling — follow the existing severity-badge color conventions (red/amber/green-family) where there's a natural mapping, otherwise pick colors consistent with the app's existing palette.
- Whether the `/products` "back to full list" link (D-05) is a Button, a plain link, or an "X" dismiss affordance — pick whichever fits the existing banner/alert patterns in the codebase, or introduce a simple one if none exists.
- Grid breakpoints/responsive collapse behavior for the 4-tile row — follow whatever responsive Tailwind conventions are already used elsewhere (e.g., table/card responsive behavior on `/products`, `/purchase-orders`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap

- `.planning/REQUIREMENTS.md` — DASH-01, DASH-02, DASH-03 (the 3 dashboard requirements this phase satisfies); note DASH-V2-01 (auto-refresh) and DASH-V2-02 (sparklines) are explicitly deferred to v2, out of scope here
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, dependency on Phase 4 (procurement)

### Project & Phase Context

- `.planning/PROJECT.md` — Core value, constraints (single warehouse, SME scale, semester timeline)
- `.planning/phases/02-catalog/02-CONTEXT.md` — D-06 (severity tier thresholds), D-07 (locked "low-stock" definition: Warning + Critical combined, `currentStock <= reorderThreshold`, explicitly written for this phase's KPI)
- `.planning/phases/03-warehouse/03-CONTEXT.md` — URL-param-driven filtering pattern used on `/inventory`; UTC day-boundary date-filtering convention this phase's "today" KPI reuses (D-10)
- `.planning/phases/04-procurement/04-CONTEXT.md` — D-18 (PO status Tabs filtering on `/purchase-orders`, which this phase's pie-chart drill-down (D-09) extends with a URL param), D-21 (PO number display format, not directly used here but relevant context for any PO references)

### Implementation Patterns to Follow

- `app/(protected)/inventory/page.tsx` — canonical Server Component + `searchParams` pattern for URL-param-driven filtering; template for how `/products` should read `?stock=low`
- `app/(protected)/products/page.tsx`, `app/(protected)/products/products-client.tsx` — current product list implementation this phase extends with the `?stock=low` filter and banner (D-01–D-05)
- `lib/utils/severity.ts` — `getSeverityBadge()`, the single source of truth for severity tier logic; reuse for the low-stock query condition (`currentStock <= reorderThreshold`)
- `app/(protected)/purchase-orders/page.tsx` (and its client component) — existing status-Tabs filtering this phase's PO drill-down navigates into

### Schema

- `prisma/schema.prisma` — no schema changes expected this phase; all KPIs are read-only aggregations over existing `Product`, `Supplier`, `StockTransaction`, `PurchaseOrder` tables

### Reusable UI Components

- `components/ui/card.tsx` — KPI tile container
- `lucide-react` (already a dependency) — KPI tile icons
- `recharts` (already in the stack per CLAUDE.md tech stack, first actual usage) — PO status pie chart

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `lib/utils/severity.ts` — severity tier logic (`getSeverityBadge`), reused for low-stock count/filter
- `components/ui/card.tsx` — already used on `/products` for the table container; reuse for KPI tiles
- `app/(protected)/inventory/page.tsx` — direct template for `searchParams`-driven filtering to replicate on `/products`

### Established Patterns

- **Server + client split:** `page.tsx` (async Server Component, Prisma fetch) → `xxx-client.tsx` (`"use client"` for interactive bits like the Recharts pie chart, which needs client-side rendering)
- **URL-param filters:** Server Component rebuilds the Prisma `where` clause from `searchParams` on every navigation (established `/inventory` pattern, Phase 3) — this phase extends the same pattern to `/products`
- **Decimal serialization:** Not applicable here — no `Decimal` fields are read for dashboard KPIs (all counts/integers), but PO status summary should double-check `PurchaseOrder.totalAmount` is NOT accidentally passed to a client component if the pie chart later needs values (04-CONTEXT D-23 applies if so)

### Integration Points

- `app/(protected)/dashboard/page.tsx` — replace the Phase 1 stub (`<h1>Dashboard</h1>`) with the full KPI + PO panel implementation
- `app/(protected)/products/page.tsx` — add `?stock=low` searchParams handling (new capability, not previously supported on this page)
- `app/(protected)/purchase-orders/page.tsx` — verify/extend status-filter searchParams handling so `?status=DRAFT` (etc.) from the dashboard pie-chart click pre-selects the matching Tab

</code_context>

<specifics>
## Specific Ideas

- KPI tile icons: `Package` (products), `Truck` (suppliers), `Activity` (movements today), `AlertTriangle` (low-stock) — Lucide icon names as a starting point, Claude's discretion to adjust (see Claude's Discretion above)
- Banner copy on filtered `/products`: "Showing N low-stock products" pattern, with a way back to the unfiltered list

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (DASH-V2-01 auto-refresh and DASH-V2-02 sparklines were already tracked as v2 deferrals in REQUIREMENTS.md prior to this discussion, not new deferrals from this session.)

</deferred>

---

*Phase: 5-Dashboard*
*Context gathered: 2026-07-06*
