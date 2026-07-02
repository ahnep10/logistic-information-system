---
phase: 03-warehouse
reviewed: 2026-07-02T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/(protected)/inventory/inventory-client.tsx
  - app/(protected)/inventory/page.tsx
  - app/(protected)/stock/page.tsx
  - app/(protected)/stock/stock-client.tsx
  - prisma/migrations/20260630100000_add_catalog_tables/migration.sql
  - prisma/migrations/20260701150104_add_stock_transactions/migration.sql
  - prisma/schema.prisma
  - tests/warehouse.test.ts
findings:
  critical: 0
  warning: 8
  info: 6
  total: 14
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-07-02
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the warehouse phase's inventory history page, stock recording UI, catalog/stock-transaction migrations, schema, and test file. No injection, XSS, hardcoded-secret, or auth-bypass vulnerabilities were found in these files — page access is correctly gated by `middleware.ts`, Prisma queries are parameterized, and JSX rendering of user-supplied `notes`/`reason` text is auto-escaped by React.

However, several logic and robustness gaps were found: an implicit 30-day default date filter on the inventory history page is not reflected in the "no results" UI copy or the active-filters indicator, producing a misleading "no transactions ever" message; unvalidated `from`/`to` query params can crash the page with an unhandled Prisma error; the 200-row cap on the history table has no pagination or truncation indicator; dialog-local error/form state in the stock-recording UI is never cleared when the dialog is dismissed without a fresh submission; the DB-level non-negative-stock CHECK constraint has no representation in `schema.prisma`, creating drift risk on the next `prisma migrate dev`; the `quantity` column lacks an equivalent DB-level floor; and the test file's `it.todo` stubs give the false impression that the highest-risk logic (atomic stock mutation, negative-stock rejection) has coverage when it does not.

## Warnings

### WR-01: Implicit 30-day default filter not reflected in "no results" messaging

**File:** `app/(protected)/inventory/page.tsx:39-43`, `app/(protected)/inventory/inventory-client.tsx:99-104,188-195`
**Issue:** When no `from`/`to`/`productId`/`type` query params are present, `page.tsx` silently applies a 30-day `createdAt` filter (`where.createdAt = { gte: thirtyDaysAgo }`). `inventory-client.tsx`'s `hasActiveFilters` only checks the URL params, so it evaluates to `false` in this case. If the result set is empty (all transactions are older than 30 days, or filters otherwise scoped down to include this default), the client renders the `!hasActiveFilters` branch: "No transactions recorded yet — Stock movements will appear here after the first transaction." That message is factually wrong if older transactions exist; it just misrepresents an implicit, invisible date filter as "no history at all," undermining the product's core "operational transparency" value.
**Fix:** Either surface the default date range in the UI (pre-fill the From/To inputs with the computed 30-day window so `hasActiveFilters` reflects reality), or track "filter applied" as a separate concept from "user-specified filter" and adjust the empty-state copy accordingly:
```tsx
// page.tsx: pass the *effective* range back down so the client can render it
const effectiveFrom = params.from ?? thirtyDaysAgo.toISOString().slice(0, 10)
```

### WR-02: Unvalidated date query params can crash the page

**File:** `app/(protected)/inventory/page.tsx:33-38`
**Issue:** `params.from`/`params.to` come directly from the URL and are passed straight into `new Date(`${params.from}T00:00:00.000Z`)` with no format validation. A malformed value (e.g. `?from=abc`) produces an `Invalid Date`, which Prisma will reject at query time with a runtime error, crashing the Server Component render (unhandled 500) since there is no try/catch or validation guard.
**Fix:**
```ts
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
if (params.from && DATE_RE.test(params.from)) {
  where.createdAt = { ...where.createdAt, gte: new Date(`${params.from}T00:00:00.000Z`) }
}
```

### WR-03: 200-row cap on inventory history with no pagination or truncation indicator

**File:** `app/(protected)/inventory/page.tsx:49`
**Issue:** `take: 200` silently truncates any filter that matches more than 200 rows. There is no total count, "showing 200 of N" indicator, or pagination control, so a manager filtering a busy product/date range has no way to know the table is incomplete — directly at odds with the "operational transparency" objective for this MIS.
**Fix:** Fetch a count alongside the page (`prisma.stockTransaction.count({ where })`) and render a "Showing 200 of {count}" note, or add real pagination (`skip`/`take` with page controls).

### WR-04: Dialog error/form state not reset on close

**File:** `app/(protected)/stock/stock-client.tsx:161-180` (`RecordStockInDialog`), `296-315` (`RecordStockOutDialog`)
**Issue:** `serverError` is only cleared at the top of `onSubmit`. If a submission fails (dialog stays open, error shown), and the user then closes the dialog via Discard/Escape/backdrop-click instead of retrying, `serverError` remains set. Reopening the dialog later re-renders the stale error message even though no new invalid submission occurred. Likewise `form` values are only reset on a *successful* submit — closing via Discard leaves the previous partial input in place on reopen instead of resetting to `defaultValues`.
**Fix:** Reset both in `onOpenChange`:
```tsx
<Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setServerError(null); form.reset() } }}>
```

### WR-05: `products_current_stock_non_negative` CHECK constraint has no representation in `schema.prisma`

**File:** `prisma/schema.prisma` (Product model, lines 48-62), `prisma/migrations/20260701150104_add_stock_transactions/migration.sql:24-25`
**Issue:** The non-negative-stock hard floor was added via a hand-written `ALTER TABLE ... ADD CONSTRAINT` in the migration, but `schema.prisma` has no comment, `@@check` (Prisma 6 preview attribute), or any other marker documenting the constraint's existence. Prisma's `migrate dev` diffing is driven by the declared schema plus migration history; because nothing in `schema.prisma` says this constraint should exist, any unrelated future schema edit followed by `prisma migrate dev` risks generating a migration that silently drops it, since the tool has no declarative source of truth telling it to keep it. This removes the D-04 safety net without any warning surfaced to the developer running the migration.
**Fix:** At minimum, add a durable comment in `schema.prisma` next to `currentStock` documenting the out-of-band constraint and the migration that added it; better, adopt Prisma's `@@check` preview attribute (if the Prisma version in use supports it) so the constraint is schema-declared and diff-safe.

### WR-06: No DB-level floor on `stock_transactions.quantity`

**File:** `prisma/migrations/20260701150104_add_stock_transactions/migration.sql:5-16`
**Issue:** `products.currentStock` was explicitly hardened with a `CHECK (currentStock >= 0)` constraint, but the `quantity` column on `stock_transactions` has no equivalent `CHECK (quantity > 0)`. Application-level Zod validation (outside this file's scope) is the only guard. Any future code path, admin script, or direct DB write that bypasses that validation layer can insert a zero or negative quantity, silently corrupting the stock audit trail (e.g., a "STOCK_OUT" row with a negative quantity would net-increase stock while being logged as an outflow).
**Fix:**
```sql
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_quantity_positive" CHECK ("quantity" > 0);
```

### WR-07: `it.todo` stubs mislabeled as covering the highest-risk logic (INVT-03)

**File:** `tests/warehouse.test.ts:72-80`
**Issue:** The file header comment claims coverage of "INVT-03" (atomic stock mutation, negative-stock rejection), but the actual "tests" for it are two `it.todo(...)` placeholders with no mock setup or assertions. This is precisely the logic the `actions/stock-transactions.ts` code comments describe as safety-critical (`SELECT ... FOR UPDATE` race prevention, TOCTOU guard on stock-out). As written, a regression in that atomicity/negative-stock logic would not be caught by this test suite, despite the suite's docstring implying it is covered.
**Fix:** Implement the stubs with a mocked `prisma.$transaction` (or an integration test against a test DB) asserting: (1) `recordStockOut` with `quantity > currentStock` returns the expected error and does not mutate `currentStock`; (2) `recordStockIn` calls `tx.product.update` with `{ increment: quantity }` and creates the transaction row. Until implemented, update the docstring/comment to accurately state these are unimplemented stubs, not coverage.

### WR-08: Product filter `<Select>` can silently desync from the applied filter for inactive products

**File:** `app/(protected)/inventory/inventory-client.tsx:111-126`, `app/(protected)/inventory/page.tsx:55-59`
**Issue:** The product filter dropdown is populated only from `prisma.product.findMany({ where: { isActive: true } })`. If a deep link (or a previously bookmarked URL) sets `?productId=<id>` for a product that has since been deactivated, `currentParams.productId` won't match any `SelectItem`, so the Select will show its placeholder ("All Products") even though the query is actually still filtered to that specific (now-hidden) product — the visible transaction list and the visible filter control disagree about what's being shown.
**Fix:** Include inactive products referenced by the current filter in the dropdown (e.g. fetch by id if not already in the active list), or visually indicate "Filtered by: {productName} (inactive)" independent of the Select's option list.

## Info

### IN-01: `zodResolver(...) as any` bypasses type checking

**File:** `app/(protected)/stock/stock-client.tsx:165, 300`
**Issue:** Both dialogs cast the resolver to `any`, silencing any mismatch between the Zod-inferred output type and what `useForm` expects. This hides genuine type errors if the schema and form types ever drift.
**Fix:** Investigate and fix the underlying type mismatch (likely from the `z.preprocess` on `quantity`) rather than suppressing it, e.g. type the resolver explicitly: `zodResolver<StockInInput>(stockInSchema)`.

### IN-02: `getTypeBadgeClass` / `formatDateTime` duplicated verbatim across two files

**File:** `app/(protected)/inventory/inventory-client.tsx:64-78`, `app/(protected)/stock/stock-client.tsx:75-89`
**Issue:** Identical helper functions are copy-pasted rather than shared, risking drift (e.g. a future badge color/date-format change applied to one file but not the other).
**Fix:** Extract to `lib/format.ts` (or similar) and import in both client components.

### IN-03: Reason enum values hardcoded inline in JSX instead of derived from the shared schema

**File:** `app/(protected)/stock/stock-client.tsx:247-250, 382-385`
**Issue:** The `SelectItem` values ("Purchase Received", "Return", "Manual Adjustment", "Sale", "Write-Off") are typed directly in JSX rather than mapped from the `stockInSchema`/`stockOutSchema` enum definitions. If the Zod enum is ever changed, the UI options can silently fall out of sync, causing a client-validated value to be rejected server-side (or vice versa).
**Fix:** Export the enum value arrays from `lib/validations/stock-transaction.ts` and map over them in JSX instead of re-declaring the literals.

### IN-04: No upper bound (`max`) on quantity inputs

**File:** `app/(protected)/stock/stock-client.tsx:229, 364`
**Issue:** `<Input type="number" min={1} ...>` has no `max`, so a user can type an arbitrarily large number before any validation feedback appears.
**Fix:** Add a sensible `max` (e.g. `max={999999}`) matching whatever upper bound (if any) exists in the Zod schema, for earlier user feedback.

### IN-05: Inconsistent field alignment/whitespace in `schema.prisma`

**File:** `prisma/schema.prisma:30-32, 56-59`
**Issue:** `User` and `Product` models mix single-space and multi-space field alignment (e.g. `isActive     Boolean  @default(true)` vs. `isActive          Boolean            @default(true)`), suggesting `prisma format` wasn't run after edits.
**Fix:** Run `npx prisma format` to normalize alignment.

### IN-06: Deactivated products cannot be selected as a history filter

**File:** `app/(protected)/inventory/page.tsx:55-59`
**Issue:** Related to WR-08 — the product filter dropdown only ever lists active products, so there is no UI path to filter history by a product that has since been deactivated (only a hand-crafted URL works). This is a feature gap for auditing discontinued SKUs.
**Fix:** Consider including inactive products in the filter list (perhaps visually distinguished), or provide a "show discontinued" toggle.

---

_Reviewed: 2026-07-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
