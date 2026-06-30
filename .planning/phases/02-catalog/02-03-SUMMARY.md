---
phase: 02-catalog
plan: "03"
subsystem: catalog/categories
status: complete
tags:
  - server-actions
  - categories
  - crud
  - role-guard
dependency_graph:
  requires:
    - 02-01  # Prisma Category model with isActive field
    - 02-02  # lib/validations/category.ts, shadcn components installed
  provides:
    - actions/categories.ts (createCategory, updateCategory, toggleCategoryActive)
    - app/(protected)/categories/page.tsx (server page)
    - app/(protected)/categories/categories-client.tsx (client CRUD)
  affects:
    - 02-04  # Products page requires categories for FK dropdown
tech_stack:
  added: []
  patterns:
    - Server Action with requireManager() guard
    - Case-insensitive uniqueness pre-check via Prisma findFirst + mode insensitive
    - Soft-deactivate toggle (isActive flag, no hard delete)
    - Server page + client component split (dialogs require client context)
    - render prop pattern for DialogTrigger/DialogClose/AlertDialogTrigger (base-ui)
    - Promise.all for parallel Prisma + auth() fetch in server component
key_files:
  created:
    - actions/categories.ts
    - app/(protected)/categories/categories-client.tsx
  modified:
    - app/(protected)/categories/page.tsx
decisions:
  - "requireManager() defined inline in categories.ts (not imported) per Phase 1 pattern established in actions/users.ts"
  - "Uniqueness check uses prisma.category.findFirst with mode: 'insensitive' — matching Prisma StringFilter API; NOT findUnique which lacks mode support"
  - "updateCategory excludes current record via NOT: { id: parsed.data.id } in findFirst to allow saving same name"
  - "page.tsx retains 'use client' on line 1 to match users/page.tsx pattern (base-ui dialog hydration requirement)"
metrics:
  duration: "~12 minutes"
  completed: "2026-06-30"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 02 Plan 03: Categories Full CRUD Slice Summary

**One-liner:** Full categories management slice with Server Actions guarded by requireManager(), case-insensitive uniqueness, soft-deactivation, and Manager-only CRUD dialogs using base-ui render prop pattern.

## What Was Built

### Task 1 — actions/categories.ts

Three exported Server Actions:

- **createCategory(formData)** — validates with Zod, checks for duplicate name (case-insensitive), creates record, revalidates path
- **updateCategory(formData)** — validates with Zod, checks for duplicate name excluding current record, updates record, revalidates path
- **toggleCategoryActive(id, isActive)** — sets isActive flag (soft-deactivate or reactivate), revalidates path

All three call `requireManager()` before any Prisma operation. The `requireManager()` function is defined inline (non-exported) per the Phase 1 pattern from `actions/users.ts`.

### Task 2 — Categories page + client component

**app/(protected)/categories/page.tsx** (replaced stub):
- Server component using `Promise.all` to fetch `prisma.category.findMany` and `auth()` in parallel
- Passes `categories` array and `isManager` boolean to `CategoriesClient`

**app/(protected)/categories/categories-client.tsx** (new):
- Full CRUD table with 3 columns: Name, Status, Actions (conditional on `isManager`)
- `CreateCategoryDialog` — Dialog with Form, Zod validation, server error display
- `EditCategoryDialog` — pre-filled Dialog with id + name, same validation
- `DeactivateCategoryDialog` — AlertDialog with exact UI-SPEC copy
- `ReactivateCategoryDialog` — AlertDialog with exact UI-SPEC copy
- Empty state: Tag icon, "No categories yet", "Create a category to organize your products."
- All `DialogTrigger`, `DialogClose`, `AlertDialogTrigger` use render prop (not asChild) per [01-04] decision

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `992cfc8` | feat(02-03): add categories Server Actions |
| Task 2 | `c1b6a0e` | feat(02-03): replace categories page stub and create categories-client.tsx |

## Verification

- `npx tsc --noEmit` exits with code 0 after both tasks
- createCategory, updateCategory, toggleCategoryActive all exported from actions/categories.ts
- requireManager() defined inline, not exported
- No call to prisma.category.delete() anywhere in the file
- DialogTrigger/DialogClose/AlertDialogTrigger all use render prop pattern (confirmed in client component)
- isManager controls Create button and Actions column rendering

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are wired to real Prisma queries and Server Actions.

## Threat Flags

None — all mitigations from threat model implemented:
- T-02-03-01: requireManager() calls before all mutations
- T-02-03-02: Zod safeParse with z.object() discards unknown keys
- T-02-03-03: mode: 'insensitive' on findFirst for case-variation bypass prevention
- T-02-03-04: UI hides buttons for Staff (isManager prop); server-side requireManager() is the security layer

## Self-Check: PASSED

- [x] actions/categories.ts exists
- [x] app/(protected)/categories/page.tsx modified
- [x] app/(protected)/categories/categories-client.tsx created
- [x] Commit 992cfc8 exists in git log
- [x] Commit c1b6a0e exists in git log
- [x] TypeScript compiles cleanly
