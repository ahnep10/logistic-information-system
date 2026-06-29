---
phase: 01-foundation
plan: "01A"
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - auth.config.ts
  - lib/auth.ts
  - lib/prisma.ts
  - types/next-auth.d.ts
  - app/api/auth/[...nextauth]/route.ts
  - lib/validations/auth.ts
  - prisma/schema.prisma
  - prisma/seed.ts
  - .env.example
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-03

must_haves:
  truths:
    - "Next.js 15 project compiles with zero TypeScript errors after prisma generate (AUTH-01)"
    - "prisma/schema.prisma contains Role enum (MANAGER/STAFF) and User model with id/email/name/passwordHash/role/isActive (AUTH-01)"
    - "lib/auth.ts Credentials provider authorizes valid active users via bcryptjs.compare; deactivated users are rejected (AUTH-01)"
    - "auth.config.ts has zero imports of bcryptjs or @prisma/client — Edge-safe for middleware.ts (AUTH-02, AUTH-03)"
    - "prisma/seed.ts uses upsert for idempotency; bcryptjs cost factor 12 in both seed and authorize() (per T-1-01)"
    - "Both jwt and session callbacks in lib/auth.ts forward role — session.user.role is never undefined (AUTH-02)"
  artifacts:
    - "auth.config.ts — Edge-safe auth config, zero Node.js imports, providers array empty"
    - "lib/auth.ts — Full Auth.js instance; Credentials provider with bcryptjs.compare + prisma.user.findUnique; both jwt and session callbacks forward role"
    - "lib/prisma.ts — PrismaClient singleton using globalThis pattern"
    - "types/next-auth.d.ts — Module augmentation: session.user.id (string), session.user.role (string)"
    - "prisma/schema.prisma — Role enum (MANAGER/STAFF) + User model mapped to 'users' table"
    - "prisma/seed.ts — Upserts single MANAGER account using bcryptjs hash cost factor 12 (per T-1-04)"
    - "lib/validations/auth.ts — loginSchema with email() and min(1) password"
    - ".env.example — DATABASE_URL and AUTH_SECRET placeholder lines"
  key_links:
    - "Both jwt and session callbacks must be present in lib/auth.ts — missing either makes session.user.role undefined on first render"
    - "auth.config.ts imports nothing from Node.js — this is what makes middleware.ts Edge-safe"
    - "prisma/seed.ts uses upsert (not create) so re-running seed after migrate reset does not throw unique constraint error"
    - "bcryptjs hash cost factor 12 in both lib/auth.ts authorize callback and prisma/seed.ts (T-1-01 mitigation)"
    - "authorize() returns only { id, email, name, role } — passwordHash is NEVER included (T-1-04 mitigation)"
---

<objective>
Scaffold the Logistics MIS project and establish the auth core: Next.js 15 project skeleton,
all dependencies, Prisma schema with User model, Auth.js two-file split (auth.config.ts +
lib/auth.ts), Prisma singleton, type augmentation, seed script, and validation schema.

Purpose: Deliver a TypeScript-clean auth foundation that the walking skeleton (Plan 01-01B)
and every subsequent phase builds inside. This plan produces no visible UI — only the server-
side auth machinery.

Output: A TypeScript-clean Next.js 15 project with the full auth layer (AUTH-01, AUTH-02,
AUTH-03 per D-01–D-05). Plan 01-01B builds the middleware, UI shell, and stub pages on top.
</objective>

<execution_context>
@C:/Users/LENOVO/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/LENOVO/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-RESEARCH.md
@.planning/phases/01-foundation/01-PATTERNS.md
@.planning/phases/01-foundation/01-UI-SPEC.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold Project + Install Dependencies + Initialize Prisma and shadcn/ui</name>
  <files>
    package.json
  </files>
  <read_first>
    .planning/phases/01-foundation/01-RESEARCH.md — Standard Stack (exact package versions), Critical Version Notes, Common Pitfalls (Pitfall 3: do not install @types/bcryptjs), Package Legitimacy Audit table
    .planning/phases/01-foundation/01-UI-SPEC.md — Design System section (shadcn/ui style: New York, base color: Zinc, CSS variables: Yes; component list)
  </read_first>
  <action>
    STEP 1 — Scaffold Next.js 15 (NOT create-next-app@latest which installs v16):
    Run `npx create-next-app@15 . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --yes` from the project root. This creates package.json, tsconfig.json, next.config.ts, app/layout.tsx, app/page.tsx, app/globals.css, and Tailwind config.

    STEP 2 — Install core packages with exact pinned versions (per RESEARCH.md Critical Version Notes):
    Run `npm install prisma@6 @prisma/client@6 next-auth@5.0.0-beta.31 bcryptjs react-hook-form zod @hookform/resolvers`.
    Then run `npm install -D tsx`.
    Do NOT install @types/bcryptjs — bcryptjs 3.x ships its own types and @types/bcryptjs causes duplicate identifier conflicts (RESEARCH.md Pitfall 3).

    STEP 3 — Initialize Prisma (creates prisma/ directory with empty schema):
    Run `npx prisma init --datasource-provider postgresql`.

    STEP 4 — Initialize shadcn/ui (per UI-SPEC.md Design System):
    Run `npx shadcn@latest init` and choose: Style = New York, Base color = Zinc, CSS variables = Yes.
    Then run `npx shadcn@latest add button card form input label table badge dialog alert-dialog select avatar dropdown-menu separator`.

    STEP 5 — Update package.json with Prisma seed config and db scripts. Add a top-level "prisma" key with "seed": "tsx prisma/seed.ts". Add to "scripts": "db:seed": "prisma db seed", "db:migrate": "prisma migrate dev", "db:push": "prisma db push", "db:studio": "prisma studio".
  </action>
  <verify>
    <automated>node -e "const p=require('./package.json');const d=p.dependencies||{};const s=p.scripts||{};if(!d.next)throw new Error('next missing');if(!d['@prisma/client'])throw new Error('@prisma/client missing');if(!s['db:seed'])throw new Error('db:seed script missing')" && ls prisma/schema.prisma components/ui/button.tsx && echo "PASS: Scaffold + deps installed"</automated>
  </verify>
  <acceptance_criteria>
    - next, @prisma/client, next-auth, bcryptjs, react-hook-form, zod, @hookform/resolvers are in package.json dependencies
    - tsx is in devDependencies; @types/bcryptjs is NOT in devDependencies
    - package.json has "db:seed", "db:migrate", "db:push", "db:studio" in scripts and "prisma": { "seed": "tsx prisma/seed.ts" } at top level
    - prisma/schema.prisma exists (created by prisma init — empty datasource block, will be overwritten in Task 2)
    - components/ui/button.tsx exists (confirms shadcn/ui init ran successfully)
  </acceptance_criteria>
  <done>Next.js 15 project scaffolded; all production and dev dependencies installed; Prisma initialized; shadcn/ui components copied in; package.json db scripts configured</done>
</task>

<task type="auto">
  <name>Task 2: Create Auth Core Files</name>
  <files>
    prisma/schema.prisma,
    prisma/seed.ts,
    auth.config.ts,
    lib/auth.ts,
    lib/prisma.ts,
    types/next-auth.d.ts,
    app/api/auth/[...nextauth]/route.ts,
    lib/validations/auth.ts,
    .env.example
  </files>
  <read_first>
    .planning/phases/01-foundation/01-RESEARCH.md — Pattern 1 (auth.config.ts / lib/auth.ts two-file split), Pattern 3 (Prisma singleton), Pattern 4 (schema.prisma), Pattern 5 (seed.ts), Common Pitfalls (Pitfall 1–4)
    .planning/phases/01-foundation/01-PATTERNS.md — auth.config.ts, lib/auth.ts, lib/prisma.ts, prisma/schema.prisma, prisma/seed.ts, lib/validations/auth.ts pattern sections
  </read_first>
  <action>
    STEP 6 — Overwrite prisma/schema.prisma with the User model (per PATTERNS.md Pattern 4):
    Generator block uses "prisma-client-js". Datasource uses DATABASE_URL env var for PostgreSQL.
    Define enum Role with values MANAGER and STAFF.
    Define model User with fields: id (String, @id, @default(cuid())), email (String, @unique), name (String), passwordHash (String), role (Role, @default(STAFF)), isActive (Boolean, @default(true)), createdAt (DateTime, @default(now())), updatedAt (DateTime, @updatedAt). Map table to "users" with @@map("users").
    NOTE: Use String id (cuid) — not Int autoincrement — so Auth.js JWT sub claim and all future foreign keys share the same String type.

    STEP 7 — Create prisma/seed.ts (per PATTERNS.md Pattern 5):
    Import PrismaClient and Role from "@prisma/client"; import hash from "bcryptjs".
    Use a local `new PrismaClient()` (not the singleton — seed is a one-off script).
    In main(): hash seed password "Admin@123" with cost factor 12 (per T-1-04 mitigation).
    Call prisma.user.upsert with where: { email: "admin@logistics.com" }, update: {}, create: { email, name: "System Administrator", passwordHash, role: Role.MANAGER, isActive: true }.
    Log the seeded email. Call disconnect in finally block.

    STEP 8 — Create auth.config.ts at project root (per PATTERNS.md auth.config.ts pattern):
    This file MUST NOT import bcryptjs, @prisma/client, or any Node.js-only package — it runs on Edge runtime via middleware.ts.
    Import NextAuthConfig from "next-auth".
    Export default object with: pages.signIn = "/login"; callbacks.authorized that checks !!auth?.user; providers = [] (empty — Credentials provider goes in lib/auth.ts).

    STEP 9 — Create lib/auth.ts (per PATTERNS.md lib/auth.ts pattern):
    Import NextAuth from "next-auth"; Credentials from "next-auth/providers/credentials"; compare from "bcryptjs"; prisma from "@/lib/prisma"; authConfig from "@/auth.config"; loginSchema from "@/lib/validations/auth".
    Call NextAuth with spread authConfig, session: { strategy: "jwt" }, and Credentials provider with authorize function that: parses credentials with loginSchema.safeParse, returns null on failure; queries prisma.user.findUnique by email; returns null if not found or not isActive; compares password with compare(); returns { id, email, name, role } — NEVER include passwordHash in the return value.
    Include both callbacks: jwt callback adds token.id and token.role when user is present; session callback forwards token.id and token.role to session.user.id and session.user.role.

    STEP 10 — Create lib/prisma.ts (per PATTERNS.md Pattern 3):
    Use globalThis pattern to export a shared PrismaClient singleton. Log "query", "error", "warn" in development; "error" only in production.

    STEP 11 — Create types/next-auth.d.ts (per PATTERNS.md types pattern):
    Module augmentation for "next-auth": extend User interface with role: string; extend Session.user with id: string and role: string.
    Module augmentation for "next-auth/jwt": extend JWT with id: string and role: string.

    STEP 12 — Create app/api/auth/[...nextauth]/route.ts:
    Two lines: import { handlers } from "@/lib/auth"; export const { GET, POST } = handlers.

    STEP 13 — Create lib/validations/auth.ts:
    Import z from "zod". Export loginSchema as z.object with email (z.string().email()) and password (z.string().min(1)). Export LoginInput type as z.infer of loginSchema.

    STEP 14 — Create .env.example with two placeholder lines: DATABASE_URL and AUTH_SECRET. Add a comment that AUTH_SECRET is generated via `openssl rand -base64 32`.

    STEP 15 — Run `npx prisma generate` to generate the Prisma client TypeScript types from schema.prisma. This is required for tsc to recognize Prisma model types. Does NOT need DATABASE_URL — only reads schema.prisma.
  </action>
  <verify>
    <automated>npx prisma validate && npx tsc --noEmit 2>&1 | grep -c "error TS" | grep -q "^0$" && echo "PASS: Zero TypeScript errors"</automated>
  </verify>
  <acceptance_criteria>
    - `npx prisma validate` exits 0 (schema.prisma is syntactically valid)
    - `npx tsc --noEmit` reports zero "error TS" lines after prisma generate
    - prisma/schema.prisma contains Role enum with MANAGER and STAFF values
    - lib/auth.ts does NOT import from middleware.ts or auth.config.ts directly in a way that bypasses the split
    - auth.config.ts has zero imports of bcryptjs or @prisma/client
    - prisma/seed.ts uses upsert (not create) to ensure idempotency
    - @types/bcryptjs is NOT in package.json devDependencies
  </acceptance_criteria>
  <done>Auth core complete: Prisma schema with User model and Role enum; Auth.js two-file split (auth.config.ts Edge-safe, lib/auth.ts Node.js-only); Prisma singleton; type augmentation; seed script with bcryptjs cost factor 12; prisma generate runs clean</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → middleware.ts | All HTTP requests cross here; session JWT is validated before any render occurs |
| Login form → actions/auth.ts | User-supplied email and password enter the server here; Zod validates before bcryptjs compare |
| JWT token → session.user | Token is signed by Auth.js using AUTH_SECRET; role in token cannot be spoofed client-side |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-1-01 | Spoofing | lib/auth.ts → authorize() | high | mitigate | bcryptjs.compare with cost factor 12 in authorize(); cost factor 12 also used in prisma/seed.ts for the seeded Manager password. Intentionally slow hash defeats brute-force and credential stuffing. |
| T-1-02 | Elevation of Privilege | middleware.ts → RBAC check | high | mitigate | MANAGER_ROUTES = ["/dashboard", "/reports", "/users"]; pathname.startsWith check prevents bypasses via trailing slashes. Server Actions re-check role (inner gate) as second enforcement layer. |
| T-1-03 | Spoofing | Auth.js JWT cookie | high | mitigate | Auth.js v5 sets HttpOnly, Secure, SameSite=lax flags on the session cookie automatically. Session strategy is "jwt" — no server-side session storage needed. |
| T-1-04 | Information Disclosure | lib/auth.ts → authorize() return value | high | mitigate | authorize() returns only { id, email, name, role } — passwordHash is NEVER included in the returned user object or the JWT token. |
| T-1-SC | Tampering | npm install (scaffold + deps) | high | mitigate | Package Legitimacy Audit in 01-RESEARCH.md covers all packages. All verified as OK or approved SUS (false positives). No [ASSUMED] or [SLOP] packages — no human checkpoint required for this plan. |
</threat_model>

## Artifacts This Phase Produces

| Artifact | Path | Consumer |
|----------|------|---------|
| Edge-safe auth config | auth.config.ts | middleware.ts (Plan 01-01B imports here, not from lib/auth.ts) |
| Full Auth.js instance | lib/auth.ts | actions/auth.ts, app/(protected)/layout.tsx, Server Actions |
| Prisma singleton | lib/prisma.ts | lib/auth.ts, actions/users.ts (Phase 1 Plan 04) |
| Type augmentation | types/next-auth.d.ts | All files using session.user.role or session.user.id |
| User model + Role enum | prisma/schema.prisma | All phases that write to or read from the users table |
| Seed script | prisma/seed.ts | Plan 01-02 (npm run db:seed) |
| Auth Server Action stub | lib/validations/auth.ts | lib/auth.ts authorize(), actions/auth.ts login() |

<verification>
Auth core verification (run after Task 1 completes):

1. `npx prisma validate` — schema.prisma is structurally valid
2. `npx tsc --noEmit` — zero TypeScript errors across the full project
3. Confirm auth.config.ts has no bcryptjs or @prisma/client imports: `grep -E "bcryptjs|@prisma" auth.config.ts` returns no matches

End-to-end verification is gated on Plan 01-01B (middleware + shell) and Plan 01-02 (DB setup).
</verification>

<success_criteria>
- AUTH-01 (D-01, D-03): Credentials provider in lib/auth.ts accepts email+password; deactivated users are rejected in authorize(); seeded Manager account ready for Plan 01-02 seed run
- AUTH-02: Auth.js JWT session strategy with 30-day default expiry; HttpOnly cookie prevents client-side JS access
- AUTH-03 (D-06, D-07, D-08, D-09): auth core files are in place; middleware enforcement is added in Plan 01-01B
- Security: bcryptjs cost factor 12; no passwordHash in JWT; auth.config.ts has zero Node.js imports
</success_criteria>

<output>
Create `.planning/phases/01-foundation/01-01A-SUMMARY.md` when done.
</output>
