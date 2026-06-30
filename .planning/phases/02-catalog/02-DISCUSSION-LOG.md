# Phase 2: Catalog - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 2-Catalog
**Areas discussed:** Category scope, Current stock in Phase 2, Severity tier definition, Form UX (products & suppliers)

---

## Category Scope

### What does the Categories page let users do?

| Option | Description | Selected |
|--------|-------------|----------|
| Full CRUD | Users can create, rename, and deactivate categories. Category becomes its own Prisma model (id, name, isActive). Products select from active categories. Consistent with Users page dialog pattern. | ✓ |
| View-only — predefined list | A fixed seed list that admins cannot change in-app. Simpler schema, but requires dev to add new categories. | |
| No separate Categories page | Category is just a free-text field on the Product form. Sidebar item removed. | |

**User's choice:** Full CRUD
**Notes:** Consistent with the sidebar nav item already in place from Phase 1 (D-11).

---

### When a category is deactivated, what happens to products assigned to it?

| Option | Description | Selected |
|--------|-------------|----------|
| Products keep the category | Deactivated categories still show on existing products but can't be selected for new products. Same soft-delete pattern as users. | ✓ |
| Products must be reassigned first | Block deactivation if any active products use the category. More protection, more friction. | |
| You decide | Claude picks the safest pattern. | |

**User's choice:** Products keep the category
**Notes:** Preserves historical data integrity; deactivated categories simply disappear from the dropdown for new/edited products.

---

### Can the same category name be reused after deactivation?

| Option | Description | Selected |
|--------|-------------|----------|
| No — name is unique globally | Unique constraint on name in the DB. Prevents confusion. | ✓ |
| Yes — unique only among active | Deactivated names can be reused. More complex query logic needed. | |

**User's choice:** No — globally unique
**Notes:** Avoids ambiguity in reporting and history; admins can reactivate if needed.

---

## Current Stock in Phase 2

### How should current stock be stored on a Product?

| Option | Description | Selected |
|--------|-------------|----------|
| currentStock field on Product | Add `currentStock Int @default(0)`. Phase 3 updates atomically on transactions. Simple reads for product list. | ✓ |
| Computed from transactions | No stock field on Product. Computed as SUM of StockTransactions. Product list can't show stock until Phase 3. | |
| You decide | Claude picks the best approach. | |

**User's choice:** currentStock field on Product
**Notes:** Required for Phase 2 success criterion #3 ("Product list shows current stock level"). All new products start at 0.

---

### Can a Manager manually set initial stock on product creation?

| Option | Description | Selected |
|--------|-------------|----------|
| Always starts at 0, transactions only | Keeps records auditable. Staff record stock-in in Phase 3 for existing inventory. | ✓ |
| Optional initial stock on product creation | Convenient but breaks audit trail — stock with no transaction record. | |

**User's choice:** Always starts at 0
**Notes:** Enforces clean audit trail from day one.

---

## Severity Tier Definition

### What defines each severity tier?

| Option | Description | Selected |
|--------|-------------|----------|
| Critical=0, Warning=at/below threshold, OK=above | Critical: currentStock=0. Warning: 0 < currentStock <= reorderThreshold. OK: above threshold. | ✓ |
| Critical=at/below threshold, Warning=within 2× threshold, OK=above 2× | Advance warning before threshold is hit. | |
| You decide | Claude picks the most practical definition. | |

**User's choice:** Critical = 0, Warning = at/below threshold, OK = above
**Notes:** "0 stock" is a distinct emergency state from "low but not zero" — clearest for staff.

---

### For the dashboard KPI "count of low-stock items" — does "low-stock" mean Warning only, or Warning + Critical?

| Option | Description | Selected |
|--------|-------------|----------|
| Warning + Critical combined | Low-stock = currentStock <= reorderThreshold. Both tiers need attention. Simpler filter. | ✓ |
| Warning only | Low-stock = 0 < currentStock <= reorderThreshold. Critical counted separately. | |
| You decide | Claude decides what's most useful for managers. | |

**User's choice:** Warning + Critical combined
**Notes:** Single condition `currentStock <= reorderThreshold` covers both tiers for dashboard filtering.

---

### How should severity tiers be visually shown?

| Option | Description | Selected |
|--------|-------------|----------|
| Colored Badge | shadcn/ui Badge component — red for Critical, yellow/orange for Warning, green for OK. Already exists in `components/ui/badge.tsx`. | ✓ |
| Row background color | Tint entire table row. More visible but more aggressive. New pattern not yet in codebase. | |
| You decide | Claude picks the most consistent treatment. | |

**User's choice:** Colored Badge
**Notes:** Reuses existing `badge.tsx` component — no new component needed.

---

## Form UX (Products & Suppliers)

### How should create/edit forms work for Products and Suppliers?

| Option | Description | Selected |
|--------|-------------|----------|
| Dialog/modal — same pattern as Users | Open create/edit in a Dialog overlay on the list page. Already established in `users-client.tsx`. Zero new routing needed. | ✓ |
| Dedicated /new and /[id]/edit routes | Full-page forms. More form space but new routing pattern. | |
| You decide | Claude picks most consistent pattern. | |

**User's choice:** Dialog/modal — same pattern as Users
**Notes:** Products have 4 fields; suppliers have 5. Both fit comfortably in a dialog.

---

### For the Supplier address field — single text area or structured?

| Option | Description | Selected |
|--------|-------------|----------|
| Single text area | One textarea for the full address. Simple, flexible, works for any format. | ✓ |
| Structured fields | Separate inputs for street, city, postal code, country. Easier to query by city but adds form complexity. | |

**User's choice:** Single text area
**Notes:** SUPL-01 doesn't require structured address; flexibility preferred for SME context.

---

### When an admin deactivates a product — should Phase 3 block stock transactions for it?

| Option | Description | Selected |
|--------|-------------|----------|
| Block — deactivated products can't have new transactions | Phase 3 stock forms only show active products. Prevents phantom inventory on retired products. | ✓ |
| Allow — deactivated products can still receive transactions | No restriction. More flexible but harder to explain. | |
| You decide | Claude picks what makes sense for inventory integrity. | |

**User's choice:** Block
**Notes:** Only active products shown in Phase 3 transaction dropdowns. Constraint lives in Phase 3 query logic, not Phase 2.

---

## Claude's Discretion

- Prisma schema field ordering and optional fields (e.g. optional `description` on Product)
- Pagination: no pagination needed for MVP at SME scale
- Zod schema file locations: `lib/validations/product.ts`, `lib/validations/category.ts`, `lib/validations/supplier.ts`
- SKU format validation: non-empty string, trimmed, max length ~50
- Deactivation confirmation UX: use existing `alert-dialog.tsx` pattern
- Category dropdown: `<Select>` populated with active categories only

## Deferred Ideas

None — discussion stayed within Phase 2 scope.
