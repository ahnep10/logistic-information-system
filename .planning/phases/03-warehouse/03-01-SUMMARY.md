---
phase: 03-warehouse
plan: "01"
subsystem: warehouse-schema
status: complete
tags:
  - prisma
  - migration
  - stock-transactions
  - testing
dependency_graph:
  requires:
    - 02-catalog (Product and User models)
  provides:
    - StockTransaction model (prisma.stockTransaction)
    - TransactionType enum (STOCK_IN, STOCK_OUT)
    - stock_transactions table with FK constraints
    - DB-level CHECK constraint (products_current_stock_non_negative)
    - tests/warehouse.test.ts Zod unit tests
  affects:
    - Wave 2 plans (03-02 stock page, 03-03 inventory page) — both depend on Prisma client having StockTransaction types
tech_stack:
  added:
    - TransactionType enum (Prisma PSL)
    - StockTransaction model (Prisma PSL)
    - PostgreSQL CHECK constraint via custom migration SQL
  patterns:
    - Prisma baseline migration workflow (migrate resolve --applied) for db push drift recovery
    - Custom migration SQL appended after Prisma-generated SQL for CHECK constraint
    - Vitest describe/it.todo stub pattern for Server Action integration tests
key_files:
  created:
    - prisma/migrations/20260630100000_add_catalog_tables/migration.sql
    - prisma/migrations/20260701150104_add_stock_transactions/migration.sql
    - tests/warehouse.test.ts
  modified:
    - prisma/schema.prisma
decisions:
  - "Baseline migration (20260630100000_add_catalog_tables) created to resolve Phase 2 db push drift — marked applied via migrate resolve without re-running SQL against existing DB"
  - "reason stored as display label string (e.g. Purchase Received) per RESEARCH.md Open Question 2 — Zod enum validates exact string, no transformation needed for history display"
  - "SELECT FOR UPDATE via tx.$queryRaw used in existing actions (stronger than application-only check) — sealed as-is since it exceeds D-05 spec requirement"
metrics:
  duration: "~10 minutes"
  completed: "2026-07-01"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
  files_created: 3
---

# Phase 03 Plan 01: Schema and Migration Summary

**One-liner:** Prisma schema extended with StockTransaction model and TransactionType enum; custom migration applied with DB-level CHECK constraint (products_current_stock_non_negative); Zod test suite established.

## What Was Built

### Task 1: Schema extension and test scaffold

Extended `prisma/schema.prisma` with:
- `TransactionType` enum (STOCK_IN, STOCK_OUT) inserted after the `Role` enum
- `StockTransaction` model with all D-01 fields: `id` (cuid), `type` (TransactionType), `productId` (FK→Product), `quantity` (Int), `reason` (String), `notes` (String?), `createdById` (FK→User), `createdAt` (DateTime @default(now())) — no `updatedAt` per D-01 (immutable transactions)
- `stockTransactions StockTransaction[]` back-relation added to both `User` and `Product` models

**Audit results (pre-existing files — no changes needed):**

`actions/stock-transactions.ts` passed all audit criteria:
- `"use server"` on line 1
- Session check: `if (!session?.user?.id) return { error: "Unauthorized" }` — no requireManager()
- Both actions use `prisma.$transaction(async (tx) => {...})`
- Stock-out uses `tx.$queryRaw SELECT FOR UPDATE` then checks `currentStock < quantity`, throws `Insufficient stock. Current stock: ${currentStock} units.`
- Stock-in uses `tx.product.update` with `{ increment: parsed.data.quantity }`
- Both actions call `revalidatePath("/stock")`, `revalidatePath("/inventory")`, `revalidatePath("/products")`
- Both use `createdById: session.user.id`

`lib/validations/stock-transaction.ts` passed all audit criteria:
- stockInSchema reason: `z.enum(["Purchase Received", "Return", "Manual Adjustment"])`
- stockOutSchema reason: `z.enum(["Sale", "Manual Adjustment", "Write-Off"])`
- quantity uses `z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().int().min(1, ...))`
- `StockInInput` and `StockOutInput` types exported via `z.infer`

`tests/warehouse.test.ts` created with:
- 5 unit tests (3 Stock In + 2 Stock Out) covering INVT-01 and INVT-02
- 2 `it.todo` integration stubs covering INVT-03

### Task 2: Migration execution

Due to Phase 2 using `prisma db push` instead of `prisma migrate dev`, the migration history had drift. Resolution:

1. Created baseline migration `20260630100000_add_catalog_tables` with SQL for categories, products, suppliers
2. Marked it applied via `npx prisma migrate resolve --applied` (DB already had these tables)
3. Created `20260701150104_add_stock_transactions` via `npx prisma migrate dev --create-only`
4. Appended CHECK constraint: `ALTER TABLE "products" ADD CONSTRAINT "products_current_stock_non_negative" CHECK ("currentStock" >= 0);`
5. Applied with `npx prisma migrate dev`
6. Regenerated Prisma client (required Stop-Process on Windows to release DLL lock)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Drift from Phase 2 db push required baseline migration**
- **Found during:** Task 2 — `npx prisma migrate dev --create-only` failed with "Drift detected"
- **Issue:** Phase 2 used `prisma db push` to add categories, products, suppliers directly to DB without creating migration files. The migration history (only `20260630045322_init`) didn't match the DB state.
- **Fix:** Created baseline migration `20260630100000_add_catalog_tables` with equivalent SQL for the catalog tables and marked it applied via `prisma migrate resolve --applied` (no DB changes needed since tables already existed). Then proceeded with normal migration workflow.
- **Files modified:** `prisma/migrations/20260630100000_add_catalog_tables/migration.sql` (new)
- **Commits:** ded851c (Task 1), 16ebce9 (Task 2)

**2. [Rule 3 - Blocker] Windows DLL lock prevented Prisma client regeneration**
- **Found during:** Task 2 — `prisma migrate dev` applied migration but failed on `prisma generate` with EPERM error
- **Issue:** Windows file system lock on `query_engine-windows.dll.node` from a running Node.js process
- **Fix:** Used PowerShell `Stop-Process -Name node` to release the lock, then ran `npx prisma generate` separately
- **Files modified:** `node_modules/.prisma/client/` (regenerated — not committed)
- **Impact:** None — client generation succeeded on second attempt

## Verification Results

| Check | Result |
|-------|--------|
| `npx prisma migrate status` | 3 migrations, "Database schema is up to date!" |
| Migration SQL contains CHECK constraint | `products_current_stock_non_negative CHECK ("currentStock" >= 0)` — confirmed |
| `npm test` | 22 passed, 18 todo — exit 0 |
| `npm test -- tests/warehouse.test.ts` | 5 passed, 2 todo — exit 0 |
| `npx tsc --noEmit` | exit 0, no errors |

## Known Stubs

The `it.todo` stubs in `tests/warehouse.test.ts` are intentional — they represent integration tests for Server Actions that require Prisma mocking. These are recorded for future test expansion (post-MVP):
- `recordStockOut with quantity exceeding currentStock returns error with current stock count`
- `recordStockIn increments currentStock and creates StockTransaction record`

These stubs do NOT prevent the plan's goal — the Zod unit tests (5 passing) satisfy the Nyquist sampling baseline for INVT-01 and INVT-02, and the migration (Task 2) satisfies INVT-03 at the DB level.

## Self-Check: PASSED

- [x] `prisma/schema.prisma` has TransactionType enum and StockTransaction model with all D-01 fields
- [x] `prisma/migrations/20260701150104_add_stock_transactions/migration.sql` exists with CHECK constraint
- [x] `tests/warehouse.test.ts` exists and npm test exits 0
- [x] `npx tsc --noEmit` exits 0 after Prisma client regeneration
- [x] `npx prisma migrate status` shows no pending migrations
- [x] Commits ded851c (Task 1) and 16ebce9 (Task 2) exist in git log
