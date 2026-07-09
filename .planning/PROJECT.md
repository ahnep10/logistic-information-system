# Logistics MIS

## What This Is

A web-based Management Information System for a B2B distribution company, covering procurement (supplier management, purchase orders), warehouse operations (inventory, stock transactions), and management reporting (real-time dashboards and KPI reports). It is designed for small-to-medium businesses and replaces fragmented manual processes with a unified, real-time source of truth accessible to warehouse staff, procurement staff, and operations managers.

## Core Value

Give managers a single real-time source of truth for inventory and procurement so they can make faster, data-driven decisions, reduce stock shortages, and improve operational efficiency.

## Requirements

### Validated

- ✓ Users can log in with role-based access (manager vs. staff) — Phase 01
- ✓ Manager/admin can create and manage supplier profiles — Phase 02
- ✓ Admin can manage product master data (name, SKU, category, reorder threshold) — Phase 02
- ✓ System automatically flags products below their reorder threshold — Phase 02 (Critical/Warning/OK severity tiers)
- ✓ System tracks current inventory levels per product — Phase 03 (atomic `$transaction` + DB-level `CHECK (currentStock >= 0)`)
- ✓ Staff can record stock-in and stock-out transactions with reasons — Phase 03 (`/stock` page, INVT-01/INVT-02)
- ✓ Full stock movement history is available per product — Phase 03 (`/inventory` page, filterable by product/date/type, INVT-05)
- ✓ Staff can create purchase orders with line items and submit them (Draft → Ordered) — Phase 04
- ✓ Staff can receive goods against a purchase order (Ordered → Received) and update inventory — Phase 04 (row-locked atomic goods-receipt transaction)
- ✓ PO status is visible across all lifecycle stages (Draft, Ordered, Received) — Phase 04 (three-state PO detail page)
- ✓ Manager sees a dashboard with real-time KPIs (products, suppliers, stock movements today, low-stock count) — Phase 05
- ✓ Low-stock count drills into the filtered inventory list — Phase 05 (DASH-02)
- ✓ Dashboard shows PO status summary (Draft/Ordered/Received counts) — Phase 05 (DASH-03)
- ✓ Manager can generate an inventory report (stock level + severity tier, all products) — Phase 06 (REPT-01)
- ✓ Manager can generate a stock movement report for a selected date range, grouped by product — Phase 06 (REPT-02)
- ✓ Manager can generate a purchase order report (status, supplier, total value) — Phase 06 (REPT-03)
- ✓ Manager can export any report as a downloadable .xlsx file — Phase 06 (REPT-04, `xlsx`/SheetJS)

### Active

Candidates for next milestone (unconfirmed — finalize scope via `/gsd-new-milestone`):

- [ ] Dashboard real-time auto-refresh (DASH-V2-01)
- [ ] KPI trend sparklines on dashboard cards (DASH-V2-02)
- [ ] PDF export for reports (REPT-V2-01)
- [ ] Per-product movement mini-history widget (REPT-V2-02)
- [ ] Auto-generated Draft PO on low stock (PROC-V2-01, requires approval-workflow design)

### Out of Scope

- Delivery/shipment tracking — excluded to keep MVP achievable within one academic semester
- Multi-warehouse support — deferred; single warehouse is sufficient for MVP scope
- ERP or external system integration — not required for SME MVP
- Customer-facing portal — this is an internal operations tool
- Invoicing and billing — out of scope; focus is on operational MIS, not finance

## Context

- Academic project with a one-semester timeline — scope is deliberately bounded
- Target users are SME distribution businesses replacing spreadsheets/paper-based processes
- Three user roles in practice: warehouse staff (transactions), procurement/admin (POs and suppliers), operations manager (dashboard and reports)
- v1.0 MVP shipped 2026-07-07: ~10.9k LOC TypeScript across 6 phases (Foundation/Auth, Catalog, Warehouse, Procurement, Dashboard, Reports); Next.js 15 + PostgreSQL 16 + Prisma 6 + Auth.js v5 + shadcn/ui (base-nova/base-ui) + Recharts + xlsx (SheetJS CDN build)
- 29/29 v1 requirements validated; zero open security threats at milestone close
- Known non-blocking tech debt carried into next milestone: no automated regression tests for INVT-03 negative-stock logic (03-REVIEW.md WR-07); `/inventory` unguarded against malformed date URL params (T-03-11); 5 pre-existing `@typescript-eslint/no-explicit-any` ESLint errors (documented `zodResolver(...) as any` convention); Base UI `Select` raw-value-on-initial-render bug only fixed on `po-form-client.tsx`'s supplierId field, not audited app-wide

## Constraints

- **Timeline**: One academic semester — scope must remain tight; delivery tracking and multi-warehouse explicitly deferred
- **Scale**: Single warehouse, SME-scale user base (small team, not enterprise volume)
- **Integration**: No external system integrations in MVP — standalone web app
- **Platform**: Web-based application only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Exclude delivery tracking from MVP | Keeps scope achievable within semester timeline | ✓ Good — held through v1.0, no scope pressure surfaced |
| Single warehouse for MVP | Reduces complexity; sufficient for SME target | ✓ Good — held through v1.0, no multi-warehouse need surfaced |
| No ERP integration | Simplifies architecture; not needed by SME target segment | ✓ Good — held through v1.0, standalone app shipped as planned |
| Manager-only mutations for catalog (categories, products, suppliers) | CONTEXT.md confirms Staff is read-only on master data; prevents accidental catalog corruption by non-privileged users | Applied in Phase 01–02; `requireManager()` in all three action files |
| Auth.js v5 two-file split: `auth.config.ts` (Edge-safe) + `lib/auth.ts` (Node.js only) | Next.js 15 middleware runs on Edge runtime — only `auth.config.ts` can be imported there | Applied Phase 01; pattern must be maintained across all phases |
| shadcn/ui v4 base-nova style (@base-ui/react) — render prop pattern, not `asChild` | `asChild` belongs to Radix UI (v3); base-ui v4 uses `render={<Component>}` on Dialog/AlertDialog trigger/close elements | Applied Phase 01–02; zero `asChild` usage confirmed |
| Client-side Tabs filter for suppliers | All suppliers fetched once server-side; `FilterTab` useState drives visible rows without page reload — simpler than server-side filtered routes | Applied Phase 02; reuse pattern for similar list filters |
| Stock mutations are atomic: `prisma.$transaction` + `SELECT ... FOR UPDATE` + DB-level `CHECK (currentStock >= 0)` | Two independent layers (app-level row lock + hard DB floor) prevent negative stock even under concurrent writes; DB constraint is the backstop if application logic is ever bypassed | Applied Phase 03; behaviorally verified by direct DB test in 03-VERIFICATION.md (raw SQL decrement below zero was rejected by Postgres) |
| URL-param-driven filters (not client-side array filtering) for `/inventory` history | Server Component rebuilds the Prisma `where` clause from `searchParams` on every navigation; keeps filter state shareable via URL and avoids fetching unfiltered data to the client | Applied Phase 03; reuse pattern for Phase 6 report filters |
| `zodResolver(schema) as any` cast in React Hook Form `useForm` calls | Resolves a `z.preprocess`/RHF resolver type mismatch on numeric fields; matches existing convention in `products-client.tsx` | Applied Phase 02–03; follow same cast when adding new numeric-coerced forms |
| Row-locked transaction (`SELECT ... FOR UPDATE` + validate + write, all inside one `prisma.$transaction`) for any Server Action whose write depends on a prior read | A plain status-filtered `updateMany`/`deleteMany` (CR-01) only protects actions that write the SAME column their guard checks; `confirmPurchaseOrder`'s status write didn't protect its D-08/D-16 validation (read on `lineItems`/`supplier`, write on `status`) from a concurrent edit — closed by moving read+validate+write into one locked transaction (Phase 04 UAT, discovered via a real-Postgres concurrency test) | Applied Phase 04; use this pattern for any future action combining a stale-read validation with a delayed write |
| Base UI `Select.Root` requires an `items` prop for `Select.Value` to show a label on initial render | Without `items`, `Select.Value` displays the raw `value` until the popup's `Select.Item` has mounted at least once — affects any edit-mode Select pre-populated with a real value, not just deactivated references | Applied to `po-form-client.tsx` supplierId Select (Phase 04); other pre-populated Selects app-wide (e.g. `products-client.tsx` categoryId) may have the same latent bug — worth an audit pass |
| `xlsx` (SheetJS) installed via CDN tarball (`xlsx@0.20.3`), not the npm registry build | npm registry build frozen at `0.18.5` since 2022 with 2 disclosed CVEs; CDN tarball patches both — approved via a blocking `checkpoint:human-verify` package-legitimacy gate | Applied Phase 06; use the same CDN-tarball pattern for any future SheetJS-family dependency |
| Sanitize every string cell before `XLSX.utils.json_to_sheet` (`lib/utils/xlsx-sanitize.ts`) | Free-text fields writable by lower-privileged roles (e.g. stock-transaction `notes`/`reason`) can carry CSV/Excel formula-injection payloads (CWE-1236) that execute when a manager opens the exported file — found via post-execution code review, not planned upfront | Applied Phase 06 to all 3 `/api/reports/*` export routes; apply `sanitizeRow`/`sanitizeCell` to any future spreadsheet export touching user-writable text |
| `/api/*` Route Handlers self-enforce auth via `requireManagerResponse()` as the first statement | `middleware.ts`'s matcher explicitly excludes `/api` — Route Handlers get zero protection from the page-level middleware guard | Applied Phase 06 to all 3 report export routes; required pattern for any new `/api/*` handler in this app |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-09 after v1.0 milestone completion*
