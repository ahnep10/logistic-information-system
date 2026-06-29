# Logistics MIS

## What This Is

A web-based Management Information System for a B2B distribution company, covering procurement (supplier management, purchase orders), warehouse operations (inventory, stock transactions), and management reporting (real-time dashboards and KPI reports). It is designed for small-to-medium businesses and replaces fragmented manual processes with a unified, real-time source of truth accessible to warehouse staff, procurement staff, and operations managers.

## Core Value

Give managers a single real-time source of truth for inventory and procurement so they can make faster, data-driven decisions, reduce stock shortages, and improve operational efficiency.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Procurement**
- [ ] Manager/admin can create and manage supplier profiles
- [ ] Staff can create purchase orders with line items and submit them (Draft → Ordered)
- [ ] Staff can receive goods against a purchase order (Ordered → Received) and update inventory
- [ ] PO status is visible across all lifecycle stages (Draft, Ordered, Received)

**Warehouse**
- [ ] Admin can manage product master data (name, SKU, category, reorder threshold)
- [ ] System tracks current inventory levels per product
- [ ] Staff can record stock-in and stock-out transactions with reasons
- [ ] Full stock movement history is available per product
- [ ] System automatically flags products below their reorder threshold

**Management Dashboard & Reporting**
- [ ] Dashboard displays real-time KPIs: total products, total suppliers, stock movements today, low-stock count
- [ ] Dashboard shows real-time inventory health and low-stock alerts
- [ ] Dashboard shows purchase order status summary (Draft/Ordered/Received counts)
- [ ] Manager can generate inventory reports (current stock levels per product)
- [ ] Manager can generate stock movement reports (transactions over a date range)
- [ ] Manager can generate purchase order reports (PO list with status and value)

**Auth & Access**
- [ ] Users can log in with role-based access (manager vs. staff)

### Out of Scope

- Delivery/shipment tracking — excluded to keep MVP achievable within one academic semester
- Multi-warehouse support — deferred; single warehouse is sufficient for MVP scope
- ERP or external system integration — not required for SME MVP
- Customer-facing portal — this is an internal operations tool
- Invoicing and billing — out of scope; focus is on operational MIS, not finance

## Context

- Academic project with a one-semester timeline — scope is deliberately bounded
- Target users are SME distribution businesses replacing spreadsheets/paper-based processes
- Three user roles in practice: warehouse staff (transactions), procurement/admin (POs and suppliers), operations manager (dashboard and reports)
- No existing codebase — greenfield

## Constraints

- **Timeline**: One academic semester — scope must remain tight; delivery tracking and multi-warehouse explicitly deferred
- **Scale**: Single warehouse, SME-scale user base (small team, not enterprise volume)
- **Integration**: No external system integrations in MVP — standalone web app
- **Platform**: Web-based application only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Exclude delivery tracking from MVP | Keeps scope achievable within semester timeline | — Pending |
| Single warehouse for MVP | Reduces complexity; sufficient for SME target | — Pending |
| No ERP integration | Simplifies architecture; not needed by SME target segment | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-29 after initialization*
