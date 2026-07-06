# Phase 6: Reports - Research

**Researched:** 2026-07-07
**Domain:** Excel export streaming (SheetJS/xlsx) + read-only reporting Server Components in a Next.js 15 App Router / Prisma 6 codebase
**Confidence:** MEDIUM (HIGH on codebase-reuse findings, MEDIUM on xlsx/Route Handler findings — no Context7/official-docs MCP tool was available this session; all external claims are WebSearch/WebFetch-sourced against SheetJS's own docs and GitHub advisories, not independently cross-tool-verified)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single `/reports` page (replaces the existing stub at `app/(protected)/reports/page.tsx`) with a Tabs selector for the three report types (Inventory / Movements / Purchase Orders) — reuses the Tabs pattern already established in `/purchase-orders` and the Phase 5 dashboard drill-down.
- **D-02:** Active tab is driven by a `?type=` searchParam (values: `inventory` | `movements` | `purchase-orders`), server-validated with the same whitelist-then-fallback pattern from Phase 5 (`?stock=`, `?status=`) — any other/absent value defaults to `inventory`, never throws.
- **D-03:** Only the active tab's report query runs per page load (Server Component reads `?type=` and only queries that one report) — not all 3 in parallel. Switching tabs is a full navigation (server round-trip), consistent with how `?status=` drill-down works today.
- **D-04:** Export reflects exactly what's currently filtered/visible on screen — the export route re-derives its query from the same searchParams the report page used (e.g., movement report exported with `?from=&to=` applied exports only that date range).
- **D-05:** One Route Handler per report type: `/api/reports/inventory`, `/api/reports/movements`, `/api/reports/purchase-orders`. Each re-runs that report's Prisma query (same shape as its page) and streams an `.xlsx` workbook via the `xlsx` (SheetJS) package, matching the stack doc's exact `/api/reports/*.xlsx`-style pattern.
- **D-06:** Export is triggered by a plain `<a href={...} download>` link on each report view — no client-side fetch/blob handling, no loading-spinner state. The href includes the report's current searchParams so the download matches D-04.
- **D-07:** Default date range (no `?from=`/`?to=` given) is the last 30 days — matches the existing `/inventory` page's `thirtyDaysAgo` fallback, keeping the convention consistent app-wide.
- **D-08:** `?from=`/`?to=` are validated; an unparseable date silently falls back to the default 30-day range rather than throwing. This closes the gap tracked as **T-03-11** in `.planning/phases/03-warehouse/03-SECURITY.md` (the existing `/inventory` page's unguarded `new Date("invalid")` 500) — same never-throw whitelist/fallback discipline Phase 5 established for `?stock=`/`?status=`. Fixing the pre-existing `/inventory` occurrence of T-03-11 itself is optional follow-up, not required by this phase's success criteria, but worth doing opportunistically if it's a small diff once this pattern exists.
- **D-09:** Transactions are grouped visually into product-header sections (one section per product, transactions listed underneath) — not a flat table sorted by product column.
- **D-10:** All three PO statuses (Draft, Ordered, Received) are included — matches the success criteria's literal wording ("all purchase orders with their status").
- **D-11:** No filter UI on this report — a flat, unfiltered list of every PO. A manager wanting a specific status can already use the existing `/purchase-orders` Tabs page for that; this report stays simple by design.

### Claude's Discretion

- Exact column sets for each report table (beyond what's named in the success criteria) — e.g., whether the inventory report includes SKU/category/supplier columns beyond stock level + severity tier, and how "total order value" is computed for the PO report (reuse whatever existing total-computation exists in the PO detail/form code rather than reinventing it).
- Exact `.xlsx` file naming convention (e.g., `inventory-report-2026-07-07.xlsx`).
- Whether the inventory report includes inactive/deactivated products or only active ones (research/planning should check existing `/products` and dashboard conventions for precedent).

### Deferred Ideas (OUT OF SCOPE)

None raised during this discussion — the two known v2 deferrals (REPT-V2-01 PDF export, REPT-V2-02 per-product mini-history widget) were already deferred at roadmap time, not raised fresh here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| REPT-01 | Manager can generate an inventory report showing current stock level and severity tier for all products | `Product` query shape below; `getSeverityBadge()` reuse confirmed in `lib/utils/severity.ts` |
| REPT-02 | Manager can generate a stock movement report showing all transactions over a selected date range, grouped by product | `StockTransaction` query shape below, adapted from `app/(protected)/inventory/page.tsx` with the T-03-11 date-guard fix (D-08) |
| REPT-03 | Manager can generate a purchase order report showing all POs with status, supplier, and total order value | `PurchaseOrder` query shape below; `totalAmount` is a **pre-computed stored column** — reuse directly, do not recompute from line items |
| REPT-04 | Manager can export any report as an Excel (.xlsx) file for offline sharing and further analysis | xlsx package version/CVE findings + Next.js 15 Route Handler streaming pattern below — highest-uncertainty item, see Package Legitimacy Audit and Pitfall 1 |
</phase_requirements>

## Summary

This phase adds three read-only reports and their `.xlsx` exports to a codebase that already has every underlying data shape it needs — `Product`, `StockTransaction`, and `PurchaseOrder` are all queried elsewhere in near-identical shapes (`/products`, `/inventory`, `/purchase-orders`). The genuinely new surface area is narrow: (1) a `?type=` Tabs selector following the exact D-02 whitelist pattern already used for `?stock=` and `?status=`, (2) the movement report's date-range validation, which must **fix** rather than copy the existing unguarded `new Date(params.from)` bug tracked as T-03-11, and (3) the `.xlsx` export itself, which is this codebase's first-ever binary-streaming Route Handler and first-ever new production dependency since Phase 5's `recharts` install.

The most important finding this session: **the `xlsx` package on the public npm registry is stuck at 0.18.5, last published 2022-03-24, and is no longer updated by its maintainer (SheetJS)** — SheetJS moved distribution of all newer, CVE-patched builds to their own CDN (`cdn.sheetjs.com`) years ago. npm's 0.18.5 carries two publicly tracked CVEs (prototype pollution, ReDoS). The prototype-pollution one is explicitly scoped by its own advisory to *file-reading* workflows — this phase never reads/parses `.xlsx` files, only writes them, so that CVE does not apply to this phase's actual usage. The ReDoS CVE's trigger path is undocumented, so residual risk can't be fully ruled out for the write path either. This needs a `checkpoint:human-verify` gate (matching the T-05-SC/recharts precedent from Phase 5) with two options presented to the human: install the frozen npm 0.18.5 build (simpler, matches CLAUDE.md's stated version, small residual ReDoS-uncertainty) or install the patched 0.20.3 build directly from SheetJS's CDN tarball (safer, but introduces a non-npm-registry install source that could complicate `npm ci` in CI/deploy if the CDN URL structure changes SheetJS-side).

**Primary recommendation:** Reuse existing Prisma query shapes and UI patterns verbatim (Tabs, whitelist-then-fallback searchParams, `getSeverityBadge`, `totalAmount` as a stored column) for the three report pages; for REPT-04, install `xlsx` behind a human-verify checkpoint with the CDN-tarball path as the primary recommendation and npm 0.18.5 as an accepted fallback, and build each `/api/reports/*` Route Handler as a thin wrapper that re-runs the page's own query, converts Prisma `Decimal`/`Date` values to plain JS values, and returns `new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="..."' } })` — not the legacy `application/vnd.ms-excel` MIME type several blog examples use.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Report type selection (`?type=`) | Frontend Server (SSR) | Browser/Client | Server Component reads/validates the searchParam (D-02); the Tabs UI itself is a thin client component that only calls `router.push`/renders links, matching the existing `/purchase-orders` split |
| Report data queries (inventory/movements/PO) | API/Backend (Prisma via Server Component) | Database | Each report is a direct Prisma query inside the Server Component — no separate REST/GraphQL layer exists or is needed in this architecture (Next.js Server Components ARE the "backend" tier here) |
| Severity tier computation | API/Backend (pure function) | — | `getSeverityBadge()` is a pure JS function computed per-row after fetch — no DB-level computed column exists or is needed |
| PO total value | Database (stored column) | — | `PurchaseOrder.totalAmount` is a `Decimal` column written once at PO creation/edit time (`computeTotalAmount()` in `actions/purchase-orders.ts`) — reports must read this column, never recompute it from line items, to guarantee consistency with what `/purchase-orders` already displays |
| Excel workbook construction | API/Backend (Route Handler) | — | `xlsx` (SheetJS) runs entirely server-side inside the Route Handler process; no client-side Excel generation |
| File download delivery | CDN/Static (Response streaming) | Browser/Client | The Route Handler returns a `Response` with binary body + `Content-Disposition: attachment`; the browser's native download mechanism handles the rest — no client JS blob/fetch handling per D-06 |
| Auth/authorization for `/api/reports/*` | API/Backend (Route Handler) | — | **Critical gap found this session:** `middleware.ts`'s matcher explicitly excludes `/api/*` (`"/((?!api|_next/static|_next/image|favicon.ico).*)"`), so the existing global auth guard does **not** protect new `/api/reports/*` routes. Each Route Handler must call `auth()` itself — see Pitfall 2. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `xlsx` (SheetJS Community Edition) | `0.18.5` (npm registry, frozen) **or** `0.20.3` (SheetJS CDN tarball — recommended) | Build an in-memory `.xlsx` workbook from row objects and serialize to a `Buffer` | Already the stack decision in `.claude/CLAUDE.md`'s Report Export section; ~10.7M weekly downloads confirms wide real-world use `[VERIFIED: npm registry — package-legitimacy check verdict OK]`. **However**, the npm-registry build is stale — see Package Legitimacy Audit below before installing. |

### Supporting

No new supporting libraries needed. This phase reuses 100% of the existing stack (Next.js 15 Route Handlers, Prisma 6, shadcn/ui Tabs/Table/Card, no new form library needed since there are no mutations in this phase).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `xlsx` (SheetJS) | `exceljs` | Actively maintained on the npm registry itself (no CDN-tarball workaround needed), but CLAUDE.md already locked `xlsx` as the stack decision and this phase's usage (flat rows -> single sheet, no styling/formulas) doesn't need any capability `exceljs` uniquely offers. Switching stacks mid-project for a already-decided dependency is out of scope for this research; flagged as an option only if the human-verify checkpoint rejects both `xlsx` install paths. `[ASSUMED]` |
| npm registry `xlsx@0.18.5` | SheetJS CDN tarball `xlsx@0.20.3` | CDN install gets both CVE fixes (prototype pollution + ReDoS) but is a non-standard install source (`npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) that could break `npm ci`/lockfile reproducibility if SheetJS ever restructures their CDN paths. `[CITED: docs.sheetjs.com]` |

**Installation:**
```bash
# Option A (recommended) — CDN tarball, gets both CVE fixes:
npm rm --save xlsx 2>/dev/null
npm install --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

# Option B (fallback) — npm registry, frozen at 0.18.5, export-only usage
# sidesteps the prototype-pollution CVE (read-only trigger) but leaves the
# undocumented-trigger ReDoS CVE as an accepted, unverified residual risk:
npm install xlsx@0.18.5
```

**Version verification:** `npm view xlsx version` → `0.18.5` (confirmed live this session; `npm view xlsx time` shows this version was published `2022-03-24T14:23:09.623Z` — the registry's `modified` timestamp of `2024-10-22` is a metadata-only touch, not a new release). `npm view xlsx scripts.postinstall` → empty (no postinstall script). SheetJS's own install docs confirm current CDN version `0.20.3` and the exact tarball URL syntax `[CITED: docs.sheetjs.com/docs/getting-started/installation/nodejs]`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| `xlsx` | npm | 0.18.5 published 2022-03-24 (~4.3 yrs); package itself first published 2013 | 10.7M/wk | `github.com/SheetJS/sheetjs` (also self-hosted at `git.sheetjs.com`) | `[OK]` per automated `package-legitimacy check` (not slopsquatted, real maintainer, real downloads) — **but flagged `[SUS: stale/CVE]` by this research beyond the automated check's scope** | Approved for install, gated behind `checkpoint:human-verify` — see below |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `xlsx` — not for slopsquatting reasons (verdict `OK`, real package, real maintainer), but because the npm-registry build is frozen at a version with two publicly disclosed CVEs that the maintainer has chosen to fix only in a CDN-distributed build outside npm. The planner **must** add a `checkpoint:human-verify` task before `npm install xlsx`, presenting both install options (CDN tarball vs. frozen npm build) and the CVE-scope reasoning above, mirroring the `05-01-PLAN.md` Task 0 precedent for `recharts` (`T-05-SC`).

**CVE detail (`[CITED: github.com/advisories]`, cross-referenced against GitLab Advisory DB and Vulert — not independently reproduced/tested this session):**
- `GHSA-4r6h-8v6p-xvw6` / CVE-2023-30533 — Prototype Pollution. Affects versions ≤ 0.19.2. Advisory text: *"Workflows that do not read arbitrary files (for example, exporting data to spreadsheet files) are unaffected."* This phase's Route Handlers only call `XLSX.utils.json_to_sheet()` + `XLSX.write()` (write path) — **never** `XLSX.read()`/`XLSX.readFile()` — so per the advisory's own scoping, this CVE does not apply to this phase's actual usage pattern, regardless of which xlsx build is installed.
- `GHSA-5pgg-2g8v-p4x9` / CVE-2024-22363 — ReDoS (CWE-1333, CVSS 7.5). Affects versions < 0.20.2. **Trigger path is not documented in the public advisory** — could not confirm whether it's read-only or also reachable from the write/format path. Treat as unresolved residual risk if installing the frozen npm 0.18.5 build; the CDN 0.20.3 build has this fixed regardless of trigger path.

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  ├─ GET /reports?type=inventory|movements|purchase-orders&from=&to=
  │     │
  │     ▼
  │  reports/page.tsx (Server Component)
  │     │ 1. await searchParams
  │     │ 2. whitelist-validate ?type= → default "inventory" (D-02)
  │     │ 3. if type==="movements": whitelist-validate ?from=/?to= → default 30-day range (D-08, fixes T-03-11)
  │     │ 4. run ONLY the active tab's Prisma query (D-03)
  │     ▼
  │  PostgreSQL (via Prisma) — Product | StockTransaction | PurchaseOrder
  │     │
  │     ▼
  │  reports-client.tsx ("use client")
  │     │ - Tabs (seeded from validated `type` prop, same shape as purchase-orders-client.tsx)
  │     │ - renders report table for the active type
  │     │ - <a href={`/api/reports/${type}?${searchParamsString}`} download> (D-06)
  │
  └─ GET /api/reports/{inventory|movements|purchase-orders}?from=&to=  (plain <a> navigation, not fetch)
        │
        ▼
     Route Handler (app/api/reports/{type}/route.ts)
        │ 1. auth() check — NOT covered by middleware.ts matcher, must be explicit (Pitfall 2)
        │ 2. re-derive the SAME whitelist-validated query params as the page (D-04) — do not trust a shared cache
        │ 3. re-run the identical Prisma query
        │ 4. serialize Decimal → number, Date → string (xlsx cannot serialize Prisma types directly)
        │ 5. XLSX.utils.book_new() → json_to_sheet(rows) → book_append_sheet() → XLSX.write(wb, {type:"buffer", bookType:"xlsx"})
        ▼
     new Response(buffer, { headers: {
         "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
         "Content-Disposition": 'attachment; filename="inventory-report-2026-07-07.xlsx"'
     }})
        │
        ▼
     Browser native file download (no client JS blob handling)
```

### Recommended Project Structure
```
app/(protected)/reports/
├── page.tsx                    # Server Component: searchParams validation + single active-tab Prisma query
└── reports-client.tsx          # "use client": Tabs + report table rendering + export <a> links

app/api/reports/
├── inventory/route.ts          # GET handler: re-run inventory query, stream .xlsx
├── movements/route.ts          # GET handler: re-run movement query (date-range), stream .xlsx
└── purchase-orders/route.ts    # GET handler: re-run PO query, stream .xlsx

lib/utils/
├── severity.ts                 # REUSE — getSeverityBadge (existing)
├── po-status.ts                # REUSE — getStatusBadge (existing)
└── reports.ts                  # NEW (optional) — shared helpers: filename builder, Decimal/Date serializers if duplicated 3x across route handlers
```

### Pattern 1: Whitelist-then-fallback searchParams validation (reused, not new)
**What:** Validate an untrusted `?param=` string against an exact allowed set; any non-match (wrong case, unrelated value, or absence) falls through to a safe default — never throw.
**When to use:** `?type=` (D-02) and `?from=`/`?to=` (D-08).
**Example:**
```typescript
// Source: app/(protected)/products/page.tsx (existing, established convention)
const VALID_TYPES = ["inventory", "movements", "purchase-orders"] as const
type ReportType = (typeof VALID_TYPES)[number]

const isValidType = (VALID_TYPES as readonly string[]).includes(params.type ?? "")
const activeType: ReportType = isValidType ? (params.type as ReportType) : "inventory"
```

### Pattern 2: Date-range validation that actually guards against Invalid Date (NEW — fixes T-03-11)
**What:** Regex-validate the date string shape BEFORE constructing a `Date`, falling back to the 30-day default on any mismatch — this is what `/inventory` was supposed to do but doesn't (03-SECURITY.md's independent verification confirmed the claimed mitigation is absent in code).
**When to use:** Movement report's `?from=`/`?to=` (D-07, D-08).
**Example:**
```typescript
// Source: 03-SECURITY.md "Recommended remediation" (previously documented but never applied)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function resolveDateRange(from?: string, to?: string) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const gte = from && DATE_RE.test(from) ? new Date(`${from}T00:00:00.000Z`) : thirtyDaysAgo
  const lte = to && DATE_RE.test(to) ? new Date(`${to}T23:59:59.999Z`) : new Date()

  return { gte, lte }
}
```
Malformed values are silently ignored (fail open to the 30-day default), never a 500.

### Pattern 3: Route Handler re-derives its own query (does not trust the page's query result)
**What:** The export Route Handler is a sibling to the report page, not a consumer of its rendered output — it re-parses `request.nextUrl.searchParams` independently and re-runs the identical Prisma query, guaranteeing D-04 ("export reflects exactly what's filtered/visible") without any shared state or caching layer.
**When to use:** All three `/api/reports/*` handlers.
**Example:**
```typescript
// Source: pattern synthesized from davegray.codes Next.js xlsx Route Handler example + this codebase's existing page.tsx convention
// app/api/reports/movements/route.ts
import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== "MANAGER") {
    return new Response("Unauthorized", { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const { gte, lte } = resolveDateRange(
    searchParams.get("from") ?? undefined,
    searchParams.get("to") ?? undefined
  )

  const transactions = await prisma.stockTransaction.findMany({
    where: { createdAt: { gte, lte } },
    orderBy: [{ product: { name: "asc" } }, { createdAt: "desc" }],
    include: { product: { select: { name: true, sku: true } }, createdBy: { select: { name: true } } },
  })

  const rows = transactions.map((t) => ({
    Product: t.product.name,
    SKU: t.product.sku,
    Type: t.type,
    Quantity: t.quantity,
    Reason: t.reason,
    Date: t.createdAt.toISOString().slice(0, 10),
    "Recorded By": t.createdBy.name,
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, "Movements")
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="movements-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
```

### Anti-Patterns to Avoid
- **Recomputing PO total from line items in the report:** `PurchaseOrder.totalAmount` is already a stored `Decimal` column, written by `computeTotalAmount()` in `actions/purchase-orders.ts` at create/edit time. Re-deriving it from `lineItems.quantity * unitPrice` in the report risks silent drift from what `/purchase-orders` displays (e.g., if a future edit path ever changes the computation formula, the report would show a different number than the PO detail page for the same PO). Read the stored column.
- **Passing Prisma `Decimal`/`Date` objects directly into `XLSX.utils.json_to_sheet`:** `json_to_sheet` expects plain JS primitives. `Decimal` objects will serialize as `[object Object]` or throw depending on xlsx internals; convert with `.toNumber()` (matching the existing `purchase-orders/page.tsx` convention) before mapping to row objects.
- **Trusting the page's rendered data in the export route:** Because D-04 requires exact parity between what's on screen and what's exported, and because there's no shared cache/session state between a page request and a later `<a href>` navigation, the Route Handler must independently re-validate and re-query — never assume "the user already saw this data so we can skip validation."
- **Using `application/vnd.ms-excel` as the Content-Type:** Several tutorial blog posts (including the one found this session) use the legacy `.xls` MIME type for `.xlsx` output. It works in most browsers by coincidence but is spec-incorrect; use `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` per the OOXML spec, matching the additional-context instructions for this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Excel file binary format (ZIP + XML internals) | A custom `.xlsx` writer | `xlsx` (SheetJS) `json_to_sheet` + `write` | OOXML is a genuinely complex binary format (ZIP container of multiple XML parts with strict schema); SheetJS already handles all of this correctly |
| Severity tier logic | A new report-specific severity calculation | `lib/utils/severity.ts`'s `getSeverityBadge()` | Already the single source of truth for Critical/Warning/OK across `/products` and `/inventory`; a second implementation risks drift (e.g., a future threshold-boundary tweak only applied in one place) |
| PO total value computation | A report-specific `SUM(quantity * unitPrice)` | `PurchaseOrder.totalAmount` stored column | Already computed once, atomically, at PO create/edit time via `computeTotalAmount()`; re-deriving in a report query risks a second source of truth for the same number |

**Key insight:** This phase has almost no genuinely novel business logic — nearly everything needed already exists in the codebase in a form one report query away. The only real new engineering surface is the binary file streaming, which is exactly why `xlsx`/Route-Handler research was the highest-priority item this session, per the phase's own framing.

## Runtime State Inventory

Not applicable — this is a purely additive phase (new page, new Route Handlers, one new dependency). No renames, refactors, or migrations of existing runtime state are involved.

## Common Pitfalls

### Pitfall 1: Installing `xlsx` from npm without acknowledging the frozen/CVE status
**What goes wrong:** `npm install xlsx` silently installs `0.18.5` (the only version ever published to the npm registry, dated 2022-03-24), which npm itself may flag with an audit warning for two known CVEs, surprising whoever runs `npm audit` later in the semester.
**Why it happens:** SheetJS stopped publishing to npm years ago in favor of their own CDN, but didn't deprecate the npm package entry, so `npm install xlsx@latest` looks completely normal.
**How to avoid:** Gate the install behind an explicit `checkpoint:human-verify` task (mirroring `05-01-PLAN.md` Task 0's `recharts` precedent) that documents both install paths (CDN tarball vs. frozen npm build) and the CVE-scope reasoning (prototype-pollution is read-path-only and doesn't apply here; ReDoS trigger is undocumented and is an accepted residual risk if the npm path is chosen).
**Warning signs:** `npm audit` reporting vulnerabilities in `xlsx` after install; this is expected and already understood, not a new problem to solve mid-execution.

### Pitfall 2: Assuming `/api/reports/*` is protected by the existing global auth middleware
**What goes wrong:** `middleware.ts`'s `config.matcher` is `["/((?!api|_next/static|_next/image|favicon.ico).*)"]` — it explicitly **excludes** every path under `/api/`. Every other manager-only surface in this codebase (`/dashboard`, `/reports` page itself, `/users`) is protected because middleware runs on all non-`/api` routes and checks `MANAGER_ROUTES`. A new `/api/reports/*` Route Handler gets **none** of that protection automatically.
**Why it happens:** The only existing Route Handler (`app/api/auth/[...nextauth]/route.ts`) is NextAuth's own handler, which doesn't need the app's manager-role check (login must be reachable without a session). This phase's Route Handlers are a fundamentally different case — they must self-enforce auth — but there's no prior example that shows it because nothing has needed it before this phase.
**How to avoid:** Every `/api/reports/*` Route Handler must independently call `const session = await auth()` and check `session?.user?.role === "MANAGER"` (matching `MANAGER_ROUTES` from `middleware.ts` including `/reports`), returning `403`/`401` if not, before running any query. This is a new pattern in this codebase, distinct from the Server Action `requireManager()` helper (which returns `{ error: string }`, not an HTTP response) — write a Route-Handler-appropriate variant, or a small shared helper if reused 3x.
**Warning signs:** A logged-out user or STAFF-role user hitting `/api/reports/inventory` directly (e.g., via a bookmarked/shared link) and successfully downloading a manager-only report.

### Pitfall 3: Copying `/inventory`'s date-range parsing forward into the movement report
**What goes wrong:** `app/(protected)/inventory/page.tsx` currently does `new Date(`${params.from}T00:00:00.000Z`)` with zero format validation — a malformed `?from=` value produces an `Invalid Date`, which Prisma's query engine rejects, and this throws unhandled (confirmed via direct code read in `03-SECURITY.md`'s T-03-11 independent verification — there is no error boundary anywhere under `app/`, so this is an unhandled 500, not a caught/graceful failure as an earlier plan mistakenly claimed).
**Why it happens:** `/inventory` is the only existing precedent for this exact query shape, so copy-pasting it forward is the path of least resistance — but D-08 explicitly requires the *opposite* behavior (never throw) for the new movement report.
**How to avoid:** Apply the `DATE_RE` regex-then-fallback pattern (Pattern 2 above) for the movement report's `from`/`to` handling. Do not copy `/inventory`'s current unguarded code. Optionally (not required by success criteria), apply the same fix back to `/inventory` itself while in this area of the code, per D-08's closing note.
**Warning signs:** A hand-crafted URL like `/reports?type=movements&from=garbage` producing a 500 instead of falling back to the default 30-day range.

### Pitfall 4: Serializing Prisma `Decimal` and `Date` objects directly into xlsx rows
**What goes wrong:** `XLSX.utils.json_to_sheet()` expects plain JS values (`string`, `number`, `boolean`, `Date` is actually supported natively by SheetJS, but Prisma's `Decimal` class is not a native JS type and will not serialize as a plain number).
**Why it happens:** It's easy to pass the raw Prisma query result straight into `json_to_sheet` without an explicit mapping/serialization step, since the existing `/purchase-orders` page already does the `.toNumber()` conversion for on-screen rendering — but a fresh implementer of the export route might not realize the same conversion needs to happen again in the Route Handler's independent query.
**How to avoid:** Always map the Prisma result to a plain row-object array (`{ ColumnName: primitiveValue, ... }`) before calling `json_to_sheet`, explicitly calling `.toNumber()` on any `Decimal` field (matching the existing `purchase-orders/page.tsx:28` convention: `totalAmount: po.totalAmount.toNumber()`).
**Warning signs:** Exported `.xlsx` cells showing `[object Object]`, blank, or a JSON-stringified blob instead of a plain number for `totalAmount`.

## Code Examples

Verified patterns from official/community sources (WebSearch-derived; no Context7 MCP tool was available this session — treat as `[CITED]`, not `[VERIFIED]`):

### Building and streaming an xlsx buffer (SheetJS)
```typescript
// Source: docs.sheetjs.com/docs/solutions/output (via WebFetch digest) + npmjs.com/package/xlsx
import * as XLSX from "xlsx"

const wb = XLSX.utils.book_new()
const ws = XLSX.utils.json_to_sheet(rows) // rows: plain object array, one object per row
XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) // Node Buffer, no disk I/O
```

### Streaming a binary download from a Next.js 15 Route Handler
```typescript
// Source: davegray.codes/posts/how-to-download-xlsx-files-from-a-nextjs-route-handler (via WebFetch digest)
// NOTE: source example used the legacy "application/vnd.ms-excel" MIME type — corrected below
// per this phase's explicit requirement to use the OOXML spec MIME type.
return new Response(buffer, {
  status: 200,
  headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="report.xlsx"`,
  },
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|--------------------|---------------|--------|
| `npm install xlsx` for the latest SheetJS build | `npm install --save https://cdn.sheetjs.com/xlsx-{version}/xlsx-{version}.tgz` for the latest build | SheetJS stopped publishing new versions to the npm registry several years ago (exact date not pinned this session) | Anyone following older SheetJS tutorials/StackOverflow answers that say `npm install xlsx` will get a stale, CVE-affected build without realizing it — this is precisely the trap flagged in this research |

**Deprecated/outdated:**
- `application/vnd.ms-excel` as the Content-Type for `.xlsx` downloads: this was the correct MIME type for the legacy binary `.xls` format; `.xlsx` (OOXML) has its own registered type, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Several tutorials still use the old value; it happens to work in most browsers but is not spec-correct.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | The ReDoS CVE (GHSA-5pgg-2g8v-p4x9)'s trigger path is undocumented and *might* be reachable from the write path, not just the read path | Package Legitimacy Audit, Pitfall 1 | If the CDN-tarball install (0.20.3) is chosen, this is moot — the fix is included regardless. If the frozen npm 0.18.5 build is chosen instead, and the write path IS actually vulnerable, a manager-only, internally-trusted-row-data export is still low real-world exploitability (no untrusted user input reaches cell values — all report data comes from this app's own Prisma-validated records), but this has not been independently confirmed |
| A2 | `exceljs` is a viable alternative if both `xlsx` install paths are rejected at the human-verify checkpoint | Alternatives Considered | Low risk — this is presented only as a fallback option, not a locked recommendation; CLAUDE.md already locked `xlsx` as the stack choice |
| A3 | No Context7/official-docs MCP tool was available this session; all xlsx API and Next.js Route Handler code examples are WebSearch/WebFetch digests of third-party blog posts and SheetJS's own docs pages, not independently executed/tested against this project's actual `node_modules` | Code Examples, Architecture Patterns | If SheetJS's actual current API differs subtly from what WebFetch summarized (e.g., an options-object shape change), the planner should have the executing agent verify against `node_modules/xlsx/types/index.d.ts` once installed, before writing the final Route Handler code |

## Open Questions

1. **Does the ReDoS CVE (CVE-2024-22363) trigger on the write/export path, or only on read/parse?**
   - What we know: The GitHub Security Advisory (GHSA-5pgg-2g8v-p4x9) confirms the vulnerability class (regex backtracking, CWE-1333) and the fixed version (0.20.2), but not the exact triggering code path.
   - What's unclear: Whether `XLSX.utils.json_to_sheet()` / `XLSX.write()` (the only two functions this phase needs) touch the vulnerable regex at all.
   - Recommendation: Default to the CDN-tarball 0.20.3 install (sidesteps the question entirely) unless the human-verify checkpoint has a specific reason to prefer the npm-registry build (e.g., CDN install failing in the deployment environment), in which case document this as an accepted residual risk.

2. **Should `/inventory`'s existing T-03-11 bug be fixed in this same phase?**
   - What we know: D-08 explicitly says this is optional, not required by REPT-02's success criteria.
   - What's unclear: Whether the planner should schedule it as an explicit small task in this phase (since the fix pattern will already exist for the new movement report) or leave it purely as a "worth doing opportunistically" note.
   - Recommendation: Planner's discretion — if scheduled, it's a near-zero-risk, near-zero-cost addition once Pattern 2 exists; if deferred, it remains tracked in `03-SECURITY.md` and `STATE.md`'s Blockers/Concerns as it already is.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|-----------|
| Node.js | Route Handler runtime (Buffer, native fetch Response) | ✓ | v24.16.0 (confirmed live this session) | — |
| npm registry access | `npm install xlsx@0.18.5` | ✓ (confirmed via live `npm view xlsx`) | — | — |
| `cdn.sheetjs.com` reachability | `npm install --save https://cdn.sheetjs.com/...tgz` (recommended path) | Not verified this session (no outbound fetch to the CDN itself attempted) | — | If unreachable at install time, fall back to `npm install xlsx@0.18.5` from the standard npm registry |
| PostgreSQL / Prisma | All three report queries | ✓ (existing, used by every prior phase) | Prisma `^6.19.3` (from `package.json`) | — |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** CDN tarball install for `xlsx@0.20.3` — if `cdn.sheetjs.com` is unreachable in the execution/CI environment, fall back to the npm-registry `0.18.5` build (accepting the documented residual ReDoS-uncertainty risk per the human-verify checkpoint's guidance).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.9` (existing, `vitest.config.ts` at repo root) |
| Config file | `vitest.config.ts` — `environment: "jsdom"`, `globals: true`, `passWithNoTests: true` |
| Quick run command | `npx vitest run tests/reports.test.ts` |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| REPT-01 | Inventory report query returns all products (active + inactive, per Claude's Discretion decision) with correct severity tier per row | unit | `npx vitest run tests/reports.test.ts -t "inventory"` | ❌ Wave 0 |
| REPT-02 | Movement report groups transactions by product for a given date range; malformed `?from=`/`?to=` falls back to 30-day default without throwing | unit | `npx vitest run tests/reports.test.ts -t "movements"` | ❌ Wave 0 |
| REPT-03 | PO report includes all 3 statuses with `totalAmount` matching the stored column (not recomputed) | unit | `npx vitest run tests/reports.test.ts -t "purchase-orders"` | ❌ Wave 0 |
| REPT-04 | Route Handler returns a `Response` with the correct `Content-Type`/`Content-Disposition` headers and a non-empty binary body; unauthenticated/non-manager requests get 401/403 | unit (mock Prisma + auth, call `GET()` directly, inspect headers + `await response.arrayBuffer()` length > 0) | `npx vitest run tests/reports-export.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/reports.test.ts` (and `tests/reports-export.test.ts` once created)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/reports.test.ts` — covers REPT-01/02/03 (page-level Prisma query shape + whitelist/date-fallback validation), following the existing `tests/products.test.ts`/`tests/purchase-orders.test.ts` `vi.mock("@/lib/prisma", ...)` convention
- [ ] `tests/reports-export.test.ts` — covers REPT-04 (Route Handler auth gate + header/body shape), a genuinely new test pattern for this codebase since no prior Route Handler test exists; call the exported `GET` function directly with a constructed `NextRequest`-like object (or plain `Request`), matching how `tests/purchase-orders.test.ts` imports the page module post-`vi.mock`
- [ ] No new test framework/config needed — existing `vitest.config.ts` (`jsdom` environment) covers Route Handler tests fine since Node 24's native `Response`/`Buffer` globals are available regardless of the jsdom DOM layer

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | yes | Existing Auth.js v5 JWT session (`auth()`) — must be explicitly called in each new Route Handler since middleware does not cover `/api/*` (Pitfall 2) |
| V3 Session Management | yes | Reuses existing Auth.js session — no new session logic introduced |
| V4 Access Control | yes | MANAGER-only enforcement must be added explicitly inside each `/api/reports/*` Route Handler (see Pitfall 2) — this is new code, not inherited from `middleware.ts` |
| V5 Input Validation | yes | `?type=` whitelist (D-02) and `?from=`/`?to=` regex-then-fallback (D-08, Pattern 2) — both Route Handler and page must independently validate, since the Route Handler re-parses `request.nextUrl.searchParams` rather than trusting the page |
| V6 Cryptography | no | No new cryptographic operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Unauthenticated/non-manager access to `/api/reports/*` (bypasses `middleware.ts` entirely since `/api/*` is excluded from its matcher) | Elevation of Privilege / Information Disclosure | Explicit `auth()` + role check as the first statement in every `/api/reports/*` Route Handler, mirroring `MANAGER_ROUTES` from `middleware.ts` |
| Malformed `?from=`/`?to=` causing an unhandled 500 (T-03-11 pattern) | Denial of Service | Regex-validate date shape before `new Date()`, fall back silently to the 30-day default (Pattern 2) |
| Stale/CVE-affected `xlsx` dependency pulled from npm registry | Tampering (supply chain) | `checkpoint:human-verify` before install, presenting both the CDN-tarball (patched) and npm-registry (frozen, scoped-safe-for-write-only-usage) options |
| Export route silently diverging from the page's displayed data (violates D-04) | Tampering / Repudiation (data integrity from the user's perspective) | Route Handler must re-derive and re-validate its own query from `request.nextUrl.searchParams` rather than trusting any client-passed state (Pattern 3) |

## Sources

### Primary (HIGH confidence)
- Direct codebase reads: `middleware.ts`, `lib/auth.ts`, `lib/prisma.ts`, `prisma/schema.prisma`, `actions/purchase-orders.ts`, `actions/categories.ts`, `lib/utils/severity.ts`, `lib/utils/po-status.ts`, `app/(protected)/inventory/page.tsx`, `app/(protected)/products/page.tsx`, `app/(protected)/purchase-orders/page.tsx`, `app/(protected)/purchase-orders/purchase-orders-client.tsx`, `.planning/phases/03-warehouse/03-SECURITY.md`, `.planning/phases/05-dashboard/05-01-PLAN.md`, `.planning/phases/05-dashboard/05-SECURITY.md`
- `npm view xlsx version` / `npm view xlsx time --json` / `npm view xlsx scripts.postinstall` — live registry queries, this session
- `gsd-tools query package-legitimacy check --ecosystem npm xlsx` — verdict `OK`, this session

### Secondary (MEDIUM confidence)
- [docs.sheetjs.com — Data Export](https://docs.sheetjs.com/docs/solutions/output/) — via WebFetch digest
- [docs.sheetjs.com — Node.js installation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) — via WebFetch digest, confirms CDN tarball command + current version 0.20.3
- [davegray.codes — How to Download xlsx Files from a Next.js Route Handler](https://www.davegray.codes/posts/how-to-download-xlsx-files-from-a-nextjs-route-handler) — via WebFetch digest
- [GitHub Advisory GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) / CVE-2023-30533 — prototype pollution, read-path scoped
- [GitHub Advisory GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) / CVE-2024-22363 — ReDoS, trigger path undocumented

### Tertiary (LOW confidence)
- General WebSearch result summaries (not independently fetched/verified page-by-page): SheetJS/sheetjs GitHub issue #2667 ("Why the move away from npm registry?"), various secondary CVE aggregator sites (Vulert, GitLab Advisory DB, secure.software) — cross-referenced against each other and consistent, but not fetched from a single authoritative source

## Metadata

**Confidence breakdown:**
- Standard stack (xlsx version/CVE facts): MEDIUM — WebSearch/WebFetch-sourced against SheetJS's own docs and public GHSA advisories, cross-checked against live `npm view` output, but no Context7/official-package-docs MCP tool was available this session to verify against
- Architecture (Route Handler streaming pattern, searchParams validation reuse): HIGH for the reused patterns (directly read from this codebase), MEDIUM for the new xlsx-streaming-specific parts (third-party blog source, not SheetJS's own docs)
- Pitfalls (middleware `/api/*` exclusion, T-03-11): HIGH — both confirmed by direct code read this session (`middleware.ts` matcher regex; `03-SECURITY.md`'s independent verification of the still-unfixed `/inventory` bug)

**Research date:** 2026-07-07
**Valid until:** 30 days for the codebase-reuse findings (stable, won't drift); 7 days for the xlsx CVE/version findings specifically, given this is an actively-discussed supply-chain situation in the SheetJS community — re-verify `npm view xlsx version` and check for any newly-published npm release before executing if this research is consumed more than a week after it was written
