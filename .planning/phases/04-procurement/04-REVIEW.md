---
phase: 04-procurement
reviewed: 2026-07-04T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - actions/purchase-orders.ts
  - app/(protected)/purchase-orders/[id]/page.tsx
  - app/(protected)/purchase-orders/[id]/po-detail-client.tsx
  - app/(protected)/purchase-orders/new/page.tsx
  - app/(protected)/purchase-orders/page.tsx
  - app/(protected)/purchase-orders/po-form-client.tsx
  - app/(protected)/purchase-orders/purchase-orders-client.tsx
  - lib/utils/po-number.ts
  - lib/utils/po-status.ts
  - lib/validations/purchase-order.ts
  - prisma/migrations/20260704035704_add_purchase_orders/migration.sql
  - prisma/schema.prisma
  - tests/purchase-orders.test.ts
findings:
  critical: 3
  warning: 8
  info: 3
  total: 14
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-07-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The purchase order feature (draft creation/editing, confirmation, receiving, and the
associated UI) is functionally coherent and the `receivePurchaseOrder` action correctly
implements a `SELECT ... FOR UPDATE` row lock to prevent the double-receipt race
(mirroring the pattern already established in `actions/stock-transactions.ts`). However,
that same discipline was not applied consistently across the rest of the module:
`updateDraftPurchaseOrder` and `deletePurchaseOrder` both read a PO's status and then act
on it in a separate statement with no re-check or lock, reopening exactly the class of race
condition the codebase's own comments identify as critical (D-22). Additionally, the
`receivePurchaseOrder` action does not deduplicate submitted line-item IDs, which lets a
single "confirm receipt" submission over-credit `Product.currentStock` by repeating a
`lineItemId`. A missing upper-bound/finiteness check on `unitPrice`, combined with
`computeTotalAmount()` being called outside the surrounding `try/catch` in both draft
actions, also allows a crafted numeric input (`Infinity`) to crash the Server Action with
an unhandled exception instead of returning the graceful validation error used everywhere
else. Several lower-severity gaps round out the findings: missing DB-level uniqueness on
the human-facing `poNumber`, no bound on `receivedQuantity` relative to ordered quantity, a
UI state bug that hides the order total after a successful receipt, and stale-reference
display issues when a supplier/product is deactivated after a Draft PO references it.

## Critical Issues

### CR-01: TOCTOU race lets a confirmed/received PO be edited or deleted

**File:** `actions/purchase-orders.ts:69-119` and `actions/purchase-orders.ts:192-213`

**Issue:** `updateDraftPurchaseOrder` and `deletePurchaseOrder` each perform a
`findUnique` to check `status === "DRAFT"` and then, in a *separate* statement (a
`$transaction` for update, a plain `delete` for delete), mutate the row using only its
`id` — with no re-check of status and no row lock. If another request (e.g. a concurrent
`confirmPurchaseOrder`) changes the status to `ORDERED`/`RECEIVED` in between, the stale
check is bypassed entirely: a "Draft" edit can silently overwrite the line items and total
of a PO the supplier has already been notified about, and `deletePurchaseOrder`'s
`prisma.purchaseOrder.delete({ where: { id } })` has no status filter at all, so it will
delete a PO regardless of the state it transitioned to after the initial check.

This is the exact race class the team already identified and fixed for
`receivePurchaseOrder` (see the D-22 comment at `actions/purchase-orders.ts:227-229`) and
for stock transactions (`actions/stock-transactions.ts:20-26,70-77`), but the fix was not
carried over to the update/delete paths.

**Fix:**
```ts
// deletePurchaseOrder — guard the mutation itself, don't trust the earlier read
const { count } = await prisma.purchaseOrder.deleteMany({
  where: { id, status: "DRAFT" },
})
if (count === 0) {
  return { error: "Only Draft purchase orders can be deleted." }
}

// updateDraftPurchaseOrder — re-check inside the same transaction that performs the write
await prisma.$transaction(async (tx) => {
  const { count } = await tx.purchaseOrder.updateMany({
    where: { id, status: "DRAFT" },
    data: { supplierId: parsed.data.supplierId, totalAmount },
  })
  if (count === 0) throw new Error("Only Draft purchase orders can be edited.")
  await tx.purchaseOrderLineItem.deleteMany({ where: { purchaseOrderId: id } })
  await tx.purchaseOrderLineItem.createMany({ data: /* ... */ })
})
```

### CR-02: Duplicate `lineItemId` entries let a single receipt over-credit stock

**File:** `actions/purchase-orders.ts:238-271`

**Issue:** `receivePurchaseOrder` maps `parsed.data.lineItems` to a `productIdByLineItemId`
lookup and then iterates the *original, unde-duplicated* array to increment
`Product.currentStock` and create a `StockTransaction` per entry. `receivePurchaseOrderSchema`
(`lib/validations/purchase-order.ts:41-50`) never enforces that `lineItemId` values are
unique. A payload with the same `lineItemId` repeated N times causes `currentStock` to be
incremented N times and N duplicate `StockTransaction` rows to be created for a single
physical receipt — directly corrupting the inventory count this system exists to keep
accurate. Since this is a Server Action (callable with an arbitrary `FormData` payload, not
constrained to values the current UI happens to send), this is trivially reachable by
anyone who can call the action.

**Fix:**
```ts
const seen = new Set<string>()
for (const li of parsed.data.lineItems) {
  if (seen.has(li.lineItemId)) {
    throw new Error("Duplicate line item in receipt payload.")
  }
  seen.add(li.lineItemId)
}
```
Or add a Zod `.refine()` on `receivePurchaseOrderSchema` that checks `lineItemId` uniqueness
across the array.

### CR-03: Unbounded `unitPrice` crashes the Server Action instead of failing gracefully

**File:** `lib/validations/purchase-order.ts:8-11`, `actions/purchase-orders.ts:43`, `actions/purchase-orders.ts:90`

**Issue:** `unitPriceField` only enforces `min(0)` with no upper bound or explicit
finiteness check. A value like `1e400` parses via `Number("1e400")` to `Infinity`, which
passes Zod's type check (`typeof Infinity === "number"` and it is not `NaN`) and passes
`min(0)` (`Infinity < 0` is `false`, so the check never flags it). `computeTotalAmount()`
is then called at `actions/purchase-orders.ts:43` (in `createDraftPurchaseOrder`) and
`actions/purchase-orders.ts:90` (in `updateDraftPurchaseOrder`) — both calls sit **outside**
the `try { ... } catch` block that starts on the following lines (45 and 92 respectively).
`new Prisma.Decimal(Infinity)` throws synchronously, so this becomes an unhandled exception
in the Server Action, surfacing to the client as a raw 500/crash instead of the
`{ error: "Invalid input. Please check all fields." }` response every other bad-input path
returns.

**Fix:**
```ts
const unitPriceField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().finite().min(0).max(999_999_999.99, "Unit price is too large.")
)
```
And/or move the `computeTotalAmount(...)` call inside the existing `try` block in both
`createDraftPurchaseOrder` and `updateDraftPurchaseOrder` so any construction failure is
caught and returns the standard error response.

## Warnings

### WR-01: `poNumber` has no uniqueness constraint

**File:** `prisma/schema.prisma:106`, `prisma/migrations/20260704035704_add_purchase_orders/migration.sql:8-19`

**Issue:** `poNumber` is declared `Int @default(autoincrement())` in Prisma and `SERIAL NOT
NULL` in the migration, but neither adds a `UNIQUE` constraint. `poNumber` is the
human-facing identifier for a PO (`formatPONumber` renders it as `PO-0001`), so nothing at
the database layer actually guarantees two purchase orders can never end up with the same
number (e.g. after a manual data fix, restore, or future code path that sets it
explicitly).

**Fix:** Add `@unique` to `poNumber` in `schema.prisma` and generate a migration that adds
`ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_poNumber_key" UNIQUE
("poNumber");`.

### WR-02: No upper bound on `quantity`/`unitPrice`/`receivedQuantity` beyond CR-03's crash case

**File:** `lib/validations/purchase-order.ts:3-16`

**Issue:** Even for finite values, `quantityField` and `receivedQuantityField` have no
`max()`, so a value exceeding Postgres `INTEGER` range (±2,147,483,647) will pass Zod
validation and fail only at the database with an unhandled/opaque error, surfaced to the
user as the generic "Failed to save purchase order." Likewise `unitPriceField` has no
`max()` relative to the `DECIMAL(12,2)` column, so values beyond ~9,999,999,999.99 will
fail at insert time with the same unhelpful generic message.

**Fix:** Add reasonable `max()` bounds to all three fields in
`lib/validations/purchase-order.ts` (e.g. `max(1_000_000)` for quantities,
`max(999_999_999.99)` for prices) so invalid input is caught with a specific message
before it reaches the database.

### WR-03: `receivePurchaseOrder` doesn't require the full line-item set before marking a PO `RECEIVED`

**File:** `actions/purchase-orders.ts:215-291`

**Issue:** The action accepts whatever subset of `lineItemId`s is present in the payload,
updates only those, and then unconditionally sets `status: "RECEIVED"` for the whole PO.
If a caller submits a payload missing one or more of the PO's line items (the current UI
always sends all of them, but the action itself has no such guarantee), those omitted
lines keep `receivedQuantity: null` and never get their stock incremented — yet the order
is permanently marked `RECEIVED`, with no supported path to receive the remainder later
(re-receiving is blocked by the status guard).

**Fix:** Before completing the transaction, verify
`parsed.data.lineItems.length === dbLineItems.length` (or diff the ID sets) and reject the
receipt with a clear error if any of the PO's line items are missing from the payload.

### WR-04: `receivedQuantity` is never checked against the ordered `quantity`

**File:** `lib/validations/purchase-order.ts:13-16`, `actions/purchase-orders.ts:247-271`

**Issue:** `receivedQuantityField` only enforces `min(0)` with no relationship to the
line item's ordered `quantity`. A user (or a direct call to the Server Action) can submit
an arbitrarily large `receivedQuantity`, inflating `Product.currentStock` far beyond what
was actually ordered/delivered, with no validation catching the discrepancy.

**Fix:** In `receivePurchaseOrder`, after resolving `dbLineItems`, compare
`line.receivedQuantity` against the line item's persisted `quantity` and reject (or at
least flag) values that exceed it, per whatever over-receipt policy the business wants.

### WR-05: Order total disappears after a successful receipt due to stale `receiveMode` state

**File:** `app/(protected)/purchase-orders/[id]/po-detail-client.tsx:237-264`, `app/(protected)/purchase-orders/[id]/po-detail-client.tsx:479-486`

**Issue:** `handleConfirmReceipt` calls `router.refresh()` on success but never calls
`setReceiveMode(false)`. Because `router.refresh()` re-renders the existing client
component in place (it does not remount it), the `receiveMode` state persists as `true`
even after the server now reports `status: "RECEIVED"`. The "Total" summary block is
gated on `{!receiveMode && (...)}` (line 479), so it silently disappears from the page
after a successful receipt and only reappears once the user navigates away and back.

**Fix:**
```ts
const result = await receivePurchaseOrder(po.id, fd)
if (result && "error" in result && result.error) {
  setActionError(result.error)
  return
}
setReceiveMode(false)
router.refresh()
```

### WR-06: Deactivated supplier/product references render as blank/raw IDs when editing a Draft

**File:** `app/(protected)/purchase-orders/[id]/page.tsx:27-36`, `app/(protected)/purchase-orders/po-form-client.tsx:154-157,174`

**Issue:** The detail page only fetches `isActive: true` suppliers and products
(`page.tsx:27-36`) and passes them to `PurchaseOrderForm`. If a Draft PO's supplier or a
line item's product is deactivated after the PO was created, editing that Draft shows: (a)
the Supplier `<Select>` falling back to its placeholder because `defaultValue` doesn't
match any `SelectItem` in the (active-only) list, and (b) `productLabel()`
(`po-form-client.tsx:154-157`) falling back to printing the raw `productId` cuid instead of
a product name, since the deactivated product isn't in the `products` prop. The underlying
data is still valid and will still submit correctly, but the display is confusing/broken.

**Fix:** Include the currently-referenced supplier/products in the fetched lists even if
inactive (e.g. union the active list with the specific IDs referenced by
`po.supplierId`/`po.lineItems[].productId`), or pass the already-known names from
`po-detail-client`'s `DetailPO` down into the form instead of re-deriving them from an
active-only list.

### WR-07: `po-form-client.tsx`'s `onSubmit` has no error handling around the Server Action call

**File:** `app/(protected)/purchase-orders/po-form-client.tsx:132-152`

**Issue:** Every other Server-Action-invoking handler in this phase
(`ConfirmOrderDialog.handleConfirm`, `DeleteDraftDialog.handleDelete`,
`PurchaseOrderDetailClient.handleConfirmReceipt`) wraps its `await` in `try/catch` with a
fallback user-facing error. `onSubmit` in `po-form-client.tsx` does not — if
`createDraftPurchaseOrder`/`updateDraftPurchaseOrder` throws instead of returning
`{ error }` (e.g. the CR-03 crash path, or any other unexpected server-side exception),
this becomes an unhandled rejection inside `form.handleSubmit`, with no inline error shown
to the user.

**Fix:** Wrap the `createDraftPurchaseOrder`/`updateDraftPurchaseOrder` calls in a
`try/catch` and call `setServerError(...)` in the `catch`, consistent with the other
handlers in this phase.

### WR-08: Critical concurrency/immutability behaviors are left as unimplemented `it.todo` tests

**File:** `tests/purchase-orders.test.ts:97-112,129-132`

**Issue:** The row-lock guarantee for `receivePurchaseOrder` (D-22 double-receipt
mitigation), the per-line `StockTransaction`/stock-increment behavior, the status
transition to `RECEIVED`, and the D-16 stale-supplier/product re-validation in
`confirmPurchaseOrder` are all documented only as `it.todo(...)` placeholders — none of
these are actually asserted by a running test. These are precisely the behaviors the code
comments call out as the most safety-critical parts of this phase (see the D-22 comment at
`actions/purchase-orders.ts:227-229`), yet they ship with zero automated regression
coverage.

**Fix:** Implement the `it.todo` cases (mocking `prisma.$transaction`/`$queryRaw` as the
comments describe) before considering this phase test-complete, particularly the
double-receipt race and stale-reference re-validation cases — both of which are also the
subject of CR-01/CR-02 above.

## Info

### IN-01: `zodResolver(createPurchaseOrderSchema) as any`

**File:** `app/(protected)/purchase-orders/po-form-client.tsx:87`

**Issue:** The `as any` cast on the resolver suppresses type-checking between the form's
generic type and the schema's inferred type, defeating the point of using
`z.infer`/`CreatePurchaseOrderInput` elsewhere in the same file.

**Fix:** Investigate the underlying type mismatch (likely `zodResolver`'s generic
inference vs. the preprocessed number fields) and resolve it without `any`, or narrow the
cast to a more specific type.

### IN-02: Duplicated date/currency formatting logic

**File:** `app/(protected)/purchase-orders/[id]/po-detail-client.tsx:79-91`, `app/(protected)/purchase-orders/purchase-orders-client.tsx:39-43,158-162`

**Issue:** `currencyFormatter` and the `en-US` short-date formatting logic are duplicated
verbatim across both client components (and also appear in `po-form-client.tsx`).

**Fix:** Extract `currencyFormatter` and a `formatDate` helper into a shared module (e.g.
`lib/utils/format.ts`) and import from all three components.

### IN-03: PO immutability rule reimplemented ad hoc in three places

**File:** `lib/validations/purchase-order.ts:52-56`, `actions/purchase-orders.ts:77-79,200-202`

**Issue:** `assertPOEditable` exists specifically to express "RECEIVED POs are immutable"
but is only used in `confirmPurchaseOrder`. `updateDraftPurchaseOrder` and
`deletePurchaseOrder` instead each independently check `existing.status !== "DRAFT"` with
their own slightly different error copy, spreading the same business rule across three
call sites.

**Fix:** Route all three checks through a shared helper (or extend `assertPOEditable` to
take the required status) so the immutability rule has one source of truth.

---

_Reviewed: 2026-07-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
