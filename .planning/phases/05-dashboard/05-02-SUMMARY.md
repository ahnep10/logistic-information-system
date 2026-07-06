---
phase: 05-dashboard
plan: 02
subsystem: ui
tags: [prisma, nextjs, products, low-stock, url-filtering]

# Dependency graph
requires:
  - phase: 05-dashboard
    plan: 01
    provides: Dashboard's Low Stock KPI tile links to /products?stock=low (drill-down entry point)
  - phase: 02-catalog
    provides: lib/utils/severity.ts (currentStock <= reorderThreshold low-stock definition), existing /products page and products-client.tsx
provides:
  - Server-side ?stock=low URL-param filtering on /products via Prisma FieldRef cross-column comparison
  - Low-stock banner + filtered-empty state on products-client.tsx
affects: [05-03-purchase-orders-status-filter]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prisma FieldRef cross-column comparison (prisma.product.fields.reorderThreshold) reused verbatim from 05-01 for the /products?stock=low filter"
    - "Whitelist validation on URL searchParams: only the exact literal \"low\" triggers filtered behavior; any other value or absence silently falls back to unfiltered (no error path)"

key-files:
  created:
    - tests/products.test.ts
  modified:
    - app/(protected)/products/page.tsx
    - app/(protected)/products/products-client.tsx

key-decisions:
  - "Reused prisma.product.fields.reorderThreshold FieldRef (established in 05-01) rather than raw SQL or fetch-then-filter, keeping the low-stock definition consistent across dashboard KPI and this filtered list"
  - "lowStockCount computed as products.length (post-filter findMany result length) rather than a separate count() query, since the filtered findMany result IS the low-stock set when isLowStockFiltered is true"

patterns-established:
  - "Whitelist-validate URL searchParams against an exact literal before branching into a Prisma where clause — never coerce/lowercase/trust the raw string (closes the same class of gap as the still-open /inventory T-03-11 issue)"

requirements-completed: [DASH-02]

coverage:
  - id: D1
    description: "/products?stock=low returns only active products whose currentStock <= reorderThreshold, implemented via the Prisma FieldRef cross-column comparison"
    requirement: "DASH-02"
    verification:
      - kind: unit
        ref: "tests/products.test.ts#ProductsPage — with stock=\"low\", calls findMany with the FieldRef where clause"
        status: pass
      - kind: unit
        ref: "tests/products.test.ts#ProductsPage — with stock=\"low\", returns isLowStockFiltered=true and lowStockCount = findMany result length"
        status: pass
    human_judgment: true
    rationale: "Visual banner rendering and live browser click-through from the dashboard's Low Stock tile require a running Postgres instance and browser check, deferred to end-of-phase UAT per config human_verify_mode: end-of-phase."
  - id: D2
    description: "Banner reading 'Showing N low-stock product(s)' visible above the table whenever ?stock=low is present, with a 'View all products' link back to unfiltered /products"
    requirement: "DASH-02"
    verification:
      - kind: static
        ref: "grep -c AlertTriangle app/(protected)/products/products-client.tsx returns 2; grep -c isLowStockFiltered returns 4"
        status: pass
      - kind: static
        ref: "npx tsc --noEmit — no new type errors in products-client.tsx"
        status: pass
    human_judgment: true
    rationale: "Visual banner appearance, singular/plural copy, and the 'View all products' link's actual navigation behavior require a browser check — deferred to end-of-phase UAT."
  - id: D3
    description: "Any ?stock value other than the exact literal \"low\" (or its absence) renders the normal, unfiltered product list — never an error"
    requirement: "DASH-02"
    verification:
      - kind: unit
        ref: "tests/products.test.ts#ProductsPage — with stock=\"LOW\" (wrong case) and stock=\"true\", calls findMany with unfiltered where: {}"
        status: pass
    human_judgment: false
    rationale: "Fully covered by automated unit tests; no manual verification needed for this whitelist-validation behavior."

duration: 12min
completed: 2026-07-06
status: complete
---

# Phase 5 Plan 2: Products Low-Stock Filter Summary

**Server-side `?stock=low` filtering on `/products` via Prisma FieldRef cross-column comparison, plus a visible amber banner announcing the filtered state**

## Performance

- **Duration:** 12 min
- **Tasks:** 2
- **Files modified:** 2 (`app/(protected)/products/page.tsx`, `app/(protected)/products/products-client.tsx`) + 1 new test file

## Accomplishments

- `/products?stock=low` now applies `where: { isActive: true, currentStock: { lte: prisma.product.fields.reorderThreshold } }` server-side, using the same FieldRef pattern 05-01 established for the dashboard's low-stock KPI
- Any `?stock` value other than the exact literal `"low"` (wrong case, unrelated truthy string, or absence) falls through silently to the existing unfiltered behavior — no error path, closing the same class of gap already tracked as open technical debt on `/inventory` (STATE.md T-03-11)
- `products-client.tsx` renders an amber banner ("Showing N low-stock product(s)" + "View all products" link) whenever the filter is active, and shows distinct filtered-empty copy ("No low-stock products" / "All active products are currently above their reorder threshold.") when the filtered result set is empty
- This completes the target-page half of the dashboard's low-stock drill-down (DASH-02) — the dashboard's Low Stock KPI tile (05-01) now has a fully functional destination

## Task Commits

Each task was committed atomically (TDD RED → GREEN cycle for Task 1):

1. **Task 1: Server-side ?stock=low filtering on /products**
   - `987e536` (test) — failing tests for all 5 behavior cases (unfiltered default, filtered FieldRef where clause, wrong-case/unrelated-truthy-string whitelist fallback, isLowStockFiltered/lowStockCount props)
   - `f0b41eb` (feat) — `page.tsx` rewrite: `searchParams` prop, whitelist check, FieldRef `where` clause, new props passed to `ProductsClient`
2. **Task 2: Low-stock banner + filtered-empty state on products-client.tsx**
   - `070221f` (feat) — banner markup + filtered-empty state copy in `products-client.tsx`

## Files Created/Modified

- `tests/products.test.ts` - new file, 6 unit tests covering all 5 `<behavior>` cases from the plan (plus the `isLowStockFiltered=false` no-param case)
- `app/(protected)/products/page.tsx` - added `searchParams: Promise<{stock?: string}>`, whitelist check, conditional FieldRef `where` clause, `isLowStockFiltered`/`lowStockCount` props
- `app/(protected)/products/products-client.tsx` - added `AlertTriangle`/`Link` imports, `isLowStockFiltered`/`lowStockCount` props, amber banner markup, branched empty-state copy

## Decisions Made

- Reused `prisma.product.fields.reorderThreshold` FieldRef (established in 05-01) rather than raw SQL or fetch-then-filter, per RESEARCH.md's supersession of CONTEXT.md D-02's raw-SQL default — keeps the low-stock definition byte-identical between the dashboard KPI and this filtered list.
- `lowStockCount` computed as `products.length` (the post-filter `findMany` result length) rather than issuing a separate `.count()` query — the filtered `findMany` result IS the low-stock set when `isLowStockFiltered` is true, so no extra DB round-trip is needed.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their `<action>` and `<behavior>` specs precisely; all acceptance criteria greps and `tsc --noEmit` passed on first implementation without needing auto-fixes.

## Issues Encountered

- Full `npx vitest run` shows one pre-existing failing suite, `tests/purchase-orders-concurrency.test.ts`, which requires a live Postgres connection at `localhost:5432` (Docker container not running in this session). This is unrelated to this plan's files (a Phase 4 integration test, already documented as an out-of-scope issue in 05-01-SUMMARY.md) — not fixed, not touched, consistent with the scope-boundary rule.

## User Setup Required

None — no external service configuration required. (Docker Postgres must be running for manual browser UAT of the banner/filter behavior and for the full integration test suite, but this is existing project infrastructure from Phase 4, not new setup introduced by this plan.)

## Next Phase Readiness

- `/products?stock=low` is now fully functional end-to-end — the dashboard's Low Stock KPI tile (05-01) has a working destination.
- Manual browser UAT (visiting `/products?stock=low`, confirming banner count matches visible rows, confirming "View all products" navigates back, confirming `/products?stock=bogus` shows the unfiltered list with no banner/error) is deferred to end-of-phase UAT per `config.json`'s `human_verify_mode: end-of-phase`, and requires the Docker Postgres container to be running.
- No blockers for 05-03 (purchase-orders status filter) — no file overlap with this plan's changes.

---
*Phase: 05-dashboard*
*Completed: 2026-07-06*

## Self-Check: PASSED

All 3 claimed files verified present on disk; all 3 claimed commit hashes verified present in git history.
