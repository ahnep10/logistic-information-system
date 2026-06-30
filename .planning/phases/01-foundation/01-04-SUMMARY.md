---
phase: "01"
plan: "04"
subsystem: auth/user-management
status: complete
tags: [user-management, server-actions, validation, rbac, profile]
completed_date: "2026-06-30"
duration: "~25m"

requires:
  - "01-02"
  - "01-03"
provides:
  - "lib/validations/user.ts"
  - "actions/users.ts"
  - "app/(protected)/users/page.tsx"
  - "app/(protected)/profile/page.tsx"
affects:
  - "AUTH-03"

tech_stack:
  added: []
  patterns:
    - "TDD RED/GREEN for schema validation (validations.test.ts stub upgraded)"
    - "base-ui render prop instead of Radix asChild for Dialog/AlertDialog triggers"
    - "Server Component + Client Component split for pages with server-fetched data and client dialogs"

key_files:
  created:
    - lib/validations/user.ts
    - actions/users.ts
    - app/(protected)/users/page.tsx
    - app/(protected)/users/users-client.tsx
    - app/(protected)/profile/page.tsx
    - app/(protected)/profile/change-password-form.tsx
  modified:
    - tests/validations.test.ts
    - vitest.config.ts

decisions:
  - "Split users page into server page.tsx (data fetch) + client users-client.tsx (dialogs) — base-ui components require client context"
  - "vitest.config.ts: added resolve.alias @/* -> project root so test imports work with path alias"
  - "base-ui uses render prop not asChild — replaced all DialogTrigger/DialogClose/AlertDialogTrigger asChild usage"
  - "profile/change-password-form.tsx inline in profile dir alongside page.tsx for colocation"
---

# Phase 01 Plan 04: User Management + Profile Summary

User CRUD page for Managers, self-service password change for all users. Implements AUTH-03 with double-layer RBAC (middleware outer gate + requireManager() inner gate), bcryptjs cost factor 12, and Zod schema validation.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | User Validation Schemas + Server Actions | 42c3015 | lib/validations/user.ts, actions/users.ts, tests/validations.test.ts, vitest.config.ts |
| 2 | User Management Page | 4b18352 | app/(protected)/users/page.tsx, users-client.tsx |
| 3 | Profile / Password Change Page | 7bd5680 | app/(protected)/profile/page.tsx, change-password-form.tsx |

## What Was Built

**lib/validations/user.ts** — Three Zod schemas: `createUserSchema` (name/email/role enum/password), `editUserSchema` (id + optional newPassword), `changePasswordSchema` with `.refine()` cross-field check writing error to path `["confirmPassword"]`.

**actions/users.ts** — Four Server Actions with "use server" first line: `createUser` (requireManager + email uniqueness + bcrypt cost 12), `updateUser` (requireManager + optional password reset), `toggleUserActive` (requireManager + revalidatePath), `changeOwnPassword` (any authenticated user + bcryptjs.compare verification).

**app/(protected)/users/** — Server component fetches users + session; client component renders shadcn Table with 5 columns, CreateUserDialog, EditUserDialog (with optional password reset), DeactivateAlertDialog (AlertDialog not Dialog for a11y), ReactivateButton. Own-account deactivate disabled.

**app/(protected)/profile/** — Server component reads session; ChangePasswordForm client component with zodResolver, field-level setError for server errors, 3-second success toast inline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest path alias missing**
- **Found during:** Task 1 TDD RED (test import failed)
- **Issue:** vitest.config.ts had no resolve.alias for `@/*` so `import { changePasswordSchema } from "@/lib/validations/user"` failed in tests
- **Fix:** Added `resolve: { alias: { "@": path.resolve(__dirname, ".") } }` to vitest.config.ts
- **Files modified:** vitest.config.ts
- **Commit:** 42c3015

**2. [Rule 1 - Bug] base-ui render prop vs asChild**
- **Found during:** Task 2 TypeScript check
- **Issue:** DialogTrigger, DialogClose, AlertDialogTrigger use `render` prop (base-ui pattern), not `asChild` (Radix pattern) — 5 TS errors
- **Fix:** Replaced all `<Component asChild><Button>` with `<Component render={<Button>}>`
- **Files modified:** app/(protected)/users/users-client.tsx
- **Commit:** 4b18352

## TDD Gate Compliance

- RED gate: `test(01-04)` — tests/validations.test.ts updated with 5 real assertions; import failed before lib/validations/user.ts existed (confirmed FAIL)
- GREEN gate: `feat(01-04)` — lib/validations/user.ts created; all 5 tests passed
- Plan uses feat commit type for combined schema + action commit; TDD cycle honored within Task 1

## Known Stubs

None — all pages render real data from Prisma. Profile page displays session user's name/email. Users page fetches from DB.

## Threat Surface Scan

No new network endpoints or trust boundaries beyond what the plan's threat model covers. All four Server Actions are server-only ("use server" directive). No new routes outside the protected layout.

## Self-Check

- [x] lib/validations/user.ts exists
- [x] actions/users.ts exists
- [x] app/(protected)/users/page.tsx exists
- [x] app/(protected)/profile/page.tsx exists
- [x] Commits 42c3015, 4b18352, 7bd5680 exist in git log
- [x] npx tsc --noEmit passes (0 errors)
- [x] npx vitest run tests/validations.test.ts — 5/5 passed

## Self-Check: PASSED
