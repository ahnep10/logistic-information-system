---
phase: 02-catalog
plan: 02
subsystem: catalog
tags: [zod, validation, severity, shadcn, tests]
status: complete
completed: "2026-06-30"
depends_on:
  requires: []
  provides:
    - lib/utils/severity.ts (getSeverityBadge)
    - lib/validations/category.ts
    - lib/validations/product.ts
    - lib/validations/supplier.ts
    - components/ui/textarea.tsx
    - components/ui/tabs.tsx
    - tests/catalog.test.ts
  affects:
    - "02-03 (imports createCategorySchema, updateCategorySchema)"
    - "02-04 (imports createProductSchema, updateProductSchema, getSeverityBadge)"
    - "02-05 (imports createSupplierSchema, updateSupplierSchema; uses textarea + tabs)"
tech_stack:
  added:
    - "shadcn textarea component"
    - "shadcn tabs component"
  patterns:
    - "z.coerce.number() for FormData numeric fields"
    - "getSeverityBadge pure function — no React dependency"
key_files:
  created:
    - lib/utils/severity.ts
    - lib/validations/category.ts
    - lib/validations/product.ts
    - lib/validations/supplier.ts
    - components/ui/textarea.tsx
    - components/ui/tabs.tsx
    - tests/catalog.test.ts
  modified: []
decisions:
  - "z.coerce.number().int().min(0) used for reorderThreshold — handles FormData string-to-number per Pitfall 3"
  - "currentStock intentionally absent from createProductSchema and updateProductSchema per D-04/D-05"
  - "getSeverityBadge uses currentStock===0 guard first so zero stock is always Critical even when threshold is 0"
metrics:
  duration: "8m"
  tasks_completed: 2
  files_created: 7
  files_modified: 0
---

# Phase 02 Plan 02: Shared Utilities + Zod Schemas + Test Scaffold Summary

**One-liner:** Severity badge utility, three Zod validation schemas (category/product/supplier), two shadcn components (textarea/tabs), and 12 passing unit tests with 5 integration stubs.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install shadcn components + severity helper + Zod schemas | 8ee99d2 | textarea.tsx, tabs.tsx, severity.ts, category.ts, product.ts, supplier.ts |
| 2 | Create tests/catalog.test.ts with unit tests + stubs | 2c35e39 | tests/catalog.test.ts |

## What Was Built

### Severity Tier Utility (`lib/utils/severity.ts`)

Exports `getSeverityBadge(currentStock, reorderThreshold)` implementing D-06 three-tier logic:
- `currentStock === 0` → Critical (red badge)
- `0 < currentStock <= reorderThreshold` → Warning (amber badge)
- `currentStock > reorderThreshold` → OK (green badge)

Also exports `SeverityTier` type and `SeverityBadgeProps` interface. Pure TypeScript — no React or Prisma imports.

### Zod Schemas

| File | Exports | Notable |
|------|---------|---------|
| `lib/validations/category.ts` | createCategorySchema, updateCategorySchema, CreateCategoryInput, UpdateCategoryInput | name: min(1) + max(100) + trim() |
| `lib/validations/product.ts` | createProductSchema, updateProductSchema, CreateProductInput, UpdateProductInput | reorderThreshold uses z.coerce.number(); NO currentStock |
| `lib/validations/supplier.ts` | createSupplierSchema, updateSupplierSchema, CreateSupplierInput, UpdateSupplierInput | 5 required fields; email uses z.string().email() |

### shadcn Components

`textarea.tsx` and `tabs.tsx` installed via `npx shadcn@latest add textarea tabs` — shadcn-managed, not hand-rolled.

### Test Scaffold (`tests/catalog.test.ts`)

12 passing unit tests across 4 describe blocks + 5 `it.todo` integration stubs:
- Severity: 5 tests (Critical/Warning/OK boundaries, equal-to-threshold, zero-stock)
- Product schema: 4 tests (empty SKU, negative threshold, valid input, string coercion)
- Supplier schema: 2 tests (invalid email, valid input)
- Category schema: 1 test (empty name)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. All files are pure TypeScript utilities and test scaffolding.

Threat mitigations verified:
- T-02-02-01: `currentStock` absent from both createProductSchema and updateProductSchema
- T-02-02-02: Components from official shadcn registry only
- T-02-02-03: `z.coerce.number().int().min(0)` rejects negative values; unit test verifies coerce behavior

## Self-Check: PASSED

- `lib/utils/severity.ts` — EXISTS
- `lib/validations/category.ts` — EXISTS
- `lib/validations/product.ts` — EXISTS
- `lib/validations/supplier.ts` — EXISTS
- `components/ui/textarea.tsx` — EXISTS
- `components/ui/tabs.tsx` — EXISTS
- `tests/catalog.test.ts` — EXISTS
- Commit 8ee99d2 — FOUND (Task 1)
- Commit 2c35e39 — FOUND (Task 2)
- npm test: 12 passed | 5 todo — PASSED
