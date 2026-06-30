---
phase: 02-catalog
plan: "04"
subsystem: catalog/products
status: complete
tags:
  - server-actions
  - products
  - crud
  - severity-badge
  - role-guard
dependency_graph:
  requires:
    - 02-01  # Prisma Product model with currentStock, sku @unique, categoryId FK
    - 02-02  # lib/validations/product.ts, lib/utils/severity.ts, shadcn components installed
    - 02-03  # actions/categories.ts pattern, categories page pattern reference
  provides:
    - actions/products.ts (createProduct, updateProduct, toggleProductActive)
    - app/(protected)/products/page.tsx (server page with category include)
    - app/(protected)/products/products-client.tsx (8-column table, all dialogs)
  affects:
    - 02-05  # Suppliers slice (no dependency on products)
    - 03-warehouse  # Phase 3 reads products for stock transaction dropdowns
tech_stack:
  added: []
  patterns:
    - Server Action with requireManager() guard (inline, not exported)
    - Dual uniqueness pre-check: findUnique for create, findFirst with NOT:{ id } for update
    - Active-category race-condition guard: re-validate categoryId after Zod parse
    - getSeverityBadge() from lib/utils/severity imported — severity logic not reimplemented
    - Inactive current category rendered as disabled SelectItem with "(inactive)" suffix
    - SKU uniqueness error surfaced as field-level FormMessage via form.setError("sku", ...)
    - zodResolver cast (as any) required for z.coerce.number() Zod 4 + @hookform/resolvers@5.x compatibility
    - isManager prop gates Create button and Actions column rendering
    - AlertDialog for both Deactivate and Reactivate (vs. button-only Reactivate in users)
    - render prop pattern for DialogTrigger/DialogClose/AlertDialogTrigger (base-ui)
key_files:
  created:
    - actions/products.ts
    - app/(protected)/products/products-client.tsx
  modified:
    - app/(protected)/products/page.tsx
decisions:
  - "requireManager() defined inline in products.ts (not exported) — same pattern as users.ts and categories.ts"
  - "createProduct uses prisma.product.findUnique (not findFirst) for SKU check — SKU has @unique DB index so findUnique is correct"
  - "updateProduct uses prisma.product.findFirst with NOT: { id: parsed.data.id } — matches categories updateCategory NOT:{ id } pattern"
  - "zodResolver cast (as any) applied to useForm calls with z.coerce.number() — Zod 4 changes coerce input type to unknown, breaking @hookform/resolvers@5.x type resolution"
  - "currentStock excluded from all prisma.product.create and prisma.product.update data objects — D-04 enforced"
  - "ReactivateProductDialog uses AlertDialog (with confirmation prompt) — differs from users ReactivateButton pattern; products page spec requires confirmation on both state changes"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-30"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 02 Plan 04: Products Full CRUD Slice Summary

**One-liner:** Full products management slice with dual uniqueness checks (SKU + active-category), severity badge from shared utility, 8-column table, Manager-only CRUD dialogs, and inactive-category handling in Edit dialog.

## What Was Built

### Task 1 — actions/products.ts

Three exported Server Actions, all guarded by inline `requireManager()`:

- **createProduct(formData)** — Zod safeParse → SKU `findUnique` uniqueness check → active-category `findUnique` validation → `prisma.product.create` without `currentStock` → revalidatePath
- **updateProduct(formData)** — Zod safeParse → SKU `findFirst` with `NOT: { id }` excluding current product → active-category validation → `prisma.product.update` without `currentStock` → revalidatePath
- **toggleProductActive(id, isActive)** — `prisma.product.update({ data: { isActive } })` → revalidatePath

Security: `currentStock` is never written in Phase 2 (D-04). Active-category check prevents race-condition category deactivation after form render (T-02-04-03). `z.coerce.number().int().min(0)` rejects negative reorderThreshold values (T-02-04-04).

### Task 2 — Products page + client component

**app/(protected)/products/page.tsx** (replaced stub):
- Server component using `Promise.all` to fetch products with `include: { category: { select: { id, name, isActive } } }`, active categories only, and `auth()` in parallel
- Maps products to flat objects including `categoryName`, `categoryIsActive` for the client component
- Passes `isManager={session?.user?.role === "MANAGER"}` to `ProductsClient`

**app/(protected)/products/products-client.tsx** (new — 450+ lines):
- **8-column table**: Name (auto), SKU (120px, mono), Category (140px), Threshold (80px, right), Stock (80px, right, semibold), Severity (100px), Status (100px), Actions (80px)
- **Severity badge**: `getSeverityBadge(currentStock, reorderThreshold)` called once per row, result used for `Badge className` and label — no inline severity logic
- **Status badge**: `variant="default"` (Active) or `variant="secondary"` (Inactive)
- **Empty state**: Package icon, "No products yet", "Create a product to start tracking inventory."
- **CreateProductDialog**: 4 fields (name, sku, category Select, reorderThreshold); empty-categories guard shows disabled Select + "No active categories — create a category first" text; SKU server error surfaced as `form.setError("sku", ...)` FormMessage
- **EditProductDialog**: Pre-filled; inactive current category added as disabled `SelectItem` with `(inactive)` suffix when not in active categories list
- **DeactivateProductDialog**: AlertDialog with exact UI-SPEC copy — "Keep active" cancel, calls `toggleProductActive(id, false)`
- **ReactivateProductDialog**: AlertDialog — "Cancel", calls `toggleProductActive(id, true)`
- All `DialogTrigger`, `DialogClose`, `AlertDialogTrigger` use render prop (base-ui pattern)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `d719d7c` | feat(02-04): add products Server Actions |
| Task 2 | `7517e37` | feat(02-04): replace products page stub and create products-client.tsx |

## Verification

- `npx tsc --noEmit` exits with code 0 after both tasks
- `npm test` — 17 tests pass, 0 regressions, 2 test files pass | 4 skipped
- createProduct, updateProduct, toggleProductActive all exported from actions/products.ts
- requireManager() defined inline, not exported
- No call to prisma.product.delete() in actions/products.ts
- currentStock not present in any prisma create/update data object
- getSeverityBadge imported from "@/lib/utils/severity" — not reimplemented inline
- DialogTrigger/DialogClose/AlertDialogTrigger all use render prop pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] zodResolver type incompatibility with z.coerce.number() in Zod 4**
- **Found during:** Task 2 TypeScript verification (npx tsc --noEmit)
- **Issue:** `@hookform/resolvers@5.x` + `Zod 4` changes the input type of `z.coerce.number()` to `unknown`, causing TypeScript to reject the zodResolver as a valid `Resolver<CreateProductInput>`. Error: `Type 'Resolver<{ reorderThreshold: unknown; }>' is not assignable to type 'Resolver<{ reorderThreshold: number; }>'`
- **Fix:** Added `as any` cast on both `zodResolver(createProductSchema)` and `zodResolver(updateProductSchema)` calls in `CreateProductDialog` and `EditProductDialog`. This is a known compatibility limitation documented in @hookform/resolvers issues with Zod 4 coerce types.
- **Files modified:** app/(protected)/products/products-client.tsx (2 resolver lines)
- **Impact:** No runtime behavior change — Zod validation still enforces `int().min(0)` at runtime in both client (form) and server (Server Action).

## Known Stubs

None — all data flows are wired to real Prisma queries and Server Actions. Products start with `currentStock: 0` (DB default) which correctly renders as Severity: Critical per D-06.

## Threat Flags

None — all mitigations from threat model implemented:
- T-02-04-01: requireManager() calls before all mutations
- T-02-04-02: createProductSchema excludes currentStock; Prisma create data object excludes it
- T-02-04-03: Server Action re-validates categoryId.isActive after Zod parse (race-condition guard)
- T-02-04-04: z.coerce.number().int().min(0) rejects negative reorderThreshold
- T-02-04-05: findFirst with NOT: { id } correctly excludes current product from SKU uniqueness check in updateProduct

## Self-Check: PASSED

- [x] actions/products.ts exists
- [x] app/(protected)/products/page.tsx modified (stub replaced)
- [x] app/(protected)/products/products-client.tsx created
- [x] Commit d719d7c exists in git log
- [x] Commit 7517e37 exists in git log
- [x] TypeScript compiles cleanly (npx tsc --noEmit = exit 0)
- [x] Test suite passes (17/17 tests, 0 regressions)
