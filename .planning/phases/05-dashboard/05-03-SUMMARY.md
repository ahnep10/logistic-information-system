---
phase: 05-dashboard
plan: 03
subsystem: ui
tags: [nextjs, prisma, searchparams, purchase-orders, dashboard-drilldown]

# Dependency graph
requires:
  - phase: 04-procurement
    provides: PurchaseOrder model with DRAFT/ORDERED/RECEIVED status lifecycle, lib/utils/po-status.ts, purchase-orders-client.tsx Tabs filter UI
  - phase: 05-dashboard (05-01)
    provides: Dashboard PO status pie chart that navigates to /purchase-orders?status={STATUS}
provides:
  - "/purchase-orders?status=DRAFT|ORDERED|RECEIVED pre-selects the matching Tab on load"
  - Whitelist-validated searchParams handling on /purchase-orders (previously absent entirely)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component searchParams validated against a literal string-union enum, passed as a lowercased optional prop to seed Client Component useState — mirrors the /inventory and /products (?stock=low) URL-param pattern"

key-files:
  created: []
  modified:
    - "app/(protected)/purchase-orders/page.tsx"
    - "app/(protected)/purchase-orders/purchase-orders-client.tsx"
    - "tests/purchase-orders.test.ts"

key-decisions:
  - "Whitelist-validated params.status against the exact case-sensitive POStatus literals (DRAFT/ORDERED/RECEIVED) — any other value or absence silently resolves to undefined/'all', never throws, closing the same class of gap tracked as T-03-11 on /inventory"
  - "Prisma purchaseOrder.findMany fetch query itself remains entirely unfiltered by ?status= — filtering stays 100% client-side via the existing Tabs useState, per 05-UI-SPEC.md Screen 3"

patterns-established:
  - "Two-step wiring for URL-param-driven Tab pre-selection: (1) page.tsx validates+lowercases into an optional initialFilter prop, (2) client component seeds useState(initialFilter ?? 'all') — reusable for any future Tabs-filtered list page needing a URL entry point"

requirements-completed: [DASH-03]

coverage:
  - id: D1
    description: "/purchase-orders?status={STATUS} pre-selects the matching Tab for valid DRAFT/ORDERED/RECEIVED values"
    requirement: "DASH-03"
    verification:
      - kind: unit
        ref: "tests/purchase-orders.test.ts#Purchase Orders Page — status searchParams filter (DASH-03) > resolves initialFilter to 'draft'/'ordered'/'received' when searchParams.status is 'DRAFT'/'ORDERED'/'RECEIVED'"
        status: pass
    human_judgment: true
    rationale: "Visual Tab pre-selection and filtered-row rendering require a running browser + Postgres instance to observe; deferred to end-of-phase UAT per config.json human_verify_mode: end-of-phase, consistent with 05-01/05-02's approach."
  - id: D2
    description: "Any ?status value other than the exact literals DRAFT/ORDERED/RECEIVED (or its absence) defaults to the All tab — never an error"
    requirement: "DASH-03"
    verification:
      - kind: unit
        ref: "tests/purchase-orders.test.ts#Purchase Orders Page — status searchParams filter (DASH-03) > resolves initialFilter to undefined when searchParams.status is lowercase 'draft'"
        status: pass
      - kind: unit
        ref: "tests/purchase-orders.test.ts#Purchase Orders Page — status searchParams filter (DASH-03) > resolves initialFilter to undefined for garbage status or absent status, never throwing"
        status: pass
      - kind: unit
        ref: "tests/purchase-orders.test.ts#Purchase Orders Page — status searchParams filter (DASH-03) > does not alter prisma.purchaseOrder.findMany's call arguments based on searchParams.status"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-07-06
status: complete
---

# Phase 5 Plan 3: Purchase Orders Status Drill-Down Summary

**Validated `?status=DRAFT|ORDERED|RECEIVED` searchParams entry point on `/purchase-orders`, seeding the existing Tabs filter — the target-page half of the dashboard's PO-status pie-chart drill-down (DASH-03)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-06T12:44:49Z
- **Completed:** 2026-07-06T12:47:44Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `/purchase-orders/page.tsx` now reads and whitelist-validates `searchParams.status` (previously had zero `searchParams` handling — RESEARCH.md Pitfall 1 confirmed and corrected)
- `purchase-orders-client.tsx`'s Tabs filter now seeds from the validated `initialFilter` prop instead of a hardcoded `"all"`
- Closes the loop on 05-01-PLAN.md's dashboard PO-status pie chart, which navigates to `/purchase-orders?status={STATUS}` — that navigation now actually pre-selects the matching Tab
- Extended `tests/purchase-orders.test.ts` with 6 new tests covering all 5 `<behavior>` cases plus the "Prisma fetch unaffected" invariant, with zero regression to the 23 pre-existing PROC-01..05 tests in the same file

## Task Commits

Each task was committed atomically (TDD RED → GREEN cycle for Task 1; Task 2 had no `<behavior>` block so it was implemented directly per plan):

1. **Task 1: Validated ?status= searchParams on /purchase-orders**
   - `96ce585` (test) — failing tests for `PurchaseOrdersPage`'s searchParams validation
   - `62145a0` (feat) — `page.tsx` searchParams validation + `initialFilter` prop
2. **Task 2: Seed Tabs filter from initialFilter prop**
   - `f120f3e` (feat) — `purchase-orders-client.tsx` `useState` seed change

## Files Created/Modified
- `app/(protected)/purchase-orders/page.tsx` - Added `VALID_STATUSES` whitelist, `searchParams: Promise<{status?: string}>` prop, computes lowercased `initialFilter` or `undefined`; Prisma `findMany` query itself unchanged
- `app/(protected)/purchase-orders/purchase-orders-client.tsx` - Added optional `initialFilter?: FilterTab` prop; `useState<FilterTab>` now seeds from `initialFilter ?? "all"`
- `tests/purchase-orders.test.ts` - Extended the shared `vi.mock("@/lib/prisma", ...)` factory with `findMany`; added dynamic import of `PurchaseOrdersPage`; new "Purchase Orders Page — status searchParams filter (DASH-03)" describe block with 6 tests

## Decisions Made
- Whitelist-validated `params.status` against the exact case-sensitive `POStatus` literals (`DRAFT`/`ORDERED`/`RECEIVED`) — any other value or absence silently resolves to `undefined`/`"all"`, never throws. Mirrors the fix pattern 05-02-PLAN.md applied for `?stock=` on `/products`, and closes the same class of gap tracked as open technical debt on `/inventory` (STATE.md T-03-11).
- Left `prisma.purchaseOrder.findMany`'s query completely untouched by `?status=` — filtering remains 100% client-side via the existing Tabs `useState`, per 05-UI-SPEC.md Screen 3 (no new visual elements needed; the Tabs UI itself already communicates the active filter).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 5 (dashboard) is now fully wired end-to-end: dashboard KPI tiles (05-01), low-stock drill-down to `/products?stock=low` (05-02), and PO-status drill-down to `/purchase-orders?status={STATUS}` (05-03) all land on real, validated, tested filter targets.
- Manual browser UAT of the full drill-down chain (clicking a pie slice → landing on the pre-selected Tab; clicking low-stock tile → landing on the filtered banner) is deferred to end-of-phase UAT per `config.json`'s `human_verify_mode: end-of-phase`, consistent with 05-01/05-02.
- No blockers for phase completion.

---
*Phase: 05-dashboard*
*Completed: 2026-07-06*

## Self-Check: PASSED
