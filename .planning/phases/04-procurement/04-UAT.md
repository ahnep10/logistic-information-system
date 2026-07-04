---
status: testing
phase: 04-procurement
source: [04-VERIFICATION.md]
started: 2026-07-04T12:20:00Z
updated: 2026-07-04T13:10:00Z
---

## Current Test

number: 5
name: Post-fix UI checks — Total visibility after receipt, deactivated-reference display when editing
expected: |
  (a) Receiving goods against an Ordered PO in the browser shows the order Total row
  immediately after the page updates (not just after navigating away and back). (b)
  Deactivating a supplier or line-item product referenced by an existing Draft PO, then
  opening that Draft's edit view, shows the correct name in the Supplier Select and
  line-item rows (not blank or a raw id).
awaiting: user response

## Tests

### 1. Confirm Order — DRAFT to ORDERED status write
expected: Create (or reuse) a Draft PO with ≥1 line item and an active supplier/products, then click "Confirm Order". PO status becomes "Ordered"; reloading the detail page shows the Ordered badge and a read-only line-item table (no edit/remove controls).
result: pass

### 2. Receive Goods — reject incomplete payload and over-received quantity
expected: (a) Attempting to receive with a payload missing one of the PO's line items returns "All line items must be included when receiving this purchase order." with no stock/StockTransaction mutation. (b) Attempting to receive with a receivedQuantity greater than the ordered quantity returns "Received quantity cannot exceed the ordered quantity." with no mutation. (Note: current UI always sends all lines pre-filled at ordered quantity — this may require a direct Server Action call or devtools-forged request to exercise.)
result: pass
note: Not covered by prior test suite (only schema-level 0/negative receivedQuantity checks existed) — added two real Server-Action-level tests in tests/purchase-orders.test.ts (WR-03 missing-line-item rejection, WR-04 over-receipt rejection) mocking the tx layer per the file's existing pattern. `npx vitest run tests/purchase-orders.test.ts` — 20/20 passed.

### 3. Received-PO immutability via direct Server Action calls (bypassing UI)
expected: Directly calling updateDraftPurchaseOrder(receivedPoId, formData) and deletePurchaseOrder(receivedPoId) against a PO whose status is already RECEIVED both return their respective "Only Draft purchase orders can be..." error and make no database writes.
result: pass
note: Not covered by prior test suite (only assertPOEditable, a different guard used solely by confirmPurchaseOrder, was tested). Added two real Server-Action-level tests in tests/purchase-orders.test.ts mocking the status-filtered updateMany/deleteMany calls to return count:0 (what actually happens against a RECEIVED PO), asserting the exact error messages and zero downstream writes. `npx vitest run tests/purchase-orders.test.ts` — 22/22 passed.

### 4. Concurrent update/delete/confirm race
expected: Firing two near-simultaneous requests at the same Draft PO (e.g. one updateDraftPurchaseOrder and one confirmPurchaseOrder, or two deletePurchaseOrder calls) against the real Postgres instance results in exactly one succeeding and the other rejected cleanly with no partial/corrupted state.
result: pass
note: |
  Verified with a new real-Postgres integration suite (tests/purchase-orders-concurrency.test.ts,
  no prisma mocking, hits the actual docker `logistic-postgres` dev DB). Two of the four scenarios
  tested confirmed CR-01's existing updateMany/deleteMany status-filter guard works correctly at
  the DB level (delete-vs-delete, update-vs-delete: exactly one wins, no partial state).

  The update-vs-confirm scenario surfaced a genuine gap CR-01 did not close: confirmPurchaseOrder's
  final write was a plain `prisma.purchaseOrder.update` (no status filter), reading po.lineItems/
  supplier via an earlier unlocked findUnique. Since updateDraftPurchaseOrder never touches the
  `status` column, a mere status-filtered updateMany on confirm's write does NOT prevent it from
  committing based on stale (pre-edit) line items -- confirmed empirically: both operations reported
  success under real concurrency before any behavioral fix.

  Fix applied (actions/purchase-orders.ts, confirmPurchaseOrder): moved the read, D-08 (line-item
  count) and D-16 (active supplier/product) validation, and the atomic status-filtered write all
  inside one `prisma.$transaction` that acquires a row lock via `SELECT ... FOR UPDATE` as its first
  statement (matching the existing receivePurchaseOrder pattern) -- so confirm always validates the
  CURRENT line items, whichever operation actually wins the race.

  Re-verified: `npx vitest run tests/purchase-orders-concurrency.test.ts` -- 4/4 passed, including a
  new regression test proving confirm never finalizes ORDERED against 0 (stale pre-edit) line items.
  Existing mocked confirmPurchaseOrder tests in tests/purchase-orders.test.ts updated for the new
  tx-based shape and a new case (updateMany count:0 defense-in-depth) added -- 23/23 passed.
  Full suite: `npx vitest run` -- 50 passed, 18 pre-existing todo, 0 regressions. `tsc --noEmit` clean.

### 5. Post-fix UI checks — Total visibility after receipt, deactivated-reference display when editing
expected: (a) Receiving goods against an Ordered PO in the browser shows the order Total row immediately after the page updates (not just after navigating away and back). (b) Deactivating a supplier or line-item product referenced by an existing Draft PO, then opening that Draft's edit view, shows the correct name in the Supplier Select and line-item rows (not blank or a raw id).
result: [pending]
note: |
  Part (b) — issue reported: Supplier Select showed the raw cuid instead of the supplier's
  name when editing a Draft PO. Reproduced (RTL render of po-form-client.tsx with a
  deactivated supplier: rendered "cmr0tyyb90004v1uw3m2nx459" instead of "aery"), then found
  the bug is NOT specific to deactivated references — an ACTIVE supplier reproduced the same
  raw-id display. Root cause: Base UI's Select.Value only resolves a label from a mounted
  Select.Item, which never mounts until the popup opens; without an `items` prop on
  Select.Root it falls back to the raw value on the initial closed render.

  Fix: threaded supplier.isActive through page.tsx -> po-detail-client.tsx ->
  po-form-client.tsx and passed an `items` map to the Supplier Select
  (app/(protected)/purchase-orders/po-form-client.tsx), with an "(inactive)" suffix for a
  deactivated reference (matching products-client.tsx's category convention). Re-verified:
  active supplier now shows "Active Co" (not "sup_active_1"); deactivated supplier now shows
  "aery (inactive)" (not the raw cuid). Added 2 permanent regression tests to
  tests/purchase-order-form-select.test.tsx. Full suite: 52 passed, 0 regressions, tsc clean.

  Part (a) still needs confirmation — awaiting user's manual check in the browser.

## Summary

total: 5
passed: 4
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
