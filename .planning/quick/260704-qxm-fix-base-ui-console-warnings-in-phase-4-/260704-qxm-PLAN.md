---
phase: quick-260704-qxm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/(protected)/purchase-orders/purchase-orders-client.tsx
  - app/(protected)/purchase-orders/po-form-client.tsx
  - app/(protected)/purchase-orders/new/page.tsx
  - app/(protected)/users/users-client.tsx
  - app/(protected)/products/products-client.tsx
  - app/(protected)/stock/stock-client.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Opening /purchase-orders, /purchase-orders/new, or any Draft PO's edit view and observing the browser console shows no Base UI 'nativeButton' warning"
    - "Opening any form containing a Select control (users, products, purchase orders, stock) and observing the browser console shows no Base UI uncontrolled/controlled-state warning for that Select"
    - "No visual or functional regression: Buttons still navigate via Link, Selects still populate options and submit the chosen value through react-hook-form exactly as before"
  artifacts:
    - path: "app/(protected)/purchase-orders/purchase-orders-client.tsx"
      provides: "'Create Purchase Order' Button with nativeButton={false} on its Link render prop"
    - path: "app/(protected)/purchase-orders/po-form-client.tsx"
      provides: "'Cancel' Button with nativeButton={false} on its Link render prop; supplierId Select fully controlled"
    - path: "app/(protected)/purchase-orders/new/page.tsx"
      provides: "'Cancel' Button with nativeButton={false} on its Link render prop"
    - path: "app/(protected)/users/users-client.tsx"
      provides: "Create/Edit role Selects fully controlled"
    - path: "app/(protected)/products/products-client.tsx"
      provides: "Create/Edit categoryId Selects fully controlled; disabled empty-state Select given an explicit value"
    - path: "app/(protected)/stock/stock-client.tsx"
      provides: "Stock-in/Stock-out productId and reason Selects fully controlled"
  key_links:
    - from: "Button (components/ui/button.tsx)"
      to: "next/link Link via render prop"
      via: "nativeButton={false} added wherever Button's own render prop is overridden with a Link, so Base UI's useButton native-element check matches the anchor actually rendered"
      pattern: "nativeButton={false}"
    - from: "react-hook-form field"
      to: "Select (components/ui/select.tsx)"
      via: "value bound to the RHF field replaces the uncontrolled default that only applied on first mount, alongside the pre-existing onValueChange"
      pattern: "value={field.value"
---

<objective>
Eliminate two recurring Base UI console warnings surfaced during Phase 4 UAT: (1) the "nativeButton" warning fired whenever a `Button` overrides its own `render` prop with a Next.js `Link` while `nativeButton` stays at its default `true`, and (2) the "uncontrolled" Select warning fired by every form `Select` that mirrors a react-hook-form field through the `defaultValue` prop instead of the fully-controlled `value` prop — present since Phase 2 and reproduced across every phase that added a form Select since.

Purpose: These are pure DX/console-hygiene fixes with no behavior change — silence the warnings without altering navigation, form submission, or option lists.
Output: All Button-wraps-Link instances explicitly opt out of native-button semantics; every RHF-bound Select (and the one disabled empty-state Select) is fully controlled.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

@components/ui/button.tsx
@components/ui/select.tsx
@app/(protected)/purchase-orders/purchase-orders-client.tsx
@app/(protected)/purchase-orders/po-form-client.tsx
@app/(protected)/purchase-orders/new/page.tsx
@app/(protected)/purchase-orders/[id]/po-detail-client.tsx
@app/(protected)/users/users-client.tsx
@app/(protected)/products/products-client.tsx
@app/(protected)/stock/stock-client.tsx
@app/(protected)/inventory/inventory-client.tsx

<interfaces>
`components/ui/button.tsx`'s `Button` destructures only `className`/`variant`/`size` and spreads every other prop — including `nativeButton` — straight onto Base UI's `ButtonPrimitive`, whose own default is `nativeButton = true`. Base UI's `useButton` hook logs "A component that acts as a button expected a native <button> because the `nativeButton` prop is true..." whenever the final rendered root is not an actual `<button>` element (i.e. `render` was overridden with something else, such as `<Link/>`). Setting `nativeButton={false}` on that specific `Button` instance is the fix; do not touch `nativeButton` on any `Button`/`DialogTrigger`/`AlertDialogTrigger` that still resolves to a real `<button>` (the default `true` is correct there, and flipping it would trigger the inverse warning instead).

`components/ui/select.tsx`'s `Select` is a direct alias of Base UI's `SelectPrimitive.Root`, which accepts an optional controlled `value` prop alongside `onValueChange`, or an uncontrolled `defaultValue` (first-render-only) prop. Base UI's internal `ReactStore`/`useControlled` utilities log a console error when a prop that started uncontrolled (no `value` passed) has its `defaultValue` change across renders — exactly what happens when a `Select` is wired as `onValueChange={field.onChange} defaultValue={field.value}` inside a react-hook-form `FormField`, since `field.value` is a live, changing value being fed into a prop Base UI treats as "set once." Swapping to `value={field.value ?? ""}` (keeping the existing `onValueChange={field.onChange}`) makes the component controlled from the first render onward and removes the mismatch. Two Select instances in this codebase are already written this way and must NOT be touched: the free-standing `draftProductId` Select in `po-form-client.tsx` (`value={draftProductId}` / `onValueChange={(v) => setDraftProductId(v ?? "")}`) and the product filter Select in `inventory-client.tsx` (`value={currentParams.productId ?? "all"}`).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add nativeButton={false} to every Button whose render prop wraps a Link</name>
  <files>app/(protected)/purchase-orders/purchase-orders-client.tsx, app/(protected)/purchase-orders/po-form-client.tsx, app/(protected)/purchase-orders/new/page.tsx</files>
  <action>
A repo-wide search for Button instances whose own `render` prop is overridden with a `Link` (as opposed to Buttons that are themselves the child of a `DialogTrigger`/`AlertDialogTrigger`'s `render` prop, which is a different composition and already resolves to a real `<button>`) found exactly three matches, all in the purchase-orders feature. Add `nativeButton={false}` to each of the following, placed as a prop alongside the existing `variant`/`className` props and before `render`: (1) the "Create Purchase Order" Button in `purchase-orders-client.tsx` whose render prop wraps a Link to `/purchase-orders/new`; (2) the "Cancel" Button in `po-form-client.tsx` whose render prop wraps a Link back to `/purchase-orders` (this component is reused by both the standalone create page and the Draft-edit view rendered inside the PO detail page, so this single change covers both surfaces); (3) the "Cancel" Button in `new/page.tsx` whose render prop wraps the same back-to-list Link.

Do not modify any other Button in the app. `po-detail-client.tsx` was inspected directly and has no Button whose own render prop is overridden with a Link — its "Confirm Order" and "Delete Draft" triggers pass a plain Button as the child of `AlertDialogTrigger`'s render prop (Button's default `nativeButton={true}` is correct there since the rendered root stays a real button), and its "Cancel" button inside receive-mode is a plain onClick Button with no render override at all. No edit is required in that file.
  </action>
  <verify>
    <automated>grep -rn "render={&lt;Link" "app/(protected)/purchase-orders" --include=*.tsx | grep -c "nativeButton={false}"</automated>
  </verify>
  <done>The count from the verify command is exactly 3, one per file listed above; no other Button instance in the repo gained a nativeButton prop.</done>
</task>

<task type="auto">
  <name>Task 2: Convert every RHF-bound Select from uncontrolled to fully controlled</name>
  <files>app/(protected)/users/users-client.tsx, app/(protected)/products/products-client.tsx, app/(protected)/purchase-orders/po-form-client.tsx, app/(protected)/stock/stock-client.tsx</files>
  <action>
A repo-wide search for every `Select` usage found nine instances still wired as `onValueChange={field.onChange}` paired with a first-render-only default mirroring the same field, plus one disabled Select with no explicit value at all. For each of the nine, reorder and replace so the component reads `value={field.value ?? ""}` followed by `onValueChange={field.onChange}` (do not remove or rename `onValueChange`; only the sibling prop changes from the uncontrolled first-render mirror to an always-live controlled value). The nine locations: `users-client.tsx` — the "role" Select inside `CreateUserDialog`'s FormField and the "role" Select inside `EditUserDialog`'s FormField; `products-client.tsx` — the "categoryId" Select inside `CreateProductDialog`'s FormField (the branch rendered when `categories.length > 0`) and the "categoryId" Select inside `EditProductDialog`'s FormField; `po-form-client.tsx` — the "supplierId" Select inside the shared create/edit form's FormField; `stock-client.tsx` — the "productId" and "reason" Selects inside both `RecordStockInDialog`'s and `RecordStockOutDialog`'s FormFields (four total).

Separately, in `products-client.tsx`'s `CreateProductDialog`, the disabled placeholder Select rendered in the `categories.length === 0` branch (labeled "No active categories") currently has no value prop of any kind. Give it an explicit `value=""` so it is controlled from render one; leave it without an `onValueChange` handler since it is permanently disabled and can never emit a change event — a no-op handler there would be dead code.

Leave the two already-controlled Selects untouched: `po-form-client.tsx`'s free-standing `draftProductId` Select, and `inventory-client.tsx`'s product filter Select — both already pass an explicit `value` plus `onValueChange` and do not exhibit the warning.
  </action>
  <verify>
    <automated>grep -rn "value={field.value ?? \"\"}" "app/(protected)/users/users-client.tsx" "app/(protected)/products/products-client.tsx" "app/(protected)/purchase-orders/po-form-client.tsx" "app/(protected)/stock/stock-client.tsx" | wc -l</automated>
  </verify>
  <done>The count from the verify command is exactly 9 (2 in users-client.tsx, 2 in products-client.tsx, 1 in po-form-client.tsx, 4 in stock-client.tsx); the disabled empty-state Select in products-client.tsx reads `&lt;Select disabled value=""&gt;`; the draftProductId and inventory product-filter Selects are unchanged.</done>
</task>

<task type="auto">
  <name>Task 3: Regression check — typecheck, unit tests, and a best-effort console spot check</name>
  <files>None (verification only)</files>
  <action>
Run `npx tsc --noEmit` and confirm it exits 0 with no new type errors from the prop changes in Tasks 1-2 (the project has a pre-existing, separately-tracked set of `@typescript-eslint/no-explicit-any` ESLint errors from the `zodResolver(...) as any` convention in `products-client.tsx`, `stock-client.tsx`, and `po-form-client.tsx` — those are ESLint-only, not `tsc` errors, and are out of scope here). Run `npm test` (vitest) and confirm the full suite still exits 0; none of the existing test files under `tests/` assert on Select or Button DOM structure, so a clean pass confirms no incidental breakage from either task. As a best-effort manual spot check (not required for automated pass/fail, since a browser isn't available in this execution environment), start `npm run dev`, open `/purchase-orders`, `/purchase-orders/new`, `/users`, `/products`, and `/stock` with the browser devtools console open, and confirm neither the nativeButton warning nor the uncontrolled-Select warning appears on any of those pages; record the outcome of this manual step (performed, or skipped with the reason) in the plan's SUMMARY.md.
  </action>
  <verify>
    <automated>npx tsc --noEmit &amp;&amp; npm test</automated>
  </verify>
  <done>`npx tsc --noEmit` exits 0; `npm test` (vitest run) exits 0 with no failing tests; the manual dev-server console check result (performed or explicitly skipped with reason) is recorded in SUMMARY.md.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| None new | This plan only changes React prop wiring on already-rendered client components (Button `nativeButton` prop, Select `value`/`onValueChange` props). No new endpoint, input path, package, or trust boundary is introduced. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-Q260704-01 | N/A | Button/Select prop changes | low | accept | Pure client-side rendering/console-hygiene fix with no change to data flow, validation, or authorization — accepted as no new attack surface is created. |

</threat_model>

<verification>
- `npx tsc --noEmit` exits 0.
- `npm test` (full suite) exits 0.
- Manual dev-server console check performed (or explicitly skipped with reason) and recorded in SUMMARY.md.
</verification>

<success_criteria>
Every Button whose own render prop wraps a Link carries `nativeButton={false}`; every RHF-bound Select across the app is fully controlled with an explicit `value` alongside its existing `onValueChange`; the two console warnings reported from Phase 4 UAT no longer appear; no test or typecheck regression.
</success_criteria>

<output>
Create `.planning/quick/260704-qxm-fix-base-ui-console-warnings-in-phase-4-/260704-qxm-SUMMARY.md` when done
</output>
