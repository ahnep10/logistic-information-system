# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-07-07
**Phases:** 6 | **Plans:** 23 | **Tasks:** 34

### What Was Built
- Role-based auth (Auth.js v5) with RBAC enforced server-side on every protected route
- Product/category/supplier catalog management with soft-deactivation
- Atomic warehouse inventory tracking (row-locked transactions + DB-level non-negative-stock constraint)
- Full Draft → Ordered → Received purchase-order lifecycle with atomic goods-receipt
- Real-time manager dashboard (KPI tiles, PO-status chart, low-stock drill-down)
- Exportable Excel reports (inventory, movements, purchase orders) with sanitized cell output

### What Worked
- Row-locked transaction pattern (`SELECT ... FOR UPDATE` + validate + write, all inside one `prisma.$transaction`) proved reliable under real-Postgres concurrency tests and was reused consistently once established (Phase 3 stock, Phase 4 PO confirm/receive)
- Establishing shared conventions early (severity badge util, URL-param-driven filters, `requireManager()` gate, `zodResolver(...) as any` cast) and reusing them verbatim across phases kept later phases fast (Phase 6 Reports reused Phase 3/5 query-shape and badge conventions with almost no new decisions)
- Code review + security audit gates caught real, non-obvious issues before shipping rather than in production: CR-01 formula-injection in xlsx exports, a TOCTOU race in `confirmPurchaseOrder`, and a Prisma over-fetch bug (WR-01)

### What Was Inefficient
- Several bugs were only found reactively during UAT/code review instead of being designed away upfront: the `confirmPurchaseOrder` concurrency race, and the Base UI `Select` raw-value-on-initial-render bug (fixed only on `po-form-client.tsx`'s supplierId field — not audited across other pre-populated Selects app-wide, still open tech debt)
- One dependency (`xlsx`) required an unplanned mid-phase detour: npm registry build was frozen with 2 disclosed CVEs, requiring a CDN-tarball install and a human package-legitimacy checkpoint that wasn't anticipated in initial research
- Some test coverage was deferred rather than written: `tests/warehouse.test.ts` has `it.todo` stubs for INVT-03's negative-stock logic with zero automated regression protection, despite the behavior being verified manually

### Patterns Established
- Row-locked transaction pattern for any Server Action whose write depends on a prior read (not just same-column guards — `updateMany`/`deleteMany` status filters only protect the column they check)
- `lib/utils/xlsx-sanitize.ts` — sanitize every string cell before `XLSX.utils.json_to_sheet` for any future spreadsheet export touching user-writable text
- `requireManagerResponse()` as the canonical auth gate for `/api/*` Route Handlers, since `middleware.ts`'s matcher excludes `/api/*` entirely

### Key Lessons
1. When a Server Action reads data to validate a business rule and then writes a *different* column later, wrap read+validate+write in one row-locked transaction — a status-filtered `updateMany` alone does not close the race if the guard column and the write column differ.
2. When a UI library quirk is discovered (e.g., Base UI `Select.Value` needing an `items` prop to render a label on initial mount), audit *all* existing usages of that pattern immediately rather than fixing only the instance that surfaced it — this app still has at least one known unaudited instance (`products-client.tsx` categoryId Select).
3. Verify third-party package legitimacy (npm registry freshness, disclosed CVEs) during phase research, before implementation — the `xlsx` CDN-tarball detour could have been resolved at planning time instead of mid-execution.

### Cost Observations
- Sessions: not tracked at per-session granularity this milestone
- Notable: heavy reuse of established conventions (badge utils, filter patterns, auth gates) kept later phases (5-6) shipping in fewer plans (3 and 2 respectively) than earlier phases despite comparable requirement counts

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | — | 6 | Established row-locked transaction pattern and Manager-only catalog mutation convention from Phase 1 |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | Vitest suite (unit + concurrency) | Partial — INVT-03 negative-stock path untested | recharts, xlsx (CDN tarball) |

### Top Lessons (Verified Across Milestones)

1. Row-locked transactions (read+validate+write in one `prisma.$transaction`) are required whenever a guard column and a write column differ — verified via real-Postgres concurrency testing in v1.0.
