# Feature Landscape

**Domain:** B2B Distribution / Logistics MIS (Procurement + Warehouse + Reporting)
**Researched:** 2026-06-29
**Confidence:** MEDIUM (web sources, cross-verified across multiple queries)

---

## Table Stakes

Features users expect. A system that is replacing spreadsheets and paper-based processes
is judged against those baselines — missing any of these makes the system feel incomplete
or not worth the switch.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Product master data management (name, SKU, category, unit) | Without a product catalog there is nothing to track | Low | Admin-only write; all roles read |
| Current stock level per product | The single most-asked question in a warehouse: "how much do we have?" | Low | Derived from transactions; must be real-time |
| Stock-in / stock-out transaction recording | Core operational action; replaces the manual ledger | Low | Must capture reason, quantity, timestamp, actor |
| Full stock movement history per product | Audit trail; managers need to know *why* stock changed | Low | Date-range filter is the minimum useful slice |
| Configurable reorder threshold per product | Prevents stock-outs without requiring manual monitoring | Low | Per-product field on product master |
| Automatic low-stock flag / alert | Notifies manager when any product breaches threshold | Low | Visible on dashboard and in product list |
| Supplier profile management (name, contact, address) | Procurement cannot issue POs without a supplier registry | Low | Admin-only write |
| Purchase Order creation with line items | Core procurement action; replaces PO spreadsheets | Medium | Header (supplier, date) + line items (product, qty, price) |
| PO status lifecycle: Draft → Ordered → Received | Visibility into where every PO is; prevents duplicate ordering | Medium | Status transitions must be logged with timestamp |
| Goods receipt against a PO with auto inventory update | Closing the loop between procurement and warehouse | Medium | Receiving a PO should increase stock levels atomically |
| Role-based access control (staff vs. manager) | Different job functions need different permissions | Medium | Least-privilege; staff cannot access manager reports |
| Management dashboard with KPI summary | The product's core value prop — one screen for operations health | Medium | Counts: products, suppliers, low-stock, today's movements, PO status |
| Inventory report (current stock levels) | Managers need a printable/exportable stock snapshot | Low | Filterable by category; shows quantity vs threshold |
| Stock movement report (date-range transactions) | Audit and planning; what moved and when | Low | Filter by product, date range, movement type |
| Purchase order report (PO list with status and value) | Financial and operational visibility into procurement spend | Low | Filter by status, date range, supplier |
| User authentication (login / session management) | Any multi-user system needs identity | Medium | Secure session; password hashing |

---

## Differentiators

Features that distinguish a polished system from a bare-minimum one. Not expected by
every user comparing against spreadsheets, but valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Dashboard real-time refresh (no page reload) | Managers see operational state change without manual refresh | Medium | Polling or server-sent events; meaningful for shift managers |
| Stock health visual indicator (critical / warning / ok) | Color-coded status reduces cognitive load versus raw numbers | Low | Three-tier threshold: ok / warning (near threshold) / critical (below) |
| PO audit trail (who changed what and when) | Accountability for procurement decisions; useful for disputes | Low | Append-only log per PO; display in PO detail view |
| Inline low-stock count linked to product list | Dashboard KPI is clickable and drills into the offending products | Low | Navigation shortcut that saves manager 2+ clicks |
| Movement reason categorization (purchase, sale, return, adjustment, write-off) | Enables meaningful movement reports distinguishing causes | Low | Controlled vocabulary on transaction form |
| Per-product stock movement mini-history on product detail | Removes need to run a full report for a single product check | Low | Last N transactions shown inline |
| Summary totals on PO line items (computed order value) | Reduces manual calculation error when comparing against budget | Low | Computed field; no new data storage needed |
| Exportable reports (CSV download) | Managers may need to share data or do further analysis in Excel | Medium | Adds value without significant complexity |

---

## Anti-Features

Features to explicitly NOT build in this MVP. Each has a clear reason and a note on
what to do instead.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Delivery / shipment tracking | Requires real-time GPS or carrier integration; doubles scope; explicitly out of scope per PROJECT.md | Track PO receipt as the terminal fulfillment event |
| Multi-warehouse / location tracking | Adds a warehouse dimension to every inventory query; triples data model complexity | Single warehouse assumed; location field is not surfaced in MVP |
| Automated PO generation from reorder triggers | Valuable but requires approval workflow design; creates compliance risk if untested | Show reorder alert on dashboard; procurement staff creates the PO manually |
| Customer-facing portal or order intake | This is an internal ops tool; a customer portal is a separate product | Internal users only; no external authentication surface |
| Invoicing, billing, or accounts payable | Finance workflow is a different domain; ERP territory | Track PO value for reporting; no payment lifecycle |
| Demand forecasting / ML reorder recommendations | Requires historical data volume that a greenfield system does not have on day one | Manual reorder thresholds; can revisit after 3–6 months of data |
| Barcode scanning integration | Hardware dependency; adds native/PWA complexity; not needed to prove MIS value | Manual SKU entry; scanning can be layered in after core is stable |
| Email or SMS notifications for alerts | External service dependency (SMTP / Twilio); increases attack surface and setup cost | In-app dashboard alerts and low-stock count are sufficient for MVP |
| Approval workflows / multi-step PO authorization | Adds state machine complexity; SME team is small enough that role visibility is sufficient | Manager reviews open POs on dashboard; no formal approval gate in MVP |
| ERP or accounting system integration | API integrations with QuickBooks/SAP require ongoing maintenance contracts | Standalone; export CSV for manual import into accounting tools |
| Multi-currency or multi-language support | Internationalisation triples UI testing surface area | Single currency (IDR assumed); single language (Bahasa/English) |
| Supplier portal (supplier self-service) | External authentication surface; changes trust boundary significantly | Internal procurement staff manages all supplier data |

---

## Feature Dependencies

```
User Auth (RBAC)
  └── All features (no unauthenticated access)

Product Master Data
  └── Stock Transactions (cannot record movement without a product)
  └── Reorder Threshold (field on product)
  └── Low-Stock Alert (reads threshold)
  └── Inventory Report (reads product + stock levels)

Stock Transactions
  └── Current Stock Level (derived/aggregated from transactions)
  └── Stock Movement History (filtered view of transactions)
  └── Stock Movement Report (date-range view of transactions)
  └── Dashboard KPI: movements today (count from transactions)

Supplier Profile
  └── Purchase Order (PO references a supplier)

Purchase Order + Line Items
  └── Goods Receipt (receipt is a PO state transition)
  └── Goods Receipt → Stock-In Transaction (receipt auto-creates stock-in)
  └── PO Report (reads POs with status and computed value)
  └── Dashboard KPI: PO status summary (counts by status)

Low-Stock Alert
  └── Dashboard KPI: low-stock count
  └── Dashboard: low-stock product list (drill-down)

All Reports
  └── Product Master Data (display names/SKUs)
  └── Role: Manager-only access
```

---

## MVP Recommendation

### Prioritize (must ship for system to replace spreadsheets)

1. **User auth + RBAC** — without this, nothing else is multi-user safe
2. **Product master data management** — the catalog is the foundation of everything
3. **Stock-in / stock-out transactions** — this is the warehouse staff's core daily action
4. **Current stock levels + movement history** — immediate operational value for the manager
5. **Reorder threshold + low-stock flag** — the "killer feature" vs a spreadsheet
6. **Supplier profile management** — prerequisite for POs
7. **Purchase Order lifecycle (Draft → Ordered → Received)** — procurement workflow
8. **Goods receipt with automatic stock-in** — closes the procurement-warehouse loop
9. **Management dashboard** — the manager's daily entry point; aggregates all the above
10. **Inventory, movement, and PO reports** — makes the system auditable and useful for decisions

### Defer to post-MVP

- CSV export (useful but not blocking)
- Real-time dashboard refresh (polling is lower priority than data accuracy)
- Per-product movement mini-history (nice-to-have; full report covers this)
- PO audit trail (good governance practice; deferred due to timeline)

---

## Sources

- [Why Is Inventory And Supply Chain Management Software Critical For SMEs?](https://margbooks.com/blogs/why-is-inventory-and-supply-chain-management-software-critical-for-smes/) — MEDIUM confidence
- [Purchase Order Management: Process, Risks, and Best Practices](https://sourceday.com/blog/purchase-order-management/) — MEDIUM confidence
- [Low Stock Alerts 101: Stop Running Out of Best Sellers](https://www.kladana.com/blog/wms/low-stock-alerts-guide/) — MEDIUM confidence
- [Role-Based Access Control in Procurement: Security and Speed Combined](https://hoop.dev/blog/role-based-access-control-in-procurement-security-and-speed-combined/) — MEDIUM confidence
- [What is Role Based Access Control in Supply Chain?](https://quloi.com/blog/why-your-supply-chain-needs-role-based-access-control/) — MEDIUM confidence
- [Warehouse KPI Dashboard: The 12 Metrics Every Operations Manager Should Track](https://www.raymondwest.com/learn/blog/2025/aug/warehouse-kpis) — MEDIUM confidence
- [Inventory Movement Report: Guide in 2026](https://www.hashmicro.com/blog/inventory-movement-report/) — MEDIUM confidence
- [Supplier Performance Management: 2026 Procurement Guide](https://business.amazon.com/en/blog/supplier-management-software) — MEDIUM confidence
- [Best Warehouse Management Software for Small Business](https://www.g2.com/categories/warehouse-management/small-business) — MEDIUM confidence
- [Navigating inventory management challenges for SMEs](https://hydrian.com/library/inventory-management-challenges-for-smes/) — MEDIUM confidence
