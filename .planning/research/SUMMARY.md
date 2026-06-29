# Project Research Summary

**Project:** Logistics MIS (B2B Distribution)
**Domain:** Internal operations MIS - procurement, warehouse, management reporting
**Researched:** 2026-06-29
**Confidence:** MEDIUM

## Executive Summary

This is a web-based Management Information System for a B2B distribution SME, replacing spreadsheets and paper-based processes with a unified, real-time source of truth for inventory and procurement. Research confirms this is a well-understood domain with established patterns from ERP/WMS literature. The recommended approach is a monolithic Next.js 15 full-stack application with PostgreSQL and Prisma ORM, eliminating a separate backend entirely. This stack is the 2025 community default for internal admin tools and fits a one-semester academic timeline without requiring multi-platform deployment or infrastructure management.

The core architecture is a three-domain monolith - Auth, Procurement, Warehouse, and Reporting - with strict module ownership boundaries. The single most critical integration is the PO goods-receipt workflow, which must atomically update both PO status and inventory stock level in one database transaction. The recommended build order follows foreign-key dependency chains: Auth first, then foundational reference data (products, suppliers), then the warehouse transaction layer, then procurement, and finally the reporting dashboard.

The dominant risks are data integrity failures, not technology choices. Race conditions causing negative stock, non-atomic PO receipt operations, and unrecorded manual adjustments are the three pitfalls that cause management to abandon the system. All three must be addressed at schema and service layer design time. RBAC must be enforced server-side from the first protected route, not only in the UI.

## Key Findings

### Recommended Stack

Next.js 15 with TypeScript is the recommended framework, using Server Components for data fetching and Server Actions for mutations, removing the need for a separate REST API backend. PostgreSQL 16 provides relational integrity for deeply joined procurement and inventory data. Prisma 6 is the ORM with schema-first PSL and visual Studio tooling for development debugging. Auth.js v5 handles authentication with JWT sessions and role-based access stored in the token.

shadcn/ui (Radix-based, Tailwind-native) provides the full component set this MIS needs without lock-in. Recharts covers all required chart types declaratively. React Hook Form with Zod handles form state and server-side validation with shared schemas. Reports are generated as Excel files via the SheetJS xlsx library in a Route Handler. Deployment targets Railway (single platform for Next.js + managed PostgreSQL).

**Core technologies:**
- **Next.js 15**: Full-stack framework - eliminates separate backend; Server Actions handle all mutations
- **PostgreSQL 16**: Primary database - relational integrity for joined procurement/inventory data
- **Prisma 6**: ORM - schema-first, visual Studio, safe migration diffs
- **Auth.js v5**: Authentication - JWT sessions, RBAC via token callbacks, Next.js App Router native
- **shadcn/ui + Tailwind 4**: UI components - full ownership, Radix primitives, Tailwind-native
- **Recharts 3**: Charts - declarative React components for all required KPI visualizations
- **React Hook Form + Zod**: Forms and validation - shared schemas between client and server
- **xlsx (SheetJS)**: Report export - Excel generation in Route Handlers, no server process needed
- **Railway**: Deployment - single platform for app + managed PostgreSQL

### Expected Features

The system must replace spreadsheets, so all table-stakes features are non-negotiable. The dependency chain is firm: Auth gates everything; Product master data is the foundation of inventory; Suppliers are the prerequisite for POs; the PO goods-receipt loop closes procurement into warehouse.

**Must have (table stakes):**
- User authentication with role-based access (staff vs. manager) - gates all other features
- Product master data management (name, SKU, category, reorder threshold) - catalog foundation
- Current stock level per product - the most-asked warehouse question
- Stock-in / stock-out transaction recording with mandatory reason field - core daily operation
- Full stock movement history per product with date-range filter - audit trail
- Configurable reorder threshold with automatic low-stock flag - killer feature vs. spreadsheets
- Supplier profile management - prerequisite for purchase orders
- Purchase Order lifecycle: Draft to Ordered to Received with line items - procurement workflow
- Goods receipt with automatic atomic inventory update - closes procurement-warehouse loop
- Management dashboard with KPI summary - the system core value proposition
- Inventory, stock movement, and PO reports - makes system auditable and decision-useful

**Should have (differentiators):**
- Stock health visual severity tiers (critical / warning / ok) - reduces cognitive load vs. raw numbers
- Clickable low-stock count on dashboard drilling into affected products - saves manager 2+ clicks
- Movement reason categorization (purchase, sale, return, adjustment, write-off) - meaningful reports
- Summary totals on PO line items (computed order value) - reduces manual calculation errors
- Excel report export - managers need to share data; xlsx library is already in stack

**Defer (v2+):**
- Real-time dashboard refresh - data accuracy more important than refresh rate in MVP
- Per-product movement mini-history on product detail - full report covers the need
- PDF export - significant complexity; Excel covers the stated requirement
- Delivery/shipment tracking, multi-warehouse, ERP integration, customer portal, invoicing/billing - explicitly out of scope per PROJECT.md

### Architecture Approach

A three-layer monolith is the correct architecture for this scope. Presentation (React Server Components + Client Components), Application (Server Actions + Route Handlers with service layer), and Data (PostgreSQL via Prisma) are the three layers. The frontend never accesses the database directly. The Dashboard and Reporting module is strictly read-only. The Inventory module is the single writer of stock quantities; the PO module calls the Inventory service during goods receipt. The stock_transactions table is append-only - corrections are compensating records, never deletes or updates.

**Major components:**
1. **Auth Module** - login, JWT issue, role assignment, route-level middleware guard for all protected routes
2. **Product Catalog** - CRUD for product master, SKU uniqueness enforced at DB, reorder threshold required
3. **Supplier Management** - CRUD for supplier profiles; soft-delete via is_active; prerequisite for POs
4. **Inventory / Warehouse Module** - stock transactions (append-only), current stock level (derived), low-stock flags; single writer of stock quantities
5. **Purchase Order Module** - PO lifecycle state machine (DRAFT to ORDERED to RECEIVED, terminal); goods receipt as single atomic endpoint
6. **Dashboard and Reporting** - read-only KPI aggregation, low-stock alerts, PO status summary, Excel report exports

### Critical Pitfalls

1. **Race conditions producing negative stock** - wrap every stock mutation in a DB transaction with SELECT FOR UPDATE row lock; add a DB-level CHECK (current_quantity >= 0) constraint. Must be designed from the first transaction endpoint.
2. **Non-atomic PO goods-receipt** - PO status update and stock-in transaction must be a single DB transaction inside a single API endpoint. Store po_id on the stock_transaction record.
3. **Inventory accuracy drift from unrecorded movements** - require reason field as NOT NULL on every stock-out at DB level; provide explicit adjustment/damage categories so staff have a correct channel.
4. **RBAC enforced at UI only** - implement authorization middleware at route/action level; write automated tests asserting 403 Forbidden for wrong-role calls.
5. **Scope creep** - actively defend the out-of-scope list (delivery tracking, multi-warehouse, billing, customer portal) at every phase review.

## Implications for Roadmap

Based on research, suggested phase structure (6 phases, derived from FK dependency chains and architecture module boundaries):

### Phase 1: Foundation - Auth, RBAC, and Project Scaffolding
**Rationale:** Every subsequent feature requires authenticated access and a users table. RBAC roles define what each module allows. Route-level middleware must be wired before any protected routes are built.
**Delivers:** Working Next.js project scaffold, PostgreSQL + Prisma connected, Auth.js JWT sessions, login/logout UI, role-based middleware, user management (admin only).
**Addresses:** Auth and Access table-stakes feature; RBAC permission matrix defined before implementation.
**Avoids:** Pitfall 5 (UI-only RBAC), Pitfall 6 (monolithic admin role); write 403 tests for every protected route before marking done.

### Phase 2: Product Catalog and Supplier Management
**Rationale:** Foundational reference data tables that everything else depends on. Products and Suppliers share no FK dependency on each other and can be built in parallel within this phase. Inventory row initialization (one row per product) happens here.
**Delivers:** Product CRUD with SKU uniqueness at DB, category management, reorder threshold as required field, inventory row auto-created per product, Supplier CRUD with soft-delete.
**Addresses:** Product master data management, supplier profile management table-stakes features.
**Avoids:** Pitfall 9 (SKU without uniqueness), Pitfall 7 (alert fatigue - require threshold at creation, no global defaults).

### Phase 3: Warehouse Operations - Stock Transactions
**Rationale:** Core operational loop for warehouse staff. Must exist before PO goods receipt can write to it. The append-only transaction log and atomic inventory update pattern must be established here and cannot be retrofitted.
**Delivers:** Stock-in / stock-out recording with mandatory reason field (NOT NULL at DB), current stock level display, full stock movement history with date-range filter, automatic low-stock flag, stock health severity tiers.
**Addresses:** Stock transaction recording, stock movement history, low-stock flag table-stakes; severity tiers differentiator.
**Avoids:** Pitfall 1 (race conditions - DB transaction + row lock + CHECK constraint from day one), Pitfall 3 (accuracy drift - NOT NULL reason, adjustment categories), Pitfall 10 (immutable audit trail - no DELETE policy).

### Phase 4: Procurement - Purchase Orders and Goods Receipt
**Rationale:** Depends on Phase 2 (products, suppliers) and Phase 3 (inventory service). The PO goods-receipt endpoint is the single most complex operation in the system.
**Delivers:** PO creation with line items, PO status state machine (DRAFT to ORDERED to RECEIVED, terminal), goods receipt as single atomic endpoint updating both PO status and inventory, PO list with status visibility.
**Addresses:** Purchase Order lifecycle, goods receipt with automatic inventory update table-stakes; PO line item summary totals differentiator.
**Avoids:** Pitfall 2 (non-atomic goods receipt - single DB transaction, single endpoint, po_id on stock_transaction).

### Phase 5: Management Dashboard
**Rationale:** Reads from all prior tables. Cannot be meaningfully built or tested until real data exists from Phases 2 to 4. The dashboard is the product core value proposition but is entirely derivative.
**Delivers:** KPI summary tiles (total products, suppliers, stock movements today, low-stock count), inventory health panel with linked low-stock alerts, PO status summary, Recharts visualizations.
**Addresses:** Management dashboard table-stakes; clickable low-stock count differentiator.
**Avoids:** Pitfall 4 (dashboard performance - GROUP BY aggregations, indexes on created_at / product_id / status, short-TTL caching; run EXPLAIN on every dashboard query before phase sign-off).

### Phase 6: Reports and Export
**Rationale:** Reports are last because their correctness depends entirely on data capture accuracy from Phases 3 and 4 being verified first. Building reports before core data is reliable hides upstream problems.
**Delivers:** Inventory report (filterable by category), stock movement report (date-range filter), PO report (filterable by supplier/date/status), Excel export via xlsx Route Handler.
**Addresses:** Inventory, movement, and PO reports table-stakes; Excel export differentiator.
**Avoids:** Pitfall 11 (reports built before core CRUD stable), Pitfall 4 (unbounded queries - default date-range filters, LIMIT on all queries).

### Phase Ordering Rationale

- Auth must come first because every route, Server Action, and Prisma query needs session.user.id and session.user.role.
- Products and Suppliers are pure reference data with no upstream FK dependencies and can be parallelized within Phase 2.
- The warehouse transaction layer (Phase 3) must precede procurement (Phase 4) because goods receipt writes to the inventory service.
- Dashboard (Phase 5) must follow all data-producing phases because its correctness depends on real operational data to validate KPI queries.
- Reports (Phase 6) are last because they are the most exposed to upstream data quality.
- This order matches exactly the build sequence recommended in ARCHITECTURE.md and the MVP priority order from FEATURES.md.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Stock Transactions):** Verify exact Prisma 6 interactive transaction and SELECT FOR UPDATE pattern before coding.
- **Phase 4 (Procurement / Goods Receipt):** Verify Prisma 6 interactive transaction callback syntax for the atomic PO-receive operation before designing the service method.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Auth):** Auth.js v5 + Next.js App Router is well-documented with official guides and the nextjs/saas-starter reference.
- **Phase 2 (Catalog):** Standard CRUD with Prisma; shadcn/ui Form + Server Action is routine.
- **Phase 5 (Dashboard):** Recharts + Server Components is fully documented; query optimization addressed by the EXPLAIN requirement.
- **Phase 6 (Reports):** xlsx Route Handler pattern is standard; no novel integration needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | All libraries widely adopted with 2025-era docs; Auth.js v5 is stable beta - verify changelog before pinning |
| Features | MEDIUM | Cross-verified across multiple B2B WMS/IMS sources; table-stakes list is stable |
| Architecture | MEDIUM | Three-layer monolith is well-established in ERP/WMS literature; specific column choices are project adaptations |
| Pitfalls | MEDIUM | Race condition and atomicity pitfalls cross-checked across multiple independent sources |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Auth.js v5 beta stability:** Verify changelog and latest stable release before pinning in package.json during Phase 1.
- **Prisma transaction API:** Verify exact Prisma 6 interactive transaction syntax for the goods-receipt atomic write before Phase 4 implementation.
- **xlsx package version:** STACK.md notes LOW confidence on the 0.18.x version - verify current stable release on npm before Phase 6 installation.
- **Role permission matrix:** Must be a Phase 1 planning artifact defining which specific routes and Server Actions are accessible to STAFF vs. MANAGER vs. ADMIN before any protected routes are built.

## Sources

### Primary (referenced across multiple research files)
- [Auth.js v5 + Next.js App Router](https://authjs.dev/reference/nextjs)
- [Prisma ORM documentation](https://www.prisma.io/docs)
- [shadcn/ui official](https://ui.shadcn.com/)
- [SAP Learning: Processing a Goods Receipt for a PO](https://learning.sap.com/courses/executing-basic-erp-processes-with-sap-s-4hana/processing-a-goods-receipt-for-a-purchase-order)
- [Railway + Next.js deployment guide](https://docs.railway.com/guides/nextjs)

### Secondary (MEDIUM confidence)
- [Prisma vs Drizzle comparison](https://www.prisma.io/docs/orm/more/comparisons/prisma-and-drizzle)
- [System Design for Logistics Management System - Medium (Ayush Mittal)](https://medium.com/@ayush_mittal/system-design-for-logistics-management-system-80b876e29bbb)
- [Inventory Management DB Design - Medium (Bhargava Koya)](https://medium.com/@bhargavkoya56/weekly-db-project-1-inventory-management-db-design-seed-from-schema-design-to-performance-8e6b56445fe6)
- [RBAC Best Practices](https://www.osohq.com/learn/rbac-best-practices)
- [Warehouse KPI Dashboard](https://www.raymondwest.com/learn/blog/2025/aug/warehouse-kpis)
- [Purchase Order Management](https://sourceday.com/blog/purchase-order-management/)
- [Next.js SaaS starter reference](https://github.com/nextjs/saas-starter)

### Tertiary (supporting)
- [Best React chart libraries 2026](https://blog.logrocket.com/best-react-chart-libraries-2026/)
- [AppMaster: Common IMS Implementation Mistakes](https://appmaster.io/blog/ims-implementation-mistakes)
- [Scope Creep and Feature Bloat](https://app-scoop.com/scope-creep-and-feature-bloat-managing-requirements-in-software-project-management/)

---
*Research completed: 2026-06-29*
*Ready for roadmap: yes*
