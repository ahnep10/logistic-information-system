---
phase: 04-procurement
plan: 01
subsystem: database
tags: [prisma, postgres, zod, vitest, tdd]

# Dependency graph
requires:
  - phase: 03-warehouse
    provides: prisma migrate dev workflow (post db-push transition), StockTransaction model, z.preprocess numeric-coercion validation pattern
provides:
  - "POStatus enum + PurchaseOrder + PurchaseOrderLineItem Prisma models, migrated into Postgres"
  - "Nullable StockTransaction.purchaseOrderId FK + relation"
  - "lib/validations/purchase-order.ts: lineItemSchema, createPurchaseOrderSchema, confirmPurchaseOrderSchema, receivePurchaseOrderSchema, assertPOEditable guard"
  - "lib/utils/po-status.ts: getStatusBadge"
  - "lib/utils/po-number.ts: formatPONumber"
  - "tests/purchase-orders.test.ts: Wave 0 Nyquist coverage for PROC-01/02/03/04"
affects: [04-02-list-page, 04-03-create-flow, 04-04-detail-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First onDelete: Cascade relation in this codebase (PurchaseOrderLineItem -> PurchaseOrder)"
    - "First Decimal(12,2) field in this codebase (PurchaseOrder.totalAmount, PurchaseOrderLineItem.unitPrice) — money stored as Decimal, never Float"
    - "Single reusable assertPOEditable(status) immutability guard, to be called by every mutating Server Action in 04-04 (D-17)"

key-files:
  created:
    - lib/validations/purchase-order.ts
    - lib/utils/po-status.ts
    - lib/utils/po-number.ts
    - tests/purchase-orders.test.ts
    - prisma/migrations/20260704035704_add_purchase_orders/migration.sql
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Docker Desktop was not running at execution start (Postgres container down) — started Docker Desktop and `docker compose up -d` to bring up the logistic-postgres container before running the migration (Rule 3, blocking issue)"
  - "Followed strict TDD ordering per tdd=\"true\": test file committed first while failing on unresolved imports (RED), then implementation files committed once tests passed (GREEN); no REFACTOR commit needed as no cleanup was required"

patterns-established:
  - "PO status badge colors: DRAFT=slate, ORDERED=blue, RECEIVED=green (04-UI-SPEC.md verbatim), returned by getStatusBadge"
  - "PO number formatting: PO-0001 style, 4-digit zero-padded (formatPONumber)"

requirements-completed: [PROC-01, PROC-02, PROC-03, PROC-04]

coverage:
  - id: D1
    description: "PurchaseOrder and PurchaseOrderLineItem tables exist in Postgres with correct FKs; deleting a Draft PO cascades to its line items"
    requirement: "PROC-01"
    verification:
      - kind: other
        ref: "npx prisma migrate status (Database schema is up to date!) + prisma/schema.prisma onDelete: Cascade on PurchaseOrderLineItem.purchaseOrder"
        status: pass
    human_judgment: false
  - id: D2
    description: "createPurchaseOrderSchema accepts a Draft with 0 line items (D-08) and rejects an invalid line item (bad productId/quantity<1/unitPrice<0)"
    requirement: "PROC-01"
    verification:
      - kind: unit
        ref: "tests/purchase-orders.test.ts#Draft Purchase Order Validation"
        status: pass
    human_judgment: false
  - id: D3
    description: "confirmPurchaseOrderSchema rejects 0 line items with the exact UI-SPEC error copy and accepts >=1 line item"
    requirement: "PROC-01"
    verification:
      - kind: unit
        ref: "tests/purchase-orders.test.ts#Confirm Purchase Order Validation"
        status: pass
    human_judgment: false
  - id: D4
    description: "receivePurchaseOrderSchema accepts receivedQuantity of 0 and rejects negative values"
    requirement: "PROC-02"
    verification:
      - kind: unit
        ref: "tests/purchase-orders.test.ts#Receive Purchase Order Validation"
        status: pass
    human_judgment: false
  - id: D5
    description: "assertPOEditable throws only when status is RECEIVED, silent for DRAFT/ORDERED"
    requirement: "PROC-03"
    verification:
      - kind: unit
        ref: "tests/purchase-orders.test.ts#assertPOEditable immutability guard"
        status: pass
    human_judgment: false
  - id: D6
    description: "PO status visibility utilities (getStatusBadge, formatPONumber) match 04-UI-SPEC.md color/label and number-format contracts, ready for 04-02/04-04 consumption"
    requirement: "PROC-04"
    verification:
      - kind: other
        ref: "lib/utils/po-status.ts, lib/utils/po-number.ts — manual review against 04-UI-SPEC.md PO Status Badge Colors table and D-21"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-07-04
status: complete
---

# Phase 04 Plan 01: Purchase Order Schema and Validation Foundation Summary

**Prisma PurchaseOrder/PurchaseOrderLineItem models with Decimal money fields and cascade delete, plus Zod validation contracts and Wave 0 test coverage for PROC-01 through PROC-04**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-04T03:57:00Z
- **Completed:** 2026-07-04T03:59:38Z
- **Tasks:** 2 completed
- **Files modified:** 6 (1 modified, 5 created)

## Accomplishments
- Extended `prisma/schema.prisma` with `POStatus` enum, `PurchaseOrder` model (Decimal totalAmount, autoincrement poNumber), `PurchaseOrderLineItem` model with `onDelete: Cascade`, nullable `StockTransaction.purchaseOrderId` FK, and back-relations on `Supplier`/`User`/`Product`; migrated into Postgres as `20260704035704_add_purchase_orders`
- Built `lib/validations/purchase-order.ts` with the full D-08 lifecycle validation contract (0-line Draft save, >=1-line confirm gate, >=0 receivedQuantity) and the `assertPOEditable` immutability guard (D-17)
- Built `lib/utils/po-status.ts` (`getStatusBadge`) and `lib/utils/po-number.ts` (`formatPONumber`) matching 04-UI-SPEC.md exactly
- Established `tests/purchase-orders.test.ts` as Wave 0 Nyquist coverage for PROC-01/02/03/04, following strict RED→GREEN TDD gate sequence

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Prisma schema and migrate (D-01, D-02, D-03, D-04)** - `4ba6558` (feat)
2. **Task 2: Validation schemas, status/number utils, and Wave 0 test scaffold** - `00927ca` (test, RED) → `270a9a3` (feat, GREEN)

**Plan metadata:** pending (this commit)

_Note: Task 2 is a TDD task — the test commit intentionally fails to resolve its imports until the GREEN commit lands the implementation._

## Files Created/Modified
- `prisma/schema.prisma` - Adds `POStatus` enum, `PurchaseOrder`, `PurchaseOrderLineItem` models, `StockTransaction.purchaseOrderId` FK, back-relations
- `prisma/migrations/20260704035704_add_purchase_orders/migration.sql` - Generated migration applying the above
- `lib/validations/purchase-order.ts` - Zod schemas + `assertPOEditable` guard consumed by 04-03/04-04 Server Actions
- `lib/utils/po-status.ts` - `getStatusBadge` for PO status badges (list + detail pages)
- `lib/utils/po-number.ts` - `formatPONumber` for human-friendly PO numbers (D-21)
- `tests/purchase-orders.test.ts` - Wave 0 test scaffold for PROC-01/02/03/04

## Decisions Made
- Docker Desktop and the `logistic-postgres` container were not running when execution started; started Docker Desktop and ran `docker compose up -d` before running `prisma migrate dev` (Rule 3 auto-fix, blocking issue — not a plan deviation in substance, just an environment precondition)
- Executed Task 2 as a genuine TDD RED→GREEN cycle: wrote `tests/purchase-orders.test.ts` first, confirmed it failed on unresolved `@/lib/validations/purchase-order` imports, committed that as the RED gate, then created the three implementation files and confirmed all non-`it.todo` tests pass before committing the GREEN gate

## Deviations from Plan

None - plan executed exactly as written. The Docker Desktop / Postgres container startup was an environment precondition, not a code change; the plan's own Task 1 body did not require re-planning.

## Issues Encountered
- Postgres was unreachable at `localhost:5432` on first migration attempt (Docker Desktop not running). Resolved by starting Docker Desktop and running `docker compose up -d`, then confirmed with `pg_isready` before retrying `npx prisma migrate dev --name add_purchase_orders`, which succeeded on the second attempt.

## User Setup Required

None - no external service configuration required beyond the local Docker Postgres container already defined in `docker-compose.yml`.

## Next Phase Readiness
- `prisma/schema.prisma`, `lib/validations/purchase-order.ts`, `lib/utils/po-status.ts`, `lib/utils/po-number.ts` are stable interfaces; 04-02 (list page), 04-03 (create flow), 04-04 (detail/lifecycle actions) can now be planned and executed against them without guessing
- `tests/purchase-orders.test.ts` carries `it.todo` stubs for 04-04's atomic receive-transaction behavior (PO row lock, double-receipt rejection, per-line StockTransaction creation, currentStock increment, status transition to RECEIVED) and the D-16 stale-reference re-validation stub — these are proven-working-in-spec but have zero automated regression protection until 04-04 fills them in
- No blockers

---
*Phase: 04-procurement*
*Completed: 2026-07-04*

## Self-Check: PASSED

All created files verified present on disk; all task commits (`4ba6558`, `00927ca`, `270a9a3`, `f9f690e`) verified present in git log.
