---
phase: "01"
plan: "01B"
subsystem: app-shell
status: complete
tags:
  - next.js-15
  - auth.js-v5
  - middleware-rbac
  - shadcn-ui-v4
  - base-ui-react
  - jwt-session
dependency_graph:
  requires:
    - auth.config.ts (Edge-safe auth config — imported by middleware.ts)
    - lib/auth.ts (Full Auth.js instance for Server Actions and layouts)
    - lib/validations/auth.ts (loginSchema for login form validation)
    - components/ui/* (shadcn/ui v4 components from Plan 01-01A)
  provides:
    - middleware.ts (RBAC guard running on every request at Edge)
    - actions/auth.ts (login() and logout() Server Actions)
    - app/(auth)/login/page.tsx (login Card UI — unauthenticated entry point)
    - app/(protected)/layout.tsx (authenticated shell — reads session, renders Sidebar)
    - components/sidebar.tsx (role-conditional Server Component sidebar)
    - components/sidebar-nav-item.tsx (Client Component with usePathname active state)
    - app/(protected)/[8 routes]/page.tsx (stub pages for all domain routes)
  affects:
    - All phases that add content to protected routes (Phases 2–6)
    - All users navigating the app post-login
tech_stack:
  added:
    - Inter font via next/font/google (replaces Geist in app/layout.tsx)
  patterns:
    - Middleware RBAC with three-case logic (unauth redirect, login bypass, manager-only guard)
    - Server Action with "use server" directive, Zod pre-validation, {error} return on failure
    - Login form: RHF + zodResolver + Server Action call pattern
    - Role-conditional sidebar rendering (excluded from JSX, not hidden with CSS per D-07)
    - Client Component island (sidebar-nav-item.tsx) inside Server Component tree (sidebar.tsx)
key_files:
  created:
    - middleware.ts
    - actions/auth.ts
    - app/(auth)/login/page.tsx
    - app/(protected)/layout.tsx
    - components/sidebar.tsx
    - components/sidebar-nav-item.tsx
    - app/(protected)/dashboard/page.tsx
    - app/(protected)/inventory/page.tsx
    - app/(protected)/products/page.tsx
    - app/(protected)/categories/page.tsx
    - app/(protected)/suppliers/page.tsx
    - app/(protected)/stock/page.tsx
    - app/(protected)/purchase-orders/page.tsx
    - app/(protected)/reports/page.tsx
  modified:
    - app/layout.tsx (Inter font replacing Geist)
decisions:
  - "middleware.ts imports from ./auth.config (relative) not @/auth.config or @/lib/auth — Edge runtime safety"
  - "shadcn/ui v4 @base-ui/react DropdownMenu does not support asChild prop — used children pattern instead"
  - "Sidebar is a Server Component; SidebarNavItem is a Client Component island for usePathname()"
  - "Manager-only nav items excluded from JSX array using filter, not CSS display:none (D-07)"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-30"
  tasks_completed: 2
  tasks_total: 2
  files_created: 14
  files_modified: 1
---

# Phase 01 Plan 01B: App Shell Summary

**One-liner:** RBAC middleware at Edge (three-case guard), login Card UI with RHF+Zod, protected layout with role-conditional dark sidebar (MANAGER 9-item / STAFF 6-item), and 8 TypeScript-clean stub domain pages completing the walking skeleton.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 2 | Middleware + Login Page + Server Actions | 6ec37c1 | middleware.ts, actions/auth.ts, app/(auth)/login/page.tsx, app/layout.tsx |
| 3 | Protected Layout + Role-Conditional Sidebar + Stub Pages | 7e6978d | app/(protected)/layout.tsx, components/sidebar.tsx, components/sidebar-nav-item.tsx, 8 stub pages |

## Verification Results

- `npx tsc --noEmit` — zero TypeScript errors (exit 0)
- `npx next build` — build completes successfully (exit 0); all 8 protected routes compiled as dynamic server-rendered; middleware compiled at 87.3 kB
- middleware.ts confirmed at project root (not inside /app)
- middleware.ts import: `import authConfig from "./auth.config"` — confirmed Edge-safe (not lib/auth)
- actions/auth.ts first line: `"use server"` directive — confirmed
- Login page has no "Forgot" or "Create account" links — confirmed
- ALL_NAV_ITEMS array: exactly 9 items in D-11 order — confirmed
- MANAGER filter: all 9 items visible; STAFF filter: exactly 6 items (Dashboard, Reports, Users absent)
- SidebarNavItem sets aria-current="page" when isActive — confirmed
- All 8 stub page files created in their respective directories — confirmed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] shadcn/ui v4 DropdownMenu does not support asChild prop**
- **Found during:** Task 3 (TypeScript check)
- **Issue:** The plan's sidebar action pattern used `asChild` on `DropdownMenuTrigger` and `DropdownMenuItem`. shadcn/ui v4 replaced Radix UI primitives with `@base-ui/react/menu` primitives, which don't expose the `asChild` render delegation prop. TypeScript reported 3 errors at lines 96, 105, 109.
- **Fix:** Removed `asChild` from both `DropdownMenuTrigger` and `DropdownMenuItem`. Used the native `className` prop on `DropdownMenuTrigger` for styling the chevron button, and placed Link/form elements as children inside `DropdownMenuItem` items.
- **Files modified:** `components/sidebar.tsx`
- **Commit:** 7e6978d (included in the same task commit)

## Known Stubs

All 8 stub pages are intentional stubs as specified by the plan:

| Stub | File | Reason |
|------|------|--------|
| Dashboard stub | app/(protected)/dashboard/page.tsx | Will be replaced in Phase 2 (Dashboard) |
| Inventory History stub | app/(protected)/inventory/page.tsx | Will be replaced in Phase 3 (Warehouse) |
| Products stub | app/(protected)/products/page.tsx | Will be replaced in Phase 3 (Warehouse) |
| Categories stub | app/(protected)/categories/page.tsx | Will be replaced in Phase 3 (Warehouse) |
| Suppliers stub | app/(protected)/suppliers/page.tsx | Will be replaced in Phase 4 (Procurement) |
| Stock In/Out stub | app/(protected)/stock/page.tsx | Will be replaced in Phase 3 (Warehouse) |
| Purchase Orders stub | app/(protected)/purchase-orders/page.tsx | Will be replaced in Phase 4 (Procurement) |
| Reports stub | app/(protected)/reports/page.tsx | Will be replaced in Phase 6 (Reports) |

These stubs correctly fulfill the walking skeleton goal — all routes resolve without 404. They will be replaced with full implementations in Phases 2–6.

## Threat Surface Scan

No new trust boundaries beyond the plan's STRIDE threat register:
- T-1-02: MANAGER_ROUTES = ["/dashboard", "/reports", "/users"]; `pathname.startsWith(route)` check prevents bypass via trailing slashes — implemented in middleware.ts
- T-1-03: Auth.js v5 HttpOnly session cookie set automatically; JWT strategy confirmed in lib/auth.ts
- middleware.ts imports from ./auth.config (not lib/auth) — Edge runtime safety confirmed; no Node.js-only code reaches Edge

## Self-Check: PASSED

- [x] `middleware.ts` exists at project root (not inside app/)
- [x] `middleware.ts` imports `authConfig from "./auth.config"` (not lib/auth)
- [x] `actions/auth.ts` first line is `"use server"` directive
- [x] `actions/auth.ts` login() returns `{ error }` on failure, never throws AuthError to client
- [x] `app/(auth)/login/page.tsx` exists with CardHeader "Logistics MIS" and "Sign in to your account"
- [x] Login page has NO "Forgot" link, NO "Create account" link
- [x] Sign in button shows Loader2 spinner when isSubmitting and is disabled
- [x] `app/(protected)/layout.tsx` is an async Server Component (no "use client")
- [x] `components/sidebar.tsx` has no "use client" directive
- [x] `components/sidebar-nav-item.tsx` has "use client" as first line
- [x] ALL_NAV_ITEMS contains exactly 9 items in D-11 order
- [x] All 8 stub page files exist in their respective directories
- [x] Commits 6ec37c1 and 7e6978d exist in git log
- [x] `npx tsc --noEmit` exits 0 (zero TS errors)
- [x] `npx next build` exits 0
