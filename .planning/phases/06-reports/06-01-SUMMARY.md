---
phase: 06-reports
plan: 01
subsystem: reporting
tags: [nextjs, prisma, server-components, reports, whitelist-validation]

# Dependency graph
requires:
  - phase: 05-dashboard
    provides: whitelist-then-fallback searchParams validation pattern (?stock=, ?status=), getSeverityBadge/getStatusBadge reuse conventions
  - phase: 03-warehouse
    provides: StockTransaction model + /inventory date-range where-clause shape (with T-03-11 unguarded-Date bug identified, now fixed for this new surface)
  - phase: 04-procurement
    provides: PurchaseOrder model + totalAmount stored Decimal column, po-status.ts/po-number.ts utils
provides:
  - "/reports page: Tabs-driven single page covering Inventory, Movements, and Purchase Orders report types"
  - "lib/utils/reports.ts: resolveReportType(), resolveDateRange(), groupTransactionsByProduct() shared helpers"
  - "T-03-11-class date validation pattern (DATE_RE regex-then-fallback) established for reuse by /api/reports/* export routes (Plan 06-02)"
affects: [06-02 (export routes reuse resolveReportType/resolveDateRange and re-run these same query shapes)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Whitelist-then-fallback searchParams validation (?type=, ?from=/?to=) — never throws, silently defaults"
    - "Single Server Component page with an if/else-if/else chain gating exactly one Prisma query per request (D-03)"
    - "Product-grouped report sections (Map-based grouping, first-seen order preserved) for date-range transaction reports"

key-files:
  created:
    - lib/utils/reports.ts
    - app/(protected)/reports/reports-client.tsx
    - tests/reports.test.ts
  modified:
    - app/(protected)/reports/page.tsx

key-decisions:
  - "resolveDateRange() fixes T-03-11 for the new movements surface only — /inventory's own unguarded new Date(params.from) is left as-is (optional follow-up per D-08, not required by this phase's success criteria)"
  - "PurchaseOrderRow.status typed via lib/utils/po-status.ts's POStatus (not a locally re-declared union) once Task 3 wired in getStatusBadge"
  - "currencyFormatter duplicated verbatim in reports-client.tsx (not extracted to a shared util) per UI-SPEC's explicit single-constant sanction"

patterns-established:
  - "resolveReportType()/resolveDateRange() in lib/utils/reports.ts are the canonical re-derivation helpers Plan 06-02's /api/reports/* Route Handlers must import and reuse — not reimplement (D-04, Pattern 3)"

requirements-completed: [REPT-01, REPT-02, REPT-03]

coverage:
  - id: D1
    description: "Inventory tab (/reports?type=inventory) shows all products (active + inactive) with severity tier and Active/Inactive badge; only prisma.product.findMany runs"
    requirement: "REPT-01"
    verification:
      - kind: unit
        ref: "tests/reports.test.ts#ReportsPage — inventory tab (REPT-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Movements tab (/reports?type=movements) shows transactions from the last 30 days by default or a valid ?from=/?to= range, grouped by product; malformed dates never throw (closes T-03-11 for this surface)"
    requirement: "REPT-02"
    verification:
      - kind: unit
        ref: "tests/reports.test.ts#resolveDateRange — lib/utils/reports.ts (D-07/D-08, closes T-03-11)"
        status: pass
      - kind: unit
        ref: "tests/reports.test.ts#groupTransactionsByProduct — lib/utils/reports.ts (D-09)"
        status: pass
      - kind: unit
        ref: "tests/reports.test.ts#ReportsPage — movements tab (REPT-02, closes T-03-11)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Purchase Orders tab (/reports?type=purchase-orders) shows all three statuses with supplier and totalAmount read from the stored Decimal column (never recomputed)"
    requirement: "REPT-03"
    verification:
      - kind: unit
        ref: "tests/reports.test.ts#ReportsPage — purchase-orders tab (REPT-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Invalid/absent ?type= silently defaults to Inventory tab; tab switching is a full server navigation (router.push), never a client-side filter of pre-fetched data; only the active tab's query runs per page load"
    verification:
      - kind: unit
        ref: "tests/reports.test.ts#resolveReportType — lib/utils/reports.ts (D-02)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-07-07
status: complete
---

# Phase 6 Plan 1: Reports Page Foundation + Three Report Types Summary

**Single Tabs-driven `/reports` page delivering Inventory/Movements/Purchase-Orders reports, reusing existing severity/status badge and query-shape conventions verbatim, with a new never-throw date-range validator that closes T-03-11 for this surface**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-07T03:04:00Z
- **Completed:** 2026-07-07T03:12:23Z
- **Tasks:** 3 completed
- **Files modified:** 4 (1 new util, 1 rewritten page, 1 new client component, 1 new test file)

## Accomplishments
- Replaced the Phase 1 one-line `/reports` stub with a real Server Component that whitelist-validates `?type=` (never throws) and runs exactly one Prisma query per page load, matching D-03
- Inventory report (REPT-01): all products (active + inactive) with severity tier (`getSeverityBadge`) and Active/Inactive status badge, reusing `/products`' exact query shape and empty-state copy
- Movements report (REPT-02): product-grouped stock-transaction sections for a 30-day default or valid `?from=/?to=` range; introduced `resolveDateRange()`, a regex-then-fallback date validator that closes T-03-11 (03-SECURITY.md) for this new surface without touching `/inventory`'s existing (still-unfixed, optional-follow-up) occurrence
- Purchase Orders report (REPT-03): flat, unfiltered list of all three statuses with `totalAmount` read from the stored `Decimal` column via `.toNumber()`, never recomputed from line items

## Task Commits

Each task was committed atomically:

1. **Task 1: Reports page foundation + Inventory report vertical slice (REPT-01)** - `f54cd5d` (feat)
2. **Task 2: Movements report vertical slice (REPT-02, closes T-03-11 for this surface)** - `53712a5` (feat)
3. **Task 3: Purchase Orders report vertical slice (REPT-03)** - `59520e8` (feat)

_No TDD RED/GREEN split — tests were written and run alongside each task's implementation, all green before commit._

## Files Created/Modified
- `lib/utils/reports.ts` - `REPORT_TYPES`/`resolveReportType()` (D-02), `DATE_RE`/`resolveDateRange()` (D-08, T-03-11 fix), `groupTransactionsByProduct()` (D-09)
- `app/(protected)/reports/page.tsx` - async Server Component; if/else-if/else chain running exactly one Prisma query per active tab
- `app/(protected)/reports/reports-client.tsx` - Tabs selector + Inventory table + Movements product-grouped sections + Purchase Orders table + 3 Export links (non-functional until Plan 06-02 lands the Route Handlers, by design)
- `tests/reports.test.ts` - 19 tests covering REPT-01/02/03 pure-function behavior and page-level Prisma call-shape assertions

## Decisions Made
- `resolveDateRange()`'s regex-then-fallback fix is scoped to the new Movements surface only; `/inventory`'s existing unguarded `new Date(params.from)` (T-03-11) is left as a tracked, optional follow-up per D-08 — not required by this plan's success criteria
- `ReportsPage` returns `<div><h1/><Suspense><ReportsClient/></Suspense></div>` (matching `/inventory`'s established shape); tests drill through the Suspense wrapper (`element.props.children[1].props.children.props`) rather than reading props off the top-level returned element directly, since `ReportsClient` is nested one level deeper than `PurchaseOrdersPage`'s un-wrapped return

## Deviations from Plan

None - plan executed exactly as written. All three tasks' behavior, acceptance criteria, and verification commands passed without requiring a Rule 1-4 deviation.

## Issues Encountered

Initial test assertions (`element.props.activeType`) failed because `ReportsPage`'s returned JSX tree wraps `ReportsClient` inside `<div><h1/><Suspense>...</Suspense></div>` (required by the plan's own `<action>` text and matching the `/inventory` precedent), so `ReportsClient`'s props are one level deeper than `PurchaseOrdersPage`'s directly-returned client component. Fixed by adding a small `reportsClientProps()` test helper that drills through the Suspense wrapper — no production code change needed, purely a test-authoring correction within Task 1, before that task's commit.

## User Setup Required

None - no external service configuration required. (The `xlsx` package install + its `checkpoint:human-verify` gate is scoped to Plan 06-02, not this plan.)

## Next Phase Readiness

- All three report views are fully wired to real, unfiltered/whitelisted Prisma data — ready for Plan 06-02 to add the matching `/api/reports/*` export Route Handlers, which must import and reuse `resolveReportType()`/`resolveDateRange()`/`groupTransactionsByProduct()` from `lib/utils/reports.ts` rather than reimplementing (Pattern 3, D-04)
- The three "Export to Excel" links in `reports-client.tsx` point at `/api/reports/{inventory,movements,purchase-orders}` and are non-functional (404) until Plan 06-02 lands — this is by design, not a stub requiring resolution in this plan
- Full test suite (`npx vitest run`) is green: 90 passed, 18 pre-existing `it.todo` stubs (unrelated to this plan, tracked since Phase 3), 0 failures
- `npx tsc --noEmit` is clean with zero new type errors

---
*Phase: 06-reports*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: .planning/phases/06-reports/06-01-SUMMARY.md
- FOUND: f54cd5d
- FOUND: 53712a5
- FOUND: 59520e8
