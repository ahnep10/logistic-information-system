# Technology Stack

**Project:** Logistics MIS (B2B Distribution)
**Researched:** 2026-06-29
**Scope:** SME-scale, single warehouse, greenfield, one-semester academic timeline

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x | Full-stack React framework | Eliminates a separate backend entirely. Server Components fetch data with zero client bundle cost. Server Actions handle all mutations (create PO, receive goods, adjust stock) without writing REST endpoints. File-based routing maps cleanly to the three domain areas: `/dashboard`, `/procurement`, `/warehouse`. Built-in middleware for route-level auth guards. The 2025 default for new TypeScript web apps at this scale. |
| TypeScript | 5.5+ | Static typing | End-to-end type safety across Prisma schema → Server Actions → React components without boilerplate. Catches data-shape mismatches (e.g., `Decimal` vs `number` for PO totals) at compile time. Non-negotiable for a codebase with multiple contributors and no runtime safety net. |
| React | 19.x | UI runtime | Ships with Next.js 15; no separate install decision. React 19's Actions API aligns with Next.js Server Actions pattern. |

**What NOT to use:**
- NOT a separate Express/NestJS/FastAPI backend. Next.js handles API needs through Route Handlers and Server Actions. A second process adds deployment complexity with zero benefit at this scale.
- NOT Vue/Nuxt or SvelteKit. Next.js has the largest ecosystem of MIS/dashboard starter templates in 2025, the most tutorials, and the fastest path from zero to deployed admin tool.

---

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16.x | Primary relational database | Logistics data is deeply relational: POs have line items referencing products referencing categories; stock transactions reference both products and POs. PostgreSQL enforces these constraints at the DB layer, preventing orphaned records that would corrupt inventory counts. Superior to MySQL for complex join queries in report generation. Zero reason to use a document store for this domain. |

**What NOT to use:**
- NOT MySQL. PostgreSQL is the community default for new projects in 2025, has better JSON support, and Prisma's type generation is tighter with it.
- NOT SQLite. Not suitable for a deployed multi-user web app (write locking under concurrent staff usage).
- NOT MongoDB. The procurement and inventory data model is inherently relational. A document store would require application-level join logic and foreign key simulation.

---

### ORM

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Prisma | 6.x | Database access and migrations | Schema-first PSL is self-documenting — reading `schema.prisma` tells you the entire data model at a glance. `prisma migrate dev` computes safe SQL diffs and warns about data loss, making it the "pit of success" for schema evolution. Prisma Studio provides a visual data browser during development — invaluable for debugging inventory counts and PO states without writing raw SQL. A junior developer is productive with Prisma in two days (per comparative studies). Prisma v6 ships with PostgreSQL primary key support for implicit M-N relations. |

**Confidence:** MEDIUM (cross-referenced Prisma docs, makerkit.dev, bytebase.com, betterstack.com)

**Alternative considered:** Drizzle ORM. Better for edge/serverless performance and SQL-control enthusiasts. Rejected because: (1) no Studio equivalent for development debugging, (2) migrations require manual diff validation, (3) nested relations (create PO + line items in one call) require multi-step manual inserts. The performance difference is irrelevant at SME scale.

---

### Authentication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Auth.js (NextAuth) | 5.x | Authentication + session management | The standard auth library for Next.js App Router. Credentials provider handles username/password login against the Prisma user table. JWT session strategy requires no additional database table and works across serverless deployments. The `auth()` function works uniformly in Server Components, Server Actions, and middleware. Role-based access is stored in the JWT via `jwt` callback and surfaced in `session` callback — staff vs. manager routing enforced in `middleware.ts`. Stable release with extensive Next.js 15 tutorials as of 2025. |

**RBAC pattern:** Store `role: "MANAGER" | "STAFF" | "ADMIN"` in the Prisma User model. Forward to JWT in auth callback. Read from `session.user.role` in Server Components and middleware to conditionally render actions (e.g., hide "Generate Reports" from STAFF).

**What NOT to use:**
- NOT manual JWT implementation. Auth.js handles token rotation, CSRF protection, and secure cookie configuration that are easy to get wrong from scratch.
- NOT Clerk or Auth0. Third-party auth services add cost and an external dependency; credential auth for an internal tool does not require OAuth/social login.

---

### UI Component Library

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| shadcn/ui | Latest (CLI-managed) | React component library | Not a package — components are copied into the project source via CLI (`npx shadcn@latest add table`). This means full ownership: no version-lock, no black-box styling, no fighting the library. Built on Radix UI primitives (keyboard navigation and screen readers included). Tailwind-native styling. Provides every component this MIS needs: `Table` for inventory/PO lists, `Form` + `Input` for data entry, `Dialog` for confirmation modals, `Badge` for status labels (Draft/Ordered/Received), `Card` for dashboard KPI tiles, `Sheet` for side panels, `Select` for dropdowns. Admin dashboard templates available at shadcnuikit.com as reference. |
| Tailwind CSS | 4.x | Utility-first CSS | Ships with shadcn/ui init. v4 uses CSS-native cascade layers, no `tailwind.config.js` required for basic usage. Consistent styling vocabulary across all components. |

**What NOT to use:**
- NOT Material UI (MUI) or Ant Design. Both enforce opinionated design tokens that are difficult to override for a custom brand; heavier bundle; more complex theming system.
- NOT Chakra UI. Lower community momentum in 2025 compared to shadcn/ui.

---

### Charting and Data Visualization

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Recharts | 3.x | KPI charts and trend visualization | SVG-based, component-based API — a `<BarChart>` is declared like any React component, no imperative canvas manipulation. Recharts v3 rewrote internal state into smaller chunks, removed the `react-smooth` dependency, and enables `accessibilityLayer` by default. Covers every chart type this MIS needs: BarChart for stock movements, LineChart for inventory trends, PieChart for PO status distribution, AreaChart for procurement spend over time. Integrates cleanly with shadcn/ui layout (both are React component trees). The practical default for internal dashboards in 2025. |

**What NOT to use:**
- NOT Chart.js. Imperative canvas API requires refs and `useEffect` wrappers in React — unnecessary friction vs. Recharts' declarative model.
- NOT D3.js directly. Low-level SVG manipulation; overkill when Recharts already abstracts it correctly for the chart types needed here.
- NOT Tremor. Higher-level abstraction that loses flexibility when dashboard requirements evolve; also tightly coupled to its own design system.

---

### Form Handling and Validation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React Hook Form | 7.x | Form state management | Uncontrolled components by default — no re-render per keystroke. Eliminates the controlled-input boilerplate that clutters forms like "Add Product" and "Create Purchase Order." Integrates with Zod via `@hookform/resolvers`. |
| Zod | 3.x | Schema validation | Define validation once in `/lib/validations/`; reuse the same schema in the Server Action for server-side re-validation. `z.infer<typeof schema>` auto-generates the TypeScript type — no duplicate interface. Handles business rules: minimum quantity > 0, SKU format, reorder threshold >= 0. |
| @hookform/resolvers | 3.x | Bridge package | Connects React Hook Form's `resolver` option to Zod schemas. One import. |

---

### Report Export

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| xlsx (SheetJS Community) | 0.18.x | Excel report export | Managers need to export inventory and PO reports to Excel for further analysis and sharing. `xlsx` runs in a Next.js Route Handler: query Prisma, build a workbook in memory, stream as `.xlsx`. No server-side process required. The de facto standard for spreadsheet generation in Node.js — 12M+ weekly downloads. |

**Note:** PDF export is a common request but adds significant complexity (layout engine). Defer to a later milestone. Excel covers the stated requirement ("generate inventory reports," "generate stock movement reports").

---

### Data Fetching Strategy

No additional state management library is recommended. The Next.js App Router model covers all cases:

| Pattern | When to Use | Example |
|---------|-------------|---------|
| Server Component async fetch | Read-only data for a page | `ProductsPage` fetches inventory list via Prisma directly |
| Server Action | Mutations triggered by forms | `createPurchaseOrder`, `recordStockTransaction` |
| Route Handler (`/api/...`) | Streaming responses, file downloads | `/api/reports/inventory.xlsx` |
| `useOptimistic` | Instant UI feedback before server confirmation | Stock count update optimistic display |

**What NOT to use:**
- NOT TanStack Query (React Query). Valuable for client-side caching of frequently-polling data, but Next.js Server Components and `revalidatePath` cover the dashboard refresh pattern without adding a client-side cache layer. Revisit if dashboard KPIs need WebSocket or polling-based real-time updates.
- NOT Redux or Zustand. No shared client-side application state complex enough to justify a store at this scope.

---

### Infrastructure and Deployment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Railway | Latest | App hosting + managed PostgreSQL | Provides Next.js app deployment and PostgreSQL on a single platform. One `railway up` deploys both. DATABASE_URL is injected automatically. Usage-based pricing with a free trial — appropriate for academic timelines. No multi-platform account management. Simplest end-to-end deployment path for this stack. |

**Free-tier alternative:** Vercel (Next.js, zero-config) + Neon (serverless PostgreSQL, free tier). Two platforms to manage, but both have generous free tiers suitable for academic demos. Neon's serverless Postgres supports standard Prisma connections.

**What NOT to use:**
- NOT AWS/GCP/Azure directly. Infrastructure overhead is not appropriate for a one-semester project.
- NOT Heroku. Pricing model and DX have degraded compared to Railway/Render since 2022.

---

## Installation

```bash
# Scaffold Next.js project
npx create-next-app@latest logistic-system \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd logistic-system

# Database ORM
npm install prisma @prisma/client
npx prisma init --datasource-provider postgresql

# Authentication
npm install next-auth@beta
# (Auth.js v5 is published under the "beta" tag on npm as of mid-2025)

# UI components
npx shadcn@latest init
npx shadcn@latest add table form input button dialog badge card sheet select label textarea

# Charting
npm install recharts

# Forms and validation
npm install react-hook-form zod @hookform/resolvers

# Report export
npm install xlsx

# Dev dependencies
npm install -D @types/node
```

---

## Version Summary (Quick Reference)

| Package | Version | Confidence |
|---------|---------|------------|
| next | 15.x | MEDIUM |
| react | 19.x | MEDIUM |
| typescript | 5.5+ | MEDIUM |
| prisma | 6.x | MEDIUM |
| next-auth (Auth.js) | 5.x (beta) | MEDIUM |
| tailwindcss | 4.x | MEDIUM |
| shadcn/ui | CLI-latest | MEDIUM |
| recharts | 3.x | MEDIUM |
| react-hook-form | 7.x | MEDIUM |
| zod | 3.x | MEDIUM |
| @hookform/resolvers | 3.x | MEDIUM |
| xlsx | 0.18.x | LOW (verify on npm before install) |

**Overall stack confidence: MEDIUM.** All libraries are widely adopted with active communities and 2025-era documentation. The specific combination (Next.js 15 + Prisma 6 + Auth.js v5 + shadcn/ui + Recharts) is a well-established pattern with numerous production references. Auth.js v5 is in stable beta — verify changelog before pinning.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15 | Express + React (SPA) | Requires maintaining two deployments, CORS config, separate API documentation |
| Framework | Next.js 15 | NestJS + Next.js | NestJS adds excellent structure but doubles the surface area for a single-semester scope |
| ORM | Prisma 6 | Drizzle ORM | No visual Studio, manual migration diffs, requires SQL expertise for nested writes |
| ORM | Prisma 6 | TypeORM | Deprecated decorator-based patterns, weaker TypeScript inference than Prisma |
| Auth | Auth.js v5 | Lucia Auth | Smaller community, fewer Next.js tutorials, comparable complexity |
| UI | shadcn/ui | MUI (Material UI) | Heavier bundle, opinionated theming difficult to override, not Tailwind-native |
| UI | shadcn/ui | Ant Design | Enterprise-focused API surface much larger than needed; Chinese-market origin creates occasional inconsistencies in docs |
| Charts | Recharts | Chart.js | Imperative canvas API poorly suited to React's declarative model |
| Charts | Recharts | Tremor | Couples dashboard layout to charting library; limits customization as requirements evolve |
| Database | PostgreSQL | MySQL | PostgreSQL is the 2025 community default; better JSON support; Prisma generates tighter types |
| Database | PostgreSQL | MongoDB | Logistics domain is relational; document model requires app-level join logic |

---

## Sources

- [Prisma ORM vs Drizzle comparison — prisma.io](https://www.prisma.io/docs/orm/more/comparisons/prisma-and-drizzle)
- [Drizzle vs Prisma: Practical comparison — makerkit.dev](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma)
- [Drizzle ORM vs Prisma — bytebase.com](https://www.bytebase.com/blog/drizzle-vs-prisma/)
- [Auth.js v5 with Next.js App Router — authjs.dev](https://authjs.dev/reference/nextjs)
- [shadcn/ui official site](https://ui.shadcn.com/)
- [Tailwind v4 + shadcn/ui](https://ui.shadcn.com/docs/tailwind-v4)
- [Recharts examples](https://recharts.org/en-US/examples)
- [Best React chart libraries 2026 — logrocket.com](https://blog.logrocket.com/best-react-chart-libraries-2026/)
- [Railway + Next.js deployment guide](https://docs.railway.com/guides/nextjs)
- [Next.js Server Actions vs API Routes — dev.to](https://dev.to/myogeshchavan97/nextjs-server-actions-vs-api-routes-dont-build-your-app-until-you-read-this-4kb9)
- [React Hook Form + Zod guide — freecodecamp.org](https://www.freecodecamp.org/news/react-form-validation-zod-react-hook-form/)
- [Prisma ORM v6 upgrade guide — prisma.io](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-6)
- [Next.js SaaS starter (Next.js + Postgres + shadcn/ui) — github.com/nextjs/saas-starter](https://github.com/nextjs/saas-starter)
