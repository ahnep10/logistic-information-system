# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 1-Foundation
**Areas discussed:** Role structure, User creation flow, App shell layout, Post-login routing

---

## Role Structure

| Option | Description | Selected |
|--------|-------------|----------|
| 2 roles: Manager + Staff | Manager full access + user management; Staff operational only. Simplest RBAC | ✓ |
| 3 roles: Admin + Manager + Staff | Separate Admin for user/system management | |
| 2 roles with sub-permissions | Fine-grained per-feature toggles per user | |

**User's choice:** 2 roles (Manager + Staff). Manager creates/manages all user accounts. Hardcoded permission — not configurable.

| Option | Description | Selected |
|--------|-------------|----------|
| All operational pages | Staff accesses: Stock in/out, POs, inventory, products, suppliers | ✓ |
| Warehouse only | Staff limited to stock transactions and inventory | |
| You decide | Staff gets everything except reports, dashboard, user management | |

**User's choice:** Staff gets all operational pages (Products, Categories, Suppliers, Stock In/Out, Inventory History, Purchase Orders).

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, seed via DB script | First Manager via Prisma seed script | ✓ |
| Yes, setup page on first boot | One-time setup screen on app launch | |
| You decide | Recommended: seed via DB script | |

**User's choice:** First Manager account seeded via `npm run db:seed` (Prisma seed script).

---

## User Creation Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Manager sets password directly | Manager fills in credentials, no forced change on first login | ✓ |
| Manager sets temp password + force change | User must change password on first login | |
| You decide | Recommended: Manager sets password directly | |

**User's choice:** Manager sets password directly. Credentials shared manually.

| Option | Description | Selected |
|--------|-------------|----------|
| Name + email + role + password | Minimal fields — recommended for MVP | ✓ |
| Name + email + role + password + phone | Adds contact number | |
| You decide | Keep it minimal | |

**User's choice:** 4 fields: name, email, role, password.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — profile/settings page | Users update own password in-app | ✓ |
| No — Manager resets it | Only Manager can change passwords | |
| You decide | Recommended: allow self-service | |

**User's choice:** Yes — all users can change their password via a profile/settings page.

---

## App Shell Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Left sidebar (fixed) | Vertical sidebar, always visible. Best for 5+ modules | ✓ |
| Top navigation bar | Horizontal nav across top | |
| Collapsible sidebar | Sidebar collapses to icon-only | |

**User's choice:** Fixed left sidebar.

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard, Inventory, Procurement, Reports, Users | Top-level grouped sections | ✓ |
| Dashboard, Products, Suppliers, Stock, Purchase Orders, Reports, Users | Flat per-module items | |
| You decide | Grouped top-level sections | |

**User's choice:** Sidebar order: Dashboard, Products, Categories, Suppliers, Stock In/Out, Inventory History, Purchase Orders, Reports, Users.
**Notes:** User specified individual items rather than grouped sections. "Categories" was mentioned as a distinct sidebar item (likely product categories sub-feature of PROD-01).

| Option | Description | Selected |
|--------|-------------|----------|
| Dark sidebar + white content | slate/gray-900 sidebar, white main area — professional admin look | ✓ |
| Light/white sidebar + white content | Fully light theme | |
| Brand color sidebar | Primary color sidebar (blue/indigo) | |

**User's choice:** Dark sidebar (slate/gray-900) + white content area.

---

## Post-Login Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard page | Manager lands on KPI dashboard | ✓ |
| Last visited page | Restore previous session location | |
| You decide | Recommended: Dashboard for managers | |

**User's choice:** Managers → `/dashboard`.

| Option | Description | Selected |
|--------|-------------|----------|
| Inventory page | Staff's most frequent action context | ✓ |
| Stock transactions page | Land on stock in/out form directly | |
| You decide | Recommended: Inventory page | |

**User's choice:** Staff → `/inventory`.

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to home + toast | Silent redirect with toast message | |
| Dedicated 403 page | Full-page error with back button | |
| You decide | Recommended: redirect to home + toast | |

**User's choice (freeform):** Role-based UI rendering + server-side middleware guards. Staff sidebar hides Manager-only pages entirely (no links rendered). Middleware redirects Staff accessing restricted URLs to `/inventory`. No toast messages in normal flow — 403 redirect is a last-resort guard for direct URL access only.

---

## Claude's Discretion

- JWT session duration: Auth.js default (30 days)
- Sidebar active state styling: shadcn/ui nav item pattern
- Prisma seed file location: `prisma/seed.ts`
- Unauthenticated access: redirect to `/login`

## Deferred Ideas

None — discussion stayed within Phase 1 scope.
