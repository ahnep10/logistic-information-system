---
phase: 02-catalog
reviewed: 2026-06-30T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - actions/categories.ts
  - actions/products.ts
  - actions/suppliers.ts
  - app/(protected)/categories/categories-client.tsx
  - app/(protected)/categories/page.tsx
  - app/(protected)/products/page.tsx
  - app/(protected)/products/products-client.tsx
  - app/(protected)/suppliers/page.tsx
  - app/(protected)/suppliers/suppliers-client.tsx
  - components/ui/tabs.tsx
  - components/ui/textarea.tsx
  - lib/utils/severity.ts
  - lib/validations/category.ts
  - lib/validations/product.ts
  - lib/validations/supplier.ts
  - prisma/schema.prisma
  - tests/catalog.test.ts
findings:
  critical: 3
  warning: 6
  info: 2
  total: 11
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This phase delivered the catalog module — Category, Product, and Supplier CRUD with role-based access via Server Actions. The architecture is sound (server-component pages, client-component dialogs, Zod schemas shared between client and server), but three blockers prevent the code from working correctly:

1. All three page files carry a `"use client"` directive while being async Server Components that import Prisma. This is a build-breaking contradiction.
2. Zod's `.trim()` is chained after `.min(1)`, meaning whitespace-only inputs pass validation and produce empty strings that are written to the database.
3. No Prisma calls are wrapped in `try/catch`. A race condition on the unique-name check or any transient DB error throws an unhandled exception that the client-side `result?.error` pattern will never catch — the action rejects instead of returning `{ error }`.

Six warnings cover auth-failure error propagation, silent toggle failures, schema gaps, and a UI display inconsistency. Two info items cover test coverage gaps.

---

## Critical Issues

### CR-01: `"use client"` directive on async Server Component pages — build failure

**Files:**
- `app/(protected)/categories/page.tsx:1`
- `app/(protected)/products/page.tsx:1`
- `app/(protected)/suppliers/page.tsx:1`

**Issue:** All three page files begin with `"use client"` but are implemented as async Server Components that import `prisma` and `auth`. In Next.js App Router, `"use client"` converts a file into a Client Component boundary. Client Components cannot be `async` functions, cannot import Prisma (which uses Node.js-only native modules that fail to bundle for the browser), and cannot import `auth` from `lib/auth.ts` (which imports `bcryptjs`). The comment inside each file even states the intent: "server component fetching data". The directive contradicts the entire implementation and causes a hard build failure.

**Fix:** Remove the `"use client"` line from all three page files. Pages in `app/` are Server Components by default — no directive is needed.

```diff
- "use client"
-
 // This file combines a server-fetched data layer with client-side dialogs.
```

---

### CR-02: Zod `.trim()` placed after `.min(1)` — whitespace-only values pass validation and write empty strings to the DB

**Files:**
- `lib/validations/category.ts:4`
- `lib/validations/product.ts:7`

**Issue:** In Zod, validators and transforms are applied in declaration order. `.min(1).max(100).trim()` checks the length of the raw input and then trims. The trimmed output is never re-validated. A value like `"   "` (three spaces) passes `.min(1)` (length 3), passes `.max(100)`, and is then trimmed to `""`. The caller receives `parsed.data.name === ""`, which is then written to the database as an empty string. On categories, the DB has `name String @unique`, so `""` would be silently stored on the first such submission and then cause a P2002 on subsequent ones.

**Fix:** Move `.trim()` before the length checks so validation fires on the cleaned value.

```typescript
// lib/validations/category.ts
name: z.string().trim().min(1, "Category name is required.").max(100),

// lib/validations/product.ts
sku: z.string().trim().min(1, "SKU is required.").max(50),
```

---

### CR-03: All Prisma calls lack `try/catch` — unhandled exceptions break the client error-handling contract

**Files:**
- `actions/categories.ts:28-40` (createCategory), `actions/categories.ts:54-70` (updateCategory), `actions/categories.ts:76-83` (toggleCategoryActive)
- `actions/products.ts:32-58` (createProduct), `actions/products.ts:76-103` (updateProduct), `actions/products.ts:107-116` (toggleProductActive)
- `actions/suppliers.ts:32-43` (createSupplier), `actions/suppliers.ts:61-73` (updateSupplier), `actions/suppliers.ts:79-86` (toggleSupplierActive)

**Issue:** No Server Action wraps Prisma calls in `try/catch`. Two concrete failure paths exist today:

**Path A — Race condition on uniqueness check (TOCTOU).** `createCategory` runs a `findFirst` uniqueness check and then `create`. Two concurrent requests from the same manager can both pass the `findFirst` check. The second `create` hits the DB `@unique` constraint and throws a Prisma `P2002` error. This propagates as an unhandled exception from the Server Action — the action rejects instead of returning `{ error: "Category name already exists." }`. The client code (`if (result?.error) { setServerError(...) }`) never executes because `result` is never set; the `await createCategory(fd)` call throws. The same race exists for product SKU in `createProduct`.

**Path B — Update/toggle on a missing record.** `toggleCategoryActive`, `toggleProductActive`, and `toggleSupplierActive` call `prisma.*.update` with a caller-supplied `id` and no existence check. A stale client, a race with a concurrent delete, or a crafted request with a bogus ID causes Prisma P2025, which again propagates as an unhandled exception.

**Fix:** Wrap all Prisma mutation calls in `try/catch` and convert known error codes to structured responses.

```typescript
// Example for createCategory
try {
  await prisma.category.create({ data: { name: parsed.data.name } })
} catch (err: unknown) {
  // P2002: unique constraint violation — race condition on concurrent create
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    return { error: "Category name already exists." }
  }
  return { error: "Failed to create category. Please try again." }
}

// Example for toggleCategoryActive
try {
  await prisma.category.update({ where: { id }, data: { isActive } })
} catch {
  return { error: "Failed to update category." }
}
```

---

## Warnings

### WR-01: `requireManager()` throws instead of returning `{ error }` — auth failures produce unhandled client-side rejections

**Files:**
- `actions/categories.ts:10-16`
- `actions/products.ts:10-16`
- `actions/suppliers.ts:10-16`

**Issue:** When `requireManager()` throws, the Server Action rejects its returned promise. The client-side submit handlers (`categories-client.tsx:157`, `products-client.tsx:217`, `suppliers-client.tsx:206`) all use the pattern `const result = await action(fd)` with no surrounding `try/catch`. React Hook Form's `handleSubmit` does not catch rejections from the `onSubmit` callback. The result is an unhandled promise rejection in the browser — no error message shown to the user, no loading state reset, and a potentially stuck form.

**Fix:** Return a structured error from `requireManager()` rather than throwing, or add `try/catch` in each client `onSubmit`.

```typescript
// Option A: change requireManager to return { error } and propagate
async function requireManager(): Promise<{ error: string } | null> {
  const session = await auth()
  if (session?.user?.role !== "MANAGER") {
    return { error: "Unauthorized" }
  }
  return null
}

export async function createCategory(formData: FormData) {
  const authError = await requireManager()
  if (authError) return authError
  // ...
}
```

---

### WR-02: Toggle `onClick` handlers have no error handling or loading state — failures are silent

**Files:**
- `app/(protected)/categories/categories-client.tsx:318-320` (DeactivateCategoryDialog)
- `app/(protected)/categories/categories-client.tsx:356-358` (ReactivateCategoryDialog)
- `app/(protected)/products/products-client.tsx:554-556` (DeactivateProductDialog)
- `app/(protected)/products/products-client.tsx:592-594` (ReactivateProductDialog)
- `app/(protected)/suppliers/suppliers-client.tsx:477-479` (DeactivateSupplierDialog)
- `app/(protected)/suppliers/suppliers-client.tsx:511-513` (ReactivateSupplierDialog)

**Issue:** All toggle dialogs call the Server Action in `onClick` with no `try/catch`, no pending state, and no error display. If the action fails (DB error, auth failure per WR-01, or the action throws per CR-03), the `AlertDialogAction` closes anyway (default behavior), the user sees no feedback, and the table still shows the old status until the next navigation or refresh.

**Fix:** Add a pending state and error handler to each toggle dialog.

```typescript
function DeactivateCategoryDialog({ category }: { category: Category }) {
  const [pending, setPending] = useState(false)

  async function handleDeactivate() {
    setPending(true)
    try {
      const result = await toggleCategoryActive(category.id, false)
      if (result?.error) {
        // surface error to user
      }
    } catch {
      // surface generic error
    } finally {
      setPending(false)
    }
  }
  // ...
}
```

---

### WR-03: Update schemas accept empty string `id` — triggers unhandled Prisma P2025

**Files:**
- `lib/validations/category.ts:7` — `id: z.string()`
- `lib/validations/product.ts:13` — `id: z.string()`
- `lib/validations/supplier.ts:12` — `id: z.string()`

**Issue:** `z.string()` accepts an empty string. If `formData.get("id")` returns `""` (tampered request, empty hidden field, or a React form state race), Zod validation succeeds, and Prisma attempts `update({ where: { id: "" } })`, which throws P2025 (record not found). Combined with CR-03's missing try/catch, this produces an unhandled exception.

**Fix:**

```typescript
id: z.string().min(1, "ID is required"),
```

---

### WR-04: Products table "Actions" column header always rendered regardless of `isManager`

**File:** `app/(protected)/products/products-client.tsx:119`

**Issue:** The "Actions" table header is rendered unconditionally:
```tsx
<TableHead style={{ width: 80 }}>Actions</TableHead>
```
But the cell content is gated: `{isManager && <div>...</div>}`. Non-manager users see an empty "Actions" column. This is inconsistent with the Categories table which correctly wraps the header in `{isManager && (...)}` (categories-client.tsx:89-91).

**Fix:**

```tsx
{isManager && (
  <TableHead style={{ width: 80 }}>Actions</TableHead>
)}
```

And also gate the `<TableCell>` (already done at line 172) so the column count stays consistent — bump `colSpan` from 8 to 7 in the empty-state row when `!isManager`.

---

### WR-05: `as any` cast on `zodResolver` suppresses type checking in product forms

**File:** `app/(protected)/products/products-client.tsx:206`, `products-client.tsx:370`

**Issue:**
```typescript
resolver: zodResolver(createProductSchema) as any,
```
The `as any` cast was applied twice (create and edit dialogs) to silence a TypeScript mismatch between the Zod-inferred type and React Hook Form's `Resolver` type. The underlying type mismatch is caused by `z.coerce.number()` in `createProductSchema` — the inferred input type accepts `string | number` while RHF expects the input type to match the field value type. Casting to `any` hides this discrepancy and could mask future type errors at the form/schema boundary.

**Fix:** Explicitly type the form inputs and use the correct resolver overload, or apply `z.preprocess` instead of `z.coerce` so the input type is `unknown` rather than `string | number`.

---

### WR-06: `product.name` has no maximum length constraint

**File:** `lib/validations/product.ts:6`

**Issue:** `name: z.string().min(1, "Product name is required.")` has no `.max()` bound. Every other string field in this phase has a maximum: category name is `.max(100)`, SKU is `.max(50)`. An arbitrarily long product name (e.g., 1 MB string) passes Zod validation and reaches the database. PostgreSQL stores it without complaint (TEXT column), but it produces oversized rows and breaks table display.

**Fix:**

```typescript
name: z.string().min(1, "Product name is required.").max(200),
```

---

## Info

### IN-01: All Server Action integration tests are `it.todo` — zero tests exist for action behaviour

**File:** `tests/catalog.test.ts:134-153`

**Issue:** Five integration-style tests for `createCategory`, `toggleCategoryActive`, `createProduct`, and `toggleProductActive` are `it.todo` stubs. None of the Server Action logic — uniqueness checks, category validation, auth guards — is covered by any executing test. The tests that do run cover only the Zod schema and utility function layers.

**Fix:** Implement the action tests by mocking `@/lib/prisma` and `@/lib/auth` (or use a test database). Priority candidates: the duplicate-name check for `createCategory` (CR-03 race path) and the inactive-category guard in `createProduct`.

---

### IN-02: `getSeverityBadge` does not handle negative `currentStock`

**File:** `lib/utils/severity.ts:15-21`

**Issue:** If Phase 3 stock transactions ever produce a negative `currentStock` (e.g., a negative adjustment bug), the function returns "Warning" (`currentStock <= reorderThreshold` is always true for negative values) rather than "Critical". Because Phase 3 is not yet implemented this is latent, but the function is described as shared between Phase 2 and Phase 3.

**Fix:** Add a guard before the zero check:

```typescript
if (currentStock <= 0) {
  return { label: "Critical", className: "..." }
}
```

This also simplifies the zero-stock case to a single branch.

---

_Reviewed: 2026-06-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
