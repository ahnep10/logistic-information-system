---
phase: 5
slug: dashboard
status: final
nyquist_compliant: true
wave_0_complete: true
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
| 05-01-Task0 | 05-01 | 1 | — (process gate) | — | Human-verify checkpoint: confirm `recharts` npm package legitimacy before install (SUS false-positive per RESEARCH.md) | manual (checkpoint) | — (blocking-human gate) | N/A | ⬜ pending |
| 05-01-Task1 | 05-01 | 1 | DASH-01, DASH-03 | — | UTC day-boundary calc + `groupBy` zero-fill logic extracted into `lib/utils/dashboard.ts`, unit-tested in isolation | unit | `npx vitest run tests/dashboard.test.ts` | ❌ W0 → created this task | ⬜ pending |
| 05-01-Task2 | 05-01 | 1 | DASH-01, DASH-02, DASH-03 | T-05-01/T-05-02 | Dashboard page (5 Prisma queries incl. FieldRef low-stock count) + Recharts client component with defensive `onClick` payload read (`data?.payload?.status ?? data?.status`) | unit + manual | `npx vitest run tests/dashboard.test.ts` + human-check (KPI tiles render, pie chart/empty-state, slice click navigates without console error) | ❌ W0 → created this task | ⬜ pending |
| 05-02-Task1 | 05-02 | 1 | DASH-02 | T-05-03 | `/products?stock=low` server-side filtering via FieldRef comparison; whitelist-validate `?stock=` (only `"low"` triggers filter, any other value/absent → unfiltered, no throw) | unit | `npx vitest run tests/products.test.ts` | ❌ W0 → created this task | ⬜ pending |
| 05-02-Task2 | 05-02 | 1 | DASH-02 | — | Low-stock banner ("Showing N low-stock products") + filtered-empty state on `products-client.tsx` | type-check + manual | `npx tsc --noEmit` + human-check (banner text matches row count, "View all products" clears filter, `?stock=bogus` renders unfiltered with no error) | N/A (UI-only) | ⬜ pending |
| 05-03-Task1 | 05-03 | 1 | DASH-03 | T-05-04 | `/purchase-orders?status=X` searchParams validated against `POStatus` enum; invalid values fall back to `"all"` (whitelist-validate, no throw) | unit | `npx vitest run tests/purchase-orders.test.ts` | ❌ W0 → extended existing | ⬜ pending |
| 05-03-Task2 | 05-03 | 1 | DASH-03 | — | `FilterTab` seeded from `initialFilter` prop so `?status=ORDERED` pre-selects the matching Tab on load | unit + manual | `npx vitest run tests/purchase-orders.test.ts` + human-check (`?status=ORDERED` pre-selects Tab; `?status=bogus` behaves identically to no param) | ❌ W0 → extended existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs reflect each plan's internal task numbering (`Task 0/1/2`) prefixed with the plan ID — updated post-planning per plan-checker review (05-VERIFICATION.md pass, warnings addressed).*

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
