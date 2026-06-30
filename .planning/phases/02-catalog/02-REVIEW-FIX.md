---
phase: 02-catalog
fixed_at: 2026-06-30T00:00:00Z
review_path: .planning/phases/02-catalog/02-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 8
skipped: 1
status: partial
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-06-30T00:00:00Z
**Source review:** .planning/phases/02-catalog/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (CR-01 pre-fixed, CR-02, CR-03, WR-01 through WR-06)
- Fixed: 8
- Skipped: 1 (CR-01 already fixed before this run)

## Fixed Issues

### CR-02: Zod `.trim()` placed after `.min(1)` — whitespace-only values pass validation

**Files modified:** `lib/validations/category.ts`, `lib/validations/product.ts`
**Commit:** 079fbfb
**Applied fix:** Moved `.trim()` before `.min(1)` in both `createCategorySchema` and `updateCategorySchema` (category.ts) and in both product schemas for `sku`. Also added `.trim()` to `product.name` in both product schemas (WR-06 bundled here).

---

### CR-03: All Prisma calls lack `try/catch` — unhandled exceptions break client error contract

**Files modified:** `actions/categories.ts`, `actions/products.ts`, `actions/suppliers.ts`
**Commit:** 2612ce9
**Applied fix:** Wrapped every Prisma mutation (`create`, `update`) in `try/catch`. P2002 (unique constraint) returns a structured `{ error }` message; P2025 (record not found) returns a not-found message; all other errors return a generic retry message. Also bundled WR-01 fix (see below).

---

### WR-01: `requireManager()` throws instead of returning `{ error }` — auth failures produce unhandled rejections

**Files modified:** `actions/categories.ts`, `actions/products.ts`, `actions/suppliers.ts`
**Commit:** 2612ce9 (bundled with CR-03)
**Applied fix:** Changed `requireManager()` return type to `Promise<{ error: string } | null>`. Returns `{ error: "Unauthorized" }` instead of throwing. Each exported action checks `const authError = await requireManager(); if (authError) return authError` before proceeding.

---

### WR-02: Toggle `onClick` handlers have no error handling or loading state

**Files modified:** `app/(protected)/categories/categories-client.tsx`, `app/(protected)/products/products-client.tsx`, `app/(protected)/suppliers/suppliers-client.tsx`
**Commit:** 56d66f3
**Applied fix:** All six toggle dialogs (Deactivate/Reactivate for each entity) now have `pending` and `toggleError` state. Each handler sets `pending(true)`, calls the Server Action in a `try/catch`, surfaces `result?.error` or a generic error string via an inline `<p className="text-sm text-destructive">` in the dialog body, and resets pending in `finally`. The confirm button is `disabled={pending}` and shows a `Loader2` spinner while in-flight.

---

### WR-03: Update schemas accept empty string `id` — triggers unhandled Prisma P2025

**Files modified:** `lib/validations/category.ts`, `lib/validations/product.ts`, `lib/validations/supplier.ts`
**Commit:** 079fbfb (bundled with CR-02)
**Applied fix:** Changed `id: z.string()` to `id: z.string().min(1, "ID is required")` in `updateCategorySchema`, `updateProductSchema`, and `updateSupplierSchema`. An empty or missing `id` now fails Zod validation before reaching Prisma.

---

### WR-04: Products table "Actions" column header always rendered regardless of `isManager`

**Files modified:** `app/(protected)/products/products-client.tsx`
**Commit:** 56d66f3
**Applied fix:** Wrapped `<TableHead style={{ width: 80 }}>Actions</TableHead>` in `{isManager && (...)}`. Updated the empty-state row `colSpan` from the hard-coded `8` to `{isManager ? 8 : 7}` so column count stays consistent.

---

### WR-05: `as any` cast on `zodResolver` suppresses type checking in product forms

**Files modified:** `app/(protected)/products/products-client.tsx`, `lib/validations/product.ts`
**Commit:** 56d66f3 (client) + 079fbfb (schema)
**Applied fix:** Changed `z.coerce.number()` to `z.preprocess((v) => ..., z.number().int().min(0, ...))` in both `createProductSchema` and `updateProductSchema`. `z.preprocess` sets the input type to `unknown`, which satisfies the RHF `Resolver` generic without a cast. Removed both `as any` casts (and their eslint-disable comments) from `CreateProductDialog` and `EditProductDialog`.

---

### WR-06: `product.name` has no maximum length constraint

**Files modified:** `lib/validations/product.ts`
**Commit:** 079fbfb (bundled with CR-02)
**Applied fix:** Added `.max(200)` to `name` in both `createProductSchema` and `updateProductSchema`. Also added `.trim()` before `.min(1)` on `name` for consistency with the CR-02 fix pattern.

---

## Skipped Issues

### CR-01: `"use client"` directive on async Server Component pages

**File:** `app/(protected)/categories/page.tsx`, `app/(protected)/products/page.tsx`, `app/(protected)/suppliers/page.tsx`
**Reason:** Already fixed before this run. Commit `5b04efc` on branch `main` removed the `"use client"` directives from all three page files prior to this fix agent being invoked.

---

_Fixed: 2026-06-30T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
