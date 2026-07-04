---
phase: 04-procurement
plan: 04
subsystem: procurement
tags: [server-actions, prisma-transaction, select-for-update, next.js, react-hook-form]

# Dependency graph
requires:
  - phase: 04-01
    provides: POStatus enum, PurchaseOrder/PurchaseOrderLineItem models, confirmPurchaseOrderSchema/receivePurchaseOrderSchema, assertPOEditable guard
  - phase: 04-03
    provides: createDraftPurchaseOrder/updateDraftPurchaseOrder Server Actions, PurchaseOrderForm shared component (mode="edit" reuse)
provides:
  - "confirmPurchaseOrder / receivePurchaseOrder / deletePurchaseOrder Server Actions in actions/purchase-orders.ts"
  - "/purchase-orders/[id] detail page with Draft/Ordered/Received status-conditional views"
  - "Row-locked atomic goods-receipt transaction (SELECT ... FOR UPDATE) closing the double-receipt race"
affects: [05-dashboard, 06-reports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SELECT ... FOR UPDATE via tx.$queryRaw as the literal first statement inside prisma.$transaction, with the status re-check strictly after it returns — same technique proven in actions/stock-transactions.ts, applied here to the PurchaseOrder parent row (D-22)"
    - "Server-side re-validation of supplier.isActive/product.isActive at confirm-time (not at Draft-creation time) so a since-deactivated entity blocks confirmation with a specific error naming it (D-16)"
    - "receiveMode local boolean toggle (no navigation, no dialog) for the Ordered-state receive-edit view, preserving entered values on server error instead of resetting the form"

key-files:
  created: []
  modified:
    - actions/purchase-orders.ts
    - app/(protected)/purchase-orders/[id]/page.tsx
    - app/(protected)/purchase-orders/[id]/po-detail-client.tsx

key-decisions:
  - "receivePurchaseOrder wraps its transaction in try/catch and surfaces the thrown Error's message verbatim (matching stock-transactions.ts's err instanceof Error convention), so the D-22 'already been received' message reaches the client exactly as written"
  - "Draft state's Confirm Order / Delete Draft actions use one-shot AlertDialogs that close on failure and surface the error inline above the Details card, rather than leaving an error inside the dialog — matches 04-UI-SPEC.md's distinction between a confirm dialog and a form"
  - "Ordered state's Receive Goods flow is a local receiveMode toggle, not a route change or modal — Cancel discards edits in place, Confirm Receipt keeps entered values visible if the server rejects the request"

patterns-established:
  - "po-detail-client.tsx renders three fully separate status branches (Draft/Ordered/Received) from one component, sharing only the header (PO#, status badge, Details card) — establishes the pattern for any future status-conditional detail view in this codebase"

requirements-completed: [PROC-02, PROC-03, PROC-04, PROC-05]

coverage:
  - id: D1
    description: "confirmPurchaseOrder: rejects 0-line-item Drafts and Drafts referencing a deactivated supplier/product with a specific named error; advances DRAFT -> ORDERED on success"
    requirement: "PROC-02"
    verification:
      - kind: unit
        ref: "tests/purchase-orders.test.ts && npx tsc --noEmit"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 checkpoint step 2-3: deactivate a line-item product, confirm blocked with named error, reactivate, confirm succeeds and line items become read-only"
        status: pass
    human_judgment: false
  - id: D2
    description: "receivePurchaseOrder: single atomic action creating one StockTransaction per line (reason 'Purchase Received', purchaseOrderId set), incrementing Product.currentStock per line, and setting status RECEIVED, using SELECT...FOR UPDATE to close the double-receipt race (D-22)"
    requirement: "PROC-03"
    verification:
      - kind: unit
        ref: "tests/purchase-orders.test.ts && npx tsc --noEmit"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 checkpoint step 4-5: Receive Goods with one line's quantity edited down; verified stock-in row per line with reason 'Purchase Received' linked to the PO, and each product's stock increased by exactly its received (not ordered) quantity"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Received PO is immutable at the Server Action layer — confirm/receive/delete all reject regardless of what UI buttons are (or are not) rendered"
    requirement: "PROC-04"
    verification:
      - kind: unit
        ref: "tests/purchase-orders.test.ts (assertPOEditable / status-guard coverage) && npx tsc --noEmit"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 checkpoint step 5: Received PO detail view renders no action buttons at all (D-17 UI layer); server-side guards in confirmPurchaseOrder/receivePurchaseOrder/deletePurchaseOrder independently verified by code review against the plan's <behavior> spec"
        status: pass
    human_judgment: false
  - id: D4
    description: "/purchase-orders/[id] renders every line item with its subtotal and the PO's grand total across all three statuses (Draft editable form, Ordered read-only + receive-edit, Received fully read-only), matching the list page's total"
    requirement: "PROC-05"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit && npm test"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 checkpoint steps 1, 3, 5, 6: Draft creation lands on detail page with correct supplier/line items/total; Ordered state read-only table; Received state read-only table; list-page tabs show this PO under All/Received with matching total"
        status: pass
    human_judgment: false
  - id: D5
    description: "Draft PO hard-delete via deletePurchaseOrder, cascading to line items, restricted to DRAFT status only"
    requirement: "PROC-04"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 checkpoint step 7: created a second Draft, clicked Delete Draft, confirmed dialog copy, redirected to /purchase-orders with the PO fully removed from the list"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-04
status: complete
---

# Phase 04 Plan 04: Confirm/Receive/Delete Actions + PO Detail Page Summary

**Row-locked atomic goods-receipt transaction plus the three-state `/purchase-orders/[id]` detail page, completing the full Draft-to-Received purchase order lifecycle.**

## Performance

- **Duration:** 25 min (Task 1: 13:18, Task 2: 13:28, plus checkpoint verification and this closeout)
- **Started:** 2026-07-04T13:18:02+07:00
- **Completed:** 2026-07-04T13:28:06+07:00 (tasks); checkpoint approved same session
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 3

## Accomplishments
- `actions/purchase-orders.ts` extended with `confirmPurchaseOrder` (DRAFT-only, re-validates supplier/product `isActive` at confirm time per D-16, requires ≥1 line item), `receivePurchaseOrder` (atomic `SELECT ... FOR UPDATE`-locked transaction that creates one `StockTransaction` per line, increments `Product.currentStock`, and sets status `RECEIVED` — the D-22 double-receipt mitigation), and `deletePurchaseOrder` (hard-delete restricted to `DRAFT`, cascades to line items per D-15)
- `/purchase-orders/[id]` Server Component fetches the PO with `supplier`/`createdBy`/`lineItems.product` relations, converts every `Decimal` field via `.toNumber()` before crossing the RSC boundary (D-23)
- `po-detail-client.tsx` renders three fully distinct status views from one component: Draft (reuses `PurchaseOrderForm mode="edit"` from 04-03 unmodified, with Delete Draft / Confirm Order AlertDialogs), Ordered (read-only table + local `receiveMode` toggle into an editable Received-Qty table), Received (fully read-only, zero action buttons — D-17)
- Full lifecycle verified end-to-end in the browser: Draft creation → deactivated-product confirm-block → reactivate → Confirm Order → Receive Goods with an edited quantity → Received state with correct inventory stock-in rows and product stock increments → list-page tab filtering → second-Draft creation and hard-delete

## Task Commits

Each task was committed atomically:

1. **Task 1: confirmPurchaseOrder, receivePurchaseOrder, deletePurchaseOrder (D-15, D-16, D-17, D-22)** - `342f76e` (feat)
2. **Task 2: /purchase-orders/[id] detail page — Draft/Ordered/Received states (D-11, D-20, D-23)** - `160f5b7` (feat)
3. **Task 3: Verify the full PO lifecycle end-to-end in browser** - checkpoint, no code changes; user responded "approved" — all 7 verification steps passed with no issues reported

**Plan metadata:** (this commit)

## Files Created/Modified
- `actions/purchase-orders.ts` - Added `confirmPurchaseOrder`, `receivePurchaseOrder`, `deletePurchaseOrder`, all using the session-only guard (no `requireManager`, D-14); `receivePurchaseOrder`'s row-lock query textually precedes its status check, which textually precedes every `tx.product.update`/`tx.stockTransaction.create` call
- `app/(protected)/purchase-orders/[id]/page.tsx` - Server Component: fetches one PO with full relations, converts Decimal fields, fetches active suppliers/products for the Draft-state edit form, calls `notFound()` if the PO doesn't exist
- `app/(protected)/purchase-orders/[id]/po-detail-client.tsx` - Default-exported `PurchaseOrderDetailClient`: shared header (PO#, status badge, Details card) plus three status-conditional bodies (Draft/Ordered/Received)

## Decisions Made
- `receivePurchaseOrder` wraps its transaction in `try/catch` and surfaces the thrown `Error`'s message verbatim, matching `actions/stock-transactions.ts`'s `err instanceof Error ? err.message : "..."` convention, so the D-22 "already been received" message reaches the client exactly as written
- Draft state's Confirm Order / Delete Draft use one-shot `AlertDialog`s that close on failure and surface the error inline above the Details card (not left open inside the dialog), matching 04-UI-SPEC.md's distinction between a confirm dialog and a form
- Ordered state's Receive Goods flow is a local `receiveMode` boolean toggle (no navigation, no modal) — Cancel discards edits in place; on a server rejection, entered values are preserved and the user stays in `receiveMode` rather than the form resetting, matching the Phase 3 insufficient-stock error convention

## Deviations from Plan

None - plan executed exactly as written. Both auto tasks matched the plan's `<action>`/`<behavior>` specs and interface contracts (row-lock transaction shape, three-state detail page layout, shared `PurchaseOrderForm` reuse) without requiring auto-fixes. The checkpoint task required no file changes and was approved without any issues reported across all 7 verification steps.

## Issues Encountered

None. The pre-existing, tracked, non-blocking ESLint gate concern (5 `@typescript-eslint/no-explicit-any` errors, none introduced by this plan) and the `PROC-02/03/04` REQUIREMENTS.md premature-completion drift (already corrected in commit `03de22e` prior to this plan's execution) both remain accurately tracked in STATE.md and are resolved/unaffected by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PROC-02, PROC-03, PROC-04, and PROC-05 are now fully deliverable and requirements-complete: the entire Draft → Ordered → Received lifecycle works end to end, including the atomic goods-receipt transaction and provable server-side immutability after receipt.
- Phase 4 (Procurement) is now fully complete — all 4 plans executed and verified.
- Dashboard (Phase 5) and Reports (Phase 6) can now rely on real PO data (status distribution, totals, stock-in transactions linked via `purchaseOrderId`) for their KPI tiles and report queries.
- No blockers for Phase 5.

## Self-Check: PASSED

- FOUND: `actions/purchase-orders.ts` (confirmPurchaseOrder, receivePurchaseOrder, deletePurchaseOrder exports present)
- FOUND: `app/(protected)/purchase-orders/[id]/page.tsx`
- FOUND: `app/(protected)/purchase-orders/[id]/po-detail-client.tsx`
- FOUND: commit `342f76e`
- FOUND: commit `160f5b7`
- FOUND: `npm test` — 33 passed / 24 todo, no regressions
- FOUND: `npx tsc --noEmit` — exits 0

---
*Phase: 04-procurement*
*Completed: 2026-07-04*
