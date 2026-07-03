# Phase 4: Procurement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 4-Procurement
**Areas discussed:** PO creation & line items, Goods receipt flow, Status transitions & permissions, PO list & detail views

---

## PO creation & line items

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated page | Line items need room to grow/shrink — Dialog is cramped | ✓ |
| Large Dialog/Sheet | Consistent with Phase 1-3 but tight for dynamic rows | |
| You decide | | |

**User's choice:** Dedicated page (`/purchase-orders/new`)

| Option | Description | Selected |
|--------|-------------|----------|
| Add-row-at-a-time | Inline Product/Qty/Price form, "Add Line" appends to table | ✓ |
| Pre-select multiple then fill qty | Fewer clicks, more complex UI | |
| You decide | | |

**User's choice:** Add-row-at-a-time

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-calculated, block empty confirm | Live client total, server recalculates; 0-line Draft OK, confirm needs 1+ lines | ✓ |
| Total only at confirm time | No live total shown | |
| You decide | | |

**User's choice:** Auto-calculated, block empty confirm

| Option | Description | Selected |
|--------|-------------|----------|
| Always manual entry | No product cost field exists; type price each time | ✓ |
| Add default cost field to Product | Schema scope creep beyond Phase 2 | |

**User's choice:** Always manual entry

---

## Goods receipt flow

| Option | Description | Selected |
|--------|-------------|----------|
| Full receipt only | Whole PO moves to Received atomically, no partial state | ✓ |
| Partial receipt supported | Needs a third status + remaining-qty tracking | |

**User's choice:** Full receipt only

| Option | Description | Selected |
|--------|-------------|----------|
| Editable received-qty per line | Pre-fill ordered qty, allow correction before confirming | ✓ |
| Use ordered quantities as-is | Simpler, no correction path | |

**User's choice:** Editable received-qty per line

| Option | Description | Selected |
|--------|-------------|----------|
| One stock-in transaction per line item | Matches existing StockTransaction schema (one product per row) | ✓ |
| One aggregated transaction | Not possible without a schema redesign | |

**User's choice:** One stock-in transaction per line item

| Option | Description | Selected |
|--------|-------------|----------|
| "Purchase Received" + PO reference | Reuses Phase 3 label; adds nullable purchaseOrderId FK for traceability | ✓ |
| "Purchase Received", no PO linkage | Simpler schema, no traceability | |

**User's choice:** "Purchase Received" + PO reference

---

## Status transitions & permissions

| Option | Description | Selected |
|--------|-------------|----------|
| Both roles, same actions | Manager is a superset of Staff throughout the app | ✓ |
| Staff-only, Manager view-only | Inverts Phase 2's catalog rule; not implied by requirements | |

**User's choice:** Both roles, same actions

| Option | Description | Selected |
|--------|-------------|----------|
| Draft can be deleted | Hard-delete, no stock/history implications yet | ✓ |
| No delete | Abandoned Drafts persist forever | |

**User's choice:** Draft can be deleted

| Option | Description | Selected |
|--------|-------------|----------|
| Re-validate active status at confirm time | Blocks confirm if supplier/product deactivated mid-Draft | ✓ |
| No re-validation | Simpler, ignores the edge case | |

**User's choice:** Re-validate active status at confirm time

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side guard + read-only detail view | Server rejects mutations on Received; UI hides buttons + shows badge | ✓ |
| Server-side guard only | No special UI treatment, user sees rejected action instead | |

**User's choice:** Server-side guard + read-only detail view

---

## PO list & detail views

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs: All/Draft/Ordered/Received | Matches Suppliers active/inactive Tabs pattern | ✓ |
| Select dropdown | Breaks from established Tabs convention | |

**User's choice:** Tabs: All/Draft/Ordered/Received

| Option | Description | Selected |
|--------|-------------|----------|
| PO #, Supplier, Status, Total, Created date, Created by | Full at-a-glance info | ✓ |
| Minimal: PO #, Supplier, Status, Total | Leaner but less audit info | |

**User's choice:** PO #, Supplier, Status, Total, Created date, Created by

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated page /purchase-orders/[id] | Room for line-item table + receive-qty editing UI | ✓ |
| Dialog/Sheet | Breaks from create-page decision, less room | |

**User's choice:** Dedicated page /purchase-orders/[id]

| Option | Description | Selected |
|--------|-------------|----------|
| Human-friendly sequential number | Autoincrement Int, displayed as PO-0001 | ✓ |
| Raw cuid/id | Simpler schema, impractical for staff to reference | |

**User's choice:** Human-friendly sequential number

---

## Claude's Discretion

- Decimal vs Int (cents) representation for `unitPrice`/`totalAmount`
- Zod validation schema file location (`lib/validations/purchase-order.ts`)
- Line-item table styling/responsive behavior
- Badge color variants for DRAFT/ORDERED/RECEIVED
- Whether "Edit Draft" reuses the create-page form or a dedicated `/purchase-orders/[id]/edit` route
- `poNumber` zero-padding width (4 digits assumed)

## Deferred Ideas

- Partial receipt / "Partially Received" status with remaining-balance tracking — explicitly out of scope for this phase, would need schema/state-machine redesign
- Default/pre-fillable unit cost on Product — schema change beyond Phase 2's model, not added now
- Auto-generated Draft PO on low stock — already tracked as PROC-V2-01 in REQUIREMENTS.md v2 section
