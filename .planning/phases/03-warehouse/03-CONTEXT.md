# Phase 3: Warehouse - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the warehouse transaction layer: a Prisma `StockTransaction` model + migration, a `/stock` page for recording stock-in and stock-out transactions, and an `/inventory` page showing the full transaction history with filtering. All stock mutations update `Product.currentStock` atomically in a Prisma interactive transaction that prevents negative stock. Low-stock severity flagging (INVT-04, INVT-06) re-uses the existing severity tier logic from Phase 2 — no new logic needed. The `/products` page already displays severity tiers; this phase focuses on the transaction recording and history views.

Stub pages at `/stock` and `/inventory` exist from Phase 1 scaffolding — replace them with full implementations.

</domain>

<decisions>
## Implementation Decisions

### StockTransaction Prisma Schema

- **D-01:** Add a `StockTransaction` model and a `TransactionType` enum (`STOCK_IN` | `STOCK_OUT`) to `prisma/schema.prisma`. Fields: `id` (cuid), `type` (TransactionType), `productId` (FK → Product), `quantity` (Int, always positive), `reason` (String — validated at form level, not a DB enum), `notes` (String?, optional free-text), `createdById` (FK → User — audit trail), `createdAt` (DateTime @default(now())). No `updatedAt` — transactions are immutable once created.
- **D-02:** `reason` is a plain String (not a DB enum). Form-level validation constrains stock-in reasons to "purchase" | "return" | "adjustment" and stock-out reasons to "sale" | "adjustment" | "write-off" (per INVT-01/02). Keeping it a string avoids a migration change if a new reason type is needed later.
- **D-03:** Add `stockTransactions StockTransaction[]` relation on `Product` model (one-to-many). Add `stockTransactions StockTransaction[]` on `User` model.
- **D-04:** Add DB-level CHECK constraint `currentStock >= 0` on the `products` table via a custom migration SQL statement. This is the hard floor; the application layer's transaction check is the primary guard.

### Atomic Stock Mutation

- **D-05:** All stock mutations (both stock-in and stock-out) use a Prisma interactive transaction: `prisma.$transaction(async (tx) => { ... })`. Researcher/planner must verify exact Prisma 6 interactive transaction syntax (noted as a STATE.md blocker).
- **D-06:** For stock-out: within the transaction, read `Product.currentStock`, check `currentStock >= quantity`. If the check fails, throw an error (caught by the Server Action to return `{ error: "Insufficient stock. Current stock: X." }`). Then decrement and create the transaction record. This is the primary no-negative guard; the DB CHECK constraint is the backstop.
- **D-07:** For stock-in: increment `Product.currentStock` and create the transaction record in a single interactive transaction. No risk of negative stock for stock-in.

### `/stock` Page — Transaction Recording

- **D-08:** The `/stock` page has two prominent action buttons side-by-side: "Record Stock In" and "Record Stock Out". Each opens a separate Dialog (same Dialog/modal pattern as Phase 1-2 Users and Products pages).
- **D-09:** Stock In Dialog form fields: Product (Select — only `isActive: true` products, per Phase 2 D-11), Quantity (number input, min: 1), Reason (Select: "Purchase Received" / "Return" / "Manual Adjustment"), Notes (optional Textarea).
- **D-10:** Stock Out Dialog form fields: Product (Select — only `isActive: true` products), Quantity (number input, min: 1), Reason (Select: "Sale" / "Manual Adjustment" / "Write-Off"), Notes (optional Textarea).
- **D-11:** The `/stock` page also shows a "Recent Transactions" table below the action buttons (last 10 transactions, newest first) — gives warehouse staff immediate confirmation that the recording succeeded and a quick view of recent activity. Server component fetches this; `revalidatePath("/stock")` updates it after each mutation.
- **D-12:** Both Staff and Manager can record transactions — no `requireManager()` guard on stock transaction Server Actions. INVT-01/02 say "Staff can record". Session presence is still required (authenticated guard applies).

### `/inventory` Page — Transaction History

- **D-13:** The `/inventory` page is a global transaction history view (most recent first), with three client-side or URL-param filters:
  - **Product**: Select dropdown ("All Products" default) — filters to one product
  - **From / To**: Two `<input type="date">` fields — filters by date range
  - **Type**: Tabs or Select toggle (All / Stock In / Stock Out)
- **D-14:** History table columns: Date/Time, Product Name, SKU, Type (IN badge / OUT badge), Quantity, Reason, Notes, Recorded By (user name).
- **D-15:** Default view: all transactions for the last 30 days (avoids overwhelming the page on first load). No pagination in MVP — limit 200 rows (sufficient for SME scale). If filters narrow the result further, all matching rows are shown.
- **D-16:** Filtering approach: URL search params (`?productId=...&from=...&to=...&type=...`) so filters are shareable and bookmarkable. Page is a Server Component that reads `searchParams` and passes to Prisma `where`. The filter controls are a `"use client"` component that pushes URL updates via `useRouter`.
- **D-17:** Staff land on `/inventory` after login (Phase 1 D-12). The default 30-day view is an appropriate starting state for a warehouse shift.

### Negative-Stock Rejection UX

- **D-18:** Server Action returns `{ error: "Insufficient stock. Current stock: [N] units." }` when a stock-out would go negative. The client component displays this as an inline error message inside the Stock Out Dialog (same error-display pattern as Phase 1-2 forms). No toast. Form stays open so the user can correct the quantity.

### Claude's Discretion

- Prisma migration file naming and `prisma migrate dev` execution steps — standard workflow.
- Zod validation schema location: `lib/validations/stock-transaction.ts` — follow the existing pattern.
- Product Select dropdown in both dialogs: reuse `components/ui/select.tsx`; if the product list is long, a searchable select is a nice-to-have but not required for MVP. Standard Select is fine.
- Recent transactions limit on `/stock` page: 10 rows is a sensible default; Claude decides final number.
- Column ordering and responsive styling on history table: follow the Phase 2 products/suppliers table pattern.
- Badge variants for IN/OUT type: use existing `badge.tsx` variants (green for IN, red for OUT) — Claude picks appropriate variant names.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap

- `.planning/REQUIREMENTS.md` — INVT-01, INVT-02, INVT-03, INVT-04, INVT-05, INVT-06 (the 6 warehouse requirements this phase satisfies)
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, dependency on Phase 2

### Project & Phase Context

- `.planning/PROJECT.md` — Core value, constraints (single warehouse, SME scale, semester timeline), Key Decisions table
- `.planning/STATE.md` — Blocker: verify exact Prisma 6 interactive transaction syntax before coding begins; verify SELECT FOR UPDATE pattern
- `.planning/phases/02-catalog/02-CONTEXT.md` — D-04/D-05 (currentStock field), D-06/D-07/D-08 (severity tier logic), D-11 (only isActive products in transaction dropdowns)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-12 (Staff redirected to /inventory post-login), D-06 (sidebar structure with "Stock In/Out" and "Inventory History" routes)

### Implementation Patterns to Follow

- `actions/products.ts` — canonical Server Action pattern: `"use server"`, Zod `safeParse`, session check, Prisma mutation, `revalidatePath()`. Stock transaction actions follow the same structure but use `prisma.$transaction()` instead of a plain mutation.
- `app/(protected)/products/page.tsx` — server component pattern: async, Prisma fetch, passes data to client component.
- `app/(protected)/products/products-client.tsx` (or suppliers-client.tsx) — client component pattern: `"use client"`, Dialog state, form submission with Server Actions.
- `lib/validations/product.ts` — Zod schema pattern; create `lib/validations/stock-transaction.ts` following the same structure.

### Schema

- `prisma/schema.prisma` — current schema (User, Category, Product, Supplier). Phase 3 must add `TransactionType` enum, `StockTransaction` model, and relations to Product and User.

### Reusable UI Components

- `components/ui/dialog.tsx` — transaction recording dialogs (Stock In / Stock Out)
- `components/ui/select.tsx` — Product dropdown in transaction forms
- `components/ui/badge.tsx` — IN/OUT type indicator and severity tiers on history table
- `components/ui/table.tsx` — recent transactions and history tables
- `components/ui/input.tsx` — quantity field and date range inputs
- `components/ui/textarea.tsx` — optional notes field
- `components/ui/tabs.tsx` — type filter (All / In / Out) on inventory history page
- `components/ui/form.tsx`, `components/ui/label.tsx`, `components/ui/button.tsx` — standard form elements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `actions/products.ts` — direct template for `actions/stock-transactions.ts` (same structure, add `prisma.$transaction()` wrapper for mutations)
- `components/ui/badge.tsx` — already used for Critical/Warning/OK severity; reuse for IN/OUT type badge and severity on history table
- `components/ui/dialog.tsx` — already used for product/supplier/user create-edit dialogs; reuse for Stock In and Stock Out dialogs
- `components/ui/tabs.tsx` — already installed (used in suppliers page for active/inactive filter); reuse for All/In/Out type filter

### Established Patterns

- **Server + client split:** `page.tsx` (async Server Component, Prisma data fetch) → `xxx-client.tsx` (`"use client"`, dialog state + form submission)
- **Server Actions:** `"use server"`, Zod `safeParse`, session check (not `requireManager()` — any authenticated user), Prisma mutation, `revalidatePath(path)`
- **URL search params for filters:** new in this phase — `/inventory` filters (product, date range, type) go in URL params, read from `searchParams` in the Server Component
- **Soft-delete pattern:** `isActive` guard already established; stock transaction forms must query `{ where: { isActive: true } }` for product dropdown

### Integration Points

- `prisma/schema.prisma` — add `TransactionType` enum + `StockTransaction` model; add `transactions` relation to `Product` and `User`
- `app/(protected)/stock/page.tsx` — replace stub with: stock-in/out action buttons + recent transactions table + `StockClient` component for dialogs
- `app/(protected)/inventory/page.tsx` — replace stub with: server component reading `searchParams`, passing filtered transactions to `InventoryClient` component
- `lib/prisma.ts` — no change needed; same singleton import
- `lib/auth.ts` — same `auth()` import for session check in Server Actions

</code_context>

<specifics>
## Specific Ideas

- **Reason values (exact strings for form labels):**
  - Stock In: "Purchase Received", "Return", "Manual Adjustment"
  - Stock Out: "Sale", "Manual Adjustment", "Write-Off"
  - Stored in DB as lowercase with hyphens (e.g., "purchase-received", "write-off") or as display label — Claude decides a consistent convention
- **Type badges on history table:** "IN" (green) and "OUT" (red/destructive variant) using the existing Badge component
- **Date column format on history table:** "Jul 1, 2026, 14:32" — readable timestamp, not raw ISO string
- **Inventory history default date range:** last 30 days — sensible for a warehouse shift context
- **No-negative error message:** "Insufficient stock. Current stock: [N] units." — specific, actionable message

</specifics>

<deferred>
## Deferred Ideas

- Per-product history drill-in from the products page (e.g., a "View History" button per product row) — useful UX enhancement but not required by INVT-05; the global `/inventory` page with a product filter covers the requirement
- Searchable/filterable product dropdown in transaction forms — nice-to-have for large product catalogs; standard Select is sufficient for SME scale
- Pagination on `/inventory` history — 200-row limit covers MVP; add if needed in a later phase
- Export transaction history to Excel — belongs in Phase 6 Reports (REPT-02)

None — no scope creep attempted during auto-selection.

</deferred>

---

*Phase: 3-Warehouse*
*Context gathered: 2026-07-01*
