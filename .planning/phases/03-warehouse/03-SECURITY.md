---
phase: 03-warehouse
audited: 2026-07-02
asvs_level: 1
block_on: high
threats_total: 13
threats_closed: 12
threats_open: 0
threats_open_nonblocking: 1
status: SECURED
---

# Phase 03 (Warehouse) — Security Audit

Retroactive threat-mitigation verification against the threat models declared in `03-01-PLAN.md`, `03-02-PLAN.md`, and `03-03-PLAN.md`. Threats were pre-registered at plan time; this audit verifies each declared mitigation is actually present in the implemented code (grep/read-level evidence, per ASVS L1).

## Threat Verification

| Threat ID | Category | Component | Severity | Disposition | Status | Evidence |
|-----------|----------|-----------|----------|-------------|--------|----------|
| T-03-01 | Tampering | `actions/stock-transactions.ts` — missing auth check | high | mitigate | **CLOSED** | `actions/stock-transactions.ts:8-9` and `:57-58` — `const session = await auth(); if (!session?.user?.id) return { error: "Unauthorized" }` present verbatim in both `recordStockIn` and `recordStockOut`, no `requireManager()` call |
| T-03-02 | Tampering | negative stock via race condition | high | mitigate | **CLOSED** | App layer: `actions/stock-transactions.ts:75-85` — `SELECT "currentStock" ... FOR UPDATE` inside `prisma.$transaction`, throws `Insufficient stock...` before decrement. DB backstop: `prisma/migrations/20260701150104_add_stock_transactions/migration.sql:25` — `ALTER TABLE "products" ADD CONSTRAINT "products_current_stock_non_negative" CHECK ("currentStock" >= 0);` |
| T-03-03 | Tampering | mass assignment via FormData | medium | mitigate | **CLOSED** | `actions/stock-transactions.ts:11-16, 60-65` — both actions build a Zod input object explicitly from named `formData.get(...)` calls and run `stockInSchema.safeParse` / `stockOutSchema.safeParse` (`lib/validations/stock-transaction.ts:8-20`); non-schema fields are never read from `formData` |
| T-03-04 | Tampering | migration.sql CHECK constraint SQL injection | low | accept | **CLOSED** | Accepted risk logged below — migration SQL is static, authored by the executor, not derived from user input; confirmed by reading `migration.sql` (no interpolation of external values) |
| T-03-05 | Tampering | `RecordStockOutDialog` — productId IDOR | high | mitigate | **CLOSED** | `actions/stock-transactions.ts:75-78` (stock-out) and `:24-27` (stock-in) — `SELECT ... FOR UPDATE` inside the transaction; `if (rows.length === 0) throw new Error("Product not found.")` rolls back before any write |
| T-03-06 | Tampering | quantity as string bypasses int check | medium | mitigate | **CLOSED** | `lib/validations/stock-transaction.ts:3-6` — `z.preprocess((v) => ... Number(v), z.number().int().min(1, ...))`; non-numeric strings coerce to `NaN` which fails `z.number()` |
| T-03-07 | Tampering | products dropdown shows deactivated products | medium | mitigate | **CLOSED** | `app/(protected)/stock/page.tsx:14-18` — `prisma.product.findMany({ where: { isActive: true }, ... })` feeds the dropdown in `stock-client.tsx` |
| T-03-08 | Info Disclosure | Recent Transactions shows all users' transactions | low | accept | **CLOSED** | Accepted risk logged below — shared visibility is the intended design per D-12 (all authenticated staff/managers see the same operational data) |
| T-03-09 | Info Disclosure | `/inventory` visible without auth | high | mitigate | **CLOSED** | `middleware.ts:17-21` — `if (!session) { ... return NextResponse.redirect(new URL("/login", nextUrl)) }`; matcher (`config.matcher`) covers all paths except `api`/`_next`/`favicon.ico`, and `/inventory` is under `(protected)` route group with no opt-out |
| T-03-10 | Tampering | URL param `productId` filter injection | medium | mitigate | **CLOSED** | `app/(protected)/inventory/page.tsx:22-24` — `where.productId = params.productId` passed as a Prisma parameterized query value (never interpolated into raw SQL); non-existent IDs simply return an empty result set |
| T-03-11 | Tampering/Availability | URL param `from`/`to` malformed date string | medium | mitigate | **OPEN — non-blocking (below `block_on: high`)** | See "T-03-11 Independent Verification" below — claimed mitigation ("Server Component catches and renders empty state") is **not present** in the code |
| T-03-12 | Info Disclosure | History table shows all users' records | low | accept | **CLOSED** | Accepted risk logged below — same rationale as T-03-08, shared visibility per D-12 |
| T-03-SC | Tampering | npm/pip/cargo installs | low | accept | **CLOSED** | `git diff 7e76de6..HEAD -- package.json package-lock.json` produced no output — confirmed zero dependency changes across all of Phase 3 |

**Closed: 12/13 | Open (non-blocking): 1/13 | Open (blocking): 0/13**

## T-03-11 Independent Verification (orchestrator-flagged)

The plan's claimed mitigation text reads: *"`new Date("invalid")` produces Invalid Date; Prisma rejects the query and throws; Server Component catches and renders empty state."*

Direct read of `app/(protected)/inventory/page.tsx:31-43`:

```ts
if (params.from || params.to) {
  where.createdAt = {}
  if (params.from) {
    where.createdAt.gte = new Date(`${params.from}T00:00:00.000Z`)
  }
  if (params.to) {
    where.createdAt.lte = new Date(`${params.to}T23:59:59.999Z`)
  }
} else { ... }

const [transactions, products] = await Promise.all([
  prisma.stockTransaction.findMany({ where, ... }),
  ...
])
```

Findings:
- No format validation on `params.from` / `params.to` before constructing the `Date`.
- No `try`/`catch` around the `Date` construction or the `Promise.all([prisma.stockTransaction.findMany(...), ...])` call.
- `Glob` search confirmed **no `error.tsx`, `global-error.tsx`, or any error boundary exists anywhere under `app/`** — not in `app/(protected)/inventory/`, not at any parent segment, not at the root.
- A malformed value such as `?from=abc` produces `new Date("abcT00:00:00.000Z")` → `Invalid Date`. When Prisma serializes this value for the query engine it throws (Invalid Date → `toISOString()`/serialization failure), and that throw is unhandled — it propagates out of the Server Component render with no catch and no segment-level error boundary to intercept it.

**Conclusion: the flag is confirmed correct — the claimed mitigation does not exist.** This is not "Prisma rejects the query and the Server Component catches and renders empty state" as documented; it is an unhandled exception that crashes the page render (matches code review finding `03-REVIEW.md` WR-02 exactly, including file and line references).

**Disposition per severity-aware gate:** T-03-11 is registered `medium` severity. `block_on: high` per this audit's `<config>`. Per the auditor's severity-aware `threats_open` computation, an OPEN threat below the block threshold is recorded as open-non-blocking and does **not** count toward `threats_open`. It does not block shipping this phase, but it is a real, verified gap and should be fixed before /inventory is exposed to untrusted query-string tampering (e.g., a crafted bookmark or shared link with a bad `from`/`to` value will 500 the page for any user, not just the one who crafted the URL).

**Recommended remediation (not applied — implementation files are read-only for this audit):**
```ts
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
if (params.from && DATE_RE.test(params.from)) {
  where.createdAt = { ...where.createdAt, gte: new Date(`${params.from}T00:00:00.000Z`) }
}
if (params.to && DATE_RE.test(params.to)) {
  where.createdAt = { ...where.createdAt, lte: new Date(`${params.to}T23:59:59.999Z`) }
}
```
Malformed values are silently ignored rather than crashing the page (fail open to "no date filter" rather than fail with a 500).

## Accepted Risks Log

| Threat ID | Rationale | Accepted By |
|-----------|-----------|-------------|
| T-03-04 | Migration SQL is static and authored by the plan executor, not derived from any user-controlled input; verified by direct read of `migration.sql` — no string interpolation of external values | Plan-time (03-01-PLAN.md), confirmed by this audit |
| T-03-08 | All authenticated users (Staff and Manager) may view all stock transactions by design — shared operational visibility is the product's stated core value ("unified, real-time source of truth"); this is D-12, not an oversight | Plan-time (03-02-PLAN.md), confirmed by this audit |
| T-03-12 | Same rationale as T-03-08, applied to the `/inventory` history table | Plan-time (03-03-PLAN.md), confirmed by this audit |
| T-03-SC | No new package installs occurred during Phase 3 (schema/migration + two UI vertical slices used only pre-existing dependencies) — confirmed via `git diff` on `package.json`/`package-lock.json` across the full phase commit range | Plan-time (all 3 plans), confirmed by this audit |

## Unregistered Flags

None. Cross-referenced `03-REVIEW.md` (code review, separate quality gate) against the threat register: `03-REVIEW.md` findings WR-01, WR-03, WR-04, WR-05, WR-06, WR-07, WR-08 and IN-01 through IN-06 are code-quality / robustness / drift-risk issues (missing pagination indicator, dialog state not reset on close, CHECK constraint undocumented in `schema.prisma`, no floor on `quantity`, mislabeled test stubs, duplicated helpers, hardcoded enum values, no `max` on quantity input) — none of these describe a new *trust-boundary-crossing* attack surface beyond what's already covered by T-03-01 through T-03-12. WR-02 specifically **is** already covered by the registered T-03-11 and is the exact same gap independently confirmed above.

## Summary

12 of 13 registered threats verified CLOSED with direct code evidence (file + line). 1 threat (T-03-11) confirmed OPEN — the documented mitigation is not implemented — but its registered severity (medium) is below this audit's `block_on: high` threshold, so it does not block shipping. No new/unregistered attack surface found. No blocking threats. Phase 03 is **SECURED** for shipping purposes; T-03-11 should be tracked and fixed in a follow-up (implementation files were not modified by this audit per the read-only constraint).
