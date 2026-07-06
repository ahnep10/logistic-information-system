# Phase 6: Reports - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Managers can generate three operational reports — inventory (current stock + severity tier), stock movements (transactions over a date range, grouped by product), and purchase orders (all POs with status/supplier/total value) — and export any of them as a downloadable `.xlsx` file. This phase delivers REPT-01 through REPT-04. It does not add PDF export, per-product mini-history widgets, or any new filtering capability beyond what's decided below — those are deferred (REPT-V2-01, REPT-V2-02).

</domain>

<decisions>
## Implementation Decisions

### Report page structure
- **D-01:** Single `/reports` page (replaces the existing stub at `app/(protected)/reports/page.tsx`) with a Tabs selector for the three report types (Inventory / Movements / Purchase Orders) — reuses the Tabs pattern already established in `/purchase-orders` and the Phase 5 dashboard drill-down.
- **D-02:** Active tab is driven by a `?type=` searchParam (values: `inventory` | `movements` | `purchase-orders`), server-validated with the same whitelist-then-fallback pattern from Phase 5 (`?stock=`, `?status=`) — any other/absent value defaults to `inventory`, never throws.
- **D-03:** Only the active tab's report query runs per page load (Server Component reads `?type=` and only queries that one report) — not all 3 in parallel. Switching tabs is a full navigation (server round-trip), consistent with how `?status=` drill-down works today.

### Excel export behavior
- **D-04:** Export reflects exactly what's currently filtered/visible on screen — the export route re-derives its query from the same searchParams the report page used (e.g., movement report exported with `?from=&to=` applied exports only that date range).
- **D-05:** One Route Handler per report type: `/api/reports/inventory`, `/api/reports/movements`, `/api/reports/purchase-orders`. Each re-runs that report's Prisma query (same shape as its page) and streams an `.xlsx` workbook via the `xlsx` (SheetJS) package, matching the stack doc's exact `/api/reports/*.xlsx`-style pattern.
- **D-06:** Export is triggered by a plain `<a href={...} download>` link on each report view — no client-side fetch/blob handling, no loading-spinner state. The href includes the report's current searchParams so the download matches D-04.

### Movement report date range
- **D-07:** Default date range (no `?from=`/`?to=` given) is the last 30 days — matches the existing `/inventory` page's `thirtyDaysAgo` fallback, keeping the convention consistent app-wide.
- **D-08:** `?from=`/`?to=` are validated; an unparseable date silently falls back to the default 30-day range rather than throwing. This closes the gap tracked as **T-03-11** in `.planning/phases/03-warehouse/03-SECURITY.md` (the existing `/inventory` page's unguarded `new Date("invalid")` 500) — same never-throw whitelist/fallback discipline Phase 5 established for `?stock=`/`?status=`. Fixing the pre-existing `/inventory` occurrence of T-03-11 itself is optional follow-up, not required by this phase's success criteria, but worth doing opportunistically if it's a small diff once this pattern exists.
- **D-09:** Transactions are grouped visually into product-header sections (one section per product, transactions listed underneath) — not a flat table sorted by product column.

### PO report scope
- **D-10:** All three PO statuses (Draft, Ordered, Received) are included — matches the success criteria's literal wording ("all purchase orders with their status").
- **D-11:** No filter UI on this report — a flat, unfiltered list of every PO. A manager wanting a specific status can already use the existing `/purchase-orders` Tabs page for that; this report stays simple by design.

### Claude's Discretion
- Exact column sets for each report table (beyond what's named in the success criteria) — e.g., whether the inventory report includes SKU/category/supplier columns beyond stock level + severity tier, and how "total order value" is computed for the PO report (reuse whatever existing total-computation exists in the PO detail/form code rather than reinventing it).
- Exact `.xlsx` file naming convention (e.g., `inventory-report-2026-07-07.xlsx`).
- Whether the inventory report includes inactive/deactivated products or only active ones (research/planning should check existing `/products` and dashboard conventions for precedent).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Threat/gap tracking
- `.planning/phases/03-warehouse/03-SECURITY.md` — tracks **T-03-11**, the unguarded malformed-date bug on `/inventory` that D-08 explicitly closes for the new movement report (and optionally for `/inventory` itself as follow-up)
- `.planning/phases/05-dashboard/05-SECURITY.md` — establishes the whitelist-validate-then-fallback pattern (T-05-03, T-05-05) this phase's `?type=`/`?from=`/`?to=` validation (D-02, D-08) must follow

### Stack / tooling
- `.claude/CLAUDE.md` (Report Export section) — the `/api/reports/*.xlsx` Route Handler + SheetJS pattern this phase implements (D-05)

### Requirements
- `.planning/REQUIREMENTS.md` §Reports (REPT-01 through REPT-04, REPT-V2-01, REPT-V2-02) — full requirement text and deferred v2 scope

No ADR/PRD docs exist for this phase beyond the above — requirements are otherwise fully captured in the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/utils/severity.ts` (`getSeverityBadge`) — the severity tier (Critical/Warning/OK) logic REPT-01 needs; already used by `/products` and `/inventory`. Reuse directly, do not reimplement.
- `app/(protected)/inventory/page.tsx` — existing `from`/`to` searchParam date-range Prisma query shape (`where.createdAt.gte`/`lte`) to adapt for the movement report, fixing the T-03-11 gap per D-08 rather than copying it forward.
- Tabs pattern from `app/(protected)/purchase-orders/purchase-orders-client.tsx` (`useState<FilterTab>` seeded from a validated `initialFilter` prop) — the exact shape to reuse for D-01/D-02's report-type Tabs.
- `app/(protected)/reports/page.tsx` — current one-line stub (`<h1>Reports</h1>`) to be replaced entirely.

### Established Patterns
- Server Component reads `searchParams` → whitelist-validates → passes a validated prop into a `"use client"` component that seeds its own `useState` (established across Phases 3, 5). This phase's Tabs (D-02) and date-range (D-08) validation should follow the identical shape.
- Route Handler for file streaming: `app/api/auth/[...nextauth]/route.ts` is the only existing Route Handler in the app — no prior `.xlsx`-streaming precedent, so `/api/reports/*` (D-05) will be the first of this kind; the stack doc's guidance is the primary reference.
- `xlsx` (SheetJS) is **not yet installed** — `package.json` has no `xlsx` dependency. Verifying its current stable version on npm before installing was already flagged as a carried concern (STATE.md) prior to this phase.

### Integration Points
- Inventory report queries `Product` (+ `reorderThreshold`, reusing the Phase 5 `prisma.product.fields.reorderThreshold` FieldRef convention if a "low stock only" view is ever added — not required for REPT-01 itself, which shows all products).
- Movement report queries `StockTransaction`, same model `/inventory` already queries.
- PO report queries `PurchaseOrder` (+ line items for total value), same model `/purchase-orders` already queries — check its existing total-value computation (D-Claude's-Discretion) before writing a new one.

</code_context>

<specifics>
## Specific Ideas

No specific visual/UX references beyond what's captured in Decisions above — the user confirmed the recommended option at each gray area (Tabs-based single page, filtered exports, 30-day default, product-header grouping, unfiltered PO list).

</specifics>

<deferred>
## Deferred Ideas

None raised during this discussion — the two known v2 deferrals (REPT-V2-01 PDF export, REPT-V2-02 per-product mini-history widget) were already deferred at roadmap time, not raised fresh here.

### Reviewed Todos (not folded)
None — `todo.match-phase 6` returned zero matches.

</deferred>

---

*Phase: 6-Reports*
*Context gathered: 2026-07-07*
