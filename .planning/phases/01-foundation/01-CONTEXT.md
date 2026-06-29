# Phase 1: Foundation - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the Next.js 15 project, wire up the database (PostgreSQL + Prisma), implement authentication (Auth.js v5 credentials), enforce role-based access control server-side via middleware, build the app shell (fixed left sidebar), implement user management (Manager creates/deactivates staff accounts), and expose a profile/settings page for self-service password change. Every subsequent phase builds its pages inside this shell and behind this auth layer.

</domain>

<decisions>
## Implementation Decisions

### Role Structure

- **D-01:** Two roles — `MANAGER` and `STAFF`. Hardcoded; no configurable per-user permissions.
- **D-02:** MANAGER: full access to all modules + user management (create, edit, deactivate users). STAFF: operational modules only (Products, Categories, Suppliers, Stock In/Out, Inventory History, Purchase Orders).
- **D-03:** No self-registration. All user accounts created by a Manager. First Manager account seeded via a Prisma seed script (`npm run db:seed`).

### User Creation Flow

- **D-04:** Manager creates accounts by filling in: name, email, role (Manager or Staff), and initial password. Credentials shared manually (out of band). No forced password change on first login.
- **D-05:** Users can change their own password via a profile/settings page after login. Manager can also edit any user's password.

### Role-Based UI Rendering + Middleware Guards

- **D-06:** Navigation sidebar is role-aware — rendered conditionally from the session role. Staff sidebar shows: Products, Categories, Suppliers, Stock In/Out, Inventory History, Purchase Orders. Manager sidebar shows everything: Dashboard, Products, Categories, Suppliers, Stock In/Out, Inventory History, Purchase Orders, Reports, Users.
- **D-07:** Manager-only pages (Dashboard, Reports, Users) are completely absent from the Staff sidebar — no hidden links, no disabled states, just not rendered.
- **D-08:** Server-side middleware enforces role on every protected route. If a Staff user directly accesses a Manager-only URL (e.g. `/dashboard`, `/reports`, `/users`), the middleware returns a 403 and redirects to `/inventory`. UI-only hiding is not sufficient; backend guard is mandatory.
- **D-09:** No toast messages or 403 error pages in normal flow. The 403 redirect is only triggered when someone manually types a restricted URL. Normal Staff users never encounter access errors.

### App Shell Layout

- **D-10:** Fixed left sidebar navigation. Dark sidebar (slate/gray-900) with white main content area. Professional admin MIS aesthetic consistent with shadcn/ui patterns.
- **D-11:** Sidebar structure in order: Dashboard (Manager only), Products, Categories, Suppliers, Stock In/Out, Inventory History, Purchase Orders, Reports (Manager only), Users (Manager only).

### Post-Login Routing

- **D-12:** After login, Managers are redirected to `/dashboard`. Staff are redirected to `/inventory`.
- **D-13:** Auth.js `callbackUrl` or middleware post-login redirect logic handles routing based on session role.

### Claude's Discretion

- Session JWT duration: use Auth.js default (30 days) unless there's a reason to shorten for this internal tool.
- Sidebar active state styling (highlighted current route): standard shadcn/ui nav item pattern.
- Prisma schema seeding: use `prisma/seed.ts` with `ts-node` or `tsx`.
- Error page for unauthenticated access (no session): standard Next.js redirect to `/login`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements

- `.planning/REQUIREMENTS.md` — AUTH-01, AUTH-02, AUTH-03 are the Phase 1 v1 requirements
- `.planning/PROJECT.md` — Project context, core value, constraints
- `.planning/ROADMAP.md` — Phase 1 goal and success criteria

### Research Findings

- `.planning/research/STACK.md` — Auth.js v5 implementation details, Next.js App Router patterns, shadcn/ui component list
- `.planning/research/ARCHITECTURE.md` — Three-layer monolith, Auth Module boundaries, middleware guard pattern
- `.planning/research/PITFALLS.md` — RBAC pitfalls (server-side enforcement is mandatory), Auth.js v5 beta version pinning

### Key Implementation Notes from Research

- Auth.js v5 is published as `next-auth@beta` on npm — pin the exact version at project start; do NOT auto-upgrade mid-semester.
- Middleware guard must use `auth()` from Auth.js in `middleware.ts`, not a manual cookie check.
- Role is stored in JWT token via Auth.js callbacks (`session.user.role`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- None yet — greenfield project. Phase 1 creates the foundational assets all other phases reuse.

### Established Patterns

- None yet — Phase 1 establishes patterns. Key patterns to establish:
  - Prisma client singleton (`lib/prisma.ts`)
  - Auth.js session helper (`lib/auth.ts` or `lib/session.ts`)
  - Middleware pattern for RBAC (`middleware.ts` at project root)
  - shadcn/ui component usage convention

### Integration Points

- Prisma schema is the integration point all phases depend on. Phase 1 must define the `User` model (id, name, email, password hash, role, isActive, createdAt).
- Auth session shape (`session.user.role`) must be consistent — all Phase 2+ pages read from this.

</code_context>

<specifics>
## Specific Ideas

- **Sidebar nav items** (exact labels from discussion): Dashboard, Products, Categories, Suppliers, Stock In/Out, Inventory History, Purchase Orders, Reports, Users
- **Note on "Categories"**: The user mentioned a "Categories" nav item not explicitly listed in REQUIREMENTS.md. This likely refers to product categories as a sub-feature of PROD-01 (product master data). Treat as a product category CRUD page; clarify scope in Phase 2 planning.
- **Profile page**: All users can access a profile/settings page to change their password. Accessible from sidebar footer or user avatar menu.
- **No email features**: No email verification, no password reset email — all account management is manual (Manager-set credentials, in-app password change only).

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-06-29*
