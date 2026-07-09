---
phase: quick-260709-ti6
plan: 01
subsystem: database
tags: [prisma, seed-script, recharts, dashboard, vitest]

requires: []
provides:
  - Idempotent prisma/dummy-data.ts full-wipe + reseed script producing realistic Indonesian-market demo data
  - "db:dummy" npm script
  - Dashboard "Produk Paling Sering Keluar" Top Selling Products BarChart
affects: [dashboard, products, inventory, purchase-orders]

tech-stack:
  added: []
  patterns:
    - "Clamped running-balance movement helper (applyMovements) mirrors the row-lock stock-out clamp intent from actions/stock-transactions.ts, guaranteeing the products_current_stock_non_negative CHECK constraint can never be violated by seed data"
    - "groupBy + findMany + map two-step aggregate-then-lookup shape, mirrored from the existing poStatusGroups -> fillPoStatusCounts pattern"

key-files:
  created:
    - prisma/dummy-data.ts
  modified:
    - package.json
    - "app/(protected)/dashboard/page.tsx"
    - "app/(protected)/dashboard/dashboard-client.tsx"
    - tests/dashboard.test.ts

key-decisions:
  - "RECEIVED-PO line items reference only 'OK'-tier products so the folded PO-received increments never disturb the Critical/Warning severity tiers designed into the natural-movement plan"
  - "prisma/dummy-data.ts is a fully separate script from prisma/seed.ts (own PrismaClient, never imported/wired into prisma db seed), keeping the destructive full wipe manually-invoked only"

patterns-established:
  - "Idempotent full-wipe seed scripts for demo data: wipe in FK-safe order (stockTransaction -> purchaseOrder -> product -> category -> supplier), never touch users beyond upsert-by-email"

requirements-completed: []

coverage:
  - id: D1
    description: "prisma/dummy-data.ts full-wipe + idempotent reseed script with db:dummy npm script; two consecutive runs both exit 0 with identical row counts, 2 pre-existing users untouched"
    verification:
      - kind: other
        ref: "npm run db:dummy (run twice) — manual terminal verification, see Verification Results below"
        status: pass
    human_judgment: false
  - id: D2
    description: "Seeded data never produces negative currentStock and severity tiers (lib/utils/severity.ts) are visibly mixed (>=2 Critical, >=4 Warning, remainder OK)"
    verification:
      - kind: other
        ref: "ad-hoc Prisma query script — see Verification Results below"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dashboard 'Produk Paling Sering Keluar' BarChart Card added below PO Status Card, additive only, existing KPI grid/PieChart unchanged"
    verification:
      - kind: unit
        ref: "tests/dashboard.test.ts#maps stockTransaction.groupBy + product.findMany into topSellingProducts"
        status: pass
    human_judgment: false
  - id: D4
    description: "npx tsc --noEmit and npm test (full suite) both exit 0 with zero regressions"
    verification:
      - kind: other
        ref: "npx tsc --noEmit && npm test — 10 passed | 4 skipped test files, 104 passed | 18 todo tests (pre-existing todos, unrelated to this plan)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-09
status: complete
---

# Phase quick-260709-ti6: Seed Demo Data + Top Selling Products Chart Summary

**Idempotent `prisma/dummy-data.ts` full-wipe reseed (5 suppliers, 5 categories, 17 products, 8 POs, 29 stock transactions) plus an additive Recharts "Produk Paling Sering Keluar" BarChart on `/dashboard`**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-09T15:08:00Z
- **Completed:** 2026-07-09T15:33:10Z
- **Tasks:** 3 (2 code tasks + 1 verification-only task)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- New standalone `prisma/dummy-data.ts` script performs a full FK-safe wipe of Category/Product/Supplier/StockTransaction/PurchaseOrder and reseeds realistic Indonesian-market demo data, upserting 2 new Staff users while leaving the 2 pre-existing users (`admin@logistics.com` MANAGER, `karin@logis.com` STAFF) completely untouched
- A clamped running-balance helper (`applyMovements`) guarantees every seeded product's `currentStock` respects the `products_current_stock_non_negative` DB CHECK constraint, with a designed severity mix of 2 Critical / 4 Warning / 11 OK products
- 4 of the 8 seeded Purchase Orders are RECEIVED, each mirroring `receivePurchaseOrder`'s production side effect exactly (`receivedQuantity` populated + linked `STOCK_IN` StockTransaction with `purchaseOrderId` set)
- New `db:dummy` npm script (`tsx prisma/dummy-data.ts`), verified idempotent across two consecutive runs
- Dashboard additively gains a "Produk Paling Sering Keluar" Card with a Recharts BarChart ranking products by total STOCK_OUT quantity, sourced from a new `stockTransaction.groupBy` + `product.findMany` query pair in `page.tsx`
- `npx tsc --noEmit` and `npm test` (full suite, all 14 test files) both exit 0 with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Full-wipe cleanup + idempotent seed script (prisma/dummy-data.ts)** - `e317539` (feat)
2. **Task 2: Dashboard "Top Selling Products" chart (additive only)** - TDD cycle:
   - RED: `4354b3b` (test) - failing test for topSellingProducts mapping
   - GREEN: `ac50db7` (feat) - implementation makes the test pass
3. **Task 3: Verification — typecheck + full test suite, zero regressions** - no commit (verification-only, zero regressions found, nothing to fix)

**Plan metadata:** (docs commit handled by orchestrator after this SUMMARY is written)

## Files Created/Modified

- `prisma/dummy-data.ts` - New standalone idempotent full-wipe + reseed script; own `PrismaClient`, never imported from or wired into `prisma/seed.ts` / `prisma db seed` / any CI hook
- `package.json` - Added `"db:dummy": "tsx prisma/dummy-data.ts"` script, directly after `"db:seed"`
- `app/(protected)/dashboard/page.tsx` - Added `stockTransaction.groupBy` (STOCK_OUT, by productId, take 6) as a 6th parallel query, mapped through a `product.findMany` name lookup into `topSellingProducts`, passed as a new `DashboardClient` prop
- `app/(protected)/dashboard/dashboard-client.tsx` - Additive "Produk Paling Sering Keluar" Card with Recharts `BarChart` below the existing PO Status Card; empty-state mirrors the existing "No purchase orders yet" pattern
- `tests/dashboard.test.ts` - Extended the `prisma` mock with `stockTransaction.groupBy` and `product.findMany`, defaulted to empty in `beforeEach` (keeps the 3 pre-existing `DashboardPage` tests passing unmodified), added 1 new test asserting the `topSellingProducts` mapping shape/order

## Verification Results

**`npm run db:dummy` run twice in a row — both exit 0, identical counts (idempotent):**

```
=== Dummy Data Seed Summary ===
Categories: 5
Products: 17
Suppliers: 5
Users: 4
Stock Transactions: 29
Purchase Orders: 8
```

- Purchase Order status split confirmed via `groupBy`: `DRAFT: 2, ORDERED: 2, RECEIVED: 4` — matches the exact 2/2/4 requirement
- The 2 pre-existing users (`admin@logistics.com` MANAGER, `karin@logis.com` STAFF) confirmed present and unmodified; 2 new Staff users (`budi.santoso@logistics.com`, `siti.rahayu@logistics.com`) added via upsert, for 4 total
- Severity mix confirmed via ad-hoc query: **Critical: 2, Warning: 4, OK: 11** (matches `lib/utils/severity.ts` tiers exactly)
- Zero products with negative `currentStock` (confirmed via direct query)

**`npx vitest run tests/dashboard.test.ts`:** 8/8 tests pass (the 4 pre-existing `DashboardPage` tests + 1 new `topSellingProducts` mapping test + 2 unrelated helper-function tests + 1 more pre-existing).

**`npx tsc --noEmit`:** exits 0, zero errors.

**`npm test` (full suite):** `10 passed | 4 skipped (14 files)`, `104 passed | 18 todo (122 tests)` — zero failures. The 18 `it.todo` stubs and 4 skipped files are pre-existing (tracked in STATE.md's Blockers/Concerns as `tests/warehouse.test.ts`'s INVT-03 negative-stock/atomic-mutation todos, WR-07), unrelated to this plan's changes.

## Decisions Made

- RECEIVED-PO line items were deliberately restricted to "OK"-tier products only, so the PO-received `currentStock` increments never disturb the hand-designed Critical/Warning severity tiers — this keeps the severity-mix guarantee (>=2 Critical, >=4 Warning) deterministic and verifiable regardless of which POs get received
- 6 "best seller" products (ELK-001, ELK-002, AKS-001, AKS-002, KAN-001, KOMP-002) were given 2 STOCK_OUT movements each (60-150 units total) vs. 1 small movement for the remaining 11 products, so the Top Selling Products BarChart ranking is visibly non-flat
- Total stock transaction count (29) was tuned to land within the plan's required 20-30 range by capping natural movements to 1-2 per product and RECEIVED-PO line items to 1-2 per PO

## Deviations from Plan

None - plan executed exactly as written across all 3 tasks.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Demo login credentials for the 2 new Staff users: `budi.santoso@logistics.com` / `Staff@123` and `siti.rahayu@logistics.com` / `Staff@123` (bcrypt cost-12 hash, same convention as `prisma/seed.ts`).

## Next Phase Readiness

- Dev DB now has realistic, internally-consistent demo data suitable for screenshots/demos, replacing the prior "Samsong A56" / "aery" QA test artifacts
- `/dashboard` Top Selling Products chart is ready for visual review (best sellers ELK-001, AKS-001, KAN-001 etc. should rank highest)
- No blockers for next milestone planning

---
*Phase: quick-260709-ti6*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: prisma/dummy-data.ts
- FOUND: app/(protected)/dashboard/page.tsx
- FOUND: app/(protected)/dashboard/dashboard-client.tsx
- FOUND: tests/dashboard.test.ts
- FOUND: .planning/quick/260709-ti6-seed-demo-data-categories-products-suppl/260709-ti6-SUMMARY.md
- FOUND commit: e317539 (Task 1)
- FOUND commit: 4354b3b (Task 2 RED)
- FOUND commit: ac50db7 (Task 2 GREEN)
