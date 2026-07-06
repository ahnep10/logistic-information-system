---
phase: 05-dashboard
plan: 01
subsystem: ui
tags: [recharts, prisma, nextjs, dashboard, kpi, server-components]

# Dependency graph
requires:
  - phase: 04-procurement
    provides: PurchaseOrder model with DRAFT/ORDERED/RECEIVED status lifecycle, lib/utils/po-status.ts color conventions
  - phase: 02-catalog
    provides: lib/utils/severity.ts (currentStock <= reorderThreshold low-stock definition, amber "Warning" color family)
  - phase: 03-warehouse
    provides: UTC calendar-day boundary filtering convention (established on /inventory)
provides:
  - Live /dashboard page with 4 real-time KPI tiles (active products, active suppliers, movements today, low-stock count)
  - Recharts PO status pie chart (first Recharts usage in codebase) with click-to-navigate
  - lib/utils/dashboard.ts reusable helpers (getTodayUtcRange, fillPoStatusCounts)
  - Low-stock KPI tile drill-down link to /products?stock=low
  - Pie slice drill-down navigation to /purchase-orders?status={STATUS}
affects: [05-02-products-low-stock-filter, 05-03-purchase-orders-status-filter]

# Tech tracking
tech-stack:
  added: ["recharts@3.9.2"]
  patterns:
    - "Prisma FieldRef cross-column comparison (prisma.product.fields.reorderThreshold) for low-stock filtering — no raw SQL, no fetch-then-filter"
    - "Server Component (5 parallel Promise.all Prisma queries) -> Client Component (Recharts + click handlers) split, mirroring existing /purchase-orders serialize-then-pass-to-client shape"
    - "groupBy zero-fill: Prisma groupBy omits zero-count groups, must default-fill DRAFT/ORDERED/RECEIVED before use"

key-files:
  created:
    - lib/utils/dashboard.ts
    - tests/dashboard.test.ts
    - app/(protected)/dashboard/dashboard-client.tsx
  modified:
    - app/(protected)/dashboard/page.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Used prisma.product.fields.reorderThreshold FieldRef (not raw SQL) for the low-stock cross-column comparison, per RESEARCH.md's supersession of CONTEXT.md D-02's raw-SQL default"
  - "npm install required --fetch-retries flags due to transient ECONNRESET network errors against the npm registry; not a package-legitimacy issue, purely network flakiness on this session's connection"

patterns-established:
  - "Dashboard KPI helper pattern: lib/utils/dashboard.ts as a small, single-purpose file with named exports and top-of-file comment citing source decisions, matching lib/utils/severity.ts and lib/utils/po-status.ts conventions"
  - "Recharts Pie onClick payload read defensively via `data?.payload?.status ?? data?.status` to handle Recharts 3.x's inconsistent event payload shape across call sites"

requirements-completed: [DASH-01, DASH-02, DASH-03]

coverage:
  - id: D1
    description: "Dashboard displays 4 live KPI tiles (active products, active suppliers, movements today, low-stock count) sourced from real Prisma counts"
    requirement: "DASH-01"
    verification:
      - kind: unit
        ref: "tests/dashboard.test.ts#DashboardPage — app/(protected)/dashboard/page.tsx (KPI query shapes) > returns props matching the 4 mocked count values and fillPoStatusCounts(groupBy result)"
        status: pass
      - kind: unit
        ref: "tests/dashboard.test.ts#DashboardPage — app/(protected)/dashboard/page.tsx (KPI query shapes) > calls stockTransaction.count with today's UTC day-boundary Date instances"
        status: pass
    human_judgment: true
    rationale: "Visual rendering (tile layout, live numbers with a real DB) requires a running Postgres instance and browser check, deferred to end-of-phase UAT per config human_verify_mode: end-of-phase and RESEARCH.md's Wave 0 test map (manual UAT row)."
  - id: D2
    description: "Low Stock KPI tile drills into /products?stock=low via a real Link (keyboard accessible)"
    requirement: "DASH-02"
    verification:
      - kind: unit
        ref: "tests/dashboard.test.ts#DashboardPage — app/(protected)/dashboard/page.tsx (KPI query shapes) > calls prisma.product.count with the reorderThreshold FieldRef for the low-stock count"
        status: pass
    human_judgment: true
    rationale: "Full drill-down correctness (whether /products actually applies the filter) depends on 05-02-PLAN.md, not yet executed; click-through UAT deferred to end-of-phase per plan's own Screen note."
  - id: D3
    description: "PO status pie chart renders Draft/Ordered/Received counts (or empty state when 0 POs exist) and slices navigate to /purchase-orders?status={STATUS}"
    requirement: "DASH-03"
    verification:
      - kind: unit
        ref: "tests/dashboard.test.ts#fillPoStatusCounts — lib/utils/dashboard.ts (groupBy zero-fill) > fillPoStatusCounts with DRAFT and RECEIVED groups defaults missing ORDERED to 0"
        status: pass
    human_judgment: true
    rationale: "Recharts render + click-to-navigate visual behavior and empty-state rendering require a browser check with real/seeded PO data; deferred to end-of-phase UAT alongside 05-03-PLAN.md's status-filter work."

duration: 21min
completed: 2026-07-06
status: complete
---

# Phase 5 Plan 1: Dashboard KPI Tiles + PO Status Pie Chart Summary

**Real-time /dashboard with 4 live Prisma-backed KPI tiles and a Recharts PO-status pie chart (first Recharts usage in the codebase), replacing the Phase 1 stub**

## Performance

- **Duration:** 21 min
- **Started:** 2026-07-06T19:11:00+07:00
- **Completed:** 2026-07-06T19:32:00+07:00
- **Tasks:** 2 (plus 1 pre-approved checkpoint)
- **Files modified:** 6 (2 created + 1 modified in app code, package.json/package-lock.json, tests/dashboard.test.ts)

## Accomplishments
- Replaced the Phase 1 `<h1>Dashboard</h1>` stub with a real async Server Component running 5 parallel Prisma queries (product count, supplier count, stockTransaction count, low-stock FieldRef count, PO status groupBy)
- Installed and integrated `recharts@3.9.2` for the first time in this codebase — PO status pie chart with click-to-navigate drill-down
- Built `lib/utils/dashboard.ts` with two reusable, fully-tested pure helpers: `getTodayUtcRange()` (UTC calendar-day boundaries) and `fillPoStatusCounts()` (groupBy zero-fill)
- Low-stock KPI tile links to `/products?stock=low`; pie chart slices navigate to `/purchase-orders?status={STATUS}` — both drill-down entry points ready for 05-02/05-03 to complete the filter targets

## Task Commits

Each task was committed atomically (TDD RED → GREEN cycle for both tasks):

1. **Task 0: Verify recharts package legitimacy before install** — pre-approved by the orchestrating session (no commit; checkpoint, no file changes)
2. **Task 1: Install recharts + pure dashboard helper functions**
   - `24b0170` (test) — failing tests for `getTodayUtcRange`/`fillPoStatusCounts`
   - `3145924` (feat) — `npm install recharts@3.9.2` + `lib/utils/dashboard.ts` implementation
3. **Task 2: Dashboard page (5 Prisma queries) + Recharts client component**
   - `f808613` (test) — failing tests for `DashboardPage`'s Prisma query shapes and returned props
   - `3795dfc` (feat) — `dashboard/page.tsx` rewrite + new `dashboard-client.tsx`

_Note: Both tasks used the TDD RED → GREEN cycle; no REFACTOR commit needed (implementation was minimal and clean on first pass)._

## Files Created/Modified
- `lib/utils/dashboard.ts` - `getTodayUtcRange()` and `fillPoStatusCounts()` pure helpers
- `tests/dashboard.test.ts` - 7 unit tests covering UTC boundary calc, groupBy zero-fill, and `DashboardPage`'s Prisma query shapes/props
- `app/(protected)/dashboard/page.tsx` - Rewritten as async Server Component running 5 parallel Prisma queries
- `app/(protected)/dashboard/dashboard-client.tsx` - New `"use client"` component: 4 KPI tiles + Recharts pie chart + click-to-navigate handlers
- `package.json` / `package-lock.json` - `recharts@3.9.2` added as a dependency

## Decisions Made
- Used `prisma.product.fields.reorderThreshold` FieldRef (confirmed present in the installed Prisma 6.19.3 client types) for the low-stock cross-column comparison, per RESEARCH.md's supersession of CONTEXT.md D-02's raw-SQL default — avoids raw SQL and fetch-then-filter entirely.
- Recharts `onClick` payload read defensively as `data?.payload?.status ?? data?.status`, per RESEARCH.md's Open Question A1 resolution, since the exact Recharts 3.x event shape wasn't independently confirmed from official docs this session.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm install recharts failed twice with ECONNRESET, resolved with retry flags**
- **Found during:** Task 1 (`npm install recharts@3.9.2`)
- **Issue:** Two consecutive `npm install recharts@3.9.2` attempts failed with `ECONNRESET` network errors mid-download (not a package-legitimacy issue — the package name/version were exactly as planned and pre-approved; this was transient registry connectivity).
- **Fix:** Re-ran `npm install recharts@3.9.2 --fetch-retries=5 --fetch-retry-mintimeout=2000 --fetch-retry-maxtimeout=30000`, which completed successfully (31 packages added, 1 changed).
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npm ls recharts` reports `recharts@3.9.2` installed; `grep '"recharts"' package.json` confirms the dependency entry.
- **Committed in:** `3145924` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — network retry, not a scope or correctness change)
**Impact on plan:** No scope creep; the install succeeded with the exact pre-approved package/version, just required standard npm retry flags to work around transient network flakiness.

## Issues Encountered
- The full test suite (`npm test`) has one pre-existing failing suite, `tests/purchase-orders-concurrency.test.ts`, which requires a live Postgres connection at `localhost:5432` (Docker container not running in this session). This is unrelated to this plan's files (an integration test from Phase 4) and out of scope per the scope-boundary rule — not fixed, not touched.

## User Setup Required

None - no external service configuration required. (Docker Postgres must be running for the full integration test suite and for manual browser verification of `/dashboard`, but this is existing project infrastructure from Phase 4, not new setup introduced by this plan.)

## Next Phase Readiness
- `lib/utils/dashboard.ts` helpers and the `poStatusCounts`/`STATUS_COLORS` conventions are ready for 05-02 (`/products?stock=low` filter) and 05-03 (`/purchase-orders?status=X` filter) to build on.
- Both drill-down links (`/products?stock=low`, `/purchase-orders?status={STATUS}`) are wired on the dashboard side; the target pages' filter logic is NOT yet implemented — that is explicitly 05-02/05-03's scope, not a gap in this plan.
- Manual browser UAT of `/dashboard` (KPI tiles rendering, pie chart hover/click, empty state) is deferred to end-of-phase UAT (per `config.json`'s `human_verify_mode: end-of-phase`) and requires the Docker Postgres container to be running.

---
*Phase: 05-dashboard*
*Completed: 2026-07-06*
