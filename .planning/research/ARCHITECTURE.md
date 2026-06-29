# Architecture Patterns

**Project:** Logistics MIS (B2B Distribution)
**Dimension:** Architecture
**Researched:** 2026-06-29
**Confidence:** MEDIUM (cross-checked: web research + standard ERP/WMS patterns corroborated across multiple independent sources)

---

## Recommended Architecture

A three-layer monolith is the correct architecture for this project. Microservices are overkill for an academic semester timeline and a single-warehouse SME scope. The three layers are:

```
┌────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                │
│   React/Vue SPA — module views per domain          │
│   Login | Dashboard | Products | Suppliers |       │
│   Purchase Orders | Stock Transactions | Reports   │
└────────────────────────┬───────────────────────────┘
                         │ HTTP REST (JSON)
                         │ JWT in Authorization header
┌────────────────────────▼───────────────────────────┐
│                  APPLICATION LAYER                 │
│   REST API Server (Node/Express or similar)        │
│   ├── Auth Middleware (JWT verify + RBAC check)    │
│   ├── Route Handlers (thin — delegate to services) │
│   ├── Service Layer (business logic, state machines│
│   │   PO status transitions, inventory math)       │
│   └── Repository/Query Layer (DB access only here)│
└────────────────────────┬───────────────────────────┘
                         │ SQL queries via ORM/query builder
┌────────────────────────▼───────────────────────────┐
│                    DATA LAYER                      │
│   Relational Database (PostgreSQL or MySQL)        │
│   users | suppliers | products | categories |      │
│   purchase_orders | purchase_order_items |         │
│   stock_transactions | (inventory view/table)      │
└────────────────────────────────────────────────────┘
```

The frontend is a single-page application. Every user action goes through the REST API. The database is never accessed directly from the frontend.

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Auth Module** | Login, JWT issue, role assignment, session guard | All other modules (as middleware) |
| **User Management** | Create/edit users, assign roles (admin only) | Auth module |
| **Product Catalog** | CRUD for product master, SKU, category, reorder threshold | Inventory module, PO module |
| **Supplier Management** | CRUD for supplier profiles | PO module |
| **Purchase Order Module** | PO lifecycle: Draft → Ordered → Received; line items | Supplier module, Inventory module |
| **Inventory / Warehouse Module** | Current stock levels, stock-in/out transactions, low-stock flags | Product catalog, PO module, Dashboard |
| **Dashboard & Reporting** | KPI aggregation, low-stock alerts, PO status summary, report exports | All modules (read-only queries) |

**Hard rule:** The Dashboard module only reads. It never writes to any domain table. All writes go through the owning module's service layer.

**Hard rule:** The Inventory module is the single writer of stock quantities. The PO module calls the Inventory service when posting a goods receipt — it does not write to inventory tables directly.

---

## Data Flow: Procurement to Warehouse

This is the most critical integration point in the system.

```
[Supplier exists in DB]
        │
        ▼
Staff creates PO → INSERT purchase_orders (status = DRAFT)
        │            INSERT purchase_order_items (qty_ordered per product)
        │
        ▼
Staff submits PO → UPDATE purchase_orders SET status = 'ORDERED',
        │                                     order_date = NOW()
        │
        ▼
Goods arrive → Staff opens PO, enters qty_received per line item
        │
        ▼  [Goods Receipt POST /api/purchase-orders/:id/receive]
        │
        ├── Validate qty_received ≤ qty_ordered for each line
        │
        ├── For each line item:
        │     INSERT stock_transactions (
        │       product_id, type='IN', quantity=qty_received,
        │       reference_type='PO_RECEIPT', reference_id=po_id,
        │       created_by=current_user_id
        │     )
        │     UPDATE inventory SET current_quantity += qty_received
        │       WHERE product_id = line_item.product_id
        │
        └── UPDATE purchase_orders SET status = 'RECEIVED',
                                       received_date = NOW()
        │
        ▼
Dashboard reads: inventory table shows updated quantities
                 low-stock check: current_quantity < reorder_threshold
                 PO status summary: count by status
```

**Key invariant:** Every change to `inventory.current_quantity` must have a corresponding `stock_transactions` row. The transaction log is the source of truth; the inventory table is a running total derived from it. This enables full audit history.

---

## Database Schema

### Core Tables

**users**
```sql
id            SERIAL PRIMARY KEY
name          VARCHAR(255) NOT NULL
email         VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
role          ENUM('ADMIN', 'STAFF', 'MANAGER') NOT NULL
is_active     BOOLEAN DEFAULT TRUE
created_at    TIMESTAMP DEFAULT NOW()
updated_at    TIMESTAMP DEFAULT NOW()
```

**suppliers**
```sql
id            SERIAL PRIMARY KEY
name          VARCHAR(255) NOT NULL
contact_person VARCHAR(255)
email         VARCHAR(255)
phone         VARCHAR(50)
address       TEXT
is_active     BOOLEAN DEFAULT TRUE
created_at    TIMESTAMP DEFAULT NOW()
updated_at    TIMESTAMP DEFAULT NOW()
```

**categories**
```sql
id            SERIAL PRIMARY KEY
name          VARCHAR(255) UNIQUE NOT NULL
```

**products**
```sql
id                SERIAL PRIMARY KEY
name              VARCHAR(255) NOT NULL
sku               VARCHAR(100) UNIQUE NOT NULL
category_id       INTEGER REFERENCES categories(id)
description       TEXT
unit_price        DECIMAL(12,2) DEFAULT 0
reorder_threshold INTEGER DEFAULT 0       -- flag when stock < this
is_active         BOOLEAN DEFAULT TRUE
created_at        TIMESTAMP DEFAULT NOW()
updated_at        TIMESTAMP DEFAULT NOW()
```

**inventory**
```sql
id                SERIAL PRIMARY KEY
product_id        INTEGER UNIQUE REFERENCES products(id)
current_quantity  INTEGER NOT NULL DEFAULT 0
last_updated      TIMESTAMP DEFAULT NOW()
```
*One row per product. Updated atomically alongside every stock_transaction insert.*

**stock_transactions**
```sql
id               SERIAL PRIMARY KEY
product_id       INTEGER REFERENCES products(id)
transaction_type ENUM('IN', 'OUT', 'ADJUSTMENT') NOT NULL
quantity         INTEGER NOT NULL              -- always positive; type gives direction
reference_type   ENUM('PO_RECEIPT', 'MANUAL_IN', 'MANUAL_OUT', 'ADJUSTMENT')
reference_id     INTEGER                       -- purchase_order_id if PO_RECEIPT
reason           TEXT
created_by       INTEGER REFERENCES users(id)
created_at       TIMESTAMP DEFAULT NOW()
```
*Append-only. Never update or delete rows.*

**purchase_orders**
```sql
id             SERIAL PRIMARY KEY
po_number      VARCHAR(50) UNIQUE NOT NULL    -- e.g. PO-2026-0001
supplier_id    INTEGER REFERENCES suppliers(id)
status         ENUM('DRAFT', 'ORDERED', 'RECEIVED') NOT NULL DEFAULT 'DRAFT'
order_date     DATE
received_date  DATE
notes          TEXT
created_by     INTEGER REFERENCES users(id)
created_at     TIMESTAMP DEFAULT NOW()
updated_at     TIMESTAMP DEFAULT NOW()
```

**purchase_order_items**
```sql
id                   SERIAL PRIMARY KEY
purchase_order_id    INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE
product_id           INTEGER REFERENCES products(id)
quantity_ordered     INTEGER NOT NULL
quantity_received    INTEGER DEFAULT 0
unit_price           DECIMAL(12,2) NOT NULL
line_total           DECIMAL(12,2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED
```

### Key Foreign Key Map

```
users ──────────────────────────────► (created_by on purchase_orders, stock_transactions)
suppliers ──────────────────────────► purchase_orders.supplier_id
categories ─────────────────────────► products.category_id
products ───────────────────────────► inventory.product_id (1:1)
products ───────────────────────────► stock_transactions.product_id
products ───────────────────────────► purchase_order_items.product_id
purchase_orders ────────────────────► purchase_order_items.purchase_order_id
purchase_orders ────────────────────► stock_transactions.reference_id (when PO_RECEIPT)
```

---

## Patterns to Follow

### Pattern 1: State Machine for PO Status

The PO lifecycle follows a strict one-way state machine. Invalid transitions must be rejected at the service layer, not just the frontend.

```
DRAFT ──[submit]──► ORDERED ──[receive]──► RECEIVED
                                              (terminal)
```

Enforce in the service: if `currentStatus !== 'ORDERED'` when attempting a receive, return HTTP 409 Conflict.

### Pattern 2: Append-Only Transaction Log

Never update `stock_transactions`. When correcting an error, insert a compensating record (e.g., a negative ADJUSTMENT). This preserves a complete, tamper-evident history for management reports.

### Pattern 3: Thin Route Handlers, Fat Services

Route handlers validate input (request parsing, basic validation) and delegate to service classes. Services contain all business logic, call repositories for DB access, and return domain objects. This makes unit testing possible without HTTP overhead.

```
Route Handler  →  validates request shape
                  calls ProductService.create(dto)
Service Layer  →  applies business rules
                  calls ProductRepository.insert(entity)
Repository     →  executes SQL/ORM query
                  returns raw DB row
```

### Pattern 4: RBAC via Middleware

Apply role checks as route middleware, not inside service methods. Each route declares its required role(s). The auth middleware verifies JWT and attaches `req.user`. A second middleware checks `req.user.role` against the route's allowed roles.

```
POST /api/purchase-orders → [authRequired, roleRequired('STAFF', 'ADMIN')] → handler
GET  /api/reports/inventory → [authRequired, roleRequired('MANAGER', 'ADMIN')] → handler
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Updating Inventory Without a Transaction Record

**What goes wrong:** Code directly does `UPDATE inventory SET current_quantity = X` when a PO is received, without inserting a `stock_transactions` row.

**Consequences:** Inventory reports are wrong. Managers cannot see why stock changed. The stock movement history report returns no data. Audits are impossible.

**Instead:** Always insert a `stock_transactions` row first, then update `inventory.current_quantity`. Wrap both in a database transaction (atomic).

### Anti-Pattern 2: Allowing PO Status Jumps

**What goes wrong:** Frontend sends PATCH with `status: 'RECEIVED'` on a DRAFT PO, bypassing the ORDERED state.

**Consequences:** No `order_date` is recorded. Inventory is updated without a real order ever being placed. Data integrity breaks.

**Instead:** Validate status transitions in the service layer, not just the frontend. Return 409 if the current status does not allow the requested transition.

### Anti-Pattern 3: Business Logic in Route Handlers

**What goes wrong:** The goods receipt logic (qty validation, stock update, PO status change) lives in the Express route handler directly.

**Consequences:** Cannot unit test without spinning up the HTTP server. Logic gets duplicated when a second entry point is added. Error handling is inconsistent.

**Instead:** Route handler calls `PurchaseOrderService.receiveGoods(poId, lineItems, userId)`. All logic lives there.

### Anti-Pattern 4: Soft-Delete via Status Instead of `is_active`

**What goes wrong:** Deleting a supplier by setting `status = 'deleted'` rather than using an `is_active` boolean.

**Consequences:** Queries must filter by a string enum instead of a boolean index. Existing POs reference a "deleted" supplier and queries break or return inconsistent data.

**Instead:** Use `is_active = false` for soft deletes on suppliers and products. Existing POs retain their supplier reference and display correctly. All list queries add `WHERE is_active = TRUE`.

---

## Suggested Build Order

This order is derived from foreign-key dependencies: you cannot build a feature until its dependencies exist.

| Phase | Module | Why This Order |
|-------|--------|----------------|
| **1** | Auth + User Management | Every subsequent feature requires authenticated access and a `users` table. RBAC roles define what each module allows. |
| **2** | Product Master (categories + products + inventory row init) | Foundational reference data. Suppliers and POs cannot reference products that don't exist. Inventory records are created here. |
| **3** | Supplier Management | Reference data for POs. Can be built in parallel with Phase 2 since neither depends on the other. |
| **4** | Inventory / Warehouse Module (stock transactions, manual stock-in/out, low-stock flags) | Core operational loop. Must exist before PO goods receipt can write to it. |
| **5** | Procurement / Purchase Order Module (PO CRUD + goods receipt → triggers inventory update) | Depends on Phase 2 (products), Phase 3 (suppliers), Phase 4 (inventory service). This is the critical integration. |
| **6** | Dashboard + Reporting | Reads from all prior tables. Cannot be meaningfully built or tested until real data exists from Phases 2–5. |

**Phases 2 and 3 can run in parallel** because they share no foreign key dependencies (only products reference categories, which is internal to Phase 2).

---

## Scalability Considerations (for context — not MVP concerns)

| Concern | At SME Scale (current) | At Enterprise Scale (future) |
|---------|------------------------|------------------------------|
| Inventory reads | Simple SELECT with index on product_id | Caching layer (Redis) for dashboard KPIs |
| Stock transaction volume | Single table, indexed on created_at | Partitioned by month/year |
| Concurrent stock updates | DB transaction wrapping update + insert is sufficient | Optimistic locking or queue-based inventory updates |
| Reporting | Synchronous SQL aggregations | Materialized views or separate read replica |
| Multi-warehouse | Not in scope | Expand inventory table to (product_id, warehouse_id) composite key |

---

## Sources

- [Design ER Diagrams for Inventory and Warehouse Management — GeeksforGeeks](https://www.geeksforgeeks.org/sql/how-to-design-er-diagrams-for-inventory-and-warehouse-management/) — schema entity structure
- [Inventory Management DB Design — Medium (Bhargava Koya)](https://medium.com/@bhargavkoya56/weekly-db-project-1-inventory-management-db-design-seed-from-schema-design-to-performance-8e6b56445fe6) — specific table/column patterns
- [System Design for Logistics Management System — Medium (Ayush Mittal)](https://medium.com/@ayush_mittal/system-design-for-logistics-management-system-80b876e29bbb) — microservice vs monolith component breakdown
- [Processing a Goods Receipt for a Purchase Order — SAP Learning](https://learning.sap.com/courses/executing-basic-erp-processes-with-sap-s-4hana/processing-a-goods-receipt-for-a-purchase-order) — GR-to-inventory data flow
- [Web Application Architecture: Front-end, Middleware and Back-end — DEV Community](https://dev.to/techelopment/web-application-architecture-front-end-middleware-and-back-end-2ld7) — three-layer pattern
- [How to Build a Logistics Management Software — Techstack](https://tech-stack.com/blog/how-to-build-a-logistics-management-software/) — module dependencies and build considerations
- [Warehouse Management System Development Guide — MindInventory](https://www.mindinventory.com/blog/warehouse-management-system-development-guide/) — WMS component structure

*Confidence: MEDIUM — patterns are well-established across ERP/WMS literature; specific column names and exact field choices are project decisions adapted from common schemas.*
