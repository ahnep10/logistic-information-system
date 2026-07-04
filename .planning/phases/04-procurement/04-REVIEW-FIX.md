---
phase: 04-procurement
fixed_at: 2026-07-04T11:25:17Z
review_path: .planning/phases/04-procurement/04-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-07-04T11:25:17Z
**Source review:** .planning/phases/04-procurement/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 11
- Fixed: 11
- Skipped: 0

All fixes were applied and verified inside an isolated git worktree
(`gsd-reviewfix/04-6901`, branched from `aad32d6`), then fast-forward-merged
into `main`. Verification per fix: `npx tsc --noEmit` (full project, zero
errors) and `npx vitest run` (all suites green, 40 passed / 18 unrelated
`it.todo` remaining in other phases' test files) after every commit.

## Fixed Issues

### CR-01: TOCTOU race lets a confirmed/received PO be edited or deleted

**Files modified:** `actions/purchase-orders.ts`
**Commit:** `a9cb914`
**Applied fix:** `updateDraftPurchaseOrder` now re-checks `status: "DRAFT"` atomically
inside the same `$transaction` that performs the write, via
`tx.purchaseOrder.updateMany({ where: { id, status: "DRAFT" }, ... })` and
aborts with the standard error if `count === 0`. `deletePurchaseOrder` now
uses `prisma.purchaseOrder.deleteMany({ where: { id, status: "DRAFT" } })`
instead of a separate `findUnique` + unconditional `delete`, closing the
race where a concurrent `confirmPurchaseOrder`/`receivePurchaseOrder` could
change status between the read and the write. As a side effect of
restructuring `updateDraftPurchaseOrder`, `computeTotalAmount()` also moved
inside the `try` block for that function (overlaps with CR-03).

**Verification note:** Row-level atomicity of `updateMany`/`deleteMany` with
a `WHERE status = ...` filter is a well-established Postgres guarantee and
mirrors the pattern already used by `receivePurchaseOrder`'s row lock and by
`actions/stock-transactions.ts`. However, no live Postgres instance was
available in this environment to run a true concurrent-transaction
integration test (two simultaneous requests racing on the same PO). Marking
**fixed: requires human verification** — recommend a manual/staging test of
two concurrent update+confirm (or delete+confirm) requests against a real
database before considering this fully closed.

### CR-02: Duplicate `lineItemId` entries let a single receipt over-credit stock

**Files modified:** `lib/validations/purchase-order.ts`
**Commit:** `6473dba`
**Applied fix:** Added a Zod `.refine()` on `receivePurchaseOrderSchema` that
rejects the payload if `new Set(lineItemIds).size !== lineItemIds.length`,
with the message "Duplicate line item in receipt payload." This fails
`parsed.success` before `receivePurchaseOrder`'s transaction runs, so a
repeated `lineItemId` can never reach the stock-increment loop.
**Verification:** Directly exercised the refine logic with `safeParse` —
confirmed it flags duplicate `lineItemId` arrays and passes unique ones.
Status: **fixed**.

### CR-03: Unbounded `unitPrice` crashes the Server Action instead of failing gracefully

**Files modified:** `lib/validations/purchase-order.ts`, `actions/purchase-orders.ts`
**Commits:** `a9cb914` (moved `computeTotalAmount()` inside `try` for both
`createDraftPurchaseOrder` and `updateDraftPurchaseOrder`), `6473dba`
(added `.finite()` and `.max(999_999_999.99)` to `unitPriceField`)
**Applied fix:** `unitPriceField` now rejects non-finite values (e.g.
`Number("1e400")` → `Infinity`) via Zod's `.finite()` check before
`computeTotalAmount()` is ever called, and the call itself is now inside the
surrounding `try/catch` in both draft actions as defense in depth.
**Verification:** Directly exercised the schema with `safeParse("1e400")` —
confirmed it now fails validation (`expected number, received number`
special-cased for `Infinity`/`NaN`) instead of reaching `new
Prisma.Decimal(Infinity)`. Status: **fixed**.

### WR-01: `poNumber` has no uniqueness constraint

**Files modified:** `prisma/schema.prisma`,
`prisma/migrations/20260704040000_add_po_number_unique/migration.sql`
**Commit:** `ed62ed2`
**Applied fix:** Added `@unique` to `poNumber` in `schema.prisma` and hand-authored
a new migration (`ALTER TABLE "purchase_orders" ADD CONSTRAINT
"purchase_orders_poNumber_key" UNIQUE ("poNumber");`) following the existing
migration-folder naming convention.
**Verification note:** No `DATABASE_URL`/live Postgres instance was
available in the isolated fixer worktree, so the migration could not be
applied there and verified end-to-end. **Post-fix, on `main`:** the
orchestrator ran `npx prisma migrate deploy` against the live
`logistic_mis` Postgres database (Docker) — migration applied
successfully, `npx prisma migrate status` reports up to date. Full test
suite (`npm test`) passes (40/40, 18 unrelated `it.todo`) and
`npx tsc --noEmit` is clean after regenerating the Prisma client. Status
upgraded from **requires human verification** to **fixed and verified**.

### WR-02: No upper bound on `quantity`/`unitPrice`/`receivedQuantity`

**Files modified:** `lib/validations/purchase-order.ts`
**Commit:** `6473dba` (bundled with CR-02, same file/same edit pass)
**Applied fix:** Added `.max(1_000_000)` to `quantityField` and
`receivedQuantityField`, and `.max(999_999_999.99)` to `unitPriceField`
(the latter also serves CR-03). Status: **fixed**.

### WR-03: `receivePurchaseOrder` doesn't require the full line-item set before marking a PO `RECEIVED`

**Files modified:** `actions/purchase-orders.ts`
**Commit:** `8a392e0`
**Applied fix:** `receivePurchaseOrder` now loads the PO's *complete*
line-item set (`where: { purchaseOrderId: id }`, no longer filtered by the
submitted ids) and throws `"All line items must be included when receiving
this purchase order."` if `parsed.data.lineItems.length !==
dbLineItems.length`, before any stock mutation runs. Combined with CR-02's
duplicate-id rejection, a length match plus all-ids-found guarantees full
coverage.

### WR-04: `receivedQuantity` is never checked against the ordered `quantity`

**Files modified:** `actions/purchase-orders.ts`
**Commit:** `8a392e0`
**Applied fix:** The line-item lookup now also selects `quantity`, and each
submitted `line.receivedQuantity` is compared against
`dbLineItem.quantity`, throwing `"Received quantity cannot exceed the
ordered quantity."` if exceeded.

**Verification note:** The new WR-08 integration tests cover the
happy-path receipt flow (full coverage, in-bounds quantities) but do not
include a dedicated negative-path test asserting rejection of an
incomplete payload or an over-received quantity. Logic was verified by
code review only. Marking **fixed: requires human verification** for both
WR-03 and WR-04 — recommend adding the two missing negative-path unit
tests as a follow-up.

### WR-05: Order total disappears after a successful receipt due to stale `receiveMode` state

**Files modified:** `app/(protected)/purchase-orders/[id]/po-detail-client.tsx`
**Commit:** `1ee467b`
**Applied fix:** `handleConfirmReceipt` now calls `setReceiveMode(false)`
immediately before `router.refresh()` on the success path, so the Total
summary block (gated on `!receiveMode`) reappears without requiring
navigation away and back. Status: **fixed**.

### WR-06: Deactivated supplier/product references render as blank/raw IDs when editing a Draft

**Files modified:** `app/(protected)/purchase-orders/[id]/page.tsx`
**Commit:** `141d4a3`
**Applied fix:** Restructured the detail page to fetch the PO first, then
fetch suppliers/products with `OR: [{ isActive: true }, { id: <referenced id(s)> }]`
so a Draft PO's currently-referenced (but since-deactivated) supplier or
line-item products are still present in the lists passed to
`PurchaseOrderForm`, fixing both the blank Select fallback and the raw-id
`productLabel()` fallback.

**Verification note:** This is a Server Component data-fetching change
with no automated test coverage in the current test suite (no tests target
`page.tsx` files in this project). Verified by code review and `tsc`/schema
type-checking only. Marking **fixed: requires human verification** —
recommend a manual check: deactivate a supplier/product referenced by an
existing Draft PO, then open that PO's edit page and confirm the name
renders correctly.

### WR-07: `po-form-client.tsx`'s `onSubmit` has no error handling around the Server Action call

**Files modified:** `app/(protected)/purchase-orders/po-form-client.tsx`
**Commit:** `1ab7e67`
**Applied fix:** Wrapped the `createDraftPurchaseOrder`/`updateDraftPurchaseOrder`
call in `try/catch`, calling `setServerError("Failed to save purchase
order. Please try again.")` in the `catch`, consistent with the other
Server-Action-invoking handlers in this phase. Status: **fixed**.

### WR-08: Critical concurrency/immutability behaviors are left as unimplemented `it.todo` tests

**Files modified:** `tests/purchase-orders.test.ts`
**Commit:** `0b8ed31`
**Applied fix:** Replaced all 6 `it.todo` placeholders with real tests that
mock `@/lib/prisma`, `@/lib/auth`, and `next/cache`:
- Row lock (`$queryRaw ... FOR UPDATE`) is the first call inside the
  transaction, strictly before any write.
- The double-receipt guard rejects when PO status is not `ORDERED`.
- One `StockTransaction` is created per line with `reason: "Purchase
  Received"` and `purchaseOrderId` set.
- `Product.currentStock` is incremented per line via `{ increment:
  receivedQuantity }`.
- The PO status transitions to `RECEIVED`.
- `confirmPurchaseOrder` rejects when the supplier or a line-item product
  has been deactivated since Draft creation (D-16), for both cases.

All 18 new/updated assertions pass (`npx vitest run` → 40 passed, 0
failed, 18 `it.todo` remaining in unrelated test files for other phases).
Status: **fixed**.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-04T11:25:17Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
