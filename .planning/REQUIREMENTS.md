# Requirements: Logistics MIS

**Defined:** 2026-06-29
**Core Value:** Give managers a single real-time source of truth for inventory and procurement so they can make faster, data-driven decisions, reduce stock shortages, and improve operational efficiency.

## v1 Requirements

### Authentication & Access

- [x] **AUTH-01**: User can log in with email and password
- [x] **AUTH-02**: User session persists across browser refresh without re-login
- [x] **AUTH-03**: Manager role can access dashboard, reports, and all modules; staff role can perform operational transactions; system enforces roles server-side on every protected route

### Product Catalog

- [x] **PROD-01**: Admin can create a product with name, SKU, category, and reorder threshold
- [x] **PROD-02**: Admin can edit product details (name, category, reorder threshold)
- [x] **PROD-03**: Admin can deactivate a product (soft-delete; does not remove history)
- [x] **PROD-04**: User can view the product list showing current stock level and stock severity tier (Critical / Warning / OK) based on threshold proximity

### Supplier Management

- [x] **SUPL-01**: Staff can create a supplier profile (name, contact person, phone, email, address)
- [x] **SUPL-02**: Staff can edit supplier details
- [x] **SUPL-03**: Staff can deactivate a supplier (soft-delete; preserves linked PO history)
- [x] **SUPL-04**: User can view the supplier list with active/inactive filter

### Warehouse & Inventory

- [x] **INVT-01**: Staff can record a stock-in transaction with product, quantity, and reason category (purchase, return, adjustment)
- [x] **INVT-02**: Staff can record a stock-out transaction with product, quantity, and reason category (sale, adjustment, write-off)
- [x] **INVT-03**: System maintains current stock level per product, updated atomically on each transaction (no negative stock permitted at DB level)
- [x] **INVT-04**: System automatically flags any product whose stock level is at or below its reorder threshold
- [x] **INVT-05**: User can view full stock movement history per product, filterable by date range
- [x] **INVT-06**: Stock levels display a severity tier indicator (Critical / Warning / OK) to reduce cognitive load when scanning inventory

### Procurement & Purchase Orders

- [x] **PROC-01**: Staff can create a purchase order in Draft status, selecting a supplier and adding line items (product + quantity + unit price)
- [x] **PROC-02**: Staff can edit a Draft PO and confirm it, advancing status to Ordered
- [x] **PROC-03**: Staff can receive goods against an Ordered PO, advancing status to Received; the goods receipt atomically creates a stock-in transaction and updates inventory in a single DB transaction
- [x] **PROC-04**: Received PO is immutable; no further status changes permitted after Received
- [x] **PROC-05**: User can view the full PO list with status filter (Draft / Ordered / Received) and PO detail with line items

### Management Dashboard

- [x] **DASH-01**: Manager sees a dashboard with real-time KPIs: total active products, total active suppliers, stock movements recorded today, and count of low-stock items
- [x] **DASH-02**: Low-stock item count on dashboard is clickable and drills into the filtered inventory list showing only low-stock products
- [x] **DASH-03**: Dashboard shows a PO status summary (count of POs in each status: Draft, Ordered, Received)

### Reports

- [x] **REPT-01**: Manager can generate an inventory report showing current stock level and severity tier for all products
- [x] **REPT-02**: Manager can generate a stock movement report showing all transactions over a selected date range, grouped by product
- [x] **REPT-03**: Manager can generate a purchase order report showing all POs with status, supplier, and total order value
- [x] **REPT-04**: Manager can export any report as an Excel (.xlsx) file for offline sharing and further analysis

## v2 Requirements

### Dashboard Enhancements

- **DASH-V2-01**: Dashboard data auto-refreshes in real time without a page reload
- **DASH-V2-02**: Trend sparklines on KPI cards showing movement over the past 7 days

### Reporting Enhancements

- **REPT-V2-01**: PDF export for all reports (significant rendering complexity deferred)
- **REPT-V2-02**: Per-product movement mini-history widget embedded on the product detail page

### Procurement Automation

- **PROC-V2-01**: System automatically generates a Draft PO when a product drops below its reorder threshold (requires approval-workflow design)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Delivery / shipment tracking | Excluded to keep MVP achievable within one academic semester |
| Multi-warehouse support | Single warehouse is sufficient for SME MVP; adds significant schema complexity |
| ERP / external system integration | Not required by target SME segment; adds deployment and security complexity |
| Customer-facing portal | Internal operations tool only; customers not in scope |
| Invoicing and billing | Finance module beyond MIS scope; would require separate accounting logic |
| Barcode scanning | Hardware dependency; not required for SME-scale manual operations |
| Email / SMS notifications | External service dependency; low-stock dashboard alerts cover the need in MVP |
| Demand forecasting | Requires historical data and ML — post-MVP capability |
| Mobile native app | Web-based only; responsive design covers mobile browser access |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| PROD-01 | Phase 2 | Complete |
| PROD-02 | Phase 2 | Complete |
| PROD-03 | Phase 2 | Complete |
| PROD-04 | Phase 2 | Complete |
| SUPL-01 | Phase 2 | Complete |
| SUPL-02 | Phase 2 | Complete |
| SUPL-03 | Phase 2 | Complete |
| SUPL-04 | Phase 2 | Complete |
| INVT-01 | Phase 3 | Complete |
| INVT-02 | Phase 3 | Complete |
| INVT-03 | Phase 3 | Complete |
| INVT-04 | Phase 3 | Complete |
| INVT-05 | Phase 3 | Complete |
| INVT-06 | Phase 3 | Complete |
| PROC-01 | Phase 4 | Complete |
| PROC-02 | Phase 4 | Complete |
| PROC-03 | Phase 4 | Complete |
| PROC-04 | Phase 4 | Complete |
| PROC-05 | Phase 4 | Complete |
| DASH-01 | Phase 5 | Complete |
| DASH-02 | Phase 5 | Complete |
| DASH-03 | Phase 5 | Complete |
| REPT-01 | Phase 6 | Complete |
| REPT-02 | Phase 6 | Complete |
| REPT-03 | Phase 6 | Complete |
| REPT-04 | Phase 6 | Complete |

**Coverage:**

- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-29*
*Last updated: 2026-06-29 — phase assignments added after roadmap creation*
