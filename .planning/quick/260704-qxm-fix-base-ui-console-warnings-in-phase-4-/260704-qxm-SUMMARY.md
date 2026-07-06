---
phase: quick-260704-qxm
plan: 01
subsystem: ui
tags: [base-ui, react-hook-form, select, button, console-warnings]

requires: []
provides:
  - "Button instances that wrap a Link via render prop opt out of native-button semantics (nativeButton={false})"
  - "Every RHF-bound Select in the app (users, products, purchase-orders, stock) is fully controlled via value+onValueChange"
affects: [purchase-orders, users, products, stock]

tech-stack:
  added: []
  patterns:
    - "Button render={<Link/>} always paired with nativeButton={false} when Button's own render prop is overridden with a non-button element"
    - "RHF-bound Select always wired as value={field.value ?? \"\"} onValueChange={field.onChange} (fully controlled), never onValueChange+defaultValue"

key-files:
  created: []
  modified:
    - "app/(protected)/purchase-orders/purchase-orders-client.tsx"
    - "app/(protected)/purchase-orders/po-form-client.tsx"
    - "app/(protected)/purchase-orders/new/page.tsx"
    - "app/(protected)/users/users-client.tsx"
    - "app/(protected)/products/products-client.tsx"
    - "app/(protected)/stock/stock-client.tsx"

key-decisions:
  - "Left the two already-controlled Selects (po-form-client.tsx draftProductId, inventory-client.tsx product filter) untouched — they already pass explicit value+onValueChange and don't exhibit the warning"
  - "Disabled empty-state Select in products-client.tsx given explicit value=\"\" with no onValueChange handler since it can never emit a change event while disabled"

patterns-established:
  - "Pattern: Button wraps Link via render -> nativeButton={false} is mandatory to match the anchor actually rendered"
  - "Pattern: Select bound to a react-hook-form field must be controlled (value) not uncontrolled (defaultValue)"

requirements-completed: []

coverage:
  - id: D1
    description: "Three Button instances whose render prop wraps a Link now carry nativeButton={false}, silencing the Base UI nativeButton console warning"
    verification:
      - kind: other
        ref: "grep -rn \"render={<Link\" app/(protected)/purchase-orders --include=*.tsx | grep -c \"nativeButton={false}\" == 3"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nine RHF-bound Select instances converted from uncontrolled (defaultValue) to fully controlled (value), plus the disabled empty-state Select given an explicit value, silencing the Base UI uncontrolled-Select warning"
    verification:
      - kind: other
        ref: "grep -rn 'value={field.value ?? \"\"}' across the four files == 9"
        status: pass
      - kind: unit
        ref: "npm test (vitest run) — full suite"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "The actual absence of the two Base UI console warnings can only be confirmed by opening the affected pages in a browser with devtools console open — no browser is available in this execution environment, so this was recorded as a best-effort skip rather than verified directly."

duration: 12min
completed: 2026-07-04
status: complete
---

# Quick Task 260704-qxm: Fix Base UI console warnings in Phase 4 UI Summary

**Silenced two recurring Base UI console warnings (nativeButton and uncontrolled-Select) by adding `nativeButton={false}` to three Button+Link instances and converting nine RHF-bound Selects from `defaultValue` to fully-controlled `value`**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3 (2 code tasks + 1 verification-only task)
- **Files modified:** 6

## Accomplishments
- All three Button instances in the purchase-orders feature whose `render` prop overrides with a `Link` now explicitly set `nativeButton={false}`, matching the anchor Base UI's `useButton` actually sees rendered
- All nine RHF-bound Select instances across users, products, purchase-orders, and stock forms converted from the uncontrolled `onValueChange={field.onChange} defaultValue={field.value}` pattern to the fully controlled `value={field.value ?? ""} onValueChange={field.onChange}` pattern
- The one disabled empty-state Select in `products-client.tsx` (no active categories) given an explicit `value=""` so it is controlled from render one
- No behavior change: navigation via Link and Select value submission through react-hook-form work identically to before
- `npx tsc --noEmit` exits 0, `npm test` (vitest) exits 0 with 40 passed / 18 todo, no regressions

## Task Commits

1. **Task 1: Add nativeButton={false} to every Button whose render prop wraps a Link** - `6ab9f69` (fix)
2. **Task 2: Convert every RHF-bound Select from uncontrolled to fully controlled** - `60596db` (fix)
3. **Task 3: Regression check — typecheck, unit tests, manual console spot check** - verification only, no commit (tsc and vitest both exit 0; see "Manual Verification" below)

## Files Created/Modified
- `app/(protected)/purchase-orders/purchase-orders-client.tsx` - "Create Purchase Order" Button gained `nativeButton={false}`
- `app/(protected)/purchase-orders/po-form-client.tsx` - "Cancel" Button gained `nativeButton={false}`; supplierId Select made fully controlled
- `app/(protected)/purchase-orders/new/page.tsx` - "Cancel" Button gained `nativeButton={false}`
- `app/(protected)/users/users-client.tsx` - role Select made fully controlled in both Create and Edit dialogs
- `app/(protected)/products/products-client.tsx` - categoryId Select made fully controlled in both Create and Edit dialogs; disabled empty-state Select given explicit `value=""`
- `app/(protected)/stock/stock-client.tsx` - productId and reason Selects made fully controlled in both Stock In and Stock Out dialogs

## Decisions Made
- Left `po-form-client.tsx`'s free-standing `draftProductId` Select and `inventory-client.tsx`'s product-filter Select untouched — both already pass explicit `value` + `onValueChange` and never exhibited the warning
- Gave the disabled empty-state Select in `products-client.tsx` an explicit `value=""` with no `onValueChange` handler, since a permanently-disabled Select can never emit a change event (a no-op handler would be dead code)

## Deviations from Plan

None — plan executed exactly as written. Both automated verification commands (grep-based prop counts) matched the plan's exact expected counts (3 and 9) on the first attempt.

## Issues Encountered

None.

## Manual Verification

The plan's Task 3 includes a best-effort manual dev-server console spot check (opening `/purchase-orders`, `/purchase-orders/new`, `/users`, `/products`, `/stock` with devtools console open) explicitly marked as "not required for automated pass/fail, since a browser isn't available in this execution environment." This step was **skipped** for that stated reason — no browser is available in this execution environment. The automated verification (grep prop counts, `tsc --noEmit`, `npm test`) fully confirms the code changes match the plan's specification; only the live-browser confirmation that the console warnings no longer appear was not performed directly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

No blockers. This was a pure console-hygiene fix with no schema, API, or behavior changes. Recommend a quick manual browser check (open the five listed pages with devtools console open) at the next opportunity to close out the deferred manual verification step above.

---
*Plan: quick-260704-qxm*
*Completed: 2026-07-04*

## Self-Check: PASSED

All 6 modified files confirmed present on disk; both task commit hashes (6ab9f69, 60596db) confirmed present in git log.
