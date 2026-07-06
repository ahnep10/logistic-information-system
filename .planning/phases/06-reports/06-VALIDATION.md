---
phase: 6
slug: reports
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-07
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.9 (existing, `vitest.config.ts` at repo root) |
| **Config file** | `vitest.config.ts` — `environment: "jsdom"`, `globals: true`, `passWithNoTests: true` |
| **Quick run command** | `npx vitest run tests/reports.test.ts` |
| **Full suite command** | `npm test` (= `vitest run`) |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/reports.test.ts` (and `tests/reports-export.test.ts` once created)
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 0 | REPT-01 | — | Inventory report query returns all products with correct severity tier per row | unit | `npx vitest run tests/reports.test.ts -t "inventory"` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 0 | REPT-02 | T-06-DATE | Movement report groups by product for date range; malformed `?from=`/`?to=` falls back to 30-day default without throwing | unit | `npx vitest run tests/reports.test.ts -t "movements"` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 0 | REPT-03 | — | PO report includes all 3 statuses with `totalAmount` matching the stored column (not recomputed) | unit | `npx vitest run tests/reports.test.ts -t "purchase-orders"` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | REPT-04 | T-06-AUTH | Route Handler returns correct `Content-Type`/`Content-Disposition` + non-empty binary body; unauthenticated/non-manager requests get 401/403 | unit | `npx vitest run tests/reports-export.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/reports.test.ts` — covers REPT-01/02/03 (page-level Prisma query shape + whitelist/date-fallback validation), following the existing `tests/products.test.ts`/`tests/purchase-orders.test.ts` `vi.mock("@/lib/prisma", ...)` convention
- [ ] `tests/reports-export.test.ts` — covers REPT-04 (Route Handler auth gate + header/body shape), a new test pattern for this codebase since no prior Route Handler test exists; call the exported `GET` function directly with a constructed request object
- [ ] No new test framework/config needed — existing `vitest.config.ts` (`jsdom` environment) covers Route Handler tests fine since Node's native `Response`/`Buffer` globals are available regardless of the jsdom DOM layer

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tabs UI switches correctly between the 3 report views and renders expected columns/grouping | REPT-01, REPT-02, REPT-03 | Visual layout and interaction require a real browser | Visit `/reports`, click each tab, confirm correct table/grouping renders |
| Downloaded `.xlsx` file opens correctly in Excel/LibreOffice and contains expected columns/rows | REPT-04 | File format correctness after browser download requires opening the actual file in spreadsheet software | Click each report's "Export to Excel" link, open the downloaded file, confirm columns and row data match the on-screen report |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
