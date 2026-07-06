---
phase: 5
slug: dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-06
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (installed, `vitest.config.ts` present) |
| **Config file** | `vitest.config.ts` (jsdom environment, `tests/setup.ts`, `passWithNoTests: true`) |
| **Quick run command** | `npx vitest run tests/dashboard.test.ts` |
| **Full suite command** | `npm test` (= `vitest run`) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/dashboard.test.ts` (plus whichever of `products.test.ts`/`purchase-orders.test.ts` was touched)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-XX | TBD | TBD | DASH-01 | — | UTC day-boundary calculation produces correct `gte`/`lte` Date objects for "today" | unit | `npx vitest run tests/dashboard.test.ts -t "UTC day boundary"` | ❌ W0 | ⬜ pending |
| 05-XX | TBD | TBD | DASH-01 | — | KPI count queries use correct Prisma filter shape (`isActive: true`, etc.) | unit | `npx vitest run tests/dashboard.test.ts -t "KPI queries"` | ❌ W0 | ⬜ pending |
| 05-XX | TBD | TBD | DASH-02 | T-05-01 | Low-stock FieldRef filter (`currentStock: {lte: fields.reorderThreshold}`) applied identically in count query and `?stock=low` list query | unit (mocked prisma) | `npx vitest run tests/dashboard.test.ts -t "low-stock filter"` | ❌ W0 | ⬜ pending |
| 05-XX | TBD | TBD | DASH-02 | T-05-01 | `/products?stock=low` searchParams parsing: `"low"` → filter applied; any other value or absent → unfiltered (whitelist-validate, no throw) | unit | `npx vitest run tests/products.test.ts -t "stock param"` | ❌ W0 (new/extend `catalog.test.ts`) | ⬜ pending |
| 05-XX | TBD | TBD | DASH-03 | — | `PurchaseOrder.groupBy` result default-fills zero-count statuses (DRAFT/ORDERED/RECEIVED all present even if some are 0) | unit | `npx vitest run tests/dashboard.test.ts -t "groupBy zero-fill"` | ❌ W0 | ⬜ pending |
| 05-XX | TBD | TBD | DASH-03 | T-05-01 | `/purchase-orders?status=X` searchParams validated against `POStatus` enum; invalid values fall back to `"all"` (whitelist-validate, no throw) | unit | `npx vitest run tests/purchase-orders.test.ts -t "status param"` | ❌ W0 (extend existing) | ⬜ pending |
| 05-XX | TBD | TBD | DASH-02/03 | — | Manual UAT: clicking low-stock tile navigates to `/products?stock=low` with correct banner; clicking a pie slice navigates to `/purchase-orders?status={STATUS}` and pre-selects the matching Tab | manual (browser) | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs and plan/wave assignments are TBD — the planner fills these in when PLAN.md files are created.*

---

## Wave 0 Requirements

- [ ] `tests/dashboard.test.ts` — new file; covers DASH-01/02/03 unit-testable logic (UTC boundary calc, FieldRef filter shape, groupBy zero-fill). Follow the existing `vi.mock("@/lib/prisma", ...)` pattern from `tests/purchase-orders.test.ts` for asserting on Prisma call shape without hitting a real DB.
- [ ] Extend `tests/catalog.test.ts` (or create `products.test.ts`) — covers the `?stock=low` searchParams validation branch.
- [ ] Extend `tests/purchase-orders.test.ts` — covers the `?status=X` searchParams validation branch and `FilterTab` seeding from `initialFilter`.
- [ ] No new framework/config needed — Vitest + jsdom + existing `vi.mock` conventions fully cover this phase's testable surface.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Low-stock KPI tile click → `/products?stock=low` navigation, banner display, correct filtered rows | DASH-02 | No e2e tooling installed (Playwright/Cypress); requires visual/click verification | Log in as Manager, view dashboard, note low-stock count, click tile, confirm URL is `/products?stock=low`, confirm banner text matches count, confirm only active products with `currentStock <= reorderThreshold` are shown |
| PO status pie chart slice click → `/purchase-orders?status={STATUS}` navigation with pre-selected Tab | DASH-03 | Recharts click interaction and Tab pre-selection require visual/click verification | On dashboard, click each pie slice (Draft/Ordered/Received), confirm navigation to the correct filtered URL and that the matching Tab is active on load |
| Recharts pie chart renders correctly with React 19 / Next.js 15 Client Component boundary | DASH-03 | Visual rendering correctness (colors, legend, responsiveness) is not practically unit-testable | View dashboard in browser, confirm pie chart renders with 3 slices in colors matching `lib/utils/po-status.ts` conventions, confirm no React hydration/console errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
