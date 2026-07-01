---
phase: 3
slug: warehouse
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 |
| **Config file** | `vitest.config.ts` (exists from Phase 1) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-W0-01 | schema | 0 | INVT-01 | T-03-01 | Zod rejects quantity < 1 | unit | `npm test -- --reporter=verbose tests/warehouse.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-W0-02 | schema | 0 | INVT-01 | T-03-01 | Zod rejects missing productId | unit | `npm test -- --reporter=verbose tests/warehouse.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-W0-03 | schema | 0 | INVT-02 | T-03-02 | Zod rejects quantity < 1 (stock-out) | unit | `npm test -- --reporter=verbose tests/warehouse.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-W0-04 | schema | 0 | INVT-02 | T-03-02 | Zod rejects invalid reason | unit | `npm test -- --reporter=verbose tests/warehouse.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-W0-05 | actions | 0 | INVT-03 | T-03-03 | Insufficient stock returns error | integration stub | `npm test -- --reporter=verbose tests/warehouse.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-W1-01 | actions | 1 | INVT-04/06 | — | getSeverityBadge returns correct tier | unit | `npm test` | ✅ tests/catalog.test.ts | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/warehouse.test.ts` — stubs for INVT-01, INVT-02 Zod schema tests + INVT-03 integration stub (insufficient-stock error path)

*Existing `tests/catalog.test.ts` already covers `getSeverityBadge` — no new severity tests needed for INVT-04/INVT-06.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stock-in dialog opens, form submits, recent transactions table updates | INVT-01 | Server Action + RSC revalidation requires browser | 1. Open /stock. 2. Click "Record Stock In". 3. Select product, enter qty=5, reason="Purchase Received". 4. Submit. 5. Verify new row appears in Recent Transactions. |
| Stock-out rejects negative stock with inline error | INVT-02/INVT-03 | Requires live DB + browser | 1. Open /stock. 2. Click "Record Stock Out". 3. Enter qty > current stock. 4. Submit. 5. Verify inline error "Insufficient stock. Current stock: N units." — dialog stays open. |
| /inventory URL filters work (product, date range, type tabs) | INVT-05 | URL-param + RSC rerender requires browser | 1. Navigate to /inventory. 2. Select a product from dropdown. 3. Verify URL updates and table filters. 4. Set From/To dates. 5. Verify date filter applied. 6. Click "Stock In" tab. 7. Verify only IN transactions shown. |
| Severity badge (Critical/Warning/OK) visible on /products | INVT-06 | Phase 2 feature — verify not regressed | 1. Navigate to /products. 2. After stock mutation, verify badge updates on next page visit. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
