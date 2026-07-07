---
phase: 06-reports
plan: 02
subsystem: api
tags: [nextjs, xlsx, sheetjs, route-handlers, auth, excel-export]

# Dependency graph
requires:
  - phase: 06-reports (Plan 06-01)
    provides: "/reports page + Inventory/Movements/Purchase-Orders report queries; non-functional Export to Excel <a> links pointing at /api/reports/*"
  - phase: 01-foundation
    provides: "Auth.js v5 auth() session helper, MANAGER/STAFF role shape"
  - phase: 04-procurement
    provides: "PurchaseOrder.totalAmount stored Decimal column, po-status.ts/po-number.ts utils"
provides:
  - "lib/utils/route-auth.ts: requireManagerResponse() -- Route-Handler-appropriate auth gate (returns a Response, not {error})"
  - "app/api/reports/inventory/route.ts, app/api/reports/movements/route.ts, app/api/reports/purchase-orders/route.ts -- three GET Route Handlers streaming real .xlsx workbooks"
  - "xlsx@0.20.3 (SheetJS CDN tarball) as a new project dependency"
affects: []

# Tech tracking
tech-stack:
  added: ["xlsx@0.20.3 (installed via SheetJS CDN tarball, not npm registry)"]
  patterns:
    - "Route-Handler-appropriate auth gate returning a Response (401/403/null), sibling to the Server-Action requireManager() which returns {error}"
    - "Each /api/reports/* Route Handler self-enforces auth since middleware.ts's matcher excludes /api/* entirely"
    - "Route Handler re-derives its own query (does not import from the page or lib/utils/reports.ts) -- movements/route.ts duplicates a local resolveDateRange() intentionally"
    - "XLSX.utils.book_new() -> json_to_sheet(rows) -> book_append_sheet() -> XLSX.write({type:'buffer', bookType:'xlsx'}) -> new Response(buffer, {headers: OOXML Content-Type + Content-Disposition})"

key-files:
  created:
    - lib/utils/route-auth.ts
    - app/api/reports/inventory/route.ts
    - app/api/reports/movements/route.ts
    - app/api/reports/purchase-orders/route.ts
    - tests/reports-export.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "xlsx installed via the SheetJS CDN tarball (npm install --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz), per the human's 'approved: cdn' response at Task 0's blocking-human checkpoint -- patches both CVEs (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) flagged in 06-RESEARCH.md's Package Legitimacy Audit, in preference to the frozen npm-registry 0.18.5 build"
  - "package.json's xlsx dependency entry is the literal CDN tarball URL (not a semver range); package-lock.json's resolved/integrity fields point at cdn.sheetjs.com, confirmed via npm ls xlsx reporting 0.20.3"
  - "movements/route.ts's resolveDateRange()/DATE_RE duplicated verbatim from lib/utils/reports.ts (Plan 06-01) rather than imported -- Route Handlers independently re-derive and re-validate their own query per Pattern 3/D-04, by design (both plans ran independently in the same wave)"
  - "purchase-orders/route.ts's Prisma query has no status filter at all (not even a default) -- D-10/D-11 requires all three PO statuses always included, and a D-11 test asserts findMany's where argument is undefined even when a caller passes ?status=DRAFT"

patterns-established:
  - "requireManagerResponse() (lib/utils/route-auth.ts) is the canonical auth gate for any future /api/* Route Handler in this codebase that needs MANAGER-only access, since middleware.ts's matcher permanently excludes /api/* from its route-level guard"

requirements-completed: [REPT-04]

coverage:
  - id: D1
    description: "xlsx (SheetJS) installed via the CDN tarball path (0.20.3) explicitly approved by the human at Task 0's blocking-human checkpoint, patching both flagged CVEs"
    requirement: "REPT-04"
    verification:
      - kind: unit
        ref: "npm ls xlsx reports xlsx@0.20.3; package-lock.json resolved field points at cdn.sheetjs.com"
        status: pass
    human_judgment: false
  - id: D2
    description: "requireManagerResponse() gates all three /api/reports/* Route Handlers: 401 with no session, 403 for a non-MANAGER session, null (pass-through) for a MANAGER session -- self-enforced since middleware.ts excludes /api/* from its matcher"
    requirement: "REPT-04"
    verification:
      - kind: unit
        ref: "tests/reports-export.test.ts#requireManagerResponse -- lib/utils/route-auth.ts"
        status: pass
      - kind: unit
        ref: "tests/reports-export.test.ts#GET /api/reports/inventory (REPT-04) -- 401 no-session case"
        status: pass
      - kind: unit
        ref: "tests/reports-export.test.ts#GET /api/reports/purchase-orders (REPT-04) -- 401/403 cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET /api/reports/inventory streams a real .xlsx buffer with the correct OOXML Content-Type and a Content-Disposition containing inventory-report-...xlsx for a MANAGER session"
    requirement: "REPT-04"
    verification:
      - kind: unit
        ref: "tests/reports-export.test.ts#GET /api/reports/inventory (REPT-04) -- MANAGER session 200/headers/body case"
        status: pass
    human_judgment: false
  - id: D4
    description: "GET /api/reports/movements streams a real .xlsx buffer filtered by the same ?from=/?to= as the on-screen report; malformed date values silently fall back to the 30-day default rather than throwing"
    requirement: "REPT-04"
    verification:
      - kind: unit
        ref: "tests/reports-export.test.ts#GET /api/reports/movements (REPT-04) -- 200/headers case and malformed-dates-never-throw case"
        status: pass
    human_judgment: false
  - id: D5
    description: "GET /api/reports/purchase-orders streams a real .xlsx buffer covering all three PO statuses (never filtered by ?status=) with the Total column reading totalAmount.toNumber() exactly, never recomputed from line items"
    requirement: "REPT-04"
    verification:
      - kind: unit
        ref: "tests/reports-export.test.ts#GET /api/reports/purchase-orders (REPT-04) -- 200/headers, D-11 no-status-filter, and toNumber() assertions"
        status: pass
    human_judgment: false
  - id: D6
    description: "Each report's Export to Excel link (wired in Plan 06-01's reports-client.tsx) downloads a real, openable .xlsx file whose rows match the currently on-screen/filtered data; a STAFF-role or logged-out request to any /api/reports/* URL cannot download a report"
    verification: []
    human_judgment: true
    rationale: "Requires opening downloaded files in Excel/LibreOffice and visually cross-checking rows against the live /reports page across a real MANAGER session and a real STAFF/logged-out session -- genuine end-user judgment, not reproducible by a unit test against mocked Prisma/auth"

duration: 6min
completed: 2026-07-07
status: complete
---

# Phase 6 Plan 2: Excel Export Route Handlers Summary

**Three self-authenticating `/api/reports/*` Route Handlers streaming real `.xlsx` workbooks via `xlsx@0.20.3` (SheetJS CDN tarball), closing the auth gap left by `middleware.ts`'s `/api/*` exclusion**

## Performance

- **Duration:** 6 min (Task 1 + Task 2, resumed after Task 0's human-verify checkpoint was approved)
- **Started:** 2026-07-07T10:34:00Z
- **Completed:** 2026-07-07T10:40:27Z
- **Tasks:** 2 completed (Task 0 was a checkpoint, resolved by the human before this session)
- **Files modified:** 7 (2 new library files, 3 new Route Handlers, 1 new test file, package.json/package-lock.json)

## Accomplishments
- Installed `xlsx@0.20.3` via the SheetJS CDN tarball (`npm install --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), per the human's "approved: cdn" checkpoint decision — confirmed via `npm ls xlsx` and `package-lock.json`'s `cdn.sheetjs.com`-resolved entry, not the frozen npm-registry `0.18.5` build
- Added `lib/utils/route-auth.ts`'s `requireManagerResponse()`, the Route-Handler-appropriate sibling to `actions/products.ts`'s `requireManager()`, closing the auth gap `middleware.ts`'s `config.matcher` leaves for all of `/api/*` (Pitfall 2)
- Built `app/api/reports/inventory/route.ts` and `app/api/reports/movements/route.ts` (Task 1), each self-enforcing the MANAGER auth gate before independently re-running its own Prisma query and streaming a real `.xlsx` buffer with the correct OOXML `Content-Type`
- `movements/route.ts` duplicates a local `resolveDateRange()`/`DATE_RE` (regex-then-30-day-fallback) rather than importing `lib/utils/reports.ts`, per Pattern 3/D-04 — malformed `?from=`/`?to=` never throws
- Built `app/api/reports/purchase-orders/route.ts` (Task 2) with the identical skeleton, no `status` filter at all (D-10/D-11), `Total` column reading `po.totalAmount.toNumber()` verbatim (never recomputed from line items, Pitfall 4)
- `tests/reports-export.test.ts` — 13 tests covering the auth gate (401/403/pass-through) across all three handlers, header/body shape, the movements date-fallback never-throw behavior, and the purchase-orders no-status-filter + `toNumber()` serialization assertions — all green

## Task Commits

Each task was committed atomically:

1. **Task 1: Install xlsx + route-auth helper + Inventory and Movements Route Handlers** - `42e0109` (feat)
2. **Task 2: Purchase Orders Route Handler + full export test coverage** - `815145f` (feat)

_No separate TDD RED/GREEN commit split — tests were written and run alongside each task's implementation, all green before commit, matching Plan 06-01's established convention for this phase._

## Files Created/Modified
- `lib/utils/route-auth.ts` - `requireManagerResponse()`: returns `Response` (401/403) or `null`, the HTTP-response-returning variant of `actions/products.ts`'s `requireManager()`
- `app/api/reports/inventory/route.ts` - `GET` streams the inventory `.xlsx` (all products, active + inactive, with severity tier via `getSeverityBadge`)
- `app/api/reports/movements/route.ts` - `GET` streams the date-filtered movements `.xlsx`; local `resolveDateRange()` duplicate closes T-03-11 for this route independently
- `app/api/reports/purchase-orders/route.ts` - `GET` streams the purchase-orders `.xlsx`; all 3 statuses, `Total` from the stored `Decimal` column
- `tests/reports-export.test.ts` - 13 tests: `requireManagerResponse()` (3), inventory handler (2), movements handler (3), purchase-orders handler (5)
- `package.json` / `package-lock.json` - `xlsx` dependency added as the literal SheetJS CDN tarball URL, not a semver range

## Decisions Made
- Installed `xlsx@0.20.3` via the CDN tarball path (Option A, recommended) per the human's explicit "approved: cdn" response at Task 0 — patches both `GHSA-4r6h-8v6p-xvw6` (prototype pollution) and `GHSA-5pgg-2g8v-p4x9` (ReDoS), sidestepping the undocumented ReDoS trigger-path question entirely (06-RESEARCH.md Open Question 1)
- `resolveDateRange()`/`DATE_RE` duplicated locally in `movements/route.ts` rather than imported from `lib/utils/reports.ts` — matches the plan's explicit instruction (key_links) that no `/api/reports/*` handler imports from `reports/page.tsx` or `lib/utils/reports.ts`, keeping the Route Handler's re-derivation independent of the page's validation (Pattern 3, D-04)
- `purchase-orders/route.ts`'s Prisma `findMany` call omits `where` entirely (not just an unfiltered default) — a dedicated test asserts `call.where` is `undefined` even when `?status=DRAFT` is passed, proving D-11's "no filter UI on this report" requirement holds at the query layer, not just the UI layer

## Deviations from Plan

None - plan executed exactly as written for both auto tasks. Task 0's checkpoint was resolved by the human ("approved: cdn") before this continuation session began; Task 1 and Task 2 followed the plan's `<action>` specifications verbatim, including the exact row-mapping shapes, header values, and file-naming conventions.

## Issues Encountered
- `npx tsc --noEmit` initially failed on two pre-existing TypeScript friction points in the new test file: (1) `vi.mocked(auth).mockResolvedValue(null)` didn't type-check against Auth.js's overloaded `auth()` signature (needed `null as never`, matching the `as never` convention already used throughout `tests/purchase-orders.test.ts` for the same reason), and (2) `prisma.stockTransaction.findMany`'s mocked call argument needed an explicit cast to read `where.createdAt.gte`/`.lte` since Prisma's generated `DateTimeFilter` type doesn't directly expose those fields to TypeScript's structural narrowing. Both fixed inline before committing Task 1; `npx tsc --noEmit` and `npx vitest run tests/reports-export.test.ts` were clean afterward.

## User Setup Required

None - no external service configuration required. The `xlsx` CDN-tarball install completed successfully in this environment (`cdn.sheetjs.com` was reachable); no fallback to the npm-registry `0.18.5` build was needed.

## Next Phase Readiness

- All three `/api/reports/*` Route Handlers are live and wired to the "Export to Excel" links already present in `reports-client.tsx` (Plan 06-01) — REPT-04 is fully satisfied for all three report types
- Full automated test suite (`npx vitest run`) is green: 103 passed, 18 pre-existing `it.todo` stubs (tracked since Phase 3, unrelated to this plan), 0 failures; `npx tsc --noEmit` clean with zero new type errors
- One remaining human-verify item (D6, `## Coverage`) is deferred to end-of-phase UAT per this project's `human_verify_mode: end-of-phase` config: log in as Manager, click each tab's "Export to Excel" link, open the downloaded `.xlsx` in Excel/LibreOffice, and confirm a STAFF-role/logged-out request to any raw `/api/reports/*` URL is rejected
- This is the last plan in Phase 6 (Reports) — the phase's REPT-01 through REPT-04 requirements are all now code-complete, pending the phase-level UAT checkpoint

---
*Phase: 06-reports*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: lib/utils/route-auth.ts
- FOUND: app/api/reports/inventory/route.ts
- FOUND: app/api/reports/movements/route.ts
- FOUND: app/api/reports/purchase-orders/route.ts
- FOUND: tests/reports-export.test.ts
- FOUND: 42e0109
- FOUND: 815145f
