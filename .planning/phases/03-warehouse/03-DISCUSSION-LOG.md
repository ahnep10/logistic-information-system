# Phase 3: Warehouse - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 3-warehouse
**Mode:** --auto (fully autonomous)
**Areas discussed:** StockTransaction schema, Stock page layout, Inventory history structure, Access control, Negative-stock rejection UX

---

## StockTransaction Schema Design

| Option | Description | Selected |
|--------|-------------|----------|
| Type enum + DB reason enum | TransactionType + StockTransactionReason as DB-level enums for strict constraints | |
| Type enum + string reason + audit fields | TransactionType enum for IN/OUT, string reason validated at form level, optional notes, createdById for audit trail | ✓ |
| Minimal (type + product + qty only) | Just the core fields, no reason or audit trail | |

**Auto-selected:** Type enum + string reason + optional notes + createdById
**Rationale:** String reason avoids a migration change if reason categories expand; DB enum for type provides strong constraint where it matters; createdById enables audit trail for warehouse accountability.

---

## `/stock` Page Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Single form with type toggle | One dialog with a radio/select switching between In and Out | |
| Two separate dialogs | "Record Stock In" + "Record Stock Out" buttons → separate dialogs | ✓ |
| Separate /stock/in and /stock/out routes | Two dedicated pages, no dialogs | |

**Auto-selected:** Two separate dialogs
**Rationale:** Matches the established Phase 1-2 Dialog/modal pattern. Keeps the reason dropdowns clean (In and Out have different reason sets). Consistent with existing UX in users, products, suppliers pages.

---

## Inventory History (/inventory) Page Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Per-product drill-in only | Accessed by clicking a product from the product list | |
| Global log with filters | All transactions + product selector + date range + type filter | ✓ |
| Both (global + per-product tab) | Two views on the same page | |

**Auto-selected:** Global log with URL-param filters (product, date range, type)
**Rationale:** Satisfies INVT-05 directly. Staff land here post-login (Phase 1 D-12) — a global view of recent warehouse activity is more useful as a home screen than a per-product drill-in. URL search params make filters shareable.

---

## Access Control for Transactions

| Option | Description | Selected |
|--------|-------------|----------|
| Manager-only (requireManager) | Only managers can record stock transactions | |
| Any authenticated user | Staff + Manager can both record and view | ✓ |

**Auto-selected:** Any authenticated user — no requireManager() guard
**Rationale:** INVT-01/02 explicitly say "Staff can record". INVT-05 says "User can view". This differs from catalog mutations (manager-only) because warehouse operations are staff's primary responsibility.

---

## Negative-Stock Rejection UX

| Option | Description | Selected |
|--------|-------------|----------|
| Toast notification | Error shown as floating toast, dialog closes | |
| Inline form error | Error shown inside the dialog, form stays open for correction | ✓ |
| Pre-validation on quantity blur | Client-side check before submit | |

**Auto-selected:** Inline form error in dialog
**Rationale:** Matches the established error-display pattern from Phase 1-2 forms (Server Action returns `{ error: "..." }`, client component renders it inline). Form stays open so user can correct the quantity without re-opening the dialog.

---

## Claude's Discretion

- Prisma migration file naming and execution steps
- Zod schema location: `lib/validations/stock-transaction.ts`
- Product Select component — standard Select (not searchable) for MVP
- Recent transactions limit on `/stock` page (10 rows suggested)
- Column ordering and responsive table styling
- Badge color variants for IN (green) / OUT (red) type indicators
- Reason storage format (display label vs. lowercase-hyphen slug)

## Deferred Ideas

- Per-product history drill-in from products page ("View History" button per row) — global /inventory with product filter covers INVT-05
- Searchable product dropdown in transaction forms — standard Select sufficient for SME scale
- Pagination on /inventory — 200-row limit covers MVP
- Excel export of transaction history — belongs in Phase 6 Reports (REPT-02)
