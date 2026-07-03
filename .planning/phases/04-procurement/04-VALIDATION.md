---
phase: 4
slug: procurement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-03
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 |
| **Config file** | `vitest.config.ts` (exists from Phase 1) |
| **Quick run command** | `npm test -- tests/purchase-orders.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/purchase-orders.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-W0-01 | schema | 0 | PROC-01 | T-04-01 | Zod rejects invalid supplier/product/quantity/price; accepts valid Draft with 0+ line items (D-08) | unit | `npm test -- tests/purchase-orders.test.ts -t "Draft"` | ❌ Wave 0 | ⬜ pending |
| 04-W0-02 | actions | 0 | PROC-02 | T-04-04 | Confirm rejects 0-line-item PO (D-08); rejects if supplier/any line-item product is `isActive: false` (D-16) | unit + integration stub | `npm test -- tests/purchase-orders.test.ts -t "Confirm"` | ❌ Wave 0 | ⬜ pending |
| 04-W0-03 | actions | 0 | PROC-03 | T-04-02 / T-04-05 | Receive action: `tx.$queryRaw FOR UPDATE` called before writes; re-check `status === "ORDERED"` after lock; one `StockTransaction` per line with `reason: "Purchase Received"` + `purchaseOrderId` set; `Product.currentStock` incremented per line; PO status set to RECEIVED — all inside one `prisma.$transaction` | integration (stub, matches `tests/warehouse.test.ts` `it.todo` convention) | `npm test -- tests/purchase-orders.test.ts -t "receive"` | ❌ Wave 0 | ⬜ pending |
| 04-W0-04 | actions | 0 | PROC-04 | T-04-03 | Edit/confirm/receive/delete Server Actions all reject when `status === "RECEIVED"` | unit | `npm test -- tests/purchase-orders.test.ts -t "immutable"` | ❌ Wave 0 | ⬜ pending |
| 04-M-01 | ui | — | PROC-05 | — | PO list status Tabs filter + PO detail page render line items with computed total | manual-only | N/A — manual browser check | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/purchase-orders.test.ts` — new file covering PROC-01 (Draft schema), PROC-02 (confirm-time re-validation), PROC-03 (goods-receipt atomic transaction, `it.todo` stub), PROC-04 (immutability guard), following the exact structure of `tests/warehouse.test.ts` (describe blocks per schema/action, `it.todo` for the atomic transaction integration test)
- [ ] No new shared fixtures needed — reuses the established "pure Zod logic, no DB connection, no `@prisma/client` import" pattern
- [ ] No framework install needed — Vitest 4.1.9 already configured and working (`passWithNoTests: true` already set from the Phase 1 lesson)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Draft PO creation with repeating line-item rows | PROC-01 | Server Action + client `useFieldArray` form state requires browser | 1. Open `/purchase-orders/new`. 2. Select supplier. 3. Add 2+ line items (product, quantity, unit price) via "Add Line". 4. Verify live total updates. 5. Save Draft. 6. Verify redirect to detail page with correct line items and total. |
| Confirm Draft → Ordered blocks on deactivated supplier/product | PROC-02 | Requires live DB + browser to deactivate an entity mid-flow | 1. Create Draft PO referencing a product. 2. In another tab, deactivate that product via `/products`. 3. Return to PO detail, click "Confirm". 4. Verify a clear error naming the deactivated product; PO stays in Draft. |
| Receive Ordered PO updates stock atomically | PROC-03 | Server Action + RSC revalidation across two entities (PO + Product stock) requires browser | 1. Confirm a PO to Ordered. 2. Open receive screen; verify received quantities pre-filled with ordered quantities. 3. Edit one line's received quantity down. 4. Submit. 5. Verify PO status is Received, `/inventory` shows a new stock-in transaction with reason "Purchase Received" linked to this PO, and `/products` shows updated stock level. |
| Received PO is fully immutable in the UI | PROC-04 | UI convenience layer (button hiding) on top of the real Server Action guard | 1. Open a Received PO's detail page. 2. Verify no Edit/Confirm/Receive/Delete buttons are shown — only a "Received" badge. |
| PO list status filter + detail page line items/total | PROC-05 | URL/Tabs-driven rendering requires browser | 1. Navigate to `/purchase-orders`. 2. Click Draft/Ordered/Received tabs; verify list filters correctly. 3. Open a PO's detail page; verify line-item table shows per-line subtotal and grand total matching the list total. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
