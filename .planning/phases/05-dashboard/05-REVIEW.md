---
phase: 05-dashboard
reviewed: 2026-07-06T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - app/(protected)/dashboard/dashboard-client.tsx
  - app/(protected)/dashboard/page.tsx
  - app/(protected)/products/page.tsx
  - app/(protected)/products/products-client.tsx
  - app/(protected)/purchase-orders/page.tsx
  - app/(protected)/purchase-orders/purchase-orders-client.tsx
  - lib/utils/dashboard.ts
  - tests/dashboard.test.ts
  - tests/products.test.ts
  - tests/purchase-orders.test.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the Phase 05 dashboard/products/purchase-orders additions (`app/(protected)/dashboard/page.tsx` and its previously-stub siblings for products/purchase-orders were all fleshed out this phase, along with three brand-new client components and `lib/utils/dashboard.ts`). Server-side query construction (UTC day boundaries, groupBy zero-fill, the low-stock FieldRef filter, whitelist-based searchParams handling) is correct and well covered by `tests/dashboard.test.ts` and `tests/products.test.ts`. No SQL/command injection, hardcoded secrets, or auth-bypass issues were found — mutation actions (`createProduct`, `updateProduct`, `toggleProductActive`) are gated server-side by `requireManager()` independent of the client-side `isManager` conditional rendering, and `/dashboard` is a manager-only route enforced in `middleware.ts`.

The issues found are all in the client components, which have zero test coverage in this phase (only server Page functions and pure helpers are tested): a form-submission error-handling gap, a React state/URL desync bug in the purchase-orders filter tabs, a locale-date-formatting hydration risk, and a couple of naming/DRY quality issues. None are security-critical, but the state-desync and hydration-mismatch findings are genuine, reproducible logic bugs and are classified as Warnings.

## Warnings

### WR-01: Unhandled promise rejection in Create/Edit Product dialogs — no user feedback on unexpected server-action failure

**File:** `app/(protected)/products/products-client.tsx:248-266` (Create) and `app/(protected)/products/products-client.tsx:422-440` (Edit)
**Issue:** `onSubmit` in both `CreateProductDialog` and `EditProductDialog` calls `await createProduct(fd)` / `await updateProduct(fd)` with no `try/catch`. `createProduct`/`updateProduct` (in `actions/products.ts`) only catch Prisma errors around the final `create`/`update` call — the preceding `prisma.product.findUnique` (SKU check) and `prisma.category.findUnique` (category check) are **not** wrapped in try/catch, so a transient DB error there throws uncaught out of the action. In these two dialogs that becomes an unhandled promise rejection: the dialog is left open with no `serverError` message and the user has no idea the submission failed. Contrast with `DeactivateProductDialog`/`ReactivateProductDialog` in the same file, which correctly wrap their action calls in `try/catch/finally` and surface a friendly `toggleError` message (lines 570-583, 628-641) — this is an inconsistent pattern within the same file.
**Fix:**
```tsx
async function onSubmit(values: CreateProductInput) {
  setServerError(null)
  try {
    const fd = new FormData()
    fd.append("name", values.name)
    fd.append("sku", values.sku)
    fd.append("categoryId", values.categoryId)
    fd.append("reorderThreshold", String(values.reorderThreshold))
    const result = await createProduct(fd)
    if (result && "error" in result && result.error) {
      if (result.error === "SKU already exists.") {
        form.setError("sku", { message: "SKU already exists" })
      } else {
        setServerError(result.error)
      }
      return
    }
    form.reset()
    setOpen(false)
  } catch {
    setServerError("Failed to create product. Please try again.")
  }
}
```
Apply the same wrapping to `EditProductDialog.onSubmit`.

### WR-02: Purchase-order filter tab state can desync from the URL (stale derived state)

**File:** `app/(protected)/purchase-orders/purchase-orders-client.tsx:47`
**Issue:** `const [filter, setFilter] = useState<FilterTab>(initialFilter ?? "all")` only consumes `initialFilter` on the component's first mount. If the same route re-renders with new `searchParams` without a full remount of `PurchaseOrdersClient` — which Next.js App Router does when only the query string changes while the pathname stays `/purchase-orders` (e.g. browser back/forward between `?status=DRAFT` and `?status=ORDERED`, or a user editing the URL directly) — the Server Component re-runs and computes a new `initialFilter`, but the already-mounted Client Component's `useState` initializer is not re-evaluated, so the displayed tab silently disagrees with the URL. This is a classic "derived state initialized from props" bug: the current dashboard pie-chart navigation happens to always cross a different route first (`/dashboard` → `/purchase-orders`) so it isn't hit today, but it is a real, reproducible regression waiting for any future same-route deep link (e.g. a second entry point that links straight into `/purchase-orders?status=X` from within `/purchase-orders` itself).
**Fix:** Key the component (or an inner subtree) on the resolved filter so a prop change forces remount, or sync explicitly with an effect:
```tsx
useEffect(() => {
  setFilter(initialFilter ?? "all")
}, [initialFilter])
```

### WR-03: Locale date formatting without explicit `timeZone` risks SSR/client hydration mismatch

**File:** `app/(protected)/purchase-orders/purchase-orders-client.tsx:159-163`
**Issue:**
```tsx
{new Date(po.createdAt).toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})}
```
`PurchaseOrdersClient` is a `"use client"` component, but Next.js still server-renders it for the initial HTML payload before client hydration. `toLocaleDateString` without a `timeZone` option resolves the date in the **runtime's local timezone** — the Node.js server process's timezone (commonly UTC on Railway/most hosts) versus the end user's browser timezone (e.g. Asia/Jakarta, UTC+7, per the project's IDR/`id-ID` locale target audience). For any PO created within the timezone offset window of local midnight, the server-rendered date and the client-hydrated date will disagree (e.g. a PO created at `2026-07-06T23:00:00.000Z` renders as "Jul 6" on a UTC server but "Jul 7" once hydrated in UTC+7), producing either a visible flash/mismatch or a React hydration error in dev.
**Fix:** Pin an explicit timezone so server and client agree:
```tsx
{new Date(po.createdAt).toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC", // or the business's fixed operating timezone
})}
```

### WR-04: `zodResolver(...) as any` bypasses form/schema type-checking

**File:** `app/(protected)/products/products-client.tsx:244` and `:407`
**Issue:** Both `CreateProductDialog` and `EditProductDialog` cast the resolver with `as any`:
```tsx
const form = useForm<CreateProductInput>({
  resolver: zodResolver(createProductSchema) as any,
  ...
})
```
This silences whatever type mismatch made the cast necessary (likely a `@hookform/resolvers`/Zod version generic mismatch) and means future schema changes that break the form/schema contract will not be caught by the compiler.
**Fix:** Resolve the underlying generic mismatch (usually a `zodResolver<CreateProductInput>(...)` explicit type param, or aligning `@hookform/resolvers`/`zod` versions) instead of casting to `any`. If a workaround is unavoidable short-term, narrow the cast (e.g. `as Resolver<CreateProductInput>`) and leave a comment explaining why.

## Info

### IN-01: Misleading double-negative variable name `currentCategoryInActive`

**File:** `app/(protected)/products/products-client.tsx:418-420`
**Issue:**
```tsx
// Check if the product's current category is in the active categories list
const currentCategoryInActive = categories.find(
  (c) => c.id === product.categoryId
)
```
The variable is truthy when the category **is** found in the active list (i.e., the category is active), but the name reads as "current category is inactive." It's then used as `!currentCategoryInActive` at line 500 to mean "category is inactive" — logically correct today, but the naming inversion is a latent source of future sign-flip bugs for anyone editing this block.
**Fix:** Rename to something unambiguous, e.g. `isCurrentCategoryActive`, and drop the negation at the call site: `{!isCurrentCategoryActive && (...)}`.

### IN-02: `lowStockCount` prop carries the total (unfiltered) product count when not filtered

**File:** `app/(protected)/products/page.tsx:63`
**Issue:** `lowStockCount={products.length}` is passed unconditionally. When `isLowStockFiltered` is `false`, `products` is the full (unfiltered) product list, so `lowStockCount` actually holds the total product count, not a low-stock count. It happens to be harmless today because `ProductsClient` only renders `lowStockCount` inside the `isLowStockFiltered` banner (`products-client.tsx:109-127`), but the prop name over-promises what it contains and invites a future bug if someone reads it outside that guard.
**Fix:** Rename the prop to something scope-accurate (e.g. `resultCount`), or only compute/pass it when `isLowStockFiltered` is true (`lowStockCount={isLowStockFiltered ? products.length : undefined}`).

### IN-03: Duplicate low-stock `where` clause between dashboard and products pages

**File:** `app/(protected)/dashboard/page.tsx:13-18` and `app/(protected)/products/page.tsx:22-27`
**Issue:** The `{ isActive: true, currentStock: { lte: prisma.product.fields.reorderThreshold } }` filter is hand-duplicated in two places. Any future change to the low-stock definition (e.g. adding a buffer, or excluding a category) requires remembering to update both call sites.
**Fix:** Extract a shared helper, e.g. `lib/utils/dashboard.ts` or a new `lib/queries/products.ts`:
```ts
export const lowStockWhere = {
  isActive: true,
  currentStock: { lte: prisma.product.fields.reorderThreshold },
} satisfies Prisma.ProductWhereInput
```

### IN-04: No test coverage for the interactive client components introduced this phase

**File:** `app/(protected)/dashboard/dashboard-client.tsx`, `app/(protected)/products/products-client.tsx`, `app/(protected)/purchase-orders/purchase-orders-client.tsx`
**Issue:** `tests/dashboard.test.ts`, `tests/products.test.ts`, and `tests/purchase-orders.test.ts` all test Server Component page functions and pure `lib/utils` helpers, but none render or exercise the three new client components. WR-01 (unhandled rejection in form dialogs) and WR-02 (stale filter tab state) are exactly the class of bug that a component-level test (React Testing Library / `@testing-library/react`) would have caught.
**Fix:** Add component tests covering: (1) `CreateProductDialog`/`EditProductDialog` submit failure paths surface a visible error, and (2) `PurchaseOrdersClient` re-renders its selected tab when `initialFilter` prop changes.

---

_Reviewed: 2026-07-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
