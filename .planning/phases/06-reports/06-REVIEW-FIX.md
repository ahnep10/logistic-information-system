---
phase: 06
fixed_at: 2026-07-07T04:57:44Z
review_path: .planning/phases/06-reports/06-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-07-07T04:57:44Z
**Source review:** .planning/phases/06-reports/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (fix_scope: critical_warning — CR-01, WR-01)
- Fixed: 2
- Skipped: 0

Info-level findings IN-01, IN-02, IN-03 were out of scope for `critical_warning` and were not attempted. See Skipped/Out of Scope section below.

## Fixed Issues

### CR-01: CSV/Excel formula injection in all three `/api/reports/*` xlsx exports

**Files modified:** `lib/utils/xlsx-sanitize.ts` (new), `app/api/reports/inventory/route.ts`, `app/api/reports/movements/route.ts`, `app/api/reports/purchase-orders/route.ts`
**Commit:** `2c48b05`
**Applied fix:** Added a new shared `sanitizeRow`/`sanitizeCell` utility in `lib/utils/xlsx-sanitize.ts` that prefixes any string cell value starting with `=`, `+`, `-`, `@`, tab, or CR with a neutralizing `'` before it reaches `XLSX.utils.json_to_sheet`. Applied `sanitizeRow(...)` uniformly across every row object built in all three Route Handlers (inventory, movements, purchase-orders), rather than hand-picking individual columns, so any current or future string column is covered automatically.

Deviation from the review's literal suggestion: the review's Fix section described the movements export as containing a `Notes` column (citing the STAFF `recordStockIn`/`recordStockOut` `notes` field as the concrete exploit vector) and asked for the fix to be applied to a `Notes` column specifically. On reading the actual file (`app/api/reports/movements/route.ts:47-55`), the current row mapping does not include a `notes`/`Notes` field at all — only `Product`, `SKU`, `Type`, `Quantity`, `Reason`, `Date`, and `Recorded By`. The blanket `sanitizeRow` approach still closes the vulnerability class described (formula injection via any free-text-adjacent field an authenticated STAFF user can influence, e.g. `Reason`, `Product`, `SKU`) and will automatically cover a `notes` column if one is added later, so no functional gap remains — this is noted here only because the applied code differs from the review's literal file content description.

### WR-01: Purchase-orders report spreads the full Prisma record into client props, unlike the other two tabs

**Files modified:** `app/(protected)/reports/page.tsx`
**Commit:** `ebd7a35`
**Applied fix:** Replaced the `{ ...po, totalAmount: po.totalAmount.toNumber() }` spread with an explicit field-by-field mapping (`id`, `poNumber`, `status`, `totalAmount`, `createdAt`, `supplier`, `createdBy`), matching the narrowing pattern already used by the `inventoryRows` and `movementGroups` branches in the same file. This removes `supplierId`, `createdById`, and `updatedAt` (internal FK ids and an unused timestamp) from the RSC payload serialized to the client `ReportsClient` component. Applied exactly as suggested in REVIEW.md; the fix matched the current code state with no adaptation needed.

## Skipped Issues

None of the in-scope findings were skipped — both CR-01 and WR-01 were fixed and verified.

## Out of Scope (not attempted)

The following findings are Info-tier and were excluded by `fix_scope: critical_warning`:

- **IN-01** — Movements export link builds its query string via raw template-literal concatenation (`app/(protected)/reports/reports-client.tsx:176-180`). Not exploitable today per the review; recommends `URLSearchParams` for defense-in-depth against future free-text params.
- **IN-02** — `resolveDateRange`/`DATE_RE` logic is duplicated verbatim between `lib/utils/reports.ts:22-42` and `app/api/reports/movements/route.ts:9-26`. Flagged as an intentional, documented design decision (independent re-validation across the Route Handler boundary); the review only raises a drift-risk concern if a future edge-case fix is applied to only one copy.
- **IN-03** — Movements date-range filter uses UTC day boundaries against an Indonesia-targeted (WIB, UTC+7) app (`lib/utils/reports.ts:32-38`, `app/api/reports/movements/route.ts:16-22`). Pre-existing pattern from prior phases, not a regression; review recommends confirming local-day semantics with stakeholders rather than a definitive fix.

## Verification

- `tsc --noEmit`: clean, no errors, before and after both fixes.
- `vitest run` (full suite): 103 passed / 18 todo / 0 failed, identical to the pre-fix baseline (10 test files passed, 4 skipped).
- Both fixes independently re-verified with the scoped `tests/reports.test.ts` + `tests/reports-export.test.ts` files after each commit.

---

_Fixed: 2026-07-07T04:57:44Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
