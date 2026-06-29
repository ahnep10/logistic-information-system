# Walking Skeleton — Logistics MIS

**Phase:** 1
**Generated:** 2026-06-29

## Capability Proven End-to-End

A manager can navigate to `http://localhost:3000`, be redirected to `/login`, sign in with email and password, land on the `/dashboard` stub page, and see a role-conditional sidebar — exercising the full stack from PostgreSQL through Prisma through Auth.js through Next.js middleware through the React UI.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 App Router (pinned `next@15.5.19`) | Eliminates a separate backend; Server Actions handle all mutations; file-based routing maps cleanly to domain areas; middleware.ts provides edge-level RBAC. Locked in RESEARCH.md. Do NOT upgrade to Next.js 16 without re-evaluating the auth.config.ts split pattern. |
| Data layer | PostgreSQL 16 + Prisma 6 (pinned `prisma@6.19.2`) | Logistics data is relational; Prisma Studio aids debugging; schema-first PSL is self-documenting. CRITICAL: `prisma@latest` installs v7 — always pin v6 explicitly. |
| Auth | Auth.js v5 (`next-auth@5.0.0-beta.31`) + bcryptjs | Two-file split required: `auth.config.ts` (Edge-safe, no Node.js) for middleware; `lib/auth.ts` (Node.js only) for Credentials provider + bcrypt. Pinning beta version — re-verify before semester end. |
| ORM singleton | `lib/prisma.ts` with `globalThis` pattern | Prevents multiple PrismaClient instances during Next.js hot-reload. All other files import `{ prisma }` from here. |
| Session storage | JWT in HttpOnly cookie (Auth.js default, 30-day expiry) | No extra DB table; works across serverless. Role stored in JWT token via `jwt` callback. |
| RBAC enforcement | Two layers — `middleware.ts` (outer gate) + Server Action role re-check (inner gate) | Middleware blocks unauthorized routes before render. Server Actions re-verify because Server Actions bypass middleware routing. |
| UI component library | shadcn/ui (New York style, Zinc base, CSS variables) installed via CLI | Components copied into source — no version-lock, full ownership. Tailwind v4 CSS-native config. |
| Directory layout | App Router route groups: `(auth)/` for public, `(protected)/` for guarded pages | Clean separation; `(protected)/layout.tsx` owns the sidebar shell for all authenticated routes. |
| Deployment target | Railway (Next.js app + managed PostgreSQL) | Single platform, one `railway up` command, DATABASE_URL auto-injected. Appropriate for academic timeline. |
| Icon library | lucide-react (ships with shadcn init) | Covers all 9 sidebar icons needed; tree-shakeable SVG. |

## Stack Touched in Phase 1

- [x] Project scaffold — Next.js 15 + TypeScript + Tailwind v4 + ESLint + shadcn/ui + all Phase 1 deps
- [x] Routing — `/login` (public), `/(protected)/*` (guarded by middleware), `/api/auth/[...nextauth]` (Auth.js handler)
- [x] Database — `prisma.user.findUnique()` read (in `authorize` callback) + `prisma.user.upsert()` write (in seed script)
- [x] UI — Login form (email + password + submit) wired to `login()` Server Action wired to Auth.js Credentials → Prisma → bcryptjs
- [x] Deployment — `npm run dev` starts the full stack locally; documented in Plan 01-02 user_setup

## Out of Scope (Deferred to Later Slices)

- Password reset via email — no email features in MVP (CONTEXT.md)
- Self-registration — accounts only via Manager (D-03)
- Multi-warehouse support — single warehouse MVP
- Real-time dashboard data — stub pages populated in Phases 3–5
- Product, Supplier, Inventory, PO modules — Phases 2–4
- Reports with Excel export — Phase 6
- PDF export — v2 requirement
- Delivery / shipment tracking — explicitly out of scope

## Subsequent Slice Plan

Each later phase adds one vertical slice inside this shell without altering the architectural decisions above:

- Phase 2: Admin maintains product and supplier master data (PROD-01…04, SUPL-01…04)
- Phase 3: Staff records stock movements; inventory levels update in real time (INVT-01…06)
- Phase 4: Staff manages PO lifecycle from Draft through atomic goods receipt (PROC-01…05)
- Phase 5: Manager sees real-time KPI dashboard (DASH-01…03)
- Phase 6: Manager generates and exports operational reports (REPT-01…04)

## Key Version Pins (Do Not Change Without Testing)

| Package | Pinned Version | Risk if Unpinned |
|---------|----------------|-----------------|
| next | 15.5.19 | `@latest` installs v16; `middleware.ts` becomes `proxy.ts` in v16 |
| prisma + @prisma/client | 6.19.2 | `@latest` installs v7; seeding API changed in v7 |
| next-auth | 5.0.0-beta.31 | `@beta` always resolves to latest beta; API may shift |
| bcryptjs | 3.0.3 | v3 includes own TS types; do NOT install `@types/bcryptjs` alongside it |
