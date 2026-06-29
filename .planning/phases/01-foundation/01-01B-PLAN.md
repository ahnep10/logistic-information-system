---
phase: 01-foundation
plan: "01B"
type: execute
wave: 1
depends_on:
  - "01-01A"
files_modified:
  - middleware.ts
  - actions/auth.ts
  - app/layout.tsx
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
autonomous: true
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-03

must_haves:
  truths:
    - "Unauthenticated requests to any protected route are redirected to /login by middleware.ts (AUTH-02, AUTH-03)"
    - "Authenticated MANAGER requests to /login are redirected to /dashboard; STAFF to /inventory (D-12)"
    - "STAFF accessing /dashboard, /reports, or /users is silently redirected to /inventory with no error page (D-08, D-09)"
    - "Login page renders at /login with centered Card, email + password inputs, no forgot-password or create-account links (D-03)"
    - "MANAGER sidebar shows 9 nav items (D-11); STAFF sidebar shows 6 items — Dashboard/Reports/Users absent, not hidden (D-07)"
    - "All 8 stub routes resolve without 404 errors"
  artifacts:
    - "middleware.ts — At project root (not in /app); imports from ./auth.config not ./lib/auth"
    - "actions/auth.ts — login() and logout() Server Actions; login() returns { error } on failure"
    - "app/(auth)/login/page.tsx — Full-screen centered Card per UI-SPEC Screen 1"
    - "app/(protected)/layout.tsx — Server Component; reads auth() session; passes role + userName to Sidebar"
    - "components/sidebar.tsx — Role-conditional Server Component; 9-item MANAGER list / 6-item STAFF list"
    - "components/sidebar-nav-item.tsx — Client Component using usePathname() for active state"
    - "8 stub pages in app/(protected)/[route]/page.tsx — each renders an h1 with page display name"
  key_links:
    - "middleware.ts imports auth from ./auth.config — importing from ./lib/auth would crash Edge runtime with Node.js crypto error"
    - "Sidebar receives role prop from layout.tsx session.user.role — sidebar never calls auth() directly"
    - "login() Server Action calls redirect('/') after signIn — middleware intercepts and routes to role home (D-12, D-13)"
    - "SidebarNavItem uses aria-current='page' when isActive — required for accessibility"
---

<objective>
Build the app shell on top of the auth core from Plan 01-01A: middleware RBAC guard, login
page, protected layout with role-conditional sidebar, and stub pages for all 8 domain routes.
After this plan, the walking skeleton is architecturally complete.

Purpose: Deliver the visible, navigable shell that proves the walking skeleton — a developer
can start the app, see the login form, and (after DB setup in Plan 01-02) authenticate as
Manager and land on the dashboard shell with a role-appropriate sidebar.

Output: middleware.ts enforcing RBAC at Edge; login Card UI; app shell with dark sidebar;
MANAGER 9-item / STAFF 6-item nav; 8 TypeScript-clean stub pages. Per D-01–D-13.
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
@.planning/phases/01-foundation/01-01A-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 2: Middleware + Login Page + Server Actions</name>
  <files>
    middleware.ts,
    actions/auth.ts,
    app/layout.tsx,
    app/(auth)/login/page.tsx
  </files>
  <read_first>
    .planning/phases/01-foundation/01-RESEARCH.md — Pattern 2 (middleware.ts RBAC guard full code), Pattern 6 (login Server Action), Walking Skeleton (app/(auth)/login/page.tsx pattern)
    .planning/phases/01-foundation/01-PATTERNS.md — middleware.ts, actions/auth.ts, app/(auth)/login/page.tsx pattern sections, React Hook Form + Zod Convention, shadcn/ui Component Import Convention
    .planning/phases/01-foundation/01-UI-SPEC.md — Screen 1 (Login Page): layout, focal point, structure, interaction contract, copywriting contract, states required, accessibility
    .planning/phases/01-foundation/01-RESEARCH.md — Anti-Patterns: "Placing middleware.ts inside /app", "Importing auth.ts from middleware"
  </read_first>
  <action>
    STEP 1 — Create middleware.ts at PROJECT ROOT (same level as package.json, NOT inside app/):
    Import NextAuth from "next-auth"; authConfig from "./auth.config" (relative — NOT from "@/auth.config" or "@/lib/auth"); NextResponse from "next/server".
    Destructure auth from NextAuth(authConfig).
    Define MANAGER_ROUTES constant as ["/dashboard", "/reports", "/users"].
    Export default auth((req) => { ... }) with the three-case logic:
      Case 1: No session and not on /login → redirect to /login.
      Case 2: Has session and on /login → redirect to role home (MANAGER → "/dashboard", STAFF → "/inventory") per D-12.
      Case 3: Has session, route startsWith a MANAGER_ROUTES entry, and role is not "MANAGER" → redirect to "/inventory" silently (D-08, D-09, no error page, no toast).
      Default: return NextResponse.next().
    Export config.matcher as "/((?!api|_next/static|_next/image|favicon.ico).*)" to exclude Next.js internals.
    CRITICAL: This file imports from "./auth.config" not "./lib/auth" — importing lib/auth.ts in middleware causes Edge runtime crash because bcryptjs uses Node.js crypto.

    STEP 2 — Create actions/auth.ts:
    First line MUST be "use server" directive.
    Import signIn, signOut from "@/lib/auth"; loginSchema from "@/lib/validations/auth"; AuthError from "next-auth"; redirect from "next/navigation".
    Export async function login(formData: FormData): parse email and password from formData, validate with loginSchema.safeParse. On parse failure, return { error: "Invalid email or password. Please check your credentials." }. In try block, call signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirect: false }). Catch AuthError and return { error: "Invalid email or password. Please check your credentials." }. Re-throw non-AuthError exceptions. After successful signIn, call redirect("/") — middleware intercepts this and routes to /dashboard (MANAGER) or /inventory (STAFF) per D-12, D-13.
    Export async function logout(): call signOut({ redirectTo: "/login" }).

    STEP 3 — Update app/layout.tsx root layout to use Inter font:
    Import { Inter } from "next/font/google" with subsets: ["latin"] and display: "swap". Apply the className to the html element body tag.

    STEP 4 — Create app/(auth)/login/page.tsx as a Client Component ("use client"):
    This is a full-page login form per UI-SPEC.md Screen 1.
    Outer wrapper: min-h-screen flex items-center justify-center bg-zinc-50.
    Center a Card with max-w-sm w-full mx-4 shadow-sm border border-zinc-200.
    CardHeader: "Logistics MIS" as h1 (text-2xl font-semibold text-center), "Sign in to your account" as p (text-sm text-zinc-500 text-center mt-1).
    CardContent: Use React Hook Form with zodResolver(loginSchema). Form fields via shadcn Form/FormField/FormItem/FormLabel/FormControl/FormMessage pattern:
      - Email: FormField name="email", Input type="email" autoComplete="email" placeholder="you@company.com"
      - Password: FormField name="password", Input type="password" autoComplete="current-password"
    Server error display: render a paragraph with text-xs text-red-600 below the password field only when serverError state is non-null.
    Submit button: full-width Button type="submit" className="w-full" variant="default" (accent blue-600). When isSubmitting is true, render Loader2 from lucide-react with className "mr-2 h-4 w-4 animate-spin" before the "Sign in" label; set disabled={isSubmitting}.
    No "Forgot password" link. No "Create account" link (D-03).
    onSubmit handler: build FormData from values, call login(formData) Server Action, set serverError from result.error if present. The redirect inside the Server Action handles navigation on success.
    Tab order follows DOM order: Email → Password → Sign in button (natural tab flow).
    Accessibility: all inputs have labels via shadcn FormLabel; no aria-label needed on labeled inputs.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS" | grep -q "^0$" && echo "PASS: No TS errors after middleware + login"</automated>
  </verify>
  <acceptance_criteria>
    - middleware.ts exists at project root (not inside app/ directory)
    - middleware.ts imports from "./auth.config" — verified by checking the import statement references auth.config not lib/auth
    - middleware.ts config.matcher excludes api, _next/static, _next/image, favicon.ico
    - actions/auth.ts first line is the "use server" directive
    - login() returns { error } object on failure — never throws AuthError to the client
    - Login page has CardHeader with "Logistics MIS" heading and "Sign in to your account" subheading (per UI-SPEC copywriting contract)
    - Login page has NO link with text "Forgot" and NO link with text "Create account" or "Register"
    - Sign in button shows Loader2 spinner when isSubmitting and is disabled during submission
    - `npx tsc --noEmit` reports zero TypeScript errors
  </acceptance_criteria>
  <done>Middleware enforces RBAC at Edge; login page renders with Card, email/password fields, submit button with loading state; logout Server Action clears session and redirects to /login</done>
</task>

<task type="auto">
  <name>Task 3: Protected Layout + Role-Conditional Sidebar + Stub Pages</name>
  <files>
    app/(protected)/layout.tsx,
    components/sidebar.tsx,
    components/sidebar-nav-item.tsx,
    app/(protected)/dashboard/page.tsx,
    app/(protected)/inventory/page.tsx,
    app/(protected)/products/page.tsx,
    app/(protected)/categories/page.tsx,
    app/(protected)/suppliers/page.tsx,
    app/(protected)/stock/page.tsx,
    app/(protected)/purchase-orders/page.tsx,
    app/(protected)/reports/page.tsx
  </files>
  <read_first>
    .planning/phases/01-foundation/01-RESEARCH.md — Pattern 7 (protected layout), Architecture Diagram (sidebar structure), Walking Skeleton (stub pages pattern)
    .planning/phases/01-foundation/01-PATTERNS.md — app/(protected)/layout.tsx, components/sidebar.tsx, components/sidebar-nav-item.tsx, stub pages pattern sections, cn() Utility Convention
    .planning/phases/01-foundation/01-UI-SPEC.md — Screen 2 (App Shell): root structure, sidebar dimensions (w-60, bg-slate-900), nav item anatomy, MANAGER 9-item list, STAFF 6-item list, active state (bg-slate-800 + border-l-2 border-blue-600), sidebar footer (Avatar + DropdownMenu), accessibility (aria-current="page")
    .planning/phases/01-foundation/01-CONTEXT.md — D-06 (role-aware sidebar), D-07 (absent not hidden), D-10 (slate-900 + white), D-11 (nav item order), D-12 (role home routes)
  </read_first>
  <action>
    STEP 1 — Create app/(protected)/layout.tsx as an async Server Component:
    Import auth from "@/lib/auth" and redirect from "next/navigation". Import Sidebar from "@/components/sidebar".
    Call const session = await auth(). If !session?.user, call redirect("/login") — belt-and-suspenders behind middleware.
    Return a div with className "flex h-screen overflow-hidden" containing: Sidebar component (props: role={session.user.role}, userName={session.user.name ?? "User"}), and a main element with className "flex-1 overflow-y-auto bg-white" wrapping a div with className "p-6" containing {children}.

    STEP 2 — Create components/sidebar.tsx as a Server Component (no "use client"):
    Import Link from "next/link"; SidebarNavItem from "@/components/sidebar-nav-item"; icons from "lucide-react": LayoutDashboard, Package, Tag, Truck, ArrowLeftRight, History, ShoppingCart, BarChart2, Users, User.
    Import Separator from "@/components/ui/separator"; Avatar, AvatarFallback from "@/components/ui/avatar"; DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator from "@/components/ui/dropdown-menu".
    Import logout from "@/actions/auth".
    Define ALL_NAV_ITEMS array of 9 items in D-11 order with shape { label, href, icon, managerOnly }:
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, managerOnly: true }
      { label: "Products", href: "/products", icon: Package, managerOnly: false }
      { label: "Categories", href: "/categories", icon: Tag, managerOnly: false }
      { label: "Suppliers", href: "/suppliers", icon: Truck, managerOnly: false }
      { label: "Stock In/Out", href: "/stock", icon: ArrowLeftRight, managerOnly: false }
      { label: "Inventory History", href: "/inventory", icon: History, managerOnly: false }
      { label: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart, managerOnly: false }
      { label: "Reports", href: "/reports", icon: BarChart2, managerOnly: true }
      { label: "Users", href: "/users", icon: Users, managerOnly: true }
    Interface SidebarProps: role: string, userName: string.
    Function Sidebar({ role, userName }): filter ALL_NAV_ITEMS — MANAGER sees all 9 (role === "MANAGER"), STAFF sees only !managerOnly items (6 items). Items are completely excluded from JSX — not hidden with CSS (D-07).
    Render aside with className "flex flex-col w-60 bg-slate-900 text-white h-full shrink-0 overflow-hidden":
      Logo area: div h-16 px-4 flex items-center, "Logistics MIS" text in text-white font-semibold text-lg.
      Nav area: nav flex-1 overflow-y-auto px-2 py-2 space-y-1. Map visibleItems to SidebarNavItem components (key={item.href}, spread all props).
      Separator with className "bg-slate-700 mx-4".
      Footer: div p-4 flex items-center gap-3 with Avatar (initials = first letter of first word + first letter of second word of userName, AvatarFallback bg-slate-700) + div for name (text-sm text-slate-100 truncate) and role (text-xs text-slate-500 capitalize lowercase of role string) + DropdownMenu trigger (ChevronDown or similar icon). DropdownMenuContent items: "View Profile" as Link to /profile, DropdownMenuSeparator, "Sign out" form button that calls logout Server Action.

    STEP 3 — Create components/sidebar-nav-item.tsx as a Client Component ("use client"):
    Import usePathname from "next/navigation"; Link from "next/link"; cn from "@/lib/utils"; LucideIcon type from "lucide-react".
    Interface SidebarNavItemProps: label, href, icon (LucideIcon).
    Function SidebarNavItem({ label, href, icon: Icon }):
      const pathname = usePathname().
      const isActive = pathname === href || pathname.startsWith(href + "/").
      Render Link href={href} with aria-current={isActive ? "page" : undefined} and className from cn():
        Base: "flex items-center gap-2 px-3 h-10 rounded-md text-sm transition-colors"
        Active: "bg-slate-800 text-slate-100 border-l-2 border-blue-600"
        Inactive: "text-slate-300 hover:bg-slate-800/60 hover:text-white"
      Inside Link: Icon with className cn("w-4 h-4 shrink-0", isActive ? "text-slate-100" : "text-slate-400") and span with the label text.

    STEP 4 — Create 8 stub pages. Each file exports a default function that returns an h1 with className "text-2xl font-semibold" containing the page's display name:
      app/(protected)/dashboard/page.tsx → "Dashboard"
      app/(protected)/inventory/page.tsx → "Inventory History"
      app/(protected)/products/page.tsx → "Products"
      app/(protected)/categories/page.tsx → "Categories"
      app/(protected)/suppliers/page.tsx → "Suppliers"
      app/(protected)/stock/page.tsx → "Stock In/Out"
      app/(protected)/purchase-orders/page.tsx → "Purchase Orders"
      app/(protected)/reports/page.tsx → "Reports"
    These stub pages will be replaced with full implementations in Phases 2–6.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS" | grep -q "^0$" && echo "PASS: Full project TypeScript-clean"</automated>
  </verify>
  <acceptance_criteria>
    - app/(protected)/layout.tsx is an async Server Component that calls auth() — not a Client Component
    - components/sidebar.tsx has no "use client" directive — Server Component
    - components/sidebar-nav-item.tsx has "use client" as first line — required for usePathname()
    - ALL_NAV_ITEMS array contains exactly 9 items matching D-11 order: Dashboard, Products, Categories, Suppliers, Stock In/Out, Inventory History, Purchase Orders, Reports, Users
    - Sidebar filters by managerOnly: MANAGER role sees all 9 items; STAFF role sees exactly 6 items (items 2–7 above)
    - Active nav item uses bg-slate-800 and border-l-2 border-blue-600 classes; inactive uses text-slate-300
    - SidebarNavItem sets aria-current="page" when isActive is true
    - All 8 stub page files exist in their respective directories
    - `npx tsc --noEmit` reports zero TypeScript errors for the entire project
  </acceptance_criteria>
  <done>Protected layout with dark sidebar shell; MANAGER sees 9-item sidebar; STAFF sees 6-item sidebar (Dashboard/Reports/Users absent); all 8 domain stub routes resolve; walking skeleton is architecturally complete</done>
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
| RBAC middleware | middleware.ts | Next.js runtime (runs on every request before render) |
| Auth Server Actions | actions/auth.ts | Login page form, sidebar logout button |
| Login page | app/(auth)/login/page.tsx | Browser (unauthenticated entry point) |
| App shell layout | app/(protected)/layout.tsx | All authenticated pages |
| Sidebar | components/sidebar.tsx + sidebar-nav-item.tsx | app/(protected)/layout.tsx |
| Domain stub pages | app/(protected)/[8 routes]/page.tsx | Populated in Phases 2–6 |

<verification>
Full plan verification (run after both tasks complete):

1. `npx tsc --noEmit` — zero TypeScript errors across the full project
2. `npx next build 2>&1 | tail -5` — build completes (pages may warn about missing env vars; that is expected until Plan 01-02 sets up .env)

End-to-end verification is gated on Plan 01-02 (DB setup). After Plan 01-02 completes:
3. `npm run dev` starts without crash
4. http://localhost:3000 redirects to /login
5. Login page renders the Card UI with email + password inputs
</verification>

<success_criteria>
- AUTH-02: Auth.js JWT session strategy with 30-day default expiry; HttpOnly cookie prevents client-side JS access
- AUTH-03 (D-06, D-07, D-08, D-09): middleware.ts enforces role on every route; STAFF silently redirected from manager routes; MANAGER sidebar shows 9 items; STAFF sidebar shows 6 items with manager items completely absent
- D-10, D-11: Sidebar is bg-slate-900, width w-60, nav items in prescribed order; main content area is bg-white
- D-12, D-13: Post-login redirect handled by middleware intercepting redirect("/") in login Server Action
- Security: auth.config.ts import in middleware.ts confirmed (not lib/auth.ts); middleware.ts at project root not in /app
</success_criteria>

<output>
Create `.planning/phases/01-foundation/01-01B-SUMMARY.md` when done.
</output>
