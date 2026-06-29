# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-06-29
**Files analyzed:** 22 new files (greenfield — no existing codebase)
**Analogs found:** 0 / 22 (greenfield; all patterns sourced from research)

> **Greenfield note:** No source files exist yet. Every pattern below is drawn from
> `01-RESEARCH.md` code examples and Next.js 15 / Auth.js v5 / Prisma 6 official docs.
> The planner should treat these excerpts as the canonical "copy from" reference.

---

## File Classification

| New File | Role | Data Flow | Pattern Source | Match Quality |
|----------|------|-----------|----------------|---------------|
| `auth.config.ts` | config | request-response | RESEARCH Pattern 1 | canonical |
| `lib/auth.ts` | config | request-response | RESEARCH Pattern 1 | canonical |
| `middleware.ts` | middleware | request-response | RESEARCH Pattern 2 | canonical |
| `lib/prisma.ts` | utility | CRUD | RESEARCH Pattern 3 | canonical |
| `prisma/schema.prisma` | model | CRUD | RESEARCH Pattern 4 | canonical |
| `prisma/seed.ts` | utility | CRUD | RESEARCH Pattern 5 | canonical |
| `actions/auth.ts` | service | request-response | RESEARCH Pattern 6 | canonical |
| `actions/users.ts` | service | CRUD | RESEARCH Code Examples | canonical |
| `app/(auth)/login/page.tsx` | component | request-response | RESEARCH Pattern 7 (inverse) | canonical |
| `app/(protected)/layout.tsx` | component | request-response | RESEARCH Pattern 7 | canonical |
| `components/sidebar.tsx` | component | request-response | RESEARCH Architecture Diagram | canonical |
| `components/sidebar-nav-item.tsx` | component | request-response | RESEARCH D-10/D-11 decisions | canonical |
| `types/next-auth.d.ts` | config | — | RESEARCH Pattern 1 | canonical |
| `app/api/auth/[...nextauth]/route.ts` | route | request-response | RESEARCH Pattern 1 | canonical |
| `lib/validations/auth.ts` | utility | transform | RESEARCH Code Examples | canonical |
| `lib/validations/user.ts` | utility | transform | RESEARCH Code Examples | canonical |
| `app/(protected)/users/page.tsx` | component | CRUD | RESEARCH Walking Skeleton | canonical |
| `app/(protected)/profile/page.tsx` | component | CRUD | RESEARCH D-05 decision | canonical |
| `app/(protected)/dashboard/page.tsx` | component | — | RESEARCH stub pattern | canonical |
| `app/(protected)/inventory/page.tsx` | component | — | RESEARCH stub pattern | canonical |
| `tests/middleware.test.ts` | test | — | RESEARCH Validation Architecture | canonical |
| `tests/sidebar.test.tsx` | test | — | RESEARCH Validation Architecture | canonical |

---

## Pattern Assignments

### `auth.config.ts` (config, request-response)

**Source:** RESEARCH.md — Pattern 1: Auth.js v5 Two-File Split

**Purpose:** Edge-safe auth config. Imported by `middleware.ts`. Must never import `bcryptjs`, `@prisma/client`, or any Node.js-only package.

**Full file pattern:**
```typescript
// auth.config.ts — Edge-safe. NO bcrypt, NO prisma imports.
import type { NextAuthConfig } from "next-auth"

export default {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      return isLoggedIn
    },
  },
  providers: [],   // Credentials provider goes in lib/auth.ts — NOT here
} satisfies NextAuthConfig
```

**Critical anti-pattern:** Never add `import { compare } from "bcryptjs"` or `import { prisma } from "@/lib/prisma"` to this file.

---

### `lib/auth.ts` (config, request-response)

**Source:** RESEARCH.md — Pattern 1: Auth.js v5 Two-File Split

**Purpose:** Full Auth.js instance. Node.js only (never imported by middleware). Contains Credentials provider, bcryptjs compare, and Prisma user lookup. Exports `{ handlers, auth, signIn, signOut }`.

**Full file pattern:**
```typescript
// lib/auth.ts — Node.js only. Has bcrypt, prisma, Credentials provider.
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import authConfig from "@/auth.config"
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
        if (!user || !user.isActive) return null   // D-03: deactivated check

        const passwordValid = await compare(parsed.data.password, user.passwordHash)
        if (!passwordValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,   // Forward role — NEVER include passwordHash
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

---

### `middleware.ts` (middleware, request-response)

**Source:** RESEARCH.md — Pattern 2: Middleware RBAC Guard

**Purpose:** Route protection — runs on every request before rendering. Enforces D-08 (STAFF cannot access manager-only routes). Lives at project root, NOT inside `/app`.

**Full file pattern:**
```typescript
// middleware.ts — AT PROJECT ROOT (not in /app)
import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

const MANAGER_ROUTES = ["/dashboard", "/reports", "/users"]

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const pathname = nextUrl.pathname

  // 1. Unauthenticated: redirect to /login
  if (!session) {
    if (pathname === "/login") return NextResponse.next()
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  // 2. Already authenticated visiting /login: redirect to role home (D-12)
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

---

### `lib/prisma.ts` (utility, CRUD)

**Source:** RESEARCH.md — Pattern 3: Prisma Client Singleton

**Purpose:** Prevents multiple Prisma client instances during Next.js hot reload. All other files import `{ prisma }` from here — never instantiate `PrismaClient` directly.

**Full file pattern:**
```typescript
// lib/prisma.ts
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

---

### `prisma/schema.prisma` (model, CRUD)

**Source:** RESEARCH.md — Pattern 4: Prisma Schema

**Purpose:** Defines the `User` model that all phases depend on. `String @id @default(cuid())` keeps id type consistent with Auth.js JWT `sub` convention. All future `createdBy` foreign keys in later phases use `String`.

**Full file pattern:**
```prisma
// prisma/schema.prisma
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

**Note:** Later phases will add models after this block. Never change the `User` id type from `String` once later phases add foreign keys to it.

---

### `prisma/seed.ts` (utility, CRUD)

**Source:** RESEARCH.md — Pattern 5: Prisma Seed Script

**Purpose:** Creates the first Manager account idempotently (upsert, not create). Run via `npm run db:seed`. Uses a local `new PrismaClient()` — not the singleton — because this is a one-off script.

**Full file pattern:**
```typescript
// prisma/seed.ts
import { PrismaClient, Role } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await hash("Admin@123", 12)   // cost factor 12 per ASVS V2.1

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

**package.json additions:**
```json
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

---

### `actions/auth.ts` (service, request-response)

**Source:** RESEARCH.md — Pattern 6: Login Server Action

**Purpose:** Server Actions for login and logout. The `"use server"` directive is mandatory. Validates with Zod before calling Auth.js `signIn`. Returns `{ error }` objects for form error display — never throws to the client.

**Full file pattern:**
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
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password. Please check your credentials." }
    }
    throw error
  }

  redirect("/")   // middleware intercepts and routes to /dashboard or /inventory
}

export async function logout() {
  await signOut({ redirectTo: "/login" })
}
```

---

### `actions/users.ts` (service, CRUD)

**Source:** RESEARCH.md — Code Examples (createUserSchema, editUserSchema) + Security Domain (role re-check in Server Actions)

**Purpose:** User CRUD Server Actions. Each action must re-verify the caller is MANAGER before mutating — middleware is the outer gate but Server Actions are the inner gate (RESEARCH Architectural Responsibility Map).

**Pattern to follow:**
```typescript
// actions/users.ts
"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { createUserSchema, editUserSchema, changePasswordSchema } from "@/lib/validations/user"

async function requireManager() {
  const session = await auth()
  if (session?.user?.role !== "MANAGER") {
    throw new Error("Unauthorized")   // Should never reach this — middleware blocks it
  }
  return session
}

export async function createUser(formData: FormData) {
  await requireManager()

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  })
  if (!parsed.success) return { error: parsed.error.flatten() }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) return { error: "Email already in use." }

  const passwordHash = await hash(parsed.data.password, 12)
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash,
    },
  })
  return { success: true }
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  await requireManager()
  await prisma.user.update({ where: { id: userId }, data: { isActive } })
  return { success: true }
}

export async function changeOwnPassword(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthenticated")

  // ... compare currentPassword, hash newPassword, update DB
}
```

---

### `app/(auth)/login/page.tsx` (component, request-response)

**Source:** RESEARCH.md — Walking Skeleton + shadcn/ui Card component

**Purpose:** Full-screen login form. No sidebar. Uses shadcn `Card`, `Form`, `Input`, `Button`. Calls `login()` Server Action from `actions/auth.ts`.

**Pattern to follow:**
```typescript
// app/(auth)/login/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// shadcn Form + Input + Button
// react-hook-form + zod resolver for client-side validation before server call
// On submit: call login(formData) Server Action; display error if returned
```

---

### `app/(protected)/layout.tsx` (component, request-response)

**Source:** RESEARCH.md — Pattern 7: Reading Session in Server Components

**Purpose:** App shell — wraps all protected pages with sidebar + main content area. Reads session server-side. Belt-and-suspenders redirect to `/login` if no session (middleware should catch first).

**Full file pattern:**
```typescript
// app/(protected)/layout.tsx
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
    redirect("/login")
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

---

### `components/sidebar.tsx` (component, request-response)

**Source:** RESEARCH.md — D-06, D-07, D-10, D-11 decisions + Architecture Diagram

**Purpose:** Role-aware Server Component sidebar. Renders nav items conditionally based on `role` prop. Dark background (`bg-slate-900` or `bg-gray-900`). Never reads session itself — receives role from layout.

**Pattern to follow:**
```typescript
// components/sidebar.tsx
import Link from "next/link"
import SidebarNavItem from "@/components/sidebar-nav-item"
import { LayoutDashboard, Package, Tag, Truck, ArrowUpDown, 
         History, ShoppingCart, BarChart3, Users, User } from "lucide-react"

// Nav items in D-11 order:
const ALL_NAV_ITEMS = [
  { label: "Dashboard",         href: "/dashboard",       icon: LayoutDashboard, managerOnly: true },
  { label: "Products",          href: "/products",        icon: Package,         managerOnly: false },
  { label: "Categories",        href: "/categories",      icon: Tag,             managerOnly: false },
  { label: "Suppliers",         href: "/suppliers",       icon: Truck,           managerOnly: false },
  { label: "Stock In/Out",      href: "/stock",           icon: ArrowUpDown,     managerOnly: false },
  { label: "Inventory History", href: "/inventory",       icon: History,         managerOnly: false },
  { label: "Purchase Orders",   href: "/purchase-orders", icon: ShoppingCart,    managerOnly: false },
  { label: "Reports",           href: "/reports",         icon: BarChart3,       managerOnly: true },
  { label: "Users",             href: "/users",           icon: Users,           managerOnly: true },
]

interface SidebarProps {
  role: string
  userName: string
}

export default function Sidebar({ role, userName }: SidebarProps) {
  const visibleItems = role === "MANAGER"
    ? ALL_NAV_ITEMS
    : ALL_NAV_ITEMS.filter((item) => !item.managerOnly)

  return (
    <aside className="flex flex-col w-64 bg-slate-900 text-white h-full shrink-0">
      {/* Logo / brand */}
      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => (
          <SidebarNavItem key={item.href} {...item} />
        ))}
      </nav>
      {/* Footer: user name + profile link + logout */}
    </aside>
  )
}
```

---

### `components/sidebar-nav-item.tsx` (component, request-response)

**Source:** RESEARCH.md — D-10 (active state styling per shadcn/ui pattern)

**Purpose:** Single nav item with active state highlight. Must be a Client Component to use `usePathname()` for active detection. Receives icon, label, href as props.

**Pattern to follow:**
```typescript
// components/sidebar-nav-item.tsx
"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface SidebarNavItemProps {
  label: string
  href: string
  icon: LucideIcon
}

export default function SidebarNavItem({ label, href, icon: Icon }: SidebarNavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + "/")

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-slate-700 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  )
}
```

---

### `types/next-auth.d.ts` (config, —)

**Source:** RESEARCH.md — Pattern 1: Auth.js v5 Two-File Split

**Purpose:** TypeScript module augmentation so `session.user.role` and `session.user.id` are typed without casting throughout the codebase.

**Full file pattern:**
```typescript
// types/next-auth.d.ts
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

---

### `app/api/auth/[...nextauth]/route.ts` (route, request-response)

**Source:** RESEARCH.md — Pattern 1 (final snippet)

**Purpose:** Auth.js catch-all route handler. Two lines only — never add custom logic here.

**Full file pattern:**
```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers
```

---

### `lib/validations/auth.ts` (utility, transform)

**Source:** RESEARCH.md — Code Examples: Full Login Zod Schema

**Full file pattern:**
```typescript
// lib/validations/auth.ts
import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email."),
  password: z.string().min(1, "Password is required."),
})

export type LoginInput = z.infer<typeof loginSchema>
```

---

### `lib/validations/user.ts` (utility, transform)

**Source:** RESEARCH.md — Code Examples: Create/Edit User Zod Schema

**Full file pattern:**
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

---

### Stub Pages Pattern (component, —)

**Source:** RESEARCH.md — Walking Skeleton

**Applies to:** `dashboard/page.tsx`, `inventory/page.tsx`, `products/page.tsx`, `categories/page.tsx`, `suppliers/page.tsx`, `stock/page.tsx`, `purchase-orders/page.tsx`, `reports/page.tsx`

**Full pattern (copy for each stub):**
```typescript
// app/(protected)/[route]/page.tsx
export default function [Name]Page() {
  return <h1 className="text-2xl font-semibold">[Name]</h1>
}
```

---

### `app/(protected)/users/page.tsx` (component, CRUD)

**Source:** RESEARCH.md — D-02 (MANAGER full CRUD), D-04, D-05

**Purpose:** Full user management table. MANAGER only (middleware enforces; this page need not re-check role for rendering). Uses shadcn `Table`, `Dialog`, `Badge`, `Button`. Calls `createUser`, `updateUser`, `toggleUserActive` from `actions/users.ts`.

**Pattern to follow:**
- Server Component fetches user list via `prisma.user.findMany()` directly (no Route Handler needed)
- `<Table>` from shadcn/ui for the user list with columns: Name, Email, Role, Status (Badge), Actions
- `<Dialog>` from shadcn/ui for create/edit modal with React Hook Form + Zod
- Badge colors: Active = green variant, Inactive = destructive variant
- Deactivate is a toggle button calling `toggleUserActive` Server Action

---

### `app/(protected)/profile/page.tsx` (component, CRUD)

**Source:** RESEARCH.md — D-05 (all users can change their own password)

**Purpose:** Password change form for the currently logged-in user. Accessible to both MANAGER and STAFF. Uses `changePasswordSchema` from `lib/validations/user.ts`.

**Pattern to follow:**
- Server Component reads session via `auth()` to display current user's name/email
- Password change form is a Client Component using React Hook Form + `changePasswordSchema`
- Calls `changeOwnPassword` Server Action from `actions/users.ts`
- Display success/error state inline (no toast in Phase 1 scope)

---

## Shared Patterns

### Server Action Convention

**Apply to:** `actions/auth.ts`, `actions/users.ts`

```typescript
"use server"   // First line of every actions/*.ts file — mandatory directive
// Import from @/lib/auth (NOT @/auth — use the lib path alias)
// Import from @/lib/prisma (NOT direct PrismaClient instantiation)
// Always validate with Zod before any DB operation
// Return { error: string } for user-facing errors; throw only for programmer errors
// Re-check role inside MANAGER-only actions (inner gate after middleware outer gate)
```

### Import Path Alias Convention

**Apply to:** All files

```typescript
// Use @/* alias for all cross-module imports (configured by create-next-app --import-alias "@/*")
import { prisma } from "@/lib/prisma"     // ✓ correct
import { auth } from "@/lib/auth"         // ✓ correct
import { loginSchema } from "@/lib/validations/auth"  // ✓ correct
// Never use relative paths like ../../lib/prisma in app/ or components/
```

### shadcn/ui Component Import Convention

**Apply to:** All component files

```typescript
// shadcn components live in components/ui/ — import with @/ alias
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
```

### React Hook Form + Zod Convention

**Apply to:** All form components (login, create user, edit user, password change)

```typescript
"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { someSchema } from "@/lib/validations/..."

type FormValues = z.infer<typeof someSchema>

export function SomeForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(someSchema),
    defaultValues: { /* ... */ },
  })

  async function onSubmit(values: FormValues) {
    const formData = new FormData()
    Object.entries(values).forEach(([k, v]) => formData.append(k, String(v ?? "")))
    const result = await someServerAction(formData)
    if (result?.error) { /* display error */ }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="fieldName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}
```

### cn() Utility Convention

**Apply to:** Any component using conditional Tailwind classes

```typescript
import { cn } from "@/lib/utils"   // Generated by shadcn/ui init

// Usage:
className={cn("base-classes", condition && "conditional-class", otherCondition ? "a" : "b")}
```

---

## No Analog Found

All 22 files have no codebase analog (greenfield). The RESEARCH.md patterns above serve as the analog source for the planner. The planner should reference specific pattern numbers and code excerpt sections above when writing plan action steps.

---

## Critical Constraints Summary

| Constraint | Rule | Enforced By |
|------------|------|-------------|
| Edge runtime safety | `auth.config.ts` must never import bcryptjs or @prisma/client | Code review |
| middleware.ts location | Project root only — never inside /app | Pitfall 2 |
| Version pinning | next@15, prisma@6, next-auth@5.0.0-beta.31, bcryptjs (no @types/bcryptjs) | package.json |
| Password hashing | bcryptjs cost factor 12 | auth.ts + seed.ts |
| Role enforcement | Middleware (outer) + Server Action re-check (inner) | Both layers |
| Session fields | Only id, email, name, role in JWT — never passwordHash | auth.ts callbacks |
| Seed idempotency | Use upsert, not create, in seed.ts | seed.ts |
| First migration | prisma migrate dev --name init (not db push) | README / plan |

---

## Metadata

**Pattern source:** `.planning/phases/01-foundation/01-RESEARCH.md` (all patterns)
**Analog search scope:** Project root (no existing source files — greenfield)
**Files scanned:** 0 source files (project not yet scaffolded)
**Pattern extraction date:** 2026-06-29
