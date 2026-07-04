---
phase: 04-procurement
verified: 2026-07-04T12:14:34Z
status: human_needed
score: 8/13 must-haves verified
behavior_unverified: 5
overrides_applied: 0
mvp_mode_note: "ROADMAP.md marks Mode: mvp for this phase (and all six phases in this project), but the Goal line is descriptive prose, not literal 'As a...I want to...so that...' User Story syntax (user-story.validate returned false). Unlike Phase 3, no PLAN.md in this phase embeds an alternate valid User Story either. Following the Phase 3 precedent (03-VERIFICATION.md), this is treated as a documentation-formatting gap, not a blocker — the ROADMAP Success Criteria are concrete, observable, and testable, so standard goal-backward verification proceeded against them directly rather than refusing."
re_verification: null
behavior_unverified_items:
  - truth: "Confirming a valid Draft PO advances status DRAFT -> ORDERED (PROC-02)"
    test: "Create a Draft PO with >=1 line item and an active supplier/products, then call confirmPurchaseOrder(id)"
    expected: "PO status becomes ORDERED in the database; a subsequent load of the PO shows status ORDERED and the line-item table becomes read-only"
    why_human: "No automated test in tests/purchase-orders.test.ts asserts the confirmPurchaseOrder success path (only the two D-16 rejection paths — deactivated supplier/product — are unit-tested). The write itself (`prisma.purchaseOrder.update({ data: { status: \"ORDERED\" } })`) is unexercised by any mock/integration test. It was exercised in the 04-04 end-of-phase human checkpoint (approved), but that checkpoint predates the CR-01/CR-03 review-fix commits, so a fresh confirmation is recommended."
  - truth: "receivePurchaseOrder rejects a payload missing PO line items (WR-03) and rejects receivedQuantity exceeding the ordered quantity (WR-04)"
    test: "Call receivePurchaseOrder with a lineItems payload that omits one of the PO's line items, and separately with a receivedQuantity greater than that line's ordered quantity"
    expected: "First case: '{ error: \"All line items must be included when receiving this purchase order.\" }'; second case: '{ error: \"Received quantity cannot exceed the ordered quantity.\" }'; in both cases no stock/StockTransaction mutation occurs"
    why_human: "The code path exists (actions/purchase-orders.ts:251-264) and was reviewed/fixed in commit 8a392e0, but 04-REVIEW-FIX.md self-flags both as 'fixed: requires human verification' — the WR-08 follow-up test pass (0b8ed31) only added happy-path coverage (full, in-bounds receipt), not these two negative-path cases."
  - truth: "A Received PO cannot be edited or deleted via updateDraftPurchaseOrder/deletePurchaseOrder, regardless of what UI buttons are shown (PROC-04, D-17)"
    test: "Directly call updateDraftPurchaseOrder(receivedPoId, formData) and deletePurchaseOrder(receivedPoId) against a PO whose status is RECEIVED"
    expected: "Both return { error: \"Only Draft purchase orders can be edited.\" } / { error: \"Only Draft purchase orders can be deleted.\" } and make no database writes"
    why_human: "The CR-01 fix (atomic updateMany/deleteMany with a status:\"DRAFT\" WHERE-clause filter) is structurally correct by code inspection and is a well-established Postgres atomicity pattern already used elsewhere in this codebase, but no unit test in tests/purchase-orders.test.ts exercises updateDraftPurchaseOrder or deletePurchaseOrder at all (only receivePurchaseOrder and confirmPurchaseOrder are covered). Only the receive path's row-lock-and-reject behavior is behaviorally tested."
  - truth: "Two concurrent requests racing to update/delete/confirm the same PO cannot both succeed (CR-01 concurrency fix)"
    test: "Fire two near-simultaneous updateDraftPurchaseOrder/deletePurchaseOrder/confirmPurchaseOrder calls against the same Draft PO id, one of which is expected to lose the race after the other transitions the PO's status"
    expected: "Exactly one request succeeds; the other receives a clear rejection error and makes no partial writes"
    why_human: "04-REVIEW-FIX.md explicitly self-flags this: 'no live Postgres instance was available in this environment to run a true concurrent-transaction integration test... recommend a manual/staging test of two concurrent update+confirm (or delete+confirm) requests against a real database before considering this fully closed.' This verifier confirmed the fix code is present and structurally sound (atomic single-statement WHERE-clause guards) but cannot fabricate a live concurrency test that the fix's own author explicitly deferred."
  - truth: "Post-review-fix UI correctness: the order Total row reappears after a successful receipt (WR-05), and a Draft PO's deactivated-since-creation supplier/product renders by name rather than blank/raw id when editing (WR-06)"
    test: "WR-05: Receive goods against an Ordered PO and confirm the Total row is visible immediately after the page re-renders (not just after manual navigation away and back). WR-06: deactivate a supplier or line-item product referenced by an existing Draft PO, then open that Draft's edit view and confirm the Select/line-item labels show the correct name, not a blank field or raw cuid."
    expected: "WR-05: Total row visible immediately post-receipt. WR-06: Supplier Select pre-fills with the deactivated supplier's name; line-item rows show the deactivated product's name/SKU, not its raw id."
    why_human: "Both are pure UI rendering fixes with zero automated test coverage in this project (no tests target page.tsx or po-detail-client.tsx). 04-REVIEW-FIX.md self-flags WR-06 as 'requires human verification.' The 04-04 end-of-phase browser checkpoint pre-dates both fixes (commits 1ee467b and 141d4a3), so neither has been visually confirmed post-fix."
---

# Phase 4: Procurement Verification Report

**Phase Goal:** Staff can manage the complete purchase order lifecycle — from creating a draft PO through goods receipt — with the receipt atomically updating both PO status and inventory in a single database transaction.
**Verified:** 2026-07-04T12:14:34Z
**Status:** human_needed
**Re-verification:** No — initial verification

**Important context for this verification:** This phase went through a code-review + fix cycle (`.planning/phases/04-procurement/04-REVIEW.md` → `04-REVIEW-FIX.md`) after all 4 plans' executors and the 04-04 end-of-phase human checkpoint had already completed and been approved. The fix cycle changed `actions/purchase-orders.ts`, `lib/validations/purchase-order.ts`, `prisma/schema.prisma`, and two UI files (commits `a9cb914` through `0b8ed31`, all present on `main`). This verification checked the **current** state of the codebase (post-fix), not the pre-fix state the 04-01..04-04 SUMMARY.md files and the human checkpoint approval describe. Several of the fix commits' own self-assessment (in `04-REVIEW-FIX.md`) already flag specific items as "requires human verification" because no live Postgres instance was available in the fixer's isolated worktree to exercise true concurrent-transaction or negative-path scenarios — this verifier independently confirmed those same gaps still exist as of this check and could not close them without live browser/DB access.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `PurchaseOrder`/`PurchaseOrderLineItem` schema exists in Postgres with correct FKs and `onDelete: Cascade` on line items (04-01) | ✓ VERIFIED | `prisma/schema.prisma:104-130`; `npx prisma migrate status` → "Database schema is up to date!" (5 migrations, ran live against `logistic_mis` DB) |
| 2 | Zod validation contracts (`createPurchaseOrderSchema`, `confirmPurchaseOrderSchema`, `receivePurchaseOrderSchema`) and `assertPOEditable` guard behave per spec (04-01) | ✓ VERIFIED | `lib/validations/purchase-order.ts`; `npx vitest run tests/purchase-orders.test.ts` → 18/18 passed, including exact-message assertions |
| 3 | Staff can create a Draft PO with a supplier and 0+ line items; server always recomputes `totalAmount` from persisted line items, never trusts a client-submitted total (PROC-01, D-07) | ✓ VERIFIED | `actions/purchase-orders.ts:30-67` (`computeTotalAmount` inside `try`, no `totalAmount` field read from `FormData`); `po-form-client.tsx` never sends a total field; schema-level tests pass; end-to-end create→redirect flow was approved in the 04-04 human checkpoint (step 1) and this code path was not materially altered by post-checkpoint fixes beyond wrapping in `try/catch` |
| 4 | Only `isActive:true` suppliers/products selectable when creating a Draft; PO gets a unique `poNumber` via DB sequence and the user lands on its detail page (PROC-01, D-16, D-21, WR-01) | ✓ VERIFIED | `app/(protected)/purchase-orders/new/page.tsx:8-17` (`where: { isActive: true }`); `prisma/schema.prisma:106` (`poNumber Int @unique @default(autoincrement())`); migration `20260704040000_add_po_number_unique` applied live; `po-form-client.tsx:150` (`router.push(`/purchase-orders/${result.id}`)`) |
| 5 | PO list is filterable by status (All/Draft/Ordered/Received) with correct columns (PO #, Supplier, Status, Total, Created, Created By) and row-click navigation (PROC-05, list half) | ✓ VERIFIED | `purchase-orders-client.tsx` — client-side `.filter()` on `po.status.toLowerCase()`, all six columns present, each `TableCell` wraps a `Link` to `/purchase-orders/${po.id}` (keyboard-accessible) |
| 6 | Confirming a Draft with 0 line items, or with a since-deactivated supplier/line-item product, is blocked with a specific error naming the problem (PROC-02, D-08/D-16) | ✓ VERIFIED | `actions/purchase-orders.ts:125-180`; behavioral tests pass: `confirmPurchaseOrder rejects when the supplier has been deactivated...` and `...a line-item product has been deactivated...` (both assert the exact named-entity error string and that `prisma.purchaseOrder.update` is never called) |
| 7 | Confirming a valid Draft advances status DRAFT → ORDERED and its line items become uneditable thereafter (PROC-02) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code present and correctly wired (`actions/purchase-orders.ts:182-189`; `updateDraftPurchaseOrder`'s atomic `status:"DRAFT"` filter makes an ORDERED PO's line items unreachable for edit) — see `behavior_unverified_items[0]` |
| 8 | Receiving an Ordered PO is a single atomic action creating one `StockTransaction` per line (`reason: "Purchase Received"`, `purchaseOrderId` set), incrementing `Product.currentStock` per line, setting status RECEIVED, and rejecting a concurrent/duplicate receive attempt (PROC-03, D-10/D-11/D-12/D-13/D-22) | ✓ VERIFIED | `actions/purchase-orders.ts:218-309`; 5 behavioral tests pass (row-lock-first ordering, rejection when status≠ORDERED with `product.update` never called, per-line `StockTransaction` args, `currentStock` increment args, final `status:"RECEIVED"` update) — see WR-08 tests in `tests/purchase-orders.test.ts:123-299` |
| 9 | `receivePurchaseOrder` requires the full line-item set before marking RECEIVED, and rejects `receivedQuantity` exceeding the ordered `quantity` (WR-03/WR-04 hardening) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code present (`actions/purchase-orders.ts:251-264`) and logically sound, but no test exercises either rejection branch — see `behavior_unverified_items[1]` |
| 10 | A Received PO cannot be edited, confirmed, received again, or deleted through any Server Action call, regardless of what UI shows (PROC-04, D-17) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `receivePurchaseOrder`'s rejection is behaviorally tested (item 8); `confirmPurchaseOrder`'s `assertPOEditable` call is unit-tested; but `updateDraftPurchaseOrder`/`deletePurchaseOrder`'s atomic status-filtered rejection (CR-01 fix) has zero test coverage in this file — see `behavior_unverified_items[2]` and `[3]` |
| 11 | A Draft PO (and only a Draft PO) can be permanently deleted, cascading to its line items (PROC-04, D-15) | ✓ VERIFIED | `onDelete: Cascade` in schema; `deletePurchaseOrder` uses `deleteMany({ where: { id, status: "DRAFT" } })`; delete flow was approved in the 04-04 human checkpoint (step 7) — this specific code path (single-shot, non-concurrent delete) was not altered in a way that changes its happy-path behavior |
| 12 | Detail page renders every line item with its subtotal and the PO's grand total across all three statuses (Draft/Ordered/Received), matching the list page's total (PROC-05 detail half, D-20/D-23) | ✓ VERIFIED | `po-detail-client.tsx` — three distinct status branches each render a line-item table + right-aligned total; `[id]/page.tsx` converts every `Decimal` via `.toNumber()` before the RSC boundary |
| 13 | Post-review-fix UI correctness: order Total reappears after a successful receipt (WR-05); a Draft's deactivated-since-creation supplier/product renders by name, not blank/raw id, when editing (WR-06) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code fixes present and read correctly (`po-detail-client.tsx` calls `setReceiveMode(false)` before `router.refresh()`; `[id]/page.tsx` unions active suppliers/products with the PO's referenced ids) but both are UI-only fixes added after the 04-04 checkpoint, with zero automated test coverage — see `behavior_unverified_items[4]` |

**Score:** 8/13 truths verified (5 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | `POStatus` enum, `PurchaseOrder`, `PurchaseOrderLineItem` models, FK on `StockTransaction` | ✓ VERIFIED | All present; `poNumber` carries `@unique` (WR-01 fix applied) |
| `lib/validations/purchase-order.ts` | Zod schemas + `assertPOEditable` | ✓ VERIFIED | All exports present; `.finite()`/`.max()` bounds added (CR-03/WR-02); duplicate-`lineItemId` `.refine()` added (CR-02) |
| `lib/utils/po-status.ts` | `getStatusBadge` | ✓ VERIFIED | Matches 04-UI-SPEC.md color/label table exactly |
| `lib/utils/po-number.ts` | `formatPONumber` | ✓ VERIFIED | 4-digit zero-padded `PO-0001` format |
| `tests/purchase-orders.test.ts` | Wave 0 + WR-08 coverage | ✓ VERIFIED | 373 lines, 0 `it.todo` remaining; 18/18 tests pass |
| `actions/purchase-orders.ts` | All 5 Server Actions | ✓ VERIFIED | `createDraftPurchaseOrder`, `updateDraftPurchaseOrder`, `confirmPurchaseOrder`, `receivePurchaseOrder`, `deletePurchaseOrder` all exported; no `requireManager` import anywhere (D-14 confirmed) |
| `app/(protected)/purchase-orders/page.tsx` | List Server Component | ✓ VERIFIED | Fetches + serializes, renders `PurchaseOrdersClient` |
| `app/(protected)/purchase-orders/purchase-orders-client.tsx` | List client component | ✓ VERIFIED | Default export, Tabs filter, 6-column table |
| `app/(protected)/purchase-orders/new/page.tsx` | Create page | ✓ VERIFIED | Fetches active suppliers/products, renders `PurchaseOrderForm` |
| `app/(protected)/purchase-orders/po-form-client.tsx` | Shared form | ✓ VERIFIED | Default export, `useFieldArray`, `mode="create"|"edit"`, wrapped submit in `try/catch` (WR-07 fix applied) |
| `app/(protected)/purchase-orders/[id]/page.tsx` | Detail Server Component | ✓ VERIFIED | Fetches PO + relations, `notFound()` guard, WR-06 fix (unions inactive-but-referenced supplier/products) applied |
| `app/(protected)/purchase-orders/[id]/po-detail-client.tsx` | Detail client component | ✓ VERIFIED | Default export, 3 status-conditional views, WR-05 fix (`setReceiveMode(false)` before refresh) applied |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `lib/validations/purchase-order.ts` | `actions/purchase-orders.ts` | schema/guard imports | ✓ WIRED | All 3 schemas + `assertPOEditable` imported and used |
| `lib/utils/po-status.ts` + `po-number.ts` | `purchase-orders-client.tsx` / `po-detail-client.tsx` | `getStatusBadge`/`formatPONumber` imports | ✓ WIRED | Confirmed in both client components |
| `po-form-client.tsx` | `actions/purchase-orders.ts` | `createDraftPurchaseOrder`/`updateDraftPurchaseOrder` calls | ✓ WIRED | Confirmed in `onSubmit`, now wrapped in `try/catch` |
| `po-form-client.tsx` | `lib/validations/purchase-order.ts` | `zodResolver(createPurchaseOrderSchema)` | ✓ WIRED | Confirmed at line 87 |
| `po-detail-client.tsx` (Draft) | `po-form-client.tsx` | `<PurchaseOrderForm mode="edit" .../>` | ✓ WIRED | Confirmed import + usage, reused unmodified |
| `po-detail-client.tsx` | `actions/purchase-orders.ts` | `confirmPurchaseOrder(`/`deletePurchaseOrder(`/`receivePurchaseOrder(` | ✓ WIRED | All three imported and called from their respective UI handlers |
| `receivePurchaseOrder` | `tx.$queryRaw SELECT ... FOR UPDATE` | row lock precedes status check precedes writes | ✓ WIRED | Confirmed by direct code read (`actions/purchase-orders.ts:233-293`) and by the behavioral test asserting `$queryRaw` is first in `callOrder` |
| `purchase-orders-client.tsx` | `[id]/page.tsx` | row navigation `purchase-orders/${po.id}` | ✓ WIRED | Confirmed |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Purchase order test suite passes | `npx vitest run tests/purchase-orders.test.ts` | 18 passed, 0 failed | ✓ PASS |
| Full workspace test suite has no regressions | `npx vitest run` (run once) | 40 passed, 18 todo (unrelated files) | ✓ PASS |
| Project type-checks cleanly | `npx tsc --noEmit` | exits 0, no output | ✓ PASS |
| Migration state matches schema | `npx prisma migrate status` | "Database schema is up to date!" (5 migrations) | ✓ PASS |
| `receivePurchaseOrder` row lock precedes status check precedes writes | Named test: `receivePurchaseOrder acquires a PO row lock via SELECT ... FOR UPDATE before any write` | pass | ✓ PASS |
| `receivePurchaseOrder` rejects non-ORDERED status (double-receipt) | Named test: `receivePurchaseOrder rejects when the PO status is not ORDERED (double-receipt race, D-22)` | pass | ✓ PASS |
| `confirmPurchaseOrder` rejects deactivated supplier/product (D-16) | Named tests (2) in "Confirm Purchase Order Server Action" describe block | pass | ✓ PASS |
| `confirmPurchaseOrder` success path (DRAFT→ORDERED write) | *(no named test exists)* | n/a | ? SKIP — routed to human verification |
| `updateDraftPurchaseOrder`/`deletePurchaseOrder` reject on non-DRAFT status | *(no named test exists)* | n/a | ? SKIP — routed to human verification |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROC-01 | 04-01, 04-03 | Create Draft PO with supplier + line items | ✓ SATISFIED | Truths 1, 2, 3, 4 |
| PROC-02 | 04-01, 04-04 | Edit Draft, confirm to Ordered | ✓ SATISFIED (partial human_needed) | Truths 6, 7 — success-path write unverified by automated test |
| PROC-03 | 04-01, 04-04 | Receive goods atomically, single DB transaction | ✓ SATISFIED | Truth 8 (fully behaviorally tested) |
| PROC-04 | 04-01, 04-04 | Received PO immutable, Draft-only delete | ✓ SATISFIED (partial human_needed) | Truths 10, 11 |
| PROC-05 | 04-02, 04-04 | PO list + filter, detail with line items/total | ✓ SATISFIED | Truths 5, 12 |

No orphaned requirements found — REQUIREMENTS.md's Phase 4 traceability row (PROC-01 through PROC-05) exactly matches the union of `requirements:` frontmatter declared across all four plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/(protected)/purchase-orders/po-form-client.tsx` | 87 | `zodResolver(createPurchaseOrderSchema) as any` | ℹ️ Info | Pre-accepted project convention (Pitfall 3, documented in 04-RESEARCH.md/04-PATTERNS.md); not a stub, does not affect runtime behavior |
| `po-detail-client.tsx`, `purchase-orders-client.tsx`, `po-form-client.tsx` | multiple | Duplicated `currencyFormatter`/date-format logic (IN-02 from 04-REVIEW.md) | ℹ️ Info | Code-quality only, not fixed in the review-fix cycle (correctly, since it was Info-severity); no functional impact |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 11 phase-modified files. No `it.todo`/`it.skip` remaining in `tests/purchase-orders.test.ts`.

### Human Verification Required

### 1. Confirm Order — DRAFT to ORDERED status write

**Test:** Create (or reuse) a Draft PO with ≥1 line item and an active supplier/products, then click "Confirm Order" (or call `confirmPurchaseOrder(id)` directly).
**Expected:** PO status becomes "Ordered"; reloading the detail page shows the Ordered badge and a read-only line-item table (no edit/remove controls).
**Why human:** No automated test asserts the success-path `prisma.purchaseOrder.update({ data: { status: "ORDERED" } })` call — only the two D-16 rejection paths are unit-tested. This exact behavior was approved once during the 04-04 checkpoint, but that approval predates the CR-01/CR-03 review-fix commits.

### 2. Receive Goods — reject incomplete payload and over-received quantity

**Test:** (a) Attempt to receive an Ordered PO with a `lineItems` payload that omits one of its line items. (b) Attempt to receive with a `receivedQuantity` greater than a line's ordered `quantity`.
**Expected:** (a) `{ error: "All line items must be included when receiving this purchase order." }`, no stock/StockTransaction mutation. (b) `{ error: "Received quantity cannot exceed the ordered quantity." }`, no stock/StockTransaction mutation.
**Why human:** `04-REVIEW-FIX.md` self-flags both WR-03 and WR-04 as "fixed: requires human verification" — the follow-up test commit only added happy-path coverage, not these two negative-path cases. The current UI has no way to submit an incomplete payload (it always sends all lines), so this requires either a direct Server Action call or a devtools-forged request.

### 3. Received-PO immutability via direct Server Action calls (bypassing UI)

**Test:** Directly call `updateDraftPurchaseOrder(receivedPoId, formData)` and `deletePurchaseOrder(receivedPoId)` against a PO whose status is already `RECEIVED`.
**Expected:** Both return their respective "Only Draft purchase orders can be..." error and make no database writes.
**Why human:** The CR-01 atomic `updateMany`/`deleteMany` WHERE-clause fix is structurally sound by code review, but no unit test in this project exercises `updateDraftPurchaseOrder` or `deletePurchaseOrder` at all — this is the actual PROC-04 "regardless of UI" enforcement the plan calls out, and it has zero automated regression coverage.

### 4. Concurrent update/delete/confirm race

**Test:** Fire two near-simultaneous requests at the same Draft PO — e.g., one `updateDraftPurchaseOrder` and one `confirmPurchaseOrder`, or two `deletePurchaseOrder` calls — against a real Postgres instance.
**Expected:** Exactly one request succeeds; the other is rejected cleanly with no partial/corrupted state.
**Why human:** `04-REVIEW-FIX.md`'s own author explicitly could not test this ("no live Postgres instance was available... recommend a manual/staging test... before considering this fully closed"). This verifier has no mechanism to fabricate genuine concurrent database transactions either; the fix pattern (atomic single-statement WHERE-clause guards) is a well-established and structurally correct approach, but the specific race scenario remains unexercised.

### 5. Post-fix UI checks — Total visibility after receipt, deactivated-reference display when editing

**Test:** (a) Receive goods against an Ordered PO in the browser and confirm the order Total row is visible immediately after the page updates (not just after navigating away and back). (b) Deactivate a supplier or line-item product referenced by an existing Draft PO, then open that Draft's edit view and confirm the Supplier Select and line-item rows show the correct name (not blank or a raw id).
**Expected:** (a) Total row visible immediately post-receipt. (b) Names render correctly for deactivated-but-referenced entities.
**Why human:** Both are pure UI rendering fixes (WR-05, WR-06) with zero automated test coverage anywhere in this project (no tests target `page.tsx` or `po-detail-client.tsx` files). `04-REVIEW-FIX.md` self-flags WR-06 as requiring manual verification. The 04-04 end-of-phase browser checkpoint pre-dates both fix commits (`1ee467b`, `141d4a3`).

### Gaps Summary

No gaps found that block the phase (no missing artifacts, no stubs, no broken key links, no debt markers, all automated checks pass). The phase's core deliverable — the atomic goods-receipt transaction updating both PO status and inventory in a single database transaction — is directly and behaviorally verified by passing tests (item 8), which is the single highest-risk piece of this phase per its own threat model.

The `human_needed` status stems entirely from a code-review-and-fix cycle that ran *after* the phase's own end-of-phase human checkpoint was approved. Five of the eleven fix commits (`a9cb914`/CR-01, `8a392e0`/WR-03+WR-04, `1ee467b`/WR-05, `141d4a3`/WR-06) touch behavior that was either never automated-tested or was UI-only and thus untestable by the existing test suite, and in three cases (CR-01, WR-03, WR-04, WR-06) the fix author's own report explicitly recommends human/staging verification before considering the item fully closed. This verifier independently confirmed those gaps still exist in the current codebase and could not close them without live browser/database access.

---

_Verified: 2026-07-04T12:14:34Z_
_Verifier: Claude (gsd-verifier)_
