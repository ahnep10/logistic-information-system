# Phase 2: Catalog - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Build and fully implement the product and supplier master data layer: a full-CRUD Categories page, a full-CRUD Products page (with category linkage, SKU, reorder threshold, and currentStock tracking), and a full-CRUD Suppliers page (with contact info and address). All three use soft-deactivation (isActive). The product list displays current stock level and a color-coded severity tier (Critical / Warning / OK). The supplier list supports active/inactive filtering. All forms use the established dialog/modal pattern from Phase 1.

This phase also adds `currentStock Int @default(0)` to the Product schema — Phase 3 will update it atomically on each stock transaction. No stock transaction UI or logic is built in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Category Model

- **D-01:** Category is a full CRUD entity with its own `/categories` management page. Users can create new categories, rename them (edit), and soft-deactivate them. Same dialog/modal UX as the Users page.
- **D-02:** Soft-deactivation only — categories are never hard-deleted. When a category is deactivated, existing products that reference it keep the association (no forced reassignment). Deactivated categories are hidden from the "Category" dropdown when creating or editing products but remain on existing product records.
- **D-03:** Category name is globally unique (unique constraint in DB). A deactivated category's name cannot be reused by a new category.

### Stock Tracking

- **D-04:** `currentStock Int @default(0)` is added to the Prisma `Product` model in Phase 2. Every new product starts at 0. Phase 3 updates this field atomically on each stock transaction (stock-in increments, stock-out decrements with no-negative guard).
- **D-05:** No "initial stock" field on the product creation form. All stock changes happen through Phase 3 stock transactions. If physical stock exists on product creation, staff record a stock-in transaction after Phase 3 is live.

### Severity Tier Logic

- **D-06:** Three tiers, computed from `currentStock` vs. `reorderThreshold`:
  - **Critical** = `currentStock === 0` (completely out of stock — red Badge)
  - **Warning** = `0 < currentStock <= reorderThreshold` (needs restocking — amber/yellow Badge)
  - **OK** = `currentStock > reorderThreshold` (comfortable stock — green Badge)
- **D-07:** "Low-stock" (used in Phase 5 Dashboard KPI count and Phase 3 INVT-04 flag) = Warning + Critical combined, i.e., `currentStock <= reorderThreshold`. A single filter condition covers both tiers.
- **D-08:** Severity is displayed using the existing `components/ui/badge.tsx` shadcn/ui Badge component with variant-based coloring. No new component needed.

### Form UX — Products, Categories, Suppliers

- **D-09:** Create and edit forms for all three entities (Products, Categories, Suppliers) use the Dialog/modal pattern established in the Phase 1 Users page (`users-client.tsx`). No dedicated `/new` or `/[id]/edit` routes.
- **D-10:** Supplier address is a single `<textarea>` field — no structured breakdown into street/city/postal/country. Flexible and sufficient for SUPL-01.
- **D-11:** Deactivated products are excluded from all Phase 3 stock transaction dropdowns. Only `isActive: true` products appear in stock-in/out forms. (Plan this constraint in the Product query for Phase 3 — does not need a UI change in Phase 2.)

### Claude's Discretion

- Prisma schema field ordering and optional vs. required fields (e.g., `description` on Product if useful later — Claude decides based on requirements).
- Pagination: product and supplier lists will likely be small enough for no pagination in MVP. Claude decides at plan time.
- Zod validation schema file location: follow `lib/validations/user.ts` pattern → `lib/validations/product.ts`, `lib/validations/category.ts`, `lib/validations/supplier.ts`.
- SKU format validation: Claude decides a sensible pattern (non-empty string, trimmed, max length ~50).
- Deactivate confirmation UX: use existing `alert-dialog.tsx` confirmation pattern (same as Users page toggle).
- Category dropdown in product form: `<Select>` from `components/ui/select.tsx`, populated with active categories only.
- Server-side role enforcement: Admin-only actions (create/edit/deactivate product, category, supplier) use the `requireManager()` pattern from `actions/users.ts`. Staff can view lists but not mutate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap

- `.planning/REQUIREMENTS.md` — PROD-01, PROD-02, PROD-03, PROD-04 (product catalog requirements) and SUPL-01, SUPL-02, SUPL-03, SUPL-04 (supplier requirements) — the v1 requirements this phase must satisfy
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and dependency on Phase 1
- `.planning/PROJECT.md` — Project context, core value, constraints (single warehouse, SME scale, semester timeline)

### Phase 1 Decisions (carry forward)

- `.planning/phases/01-foundation/01-CONTEXT.md` — D-01/D-02 role structure, D-06/D-07/D-08 RBAC enforcement, D-09 dialog UX, D-10/D-11 sidebar nav items (exact route labels: Products, Categories, Suppliers)

### Implementation Patterns to Follow

- `actions/users.ts` — canonical pattern for Server Actions: `"use server"`, Zod safeParse, role guard (`requireManager()`), Prisma mutation, `revalidatePath()`
- `app/(protected)/users/page.tsx` — server component pattern: async page, parallel data fetch with `Promise.all`, passes data to client component
- `app/(protected)/users/users-client.tsx` — client component pattern: `"use client"`, dialog state management, form submission with Server Actions
- `lib/validations/user.ts` — Zod schema pattern to follow for `lib/validations/product.ts`, `category.ts`, `supplier.ts`

### Schema

- `prisma/schema.prisma` — current schema (User model only); Phase 2 must extend with `Category`, `Product`, `Supplier` models

### Reusable UI Components

- `components/ui/badge.tsx` — severity tier display (Critical/Warning/OK)
- `components/ui/dialog.tsx` — create/edit form dialogs
- `components/ui/alert-dialog.tsx` — deactivation confirmation
- `components/ui/table.tsx` — product and supplier list tables
- `components/ui/select.tsx` — category dropdown in product form
- `components/ui/form.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx` — form fields

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `components/ui/badge.tsx` — use for Critical/Warning/OK severity tiers with color variants
- `components/ui/dialog.tsx` — all create/edit forms open in a Dialog overlay
- `components/ui/alert-dialog.tsx` — deactivation confirmation dialogs
- `components/ui/table.tsx` — product and supplier list tables
- `components/ui/select.tsx` — category dropdown when creating/editing products
- `actions/users.ts` — direct template for product/category/supplier Server Actions

### Established Patterns

- **Server + client split:** `page.tsx` (async server component fetches data via Prisma) → `xxx-client.tsx` (`"use client"` handles dialog state + form submission)
- **Server Actions:** `"use server"` file, Zod `safeParse`, role guard `requireManager()`, Prisma mutation, `revalidatePath(path)` to bust cache
- **Soft-delete:** `isActive Boolean @default(true)` field; deactivate = `update({ data: { isActive: false } })`, never `delete()`
- **Role guard:** `requireManager()` in `actions/users.ts` — import and reuse in all admin-only actions

### Integration Points

- Stub pages already exist at `app/(protected)/products/page.tsx`, `app/(protected)/categories/page.tsx`, `app/(protected)/suppliers/page.tsx` — replace stubs with full implementations
- Sidebar already links to all three routes (from Phase 1 D-11) — no sidebar changes needed
- `lib/prisma.ts` Prisma singleton — import as `import { prisma } from "@/lib/prisma"`
- Auth session via `import { auth } from "@/lib/auth"` — used in Server Actions for role guard

</code_context>

<specifics>
## Specific Ideas

- **Sidebar labels** (from Phase 1 D-11, exact strings): "Products", "Categories", "Suppliers" — these routes already exist as stubs
- **Category dropdown on product form:** shows only `isActive: true` categories; if all categories are deactivated, the dropdown is empty and creation is blocked with an inline message "No active categories — create a category first"
- **SKU uniqueness:** rejected with a specific field-level error: "SKU already exists" — not a generic "invalid input" message
- **Role enforcement on mutations:** Both Manager AND Staff can view lists. Only Manager can create, edit, or deactivate (products, categories, suppliers). Server Actions enforce this server-side; UI hides action buttons for Staff but that is not the security layer.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Catalog*
*Context gathered: 2026-06-30*
