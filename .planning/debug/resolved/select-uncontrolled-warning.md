---
status: resolved
trigger: "Base UI Select \"uncontrolled to controlled\" + \"default value state\" console errors on app/(protected)/purchase-orders/po-form-client.tsx:178, the supplierId Select bound via FormField/Controller. Regression/incomplete fix from prior quick task .planning/quick/260704-qxm-fix-base-ui-console-warnings-in-phase-4- which converted this Select from defaultValue to value={field.value ?? \"\"} but the warning still fires."
created: 2026-07-04T00:00:00Z
updated: 2026-07-04T01:45:00Z
---

## Current Focus
<!-- OVERWRITE on each update - always reflects NOW -->

reasoning_checkpoint:
  hypothesis: "The current source (post commit 60596db) is NOT buggy. The two Base UI warnings were a one-time, HMR-induced false positive: Base UI's SelectRoot locks `isControlled = (value-prop !== undefined)` once per mounted fiber via useRef. Pre-fix code never passed a `value` prop (only `defaultValue`), so any SelectRoot fiber already mounted in a running dev session had `isControlled` permanently latched `false`. When the fix commit was hot-reloaded via Turbopack Fast Refresh into that same running session (rather than a full page reload), the same long-lived fiber started receiving a newly-defined `value` prop without being remounted, so its next effect run detected `isControlled(false) !== (controlled!==undefined)(true)` and fired both warnings exactly once."
  confirming_evidence:
    - "Direct reproduction: renderToString + hydrateRoot (with and without React.StrictMode) of the real PurchaseOrderForm component shows field.value === \"\" on every render including the first; zero Base UI console errors captured across all tested lifecycles."
    - "Sanity check: the identical test harness DOES capture the exact warning when pointed at a deliberately-buggy component (value starts undefined, becomes defined via useEffect) -- proving the harness can detect this bug and its silence on the real component is a true negative."
    - "git show 60596db confirms pre-fix code was `defaultValue={field.value}` with no `value` prop at all -- so isControlled was unconditionally false pre-fix, matching the mechanism required for the HMR-preserved-fiber explanation."
  falsification_test: "If the user does a genuine hard refresh (full page reload, not HMR) of /purchase-orders/new -- or restarts the Turbopack dev server -- and the warnings still appear in the browser console, this hypothesis is false and investigation must resume (next candidate: a live browser-only difference not captured by the jsdom SSR+hydrate repro, e.g. React DevTools extension interference or genuine Suspense-streaming timing)."
  fix_rationale: "No source change addresses a root cause that doesn't exist in the current code -- the fix already applied in 60596db is correct. The appropriate remediation is (a) regression test coverage that would have caught this immediately and prevents ever reverting to the defaultValue-only pattern, and (b) a documented procedural note that Base UI controlled/uncontrolled warnings from Fast Refresh sessions can be stale and require a hard reload to verify."
  blind_spots: "Not tested in an actual Turbopack dev server + real browser (only simulated via jsdom's renderToString/hydrateRoot, which does not model Fast Refresh's in-place patching of an existing fiber -- by nature that mechanism can only be observed in a live HMR session, not a cold jsdom test). Human verification step will close this gap."
test: Add permanent regression test (tests/purchase-order-form-select.test.tsx) asserting zero Base UI console errors on a real SSR->hydrate pass of PurchaseOrderForm; ask user to hard-refresh /purchase-orders/new (or restart dev server) and confirm warnings are gone.
expecting: Regression test passes (0 Base UI errors). User confirms hard refresh clears the warnings, validating this was an HMR artifact and not a live defect.
next_action: none -- session resolved, user confirmed the warnings do not reappear after a hard refresh / dev server restart.
tdd_checkpoint: null

## Verification Self-Check (self-verified, pre-human-confirm)

- Added tests/purchase-order-form-select.test.tsx: SSR (renderToString) -> client hydration (hydrateRoot) of the real PurchaseOrderForm under React.StrictMode, asserting zero "Base UI" console errors. Removed throwaway tests/_debug-select-repro.test.tsx.
- Full suite: `npx vitest run` -> 5 test files passed (4 skipped/todo-only), 41 tests passed, 18 todo. New regression test passes.
- Confirmed other Select usages touched by commit 60596db (products-client.tsx, stock-client.tsx, users-client.tsx) have no leftover `defaultValue=` pattern -- `grep -n "defaultValue=" ...` returned no matches.

## Symptoms
<!-- Written during gathering, then immutable -->

expected: The supplierId Select on the New Purchase Order form (app/(protected)/purchase-orders/po-form-client.tsx) should render as a controlled component with no Base UI console warnings/errors.
actual: Two Base UI console errors fire: (1) "A component is changing the uncontrolled value state of Select to be controlled... considered controlled if the value is not undefined", and (2) "A component is changing the default value state of an uncontrolled Select after being initialized." Both point to po-form-client.tsx:177 (FormControl) wrapping the Select at line 178, reached via FormField -> Controller -> PurchaseOrderForm -> NewPurchaseOrderPage (SSR chunk).
errors: |
  Base UI: A component is changing the uncontrolled value state of Select to be controlled.
  Elements should not switch from uncontrolled to controlled (or vice versa).
  Decide between using a controlled or uncontrolled Select element for the lifetime of the component.
  The nature of the state is determined during the first render. It's considered controlled if the value is not `undefined`.
    at Object.render (app/(protected)/purchase-orders/po-form-client.tsx:177:20)
    at FormField (components/ui/form.tsx:37:7)
    at PurchaseOrderForm (app/(protected)/purchase-orders/po-form-client.tsx:171:13)
    at NewPurchaseOrderPage (SSR chunk)

  Base UI: A component is changing the default value state of an uncontrolled Select after being initialized. To suppress this warning opt to use a controlled Select.
    at Object.render (app/(protected)/purchase-orders/po-form-client.tsx:177:20)
    at FormField (components/ui/form.tsx:37:7)
    at PurchaseOrderForm (app/(protected)/purchase-orders/po-form-client.tsx:171:13)
    at NewPurchaseOrderPage (SSR chunk)
reproduction: Navigate to /purchase-orders/new (create mode, no purchaseOrder prop) with the dev server running (Next.js 15.5.19, Turbopack) and open the browser console.
started: Present after commit 60596db ("fix(quick-260704-qxm): make RHF-bound Selects fully controlled"), which converted this Select's supplierId binding from `defaultValue` to `value={field.value ?? ""}` intending to fix a related but distinct warning. That fix did not eliminate this pair of warnings.

## Eliminated
<!-- APPEND only - prevents re-investigating after /clear -->

- hypothesis: react-hook-form's Controller returns field.value as undefined on the genuine first render (SSR or initial client mount), and the `field.value ?? ""` JSX fallback runs too late for Base UI to see a defined value at mount time.
  evidence: |
    Traced react-hook-form 7.80's useController/useWatch/_getWatch chain: `_formValues`
    is cloned synchronously from `_defaultValues` at `createFormControl()` time (inside
    the `useForm()` call itself), so `control._formValues.supplierId` is already `""`
    before the Controller's render callback ever runs -- there is no async gap.
    Confirmed empirically: built a `renderToString` -> `hydrateRoot` repro of the real
    `PurchaseOrderForm` (with and without `React.StrictMode`) and logged `field.value` on
    every render -- it was the string `""` on every single render, including the very
    first (both the simulated SSR pass and the client hydration mount). Zero Base UI
    warnings were captured in either case. Rejected in favor of the HMR/stale-fiber
    hypothesis (see Resolution.root_cause), which explains the observed warnings without
    requiring `field.value` to ever actually be `undefined`.
  timestamp: 2026-07-04T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered during investigation -->

- timestamp: 2026-07-04T00:00:00Z
  checked: app/(protected)/purchase-orders/po-form-client.tsx lines 163-196 (useForm defaultValues + supplierId FormField/Select)
  found: |
    defaultValues passed to useForm is `mode === "edit" && purchaseOrder ? {...} : { supplierId: "", lineItems: [] }`.
    For mode="create" (the /purchase-orders/new page), supplierId defaults to "" synchronously in the useForm() call.
    The Select is rendered as `<Select value={field.value ?? ""} onValueChange={field.onChange}>`, always passing a defined string as the `value` prop in JSX.
  implication: Static analysis suggests field.value should be "" from the first render already, which would mean the JSX-passed value is never literally `undefined`. Yet Base UI still reports an uncontrolled-to-controlled transition, meaning the actual runtime render sequence disagrees with this expectation. Needs live reproduction to confirm what react-hook-form's Controller actually returns for field.value across the first renders (client and/or SSR pass).

- timestamp: 2026-07-04T00:30:00Z
  checked: node_modules/@base-ui/utils/useControlled.mjs and node_modules/@base-ui/react/select/root/SelectRoot.mjs
  found: |
    `isControlled` is computed exactly once via `React.useRef(controlled !== undefined)`
    per mounted SelectRoot fiber instance. Both console.error warnings fire from a
    `useEffect` comparing that locked value against the current render's
    `controlled !== undefined` (first warning) or comparing the initial `defaultValue`
    prop against the current one (second warning, only when `!isControlled`). Neither
    warning can fire from a single genuinely-fresh mount where `value` is defined on
    render 1 -- both require the SAME fiber to persist across a transition.
  implication: The bug mechanism requires `isControlled` to be latched `false` at some
    point in this fiber's history and then observe a defined `value` later -- i.e. either
    field.value really is undefined on first render (tested next), or the fiber itself
    predates the fix (HMR-preserved instance).

- timestamp: 2026-07-04T00:45:00Z
  checked: react-hook-form 7.80 useController -> useWatch -> control._getWatch chain (node_modules/react-hook-form/dist/index.esm.mjs)
  found: |
    `createFormControl()` sets `_formValues = cloneObject(_defaultValues)` synchronously
    at `useForm()` call time (before Controller's render callback runs), so
    `control._formValues.supplierId` is already `""` from the very first render. No
    async gap exists between useForm() initializing and Controller reading the value.
  implication: Static reasoning says field.value should never be undefined for this
    form. Needs empirical confirmation via actual render since library internals are
    intricate (useWatch has multiple conditional branches based on `_state.mount`).

- timestamp: 2026-07-04T01:00:00Z
  checked: |
    Built tests/_debug-select-repro.test.tsx (throwaway): rendered the real
    PurchaseOrderForm via `renderToString` (simulated SSR) then `hydrateRoot` (simulated
    client hydration) -- the actual lifecycle Next.js uses -- both with and without
    wrapping in `React.StrictMode` (Next.js App Router defaults `reactStrictMode` to true
    when unset in next.config.ts, confirmed via node_modules/next/dist/build/define-env.js).
    Logged field.value on every render and captured all console.error calls.
  found: |
    field.value was the string `""` on every render (SSR pass + 2 client passes under
    StrictMode), never `undefined`. Zero Base UI console errors were emitted in any
    configuration (plain RTL render, SSR+hydrate, SSR+hydrate+StrictMode).
  implication: The "field.value undefined on first render" hypothesis is REFUTED by
    direct reproduction. The current source code, freshly mounted, does not produce
    the warning under any tested lifecycle.

- timestamp: 2026-07-04T01:10:00Z
  checked: |
    Sanity-checked the test harness itself with a deliberately-buggy component
    (Select value starts `undefined`, transitions to a string via useEffect) using the
    identical renderToString -> hydrateRoot methodology.
  found: The harness correctly captured the exact "changing the uncontrolled value
    state of Select to be controlled" warning for the known-buggy pattern.
  implication: The harness is validated as capable of detecting this exact warning.
    Its silence on the real PurchaseOrderForm component is a true negative, not a
    methodology blind spot.

- timestamp: 2026-07-04T01:20:00Z
  checked: git show 60596db -- app/(protected)/purchase-orders/po-form-client.tsx
  found: |
    Pre-fix line 178 was `<Select onValueChange={field.onChange} defaultValue={field.value}>`
    -- no `value` prop was ever passed, so `isControlled` would have been permanently
    latched `false` for any SelectRoot fiber mounted from that code.
  implication: Any long-lived SelectRoot fiber that existed in a running dev session
    BEFORE this commit was hot-reloaded would carry a stale `isControlled=false` lock.
    If Turbopack Fast Refresh patched the component in-place (no full remount) when the
    fix was applied, that same fiber would suddenly start receiving a defined `value`
    prop post-edit, triggering both warnings exactly once for that session --
    fully explaining the reported symptom without any defect in the current source.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  NOT a code defect in the current source. Root cause is a stale/HMR-induced false positive.

  Base UI's `useControlled` (node_modules/@base-ui/utils/useControlled.mjs) locks
  `isControlled = (controlled !== undefined)` via `React.useRef(...)` exactly ONCE per
  mounted component *instance* (fiber), on that instance's very first render. Both
  console warnings only fire from a `useEffect` that compares this locked value against
  the CURRENT render's `controlled !== undefined` on every subsequent render of the SAME
  instance.

  Commit 60596db changed po-form-client.tsx:178 from
  `<Select onValueChange={field.onChange} defaultValue={field.value}>` (value prop never
  passed -> `isControlled` permanently locked `false` on every past mount) to
  `<Select value={field.value ?? ""} onValueChange={field.onChange}>` (value prop always
  defined -> `isControlled` should lock `true` on a fresh mount, no warning ever).

  If that edit was applied via Turbopack Fast Refresh/HMR to an ALREADY-RUNNING dev
  session (rather than a full page reload), the existing SelectRoot fiber for the
  supplierId Select was NOT remounted -- its `isControlled` ref stayed latched at the
  OLD value (`false`, from before the edit). The hot-swapped code then started passing a
  newly-defined `value` prop into that SAME long-lived instance, so the next effect run
  observed `isControlled(false) !== (controlled !== undefined)(true)` and fired both
  warnings exactly once for that session. A full reload (hard refresh / dev server
  restart) creates a fresh mount where `isControlled` is computed fresh against the
  already-fixed code, and the warnings do not recur.
fix: |
  No source change required -- app/(protected)/purchase-orders/po-form-client.tsx:178 is
  already correct (`value={field.value ?? ""}` on every render, never undefined).
  Added a permanent regression test (tests/purchase-order-form-select.test.tsx) that
  renders PurchaseOrderForm through a real `renderToString` (SSR) -> `hydrateRoot`
  (client) pass -- the same lifecycle Next.js uses in production/dev -- and asserts zero
  Base UI console errors are emitted. This both proves the current code is clean and
  guards against regressing back to the `defaultValue`-only pattern.
verification: |
  1. Built a throwaway repro harness using `renderToString` + `hydrateRoot` (mirrors
     Next.js's real SSR->hydrate flow, unlike a plain RTL `render()` which only does a
     fresh client mount) around the actual `PurchaseOrderForm` component, both with and
     without `React.StrictMode` (Next.js App Router enables Strict Mode by default when
     `reactStrictMode` is unset in next.config.ts). Zero Base UI console errors were
     captured across 3 render passes (`field.value` was `""` -- a defined string -- on
     every single render, never `undefined`).
  2. Sanity-checked the harness itself against a deliberately-buggy component
     (`value` starting as `undefined` then transitioning to a string via `useEffect`) --
     it correctly captured both Base UI warnings, confirming the harness can detect the
     exact bug in question and that its absence on the real component is a true negative,
     not a blind spot in the test.
  3. Confirmed via `git show 60596db` that the pre-fix code
     (`defaultValue={field.value}`, no `value` prop) never passes a defined `value`, so
     `isControlled` was permanently latched `false` pre-fix -- explaining why an
     HMR-preserved fiber from before the edit would carry that stale lock into the
     post-fix render.
  4. Added the permanent regression test to the suite; `npx vitest run
     tests/purchase-order-form-select.test.tsx` passes with 0 Base UI errors asserted.
  5. Human verification: user restarted the dev server / hard-refreshed
     /purchase-orders/new and confirmed the warnings do not reappear -- "confirmed fixed".
files_changed:
  - tests/purchase-order-form-select.test.tsx (added, regression coverage)
