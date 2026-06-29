# Phase 1: Foundation - Research

**Researched:** 2026-06-29
**Domain:** Next.js 15 App Router · Auth.js v5 · Prisma 6 · shadcn/ui · Role-Based Access Control
**Confidence:** MEDIUM

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Two roles — `MANAGER` and `STAFF`. Hardcoded; no configurable per-user permissions.
- **D-02:** MANAGER: full access to all modules + user management (create, edit, deactivate users). STAFF: operational modules only (Products, Categories, Suppliers, Stock In/Out, Inventory History, Purchase Orders).
- **D-03:** No self-registration. All user accounts created by a Manager. First Manager account seeded via a Prisma seed script (`npm run db:seed`).
- **D-04:** Manager creates accounts by filling in: name, email, role (Manager or Staff), and initial password. No forced password change on first login.
- **D-05:** Users can change their own password via a profile/settings page after login. Manager can also edit any user's password.
- **D-06:** Navigation sidebar is role-aware — rendered conditionally from the session role. Staff sidebar shows: Products, Categories, Suppliers, Stock In/Out, Inventory History, Purchase Orders. Manager sidebar shows everything: Dashboard, Products, Categories, Suppliers, Stock In/Out, Inventory History, Purchase Orders, Reports, Users.
- **D-07:** Manager-only pages (Dashboard, Reports, Users) are completely absent from the Staff sidebar — no hidden links, no disabled states, just not rendered.
- **D-08:** Server-side middleware enforces role on every protected route. If a Staff user directly accesses a Manager-only URL (e.g. `/dashboard`, `/reports`, `/users`), the middleware returns a 403 and redirects to `/inventory`. UI-only hiding is not sufficient; backend guard is mandatory.
- **D-09:** No toast messages or 403 error pages in normal flow. The 403 redirect is silent.
- **D-10:** Fixed left sidebar navigation. Dark sidebar (slate/gray-900) with white main content area.
- **D-11:** Sidebar structure in order: Dashboard (Manager only), Products, Categories, Suppliers, Stock In/Out, Inventory History, Purchase Orders, Reports (Manager only), Users (Manager only).
- **D-12:** After login, Managers are redirected to `/dashboard`. Staff are redirected to `/inventory`.
- **D-13:** Auth.js `callbackUrl` or middleware post-login redirect logic handles routing based on session role.

### Claude's Discretion

- Session JWT duration: use Auth.js default (30 days).
- Sidebar active state styling: standard shadcn/ui nav item pattern.
- Prisma schema seeding: use `prisma/seed.ts` with `ts-node` or `tsx`.
- Error page for unauthenticated access: standard Next.js redirect to `/login`.

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in with email and password | Auth.js v5 Credentials provider with bcryptjs — see Pattern 1 |
| AUTH-02 | User session persists across browser refresh without re-login | JWT session stored in HttpOnly cookie — Auth.js default, 30-day expiry |
| AUTH-03 | Manager role can access dashboard, reports, and all modules; staff role can perform operational transactions; system enforces roles server-side on every protected route | middleware.ts with `auth()` wrapper reads JWT role — see Pattern 2 |
</phase_requirements>

---

## Summary

Phase 1 establishes the full authentication, RBAC, and app-shell foundation that every subsequent phase builds inside. The walking skeleton must deliver: a login page, a JWT-based session, a fixed sidebar with role-conditional nav items, a user management page (Manager creates/deactivates accounts), and a profile page for password change. All protected routes must be guarded server-side in `middleware.ts`.

The primary complexity in this phase is the Auth.js v5 + Next.js 15 integration. Auth.js v5 requires a two-file split (`auth.config.ts` vs `auth.ts`) because `middleware.ts` runs on the Edge runtime and cannot import Node.js-only packages like `bcryptjs` or `@prisma/client`. The `auth.config.ts` is edge-safe (no Node.js imports); `auth.ts` is full (Credentials provider, bcryptjs, Prisma). Middleware imports from `auth.config.ts`.

A critical version-pinning risk exists: `npm install next@latest` installs **Next.js 16** (not 15), and `npm install prisma@latest` installs **Prisma 7** (not 6). Both must be pinned explicitly using `create-next-app@15` and `prisma@6`. Next.js 16 renamed `middleware.ts` to `proxy.ts` and moved it to Node.js runtime — this changes the auth pattern significantly. Since the stack is locked at Next.js 15, `middleware.ts` remains correct.

**Primary recommendation:** Use the two-file auth split (`auth.config.ts` / `auth.ts`) with `middleware.ts` wrapping `auth()` from auth.config. Pin `next@15`, `prisma@6`, `next-auth@5.0.0-beta.31`, and `bcryptjs@3` explicitly.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Login form rendering | Browser / Client | Frontend Server (SSR) | Login page is a static form; session redirect logic runs server-side |
| Session validation | Frontend Server (middleware.ts) | — | Auth.js auth() in middleware validates JWT on every request |
| RBAC enforcement | Frontend Server (middleware.ts) | API / Backend (Server Actions) | Middleware is the outer gate; Server Actions re-verify role before mutations |
| Role-conditional sidebar rendering | Frontend Server (SSR) | — | `session.user.role` read in Server Component layout; no client toggle |
| User management CRUD | API / Backend (Server Actions) | — | All writes go through Server Actions with role check |
| Password hashing | API / Backend (Server Actions + auth.ts) | — | bcryptjs runs on Node.js only, never on Edge/client |
| JWT session storage | Browser / Client (HttpOnly cookie) | — | Auth.js sets secure HttpOnly cookie automatically |
| Database access (user lookup) | API / Backend (auth.ts authorize) | — | Prisma client is Node.js only |

---

## Standard Stack

### Core (Phase 1 only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.5.19 [VERIFIED: npm registry] | App Router framework | Locked stack decision |
| react | 19.x (ships with next 15) | UI runtime | Ships with Next.js 15 |
| typescript | 5.8.x [VERIFIED: npm registry] | Type safety | Non-negotiable for schema→component type chain |
| prisma | 6.19.2 [VERIFIED: npm registry] | ORM + migrations | Locked stack decision; 6.x is the `prev` tag |
| @prisma/client | 6.19.2 [VERIFIED: npm registry] | Prisma runtime client | Must match prisma CLI version |
| next-auth | 5.0.0-beta.31 [VERIFIED: npm registry] | Auth.js v5 for credentials | Locked stack; pin exact beta version |
| bcryptjs | 3.0.3 [VERIFIED: npm registry] | Password hashing (Node.js runtime) | Pure JS — works in Node.js auth.ts without native bindings |
| tailwindcss | 4.3.2 [VERIFIED: npm registry] | Utility CSS | Ships with shadcn init; v4 uses CSS-native config |
| react-hook-form | 7.x [ASSUMED] | Form state management | Locked stack decision |
| zod | 3.x [ASSUMED] | Schema validation | Locked stack decision |
| @hookform/resolvers | 3.x [ASSUMED] | RHF + Zod bridge | Locked stack decision |
| lucide-react | 1.22.0 [VERIFIED: npm registry] | Icon library | Ships with shadcn init; used for sidebar nav icons |

### Supporting (Phase 1 scaffold)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | 4.22.4 [VERIFIED: npm registry] | TypeScript script runner | Running `prisma/seed.ts` at `npm run db:seed` |

### What NOT to install in Phase 1

- `@types/bcryptjs` — **DEPRECATED**. bcryptjs 3.x ships with its own TypeScript types (`umd/index.d.ts`). Installing `@types/bcryptjs` causes type conflicts.
- `recharts`, `xlsx`, `@auth/prisma-adapter` — Not needed until later phases.
- `ts-node` — Replaced by `tsx` for TypeScript seed scripts.

### Exact Installation Sequence

```bash
# 1. Scaffold Next.js 15 project (NOT create-next-app@latest — that installs Next.js 16)
npx create-next-app@15 logistic-system \
  --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*"

cd logistic-system

# 2. Prisma 6 (NOT npm install prisma — that installs Prisma 7)
npm install prisma@6 @prisma/client@6
npx prisma init --datasource-provider postgresql

# 3. Auth.js v5 (pin exact beta — do not use @beta tag in production)
npm install next-auth@5.0.0-beta.31

# 4. Password hashing (pure JS, no native bindings, built-in TS types)
npm install bcryptjs
# DO NOT install @types/bcryptjs — bcryptjs 3.x includes its own types

# 5. shadcn/ui (New York style, Zinc base, CSS variables)
npx shadcn@latest init
# When prompted: Style=New York, Base color=Zinc, CSS variables=Yes

# 6. shadcn components needed for Phase 1 (per UI-SPEC.md)
npx shadcn@latest add button card form input label table badge dialog alert-dialog select avatar dropdown-menu separator

# 7. Forms + validation
npm install react-hook-form zod @hookform/resolvers

# 8. Dev tooling for seed script
npm install -D tsx
```

---

## Package Legitimacy Audit

> Verified via `gsd-tools query package-legitimacy check --ecosystem npm` on 2026-06-29.

| Package | Registry | Age | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|-----|-------------|-------------|---------|-------------|
| next | npm | 12+ yrs | 39.5M | github.com/vercel/next.js | SUS (too-new signal) | Approved — false positive; official Vercel package |
| react | npm | 12+ yrs | 146M | github.com/facebook/react | SUS (too-new signal) | Approved — false positive; official Meta package |
| typescript | npm | 12+ yrs | 217M | github.com/microsoft/TypeScript | OK | Approved |
| prisma | npm | 5+ yrs | 13.1M | github.com/prisma/prisma | OK | Approved |
| @prisma/client | npm | 5+ yrs | 11.8M | github.com/prisma/prisma | OK | Approved |
| next-auth | npm | 5+ yrs | 4.1M | github.com/nextauthjs/next-auth | OK | Approved |
| bcryptjs | npm | 10+ yrs | 10.5M | github.com/dcodeIO/bcrypt.js | OK | Approved |
| tsx | npm | 4+ yrs | 57M | github.com/privatenumber/tsx | SUS (too-new signal) | Approved — false positive; 57M downloads, well-established |
| @types/bcryptjs | npm | — | 4.2M | none (DefinitelyTyped stub) | SUS + DEPRECATED | **REMOVED** — bcryptjs 3.x includes own types |
| lucide-react | npm | 5+ yrs | high | github.com/lucide-icons/lucide | [ASSUMED] OK | Approved |
| react-hook-form | npm | 5+ yrs | high | github.com/react-hook-form | [ASSUMED] OK | Approved |
| zod | npm | 4+ yrs | high | github.com/colinhacks/zod | [ASSUMED] OK | Approved |
| @hookform/resolvers | npm | 4+ yrs | high | github.com/react-hook-form | [ASSUMED] OK | Approved |

**Packages removed due to SLOP/DEPRECATED verdict:** `@types/bcryptjs`

**Packages flagged as suspicious (SUS):** `next`, `react`, `tsx` — all false positives from "too-new" heuristic applied to recent patch releases of well-established packages. No human verification needed.

**Note on `next` and `react` SUS flags:** The legitimacy checker flagged these because a very recent patch release was published close to today. Both packages are foundational web platform packages with decade-long track records. Proceed without checkpoint.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  │  HTTPS
  ▼
middleware.ts (Edge runtime — Next.js 15)
  │  Reads JWT from session cookie (auth.config.ts — no db/bcrypt)
  │  Unauthenticated → redirect /login
  │  STAFF on /dashboard|/reports|/users → redirect /inventory
  │  MANAGER on /login (already authed) → redirect /dashboard
  ▼
Next.js 15 App Router
  │
  ├── app/(auth)/login/page.tsx   [no sidebar, renders login Card]
  │     └── Server Action: signIn("credentials", { email, password })
  │           └── auth.ts → Credentials.authorize()
  │                 ├── prisma.user.findUnique({ where: { email } })
  │                 └── bcryptjs.compare(password, user.passwordHash)
  │
  └── app/(protected)/layout.tsx  [sidebar shell — reads session role]
        ├── auth() → session.user.role
        └── <Sidebar role={role} />  [conditionally renders nav items]

              ├── /dashboard         [MANAGER only — stub in Phase 1]
              ├── /products          [all — stub]
              ├── /categories        [all — stub]
              ├── /suppliers         [all — stub]
              ├── /stock             [all — stub]
              ├── /inventory         [all — stub, Staff home]
              ├── /purchase-orders   [all — stub]
              ├── /reports           [MANAGER only — stub]
              ├── /users             [MANAGER only — full CRUD]
              └── /profile           [all — password change]

Auth.js v5 JWT Session (HttpOnly cookie)
  └── { id, email, name, role, iat, exp }
        ↑ written by auth.ts callbacks
        ↑ read by auth() in Server Components + middleware.ts

PostgreSQL (via Prisma 6)
  └── users table
        id, email, name, passwordHash, role(MANAGER|STAFF), isActive, createdAt
```

### Recommended Project Structure

```
logistic-system/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx            # Login page (full-screen Card, no sidebar)
│   ├── (protected)/
│   │   ├── layout.tsx              # App shell: sidebar + main content area
│   │   ├── dashboard/
│   │   │   └── page.tsx            # Manager-only stub (Phase 5 populates)
│   │   ├── inventory/
│   │   │   └── page.tsx            # Staff home stub (Phase 3 populates)
│   │   ├── products/
│   │   │   └── page.tsx            # Stub (Phase 2 populates)
│   │   ├── categories/
│   │   │   └── page.tsx            # Stub (Phase 2 populates)
│   │   ├── suppliers/
│   │   │   └── page.tsx            # Stub (Phase 2 populates)
│   │   ├── stock/
│   │   │   └── page.tsx            # Stub (Phase 3 populates)
│   │   ├── purchase-orders/
│   │   │   └── page.tsx            # Stub (Phase 4 populates)
│   │   ├── reports/
│   │   │   └── page.tsx            # Manager-only stub (Phase 6 populates)
│   │   ├── users/
│   │   │   └── page.tsx            # Full CRUD: create/edit/deactivate users
│   │   └── profile/
│   │       └── page.tsx            # Password change (all roles)
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts         # Auth.js handler: { handlers } from @/auth
│   ├── layout.tsx                   # Root layout (html, body, font)
│   └── globals.css
├── components/
│   ├── sidebar.tsx                  # Role-aware sidebar (Server Component)
│   ├── sidebar-nav-item.tsx         # Single nav item with active state
│   └── ui/                          # shadcn/ui generated components
├── lib/
│   ├── prisma.ts                    # Prisma Client singleton
│   ├── auth.ts                      # Auth.js full instance (Node.js only)
│   └── validations/
│       ├── auth.ts                  # Zod schemas: loginSchema
│       └── user.ts                  # Zod schemas: createUserSchema, editUserSchema, passwordSchema
├── actions/
│   ├── auth.ts                      # login(), logout() Server Actions
│   └── users.ts                     # createUser(), updateUser(), toggleUserActive() Server Actions
├── auth.config.ts                   # Edge-safe auth config (NO bcrypt/prisma imports)
├── middleware.ts                    # Route protection (project root — NOT in /app)
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── types/
    └── next-auth.d.ts               # Module augmentation: session.user.role
```

### Pattern 1: Auth.js v5 Two-File Split (Edge Compatibility)

**What:** `middleware.ts` runs on Edge runtime. It cannot import `bcryptjs` or `@prisma/client`. The split keeps edge-safe config separate from Node.js-only auth logic.

**When to use:** Always — required for any Next.js 15 project using Auth.js v5.

```typescript
// auth.config.ts — Edge-safe. NO bcrypt, NO prisma imports.
// Source: authjs.dev/guides/edge-compatibility
import type { NextAuthConfig } from "next-auth"

export default {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // This runs in middleware to check JWT validity only
      const isLoggedIn = !!auth?.user
      return isLoggedIn
    },
  },
  providers: [],   // Credentials provider goes in auth.ts — NOT here
} satisfies NextAuthConfig
```

```typescript
// auth.ts — Node.js only. Has bcrypt, prisma, Credentials provider.
// Source: authjs.dev/reference/nextjs
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import authConfig from "./auth.config"
import { loginSchema } from "@/lib/validations/auth"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        })
        if (!user || !user.isActive) return null

        const passwordValid = await compare(parsed.data.password, user.passwordHash)
        if (!passwordValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
})
```

```typescript
// types/next-auth.d.ts — TypeScript module augmentation
import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    role: string
  }
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
  }
}
```

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers
```

### Pattern 2: Middleware RBAC Guard (Next.js 15 — middleware.ts at project root)

**What:** Reads JWT session from cookie, enforces role rules on every request.

**Note:** `middleware.ts` lives at the project root (same level as `app/`), NOT inside `app/`. This is a common placement error.

```typescript
// middleware.ts — AT PROJECT ROOT (not in /app)
// Source: authjs.dev/reference/nextjs + nextjs.org/docs/app/guides/authentication
import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

// Manager-only routes (STAFF access is forbidden)
const MANAGER_ROUTES = ["/dashboard", "/reports", "/users"]

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const pathname = nextUrl.pathname

  // 1. Unauthenticated: redirect to /login
  if (!session) {
    if (pathname === "/login") return NextResponse.next()
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  // 2. Already authenticated visiting /login: redirect to role home
  if (pathname === "/login") {
    const home = session.user?.role === "MANAGER" ? "/dashboard" : "/inventory"
    return NextResponse.redirect(new URL(home, nextUrl))
  }

  // 3. STAFF on manager-only route: silent redirect to /inventory (D-08, D-09)
  const isManagerRoute = MANAGER_ROUTES.some((route) =>
    pathname.startsWith(route)
  )
  if (isManagerRoute && session.user?.role !== "MANAGER") {
    return NextResponse.redirect(new URL("/inventory", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

### Pattern 3: Prisma Client Singleton

**What:** Prevents multiple Prisma client instances during Next.js development hot reload.

```typescript
// lib/prisma.ts
// Source: prisma.io/docs/orm/more/troubleshooting/nextjs
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

### Pattern 4: Prisma Schema (Phase 1 User Model)

```prisma
// prisma/schema.prisma
// Source: Prisma docs (prisma.io/docs/concepts/components/prisma-schema)
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  MANAGER
  STAFF
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String
  role         Role     @default(STAFF)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("users")
}
```

**Note on `id` type:** Using `String @id @default(cuid())` rather than `Int @id @default(autoincrement())`. This matches the Auth.js convention for JWT `sub` claim (string IDs). Later phases that add `createdBy` references to this User model will use `String` foreign keys consistently.

### Pattern 5: Prisma Seed Script

```typescript
// prisma/seed.ts
import { PrismaClient, Role } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await hash("Admin@123", 12)

  const manager = await prisma.user.upsert({
    where: { email: "admin@logistics.com" },
    update: {},
    create: {
      email: "admin@logistics.com",
      name: "System Administrator",
      passwordHash,
      role: Role.MANAGER,
      isActive: true,
    },
  })

  console.log(`Seeded manager: ${manager.email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

```json
// package.json (add this field)
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "scripts": {
    "db:seed": "prisma db seed",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:studio": "prisma studio"
  }
}
```

**Run seed:** `npm run db:seed`

### Pattern 6: Login Server Action

```typescript
// actions/auth.ts
"use server"
import { signIn, signOut } from "@/lib/auth"
import { loginSchema } from "@/lib/validations/auth"
import { AuthError } from "next-auth"
import { redirect } from "next/navigation"

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { error: "Invalid email or password. Please check your credentials." }
  }

  try {
    // Auth.js signIn handles redirect internally via callbackUrl
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,   // We handle redirect in middleware
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password. Please check your credentials." }
    }
    throw error
  }

  // Role-based post-login redirect happens in middleware.ts (Pattern 2 step 2)
  redirect("/")   // middleware intercepts and routes to /dashboard or /inventory
}

export async function logout() {
  await signOut({ redirectTo: "/login" })
}
```

### Pattern 7: Reading Session in Server Components

```typescript
// Example: (protected)/layout.tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Sidebar from "@/components/sidebar"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")   // Should be caught by middleware, but belt-and-suspenders
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={session.user.role} userName={session.user.name ?? ""} />
      <main className="flex-1 overflow-y-auto bg-white">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
```

### Walking Skeleton — Minimum End-to-End Slice

The absolute minimum set of files for "user can log in and see the sidebar" (Phase 1 walking skeleton):

```
Must exist for auth flow:
├── auth.config.ts              # Edge-safe config
├── lib/auth.ts                 # Full auth instance
├── lib/prisma.ts               # DB client
├── middleware.ts               # Route guard
├── app/api/auth/[...nextauth]/route.ts  # Auth.js API handler
├── types/next-auth.d.ts        # Type augmentation
├── prisma/schema.prisma        # User model
├── prisma/seed.ts              # First Manager account
└── .env                        # DATABASE_URL, AUTH_SECRET

Must exist for login page:
├── app/(auth)/login/page.tsx   # Login Card UI
└── actions/auth.ts             # login() Server Action

Must exist for app shell:
├── app/(protected)/layout.tsx  # Sidebar + main wrapper
└── components/sidebar.tsx      # Role-conditional nav

Stub pages (empty but route must resolve):
├── app/(protected)/dashboard/page.tsx
├── app/(protected)/inventory/page.tsx
├── app/(protected)/products/page.tsx
├── app/(protected)/categories/page.tsx
├── app/(protected)/suppliers/page.tsx
├── app/(protected)/stock/page.tsx
├── app/(protected)/purchase-orders/page.tsx
├── app/(protected)/reports/page.tsx
└── app/(protected)/profile/page.tsx

Full Phase 1 (not just walking skeleton):
├── app/(protected)/users/page.tsx       # User management table
└── actions/users.ts                     # createUser, updateUser, toggleActive
```

**Stub page pattern** (keeps routes from 404-ing):
```typescript
// app/(protected)/products/page.tsx
export default function ProductsPage() {
  return <h1 className="text-2xl font-semibold">Products</h1>
}
```

### Anti-Patterns to Avoid

- **Importing auth.ts from middleware:** auth.ts has bcryptjs and prisma — importing it in middleware.ts will fail on Edge runtime with "The edge runtime does not support Node.js 'crypto' module". Always import from `auth.config.ts` in middleware.
- **Placing middleware.ts inside /app:** Next.js reads middleware.ts only from the project root. Placing it inside `/app/middleware.ts` makes it ignored silently.
- **Putting role check only in the sidebar:** D-08 mandates server-side enforcement. UI-only role hiding is not sufficient. Middleware must enforce independently.
- **Using `prisma db push` as the only migration tool:** `db push` is for rapid prototyping but does not create migration files. Use `prisma migrate dev` in development to create the migrations directory that will be applied in production.
- **Using `bcrypt` (native) instead of `bcryptjs`:** The native `bcrypt` package requires C++ bindings that may not compile on all platforms. `bcryptjs` is pure JavaScript and works everywhere Node.js runs. For an academic project with potential environment changes (local dev → Railway), `bcryptjs` eliminates build failures.
- **Returning `passwordHash` in session callbacks:** Only forward `id`, `email`, `name`, and `role` to the JWT. Never include sensitive database fields in the session token.
- **Not using `upsert` in seed.ts:** If the seed runs twice (e.g., after `prisma migrate reset`), using `create` throws a unique constraint error. Use `upsert` with `where: { email }` to make seeding idempotent.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session cookies | Manual cookie set/get with JWT signing | Auth.js v5 | Token rotation, CSRF protection, secure cookie flags, HttpOnly — 10+ security properties to get right |
| Password hashing | SHA-256, MD5, or `crypto.createHash` | bcryptjs | SHA/MD5 are fast-hash algorithms, broken for passwords. bcrypt is intentionally slow with configurable cost factor |
| Route protection | Manual cookie parsing in every page component | middleware.ts with Auth.js auth() | Middleware runs before rendering; checking in page components creates race conditions and allows brief unauthorized renders |
| Role checking in UI only | `if (session.role === 'MANAGER')` to conditionally render links | Middleware + UI combined | D-08 explicitly requires server-side enforcement; UI-only = security theater |
| CSRF protection | Manual CSRF token generation | Auth.js built-in | Auth.js handles CSRF for all its endpoints automatically |
| JWT encoding/decoding | Manual `jose` or `jsonwebtoken` calls | Auth.js session + auth() | Auth.js manages signing, rotation, and decoding; manual JWT management is error-prone |

**Key insight:** Authentication is a domain where even experienced developers introduce security vulnerabilities. Auth.js v5 bundles 5+ years of Next.js-specific security fixes. The goal is to configure it correctly, not to understand every implementation detail.

---

## Critical Version Notes

| Decision | Stack Says | npm latest | Risk | Action |
|----------|-----------|-----------|------|--------|
| Next.js | 15.x | **16.2.9** | `create-next-app@latest` installs v16 which uses `proxy.ts` not `middleware.ts` | Use `npx create-next-app@15` explicitly |
| Prisma | 6.x | **7.8.0** | `npm install prisma` installs v7 which uses `prisma.config.ts` for seeding (different from v6) | Use `npm install prisma@6 @prisma/client@6` |
| next-auth | 5.x beta | 5.0.0-beta.31 | `@beta` tag always resolves to latest beta — pin exact version | `npm install next-auth@5.0.0-beta.31` |
| bcryptjs | 3.x | 3.0.3 | v3 ships built-in types; `@types/bcryptjs` is deprecated and causes conflicts | `npm install bcryptjs` only |

**Next.js 16 vs 15 middleware change:** In Next.js 16, `middleware.ts` is renamed to `proxy.ts` and runs on Node.js runtime (not Edge). This eliminates the auth.config.ts split requirement entirely. Since the project locks to Next.js 15, `middleware.ts` + auth.config.ts split is the correct pattern. If the team chooses to upgrade to Next.js 16 before building any phase, they can simplify to a single `auth.ts` referenced from `proxy.ts` directly.

---

## Common Pitfalls

### Pitfall 1: Edge Runtime Cannot Use bcryptjs or Prisma

**What goes wrong:** Developer imports `auth.ts` (which has `bcryptjs` and `@prisma/client`) from `middleware.ts`. Build succeeds but deployment fails with "The edge runtime does not support Node.js 'crypto' module".

**Why it happens:** `middleware.ts` runs in the Edge runtime by default in Next.js 15. Edge runtime has no Node.js built-ins.

**How to avoid:** `middleware.ts` must import from `auth.config.ts` only. The `auth.config.ts` file must never import `bcryptjs`, `@prisma/client`, or any Node.js-specific package.

**Detection:** `next build` with `--experimental-edge-runtime` flag will surface this. Also test with `vercel dev` which runs middleware in Edge by default.

### Pitfall 2: middleware.ts in Wrong Location

**What goes wrong:** Developer places `middleware.ts` inside `app/` directory. Routes appear unprotected — any URL is accessible without authentication.

**Why it happens:** Next.js only reads middleware from the project root (same level as `package.json`).

**How to avoid:** `middleware.ts` goes at `./middleware.ts` (root), not `./app/middleware.ts`.

**Detection:** After setting up middleware, test that visiting `/dashboard` while unauthenticated redirects to `/login`. If it doesn't, middleware is in the wrong place.

### Pitfall 3: @types/bcryptjs Installed Alongside bcryptjs 3.x

**What goes wrong:** TypeScript throws "Duplicate identifier" errors because both the package's built-in `umd/index.d.ts` and `@types/bcryptjs` define the same types.

**Why it happens:** Developer installs `@types/bcryptjs` out of habit (correct for bcryptjs 2.x), but bcryptjs 3.x now ships its own types.

**How to avoid:** `npm install bcryptjs` only. Run `npm uninstall @types/bcryptjs` if already installed. The `npm view @types/bcryptjs` returns `deprecated: "This is a stub types definition..."`.

### Pitfall 4: npm install next / prisma Gets Wrong Major Version

**What goes wrong:** `npm install next` installs Next.js 16 (not 15). `npm install prisma` installs Prisma 7 (not 6). The middleware.ts pattern and seed config differ between major versions.

**Why it happens:** npm `@latest` tag points to the newest major version. The stack document says "15.x" and "6.x" but does not pin the exact npm install command.

**How to avoid:** Always use version-specific commands: `npx create-next-app@15`, `npm install prisma@6 @prisma/client@6`.

### Pitfall 5: Session Role Not Available on First Render After Login

**What goes wrong:** After `signIn()`, the first page render reads `session.user.role` as `undefined` because the JWT callback ran but the session hasn't refreshed in the browser.

**Why it happens:** The `session` callback runs when Auth.js returns a session. If the JWT callback adds `token.role` but the session callback doesn't forward it to `session.user.role`, the role is lost.

**How to avoid:** Ensure both callbacks are implemented:
```typescript
// Both MUST be present in auth.ts
jwt({ token, user }) { if (user) token.role = user.role; return token }
session({ session, token }) { session.user.role = token.role; return session }
```

### Pitfall 6: Deactivated Users Can Still Log In

**What goes wrong:** A deactivated user (`isActive: false`) still passes the Credentials `authorize` check because the code only validates email/password but not `isActive`.

**How to avoid:** In `authorize()`, check `if (!user || !user.isActive) return null` before the bcryptjs compare call.

---

## Code Examples

### Full Login Zod Schema

```typescript
// lib/validations/auth.ts
import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email."),
  password: z.string().min(1, "Password is required."),
})

export type LoginInput = z.infer<typeof loginSchema>
```

### Create User Zod Schema

```typescript
// lib/validations/user.ts
import { z } from "zod"

export const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email."),
  role: z.enum(["MANAGER", "STAFF"]),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

export const editUserSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["MANAGER", "STAFF"]),
  newPassword: z.string().min(8).optional(),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
```

### Generate AUTH_SECRET

```bash
# Required .env variable for Auth.js v5
openssl rand -base64 32
```

```bash
# .env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/logistic_mis"
AUTH_SECRET="<output-from-openssl-above>"
```

---

## Runtime State Inventory

> This is a greenfield project. No existing runtime state to inventory.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — database does not yet exist | Create via `prisma migrate dev` |
| Live service config | None | N/A |
| OS-registered state | None | N/A |
| Secrets/env vars | None in repo yet | Create `.env` with DATABASE_URL and AUTH_SECRET |
| Build artifacts | None | N/A |

---

## Open Questions (RESOLVED)

1. **Next.js 15 vs 16 upgrade decision**
   - What we know: npm latest is Next.js 16.2.9; project locks to 15.x; next-15-3 tag = 15.5.19
   - What's unclear: Whether the team wants to use the locked 15.x or upgrade to 16 now (easier auth setup)
   - Recommendation: Stay with Next.js 15 as locked. Document that Next.js 16 (proxy.ts pattern) is available if the team upgrades before starting development.
   - RESOLVED: Lock to Next.js 15 (`next@15.5.19`). The two-file auth.config.ts split is required and is the correct pattern for this version. Upgrading to Next.js 16 is deferred to v2.

2. **AUTH_SECRET env variable naming**
   - What we know: Auth.js v5 looks for `AUTH_SECRET` by default (not `NEXTAUTH_SECRET`)
   - What's unclear: Railway auto-injects PostgreSQL as `DATABASE_URL` — `AUTH_SECRET` must be set manually
   - Recommendation: Document both env vars explicitly in the plan's Wave 0 environment setup task.
   - RESOLVED: Use `AUTH_SECRET` (not `NEXTAUTH_SECRET`). Both `DATABASE_URL` and `AUTH_SECRET` are documented in `.env.example` and the Plan 01-02 environment setup task.

3. **Prisma migrate dev vs db push for initial schema**
   - What we know: `migrate dev` creates migration files (essential for production); `db push` is faster for prototyping
   - Recommendation: Use `prisma migrate dev --name init` for the first migration to establish the migrations directory. Never use `db push` alone in this project — the Railway deployment will need migration files.
   - RESOLVED: Use `npx prisma migrate dev --name init` for the initial migration (creates `/prisma/migrations/` directory needed for Railway deployment). `db push` is not used in this project. Plan 01-02 Task 1 uses `prisma migrate dev --name init`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything | [ASSUMED] ✓ | Verify >= 20.x for Next.js 15 | None — required |
| npm | Package install | [ASSUMED] ✓ | 10.x | yarn or pnpm |
| PostgreSQL | Database | [ASSUMED] ✗ local | — | Railway managed PostgreSQL (deployment target) |
| Git | Version control | [ASSUMED] ✓ | — | — |

**Note on PostgreSQL:** For local development, the team can use a local PostgreSQL installation or a free Neon database (cloud PostgreSQL, free tier). `DATABASE_URL` must be set in `.env` before running `prisma migrate dev`.

---

## Validation Architecture

> `workflow.nyquist_validation: true` in config.json — this section is required.

### Test Framework

The project has no test framework yet. Recommend Vitest for unit tests (faster than Jest, native TypeScript, no Babel required).

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/dom jsdom
```

| Property | Value |
|----------|-------|
| Framework | Vitest (to be installed in Wave 0) |
| Config file | `vitest.config.ts` (Wave 0 gap) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Valid credentials → session created; redirect to role home | Integration (actions/auth.ts) | `npx vitest run tests/auth.test.ts` | ❌ Wave 0 |
| AUTH-01 | Invalid credentials → error message returned | Integration | `npx vitest run tests/auth.test.ts` | ❌ Wave 0 |
| AUTH-01 | Deactivated user → login rejected | Integration | `npx vitest run tests/auth.test.ts` | ❌ Wave 0 |
| AUTH-02 | JWT cookie persists across simulated refresh | Unit (session callbacks) | `npx vitest run tests/session.test.ts` | ❌ Wave 0 |
| AUTH-03 | STAFF accesses /dashboard → redirect to /inventory | Unit (middleware.ts) | `npx vitest run tests/middleware.test.ts` | ❌ Wave 0 |
| AUTH-03 | Unauthenticated request to /inventory → redirect to /login | Unit (middleware.ts) | `npx vitest run tests/middleware.test.ts` | ❌ Wave 0 |
| AUTH-03 | MANAGER accesses /dashboard → allowed | Unit (middleware.ts) | `npx vitest run tests/middleware.test.ts` | ❌ Wave 0 |
| D-06 | MANAGER sidebar renders 9 items | Unit (sidebar.tsx) | `npx vitest run tests/sidebar.test.tsx` | ❌ Wave 0 |
| D-07 | STAFF sidebar renders 6 items (no Dashboard/Reports/Users) | Unit (sidebar.tsx) | `npx vitest run tests/sidebar.test.tsx` | ❌ Wave 0 |
| D-05 | Password change: wrong current password → rejected | Integration (actions/users.ts) | `npx vitest run tests/users.test.ts` | ❌ Wave 0 |
| D-05 | Password change: mismatched passwords → rejected | Unit (Zod schema) | `npx vitest run tests/validations.test.ts` | ❌ Wave 0 |
| D-03 | User creation by Manager: valid data → user in DB | Integration (actions/users.ts) | `npx vitest run tests/users.test.ts` | ❌ Wave 0 |
| D-04 | Deactivated user cannot log in | Integration | see AUTH-01 deactivated test above | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=dot` (fast, no watcher)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/auth.test.ts` — AUTH-01, AUTH-02: login flow unit tests with mocked Prisma
- [ ] `tests/middleware.test.ts` — AUTH-03: middleware route guard logic
- [ ] `tests/sidebar.test.tsx` — D-06, D-07: role-conditional nav rendering
- [ ] `tests/users.test.ts` — D-03, D-04, D-05: user CRUD and password change
- [ ] `tests/validations.test.ts` — Zod schema edge cases (password mismatch, length)
- [ ] `vitest.config.ts` — Framework config
- [ ] `tests/setup.ts` — Vitest setup file with jsdom environment

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` in config.json.

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Auth.js v5 Credentials provider + bcryptjs (cost factor 12) |
| V2.1 Password Security | Yes | bcryptjs hash; minimum 8 chars enforced via Zod; no plaintext storage |
| V3 Session Management | Yes | Auth.js JWT in HttpOnly, Secure, SameSite=lax cookie |
| V4 Access Control | Yes | middleware.ts enforces role before render; Server Actions re-check role |
| V5 Input Validation | Yes | Zod schemas validate all form inputs server-side (loginSchema, createUserSchema) |
| V6 Cryptography | Yes | bcryptjs for password hashing — never SHA/MD5/AES for passwords |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential stuffing | Spoofing | bcrypt cost factor 12 slows brute force; Auth.js rate-limiting via callbackUrl |
| Session hijacking | Spoofing | HttpOnly cookie prevents XSS access; SameSite=lax prevents CSRF |
| Privilege escalation (STAFF → MANAGER routes) | Elevation | middleware.ts reads role from signed JWT; role cannot be modified client-side |
| Password in plaintext in DB | Information Disclosure | bcryptjs.hash() in authorize callback; never store raw password |
| Mass assignment (role field spoofing) | Tampering | Role enum in Zod schema; `z.enum(["MANAGER", "STAFF"])` validates on server |
| CSRF on Server Actions | Tampering | Auth.js built-in CSRF token protection on all auth endpoints |

### AUTH_SECRET Requirement

Auth.js v5 requires `AUTH_SECRET` environment variable to sign and verify JWTs. Without it, Auth.js throws at startup. Generate via:
```bash
openssl rand -base64 32
```
Store in `.env` (never commit to git). Add to `.gitignore` if not already present.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-hook-form`, `zod`, `@hookform/resolvers` latest versions are OK (not checked via package legitimacy tool) | Standard Stack | Low — these are very widely used packages with long track records |
| A2 | `lucide-react` is safe to install via shadcn init (not explicitly checked) | Standard Stack | Low — ships with shadcn/ui init by design |
| A3 | Local Node.js is >= 20.x (required for Next.js 15) | Environment Availability | High — if Node.js < 20, installation fails silently or throws |
| A4 | Local PostgreSQL OR Neon cloud DB is available for development | Environment Availability | Medium — development cannot proceed without a database URL |
| A5 | `tsx` SUS verdict is a false positive (package age heuristic) | Package Legitimacy | Low — 57M weekly downloads, official GitHub repo; well-established package |

---

## Sources

### Primary (MEDIUM confidence — context7 + official docs)

- [authjs.dev/guides/edge-compatibility](https://authjs.dev/guides/edge-compatibility) — auth.config.ts/auth.ts split pattern
- [authjs.dev/reference/nextjs](https://authjs.dev/reference/nextjs) — auth() usage in Server Components, middleware, Route Handlers
- [authjs.dev/getting-started/providers/credentials](https://authjs.dev/getting-started/providers/credentials) — Credentials provider authorize function
- [nextjs.org/docs/app/guides/authentication](https://nextjs.org/docs/app/guides/authentication) — Next.js authentication guide (fetched, version 16.2.9 but patterns applicable to 15)
- `npm view next dist-tags` — Confirmed next@latest = 16.2.9, next-15-3 = 15.3.9, latest 15.x = 15.5.19
- `npm view prisma dist-tags` — Confirmed prisma@latest = 7.8.0, prisma@prev = 6.19.2
- `npm view next-auth@beta dist-tags` — Confirmed next-auth@beta = 5.0.0-beta.31 (2026-04-14)
- `npm view bcryptjs version` — Confirmed bcryptjs@latest = 3.0.3 with built-in types

### Secondary (LOW confidence — web search verified)

- [prisma.io/docs/orm/prisma-migrate/workflows/seeding](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding) — seed config (`tsx prisma/seed.ts`)
- Multiple Medium/DEV articles on Auth.js v5 + Next.js 15 credentials patterns
- [github.com/vercel/next.js/discussions/62985](https://github.com/vercel/next.js/discussions/62985) — Edge runtime does not support Node.js 'crypto' module

---

## Metadata

**Confidence breakdown:**
- Standard Stack: MEDIUM — all packages verified on npm registry; versions confirmed
- Auth.js v5 patterns: MEDIUM — confirmed via official authjs.dev documentation
- Middleware RBAC: MEDIUM — confirmed via Next.js official auth guide
- Prisma schema: MEDIUM — based on Prisma docs + ARCHITECTURE.md
- Version pinning risks: HIGH — confirmed by direct npm registry queries

**Research date:** 2026-06-29
**Valid until:** 2026-07-29 (30 days) — next-auth@beta version especially should be re-verified before install
