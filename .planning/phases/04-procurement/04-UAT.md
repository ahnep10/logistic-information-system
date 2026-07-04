---
status: testing
phase: 04-procurement
source: [04-VERIFICATION.md]
started: 2026-07-04T12:20:00Z
updated: 2026-07-04T12:20:00Z
---

## Current Test

number: 1
name: Confirm Order — DRAFT to ORDERED status write
expected: |
  PO status becomes "Ordered"; reloading the detail page shows the Ordered badge and a
  read-only line-item table (no edit/remove controls).
awaiting: user response

## Tests

### 1. Confirm Order — DRAFT to ORDERED status write
expected: Create (or reuse) a Draft PO with ≥1 line item and an active supplier/products, then click "Confirm Order". PO status becomes "Ordered"; reloading the detail page shows the Ordered badge and a read-only line-item table (no edit/remove controls).
result: [pending]

### 2. Receive Goods — reject incomplete payload and over-received quantity
expected: (a) Attempting to receive with a payload missing one of the PO's line items returns "All line items must be included when receiving this purchase order." with no stock/StockTransaction mutation. (b) Attempting to receive with a receivedQuantity greater than the ordered quantity returns "Received quantity cannot exceed the ordered quantity." with no mutation. (Note: current UI always sends all lines pre-filled at ordered quantity — this may require a direct Server Action call or devtools-forged request to exercise.)
result: [pending]

### 3. Received-PO immutability via direct Server Action calls (bypassing UI)
expected: Directly calling updateDraftPurchaseOrder(receivedPoId, formData) and deletePurchaseOrder(receivedPoId) against a PO whose status is already RECEIVED both return their respective "Only Draft purchase orders can be..." error and make no database writes.
result: [pending]

### 4. Concurrent update/delete/confirm race
expected: Firing two near-simultaneous requests at the same Draft PO (e.g. one updateDraftPurchaseOrder and one confirmPurchaseOrder, or two deletePurchaseOrder calls) against the real Postgres instance results in exactly one succeeding and the other rejected cleanly with no partial/corrupted state.
result: [pending]

### 5. Post-fix UI checks — Total visibility after receipt, deactivated-reference display when editing
expected: (a) Receiving goods against an Ordered PO in the browser shows the order Total row immediately after the page updates (not just after navigating away and back). (b) Deactivating a supplier or line-item product referenced by an existing Draft PO, then opening that Draft's edit view, shows the correct name in the Supplier Select and line-item rows (not blank or a raw id).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
