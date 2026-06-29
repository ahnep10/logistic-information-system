# Domain Pitfalls — Logistics MIS (B2B Distribution)

**Domain:** Web-based inventory & procurement MIS for SME distribution  
**Researched:** 2026-06-29  
**Overall confidence:** MEDIUM (cross-checked across multiple web sources)

---

## Critical Pitfalls

Mistakes that cause data corruption, system rewrites, or fundamental loss of trust in the system.

---

### Pitfall 1: Race Conditions Producing Negative Stock

**What goes wrong:** Two concurrent requests both read `stock_qty = 1`. Both decrement independently. The database ends up with `stock_qty = -1`. Users see "1 unit in stock" on the dashboard while physically zero units exist. The business ships an order it cannot fulfill.

**Why it happens:** Stock mutations are written as plain `UPDATE products SET qty = qty - 1` without row-level locking or transaction isolation. Works fine in testing (single user); fails in production when two staff members submit transactions within milliseconds of each other.

**Consequences:** Stockouts that the system claims don't exist; overselling; management dashboards showing impossible negative inventory; manual reconciliation required to recover.

**Prevention:**
- Wrap every stock-in and stock-out operation in a database transaction (`BEGIN` / `COMMIT`).
- Use `SELECT ... FOR UPDATE` to acquire a row lock before reading current quantity.
- Add a database-level `CHECK (stock_qty >= 0)` constraint as the last line of defense — the DB will reject the write rather than commit corrupt data.
- On the application layer, handle the constraint violation and surface a user-readable error.

**Detection (warning signs):**
- Any `stock_qty` value goes negative in the database.
- Dashboard "total stock value" decreases unexpectedly without a recorded stock-out.
- Staff report "I just received goods but the count didn't go up."

**Phase to address:** Warehouse module (stock transaction implementation) — Phase 2 or equivalent. Must be designed correctly from the first transaction endpoint; retrofitting locking is painful.

---

### Pitfall 2: PO Goods-Receipt Does Not Atomically Update Inventory

**What goes wrong:** Receiving goods against a PO is split into two separate operations: (1) mark PO status as `Received`, (2) add a stock-in transaction. If step 2 fails (server crash, validation error, user navigates away), the PO shows `Received` but inventory was never incremented. The discrepancy is invisible until a physical count.

**Why it happens:** Developers implement PO status update and inventory creation as two sequential API calls from the frontend, or two separate service calls without a shared transaction boundary.

**Consequences:** PO reporting shows goods received; inventory reporting shows they were never received. Root cause is extremely hard to trace after the fact because both records look individually valid.

**Prevention:**
- Treat PO status transition to `Received` and the corresponding stock-in entry as a single atomic database transaction. If either fails, both roll back.
- Design the API as a single endpoint (`POST /purchase-orders/:id/receive`) that performs both operations inside one transaction — never two separate frontend calls.
- Store the `po_id` reference on the stock movement record so the link is explicit and queryable.

**Detection (warning signs):**
- POs in `Received` status with no corresponding stock movement record sharing the same `po_id`.
- Scheduled integrity check query: `SELECT po.id FROM purchase_orders po LEFT JOIN stock_movements sm ON sm.po_id = po.id WHERE po.status = 'Received' AND sm.id IS NULL` returns rows.

**Phase to address:** Procurement module (goods receipt workflow). Write the integrity check query as a dev-time test from day one.

---

### Pitfall 3: Inventory Accuracy Drift From Unrecorded Movements

**What goes wrong:** Physical stock silently diverges from system records over time. Staff handle ad-hoc adjustments (damaged goods, misplacements, internal use) without recording them. Over weeks, the system shows 200 units; a physical count finds 163. Management loses confidence in the numbers and reverts to spreadsheets.

**Why it happens:** The system makes it easier to skip recording than to record. No mandatory reason field. No adjustment workflow. Staff treat stock movements as optional because the consequence (inaccurate records) is invisible until a count.

**Consequences:** Reorder alerts fire at the wrong thresholds. Management KPIs become meaningless. The system gets labeled "unreliable" and usage collapses.

**Prevention:**
- Require a `reason` field on every stock-out transaction (not optional) — enforce at DB level (`NOT NULL`).
- Provide explicit "Damage/Adjustment" and "Internal Use" reason categories so staff have a correct channel for ad-hoc movements rather than skipping recording entirely.
- Show a "Last recorded movement" timestamp on each product's detail view so gaps become visible.
- Implement a simple cycle-count workflow: manager can flag products for recount, staff submit physical count, system records the delta as an adjustment.

**Detection (warning signs):**
- Products with zero recorded movements for 30+ days while business continues.
- Dashboard "stock movements today" consistently at zero even on busy days.
- Reorder alerts firing for products staff say have plenty of stock.

**Phase to address:** Warehouse module (stock transaction design). The mandatory `reason` field is a schema decision — add it at table creation, not later.

---

## Moderate Pitfalls

---

### Pitfall 4: Dashboard Performance Collapse on Growing Data

**What goes wrong:** The management dashboard loads instantly with 50 products. At 500 products and 5,000 transactions, it takes 8 seconds. At 2,000 transactions, it times out. The "real-time" dashboard becomes the least-used screen.

**Why it happens:** Dashboard KPIs are computed by running `SELECT COUNT(*), SUM(...)` across the full transactions table on every page load. Missing indexes on `created_at`, `product_id`, and `status` columns mean full table scans. N+1 query patterns (loading each product's current stock with a separate query) compound the problem.

**Consequences:** Dashboard unusable during peak hours; managers don't look at it; the core value proposition (real-time visibility) is defeated.

**Prevention:**
- Design dashboard queries with aggregation (`GROUP BY`) rather than loading raw rows and aggregating in application code.
- Add indexes on columns used in WHERE and ORDER BY clauses for all report queries: `created_at`, `product_id`, `status`, `type`.
- Use a single JOIN query to compute "low stock count" rather than fetching all products and filtering in code.
- Cache dashboard summary KPIs with a short TTL (30–60 seconds) rather than recomputing on every request — real-time with a 30-second lag is acceptable for SME operations.
- Add `LIMIT` and date-range filters to all report queries as defaults, never allow unbounded queries.

**Detection (warning signs):**
- `EXPLAIN` or `EXPLAIN ANALYZE` on dashboard queries shows sequential scans.
- Report pages take visibly longer as the date range widens.

**Phase to address:** Dashboard & reporting phase. Run `EXPLAIN` on every dashboard query before marking the phase done.

---

### Pitfall 5: RBAC Enforced at UI Only, Not at the API Layer

**What goes wrong:** The frontend hides the "Manage Products" button from warehouse staff. But the API endpoint `POST /products` has no server-side authorization check. A staff member who discovers the API (via browser DevTools or a tool like Postman) can create, edit, or delete products regardless of their role.

**Why it happens:** Developers treat the UI role check as the authorization system. Server-side route guards are added as an afterthought or not at all.

**Consequences:** Data corruption by unauthorized users; regulatory/audit exposure; loss of data integrity in product master data.

**Prevention:**
- Implement authorization middleware at the route/controller level that checks the authenticated user's role before processing any request — regardless of what the frontend allows.
- Design route guard logic using the same role enum used by the business logic, not string comparisons scattered across files.
- Test authorization explicitly: write automated tests that call restricted endpoints with the wrong role and assert `403 Forbidden`.

**Detection (warning signs):**
- API endpoints that only check `if (user.role === 'manager')` in frontend JavaScript.
- No authorization middleware visible in the route definitions.

**Phase to address:** Auth & access phase (foundational). Must be wired before any protected routes are built, not added at the end.

---

### Pitfall 6: Monolithic "Admin" Role Grants Everything

**What goes wrong:** The system has two roles: `staff` and `manager`. Over time, "manager" becomes a synonym for "can do anything," including recording stock transactions, editing supplier data, and running all reports. Accountability is lost — any action could have been taken by any manager.

**Why it happens:** Roles are assigned too broadly at the start to move fast. Differentiation feels premature for an SME system.

**Consequences:** When data is wrong (a product deleted, a PO incorrectly closed), there is no audit trail to identify who did it. Managers performing operational tasks that should be staff-only creates a data quality problem.

**Prevention:**
- Map role permissions explicitly before writing code: which actions can `staff` take, which can only `manager` take, which are shared.
- Warehouse stock transactions = staff + manager. Product master data management = manager only. Dashboard/reports = manager only. PO creation = staff + manager. PO approval/status management = manager only.
- Store `created_by` (user ID) on every significant record: stock movements, POs, products.

**Phase to address:** Auth & access phase — define the permission matrix in the planning documents before implementation.

---

### Pitfall 7: Reorder Alert Fatigue From Poorly-Calibrated Thresholds

**What goes wrong:** The system is launched with default reorder thresholds set too high (e.g., `reorder_threshold = 10` for every product regardless of velocity). The dashboard shows 80% of products as "low stock" from day one. Staff and managers learn to ignore the low-stock panel. A genuine stockout happens and nobody notices the alert.

**Why it happens:** Thresholds are set once at product creation and never reviewed. The UI shows all low-stock alerts with equal visual weight — a product with 1 unit left looks identical to one with 8 units against a threshold of 10.

**Consequences:** The most important KPI on the dashboard becomes noise. The reorder workflow breaks down.

**Prevention:**
- Make reorder threshold a required field during product creation — force the user to think about it.
- Display the threshold value alongside the current stock on low-stock alerts so staff can see whether the threshold is realistic.
- Distinguish severity: products at 0 units vs. products below threshold should have different visual treatment (critical vs. warning).
- Do not pre-populate a default threshold for new products — require a deliberate number.

**Phase to address:** Warehouse module (product master data + low-stock alert design). A UX decision, not a database one.

---

### Pitfall 8: Scope Creep Into Explicitly-Deferred Features

**What goes wrong:** Delivery tracking (explicitly out of scope) gets added as "just a status field" after seeing a demo. Multi-warehouse support is added "because one client asked." Financial reporting is requested mid-project. Each addition delays the core system and reduces quality of what ships.

**Why it happens:** The out-of-scope list exists in the planning document but is not actively defended. Every addition seems small in isolation.

**Consequences:** The semester deadline arrives with 70% of each feature done and 0% of any feature fully working. The MVP never ships.

**Prevention:**
- Maintain the out-of-scope list as a living document visible in the planning directory, not buried in a requirements document.
- For any new request, explicitly compare it against the out-of-scope list before discussing implementation.
- Apply the rule: if a feature is not in the current phase's plan, it goes into a future backlog, not the current sprint.
- The project's explicit out-of-scope items (delivery tracking, multi-warehouse, ERP integration, customer portal, invoicing) must be defended against pressure at every phase review.

**Detection (warning signs):**
- Any task that references "delivery," "shipment," "invoice," "billing," "second warehouse," or "customer login" appearing in the current backlog.

**Phase to address:** Every phase — this is a process discipline, not a technical one.

---

## Minor Pitfalls

---

### Pitfall 9: Product SKU Without Uniqueness Enforcement

**What goes wrong:** Two staff members create products with the same SKU (or no SKU at all). Inventory movements are later attributed to the wrong product. Reports break when joining on SKU.

**Prevention:** Add a `UNIQUE` constraint on the `sku` column at the database level. On the UI, validate SKU format and display an error if a duplicate is attempted. Make SKU required, not optional.

**Phase to address:** Warehouse module (product master data).

---

### Pitfall 10: No Immutable Audit Trail for Stock Adjustments

**What goes wrong:** A stock-out transaction was recorded incorrectly. A staff member deletes the record to "fix" it. There is now no evidence the transaction ever happened. An audit or dispute cannot be resolved.

**Prevention:** Never allow deletion of stock movement records — mark them as `voided` with a reference to the correcting entry. Add a `voided_by` and `void_reason` column rather than DELETE. This also means `stock_qty` in the products table should always be derivable from the sum of movements.

**Phase to address:** Warehouse module (transaction schema). Schema decision — must be made at table creation time.

---

### Pitfall 11: Reports Built Before Core CRUD is Stable

**What goes wrong:** Development time is spent on complex Excel-export reports and pivot views before the underlying data (stock movements, POs) is reliably captured. The reports then display data from a broken source and appear to work while hiding the upstream problem.

**Prevention:** Prioritize data capture correctness before data presentation. Build reports only after the transaction workflows have been tested end-to-end with real data. Start with simple filtered list views before adding aggregation or exports.

**Phase to address:** Dashboard & reporting phase comes after warehouse and procurement modules.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Auth & RBAC | Server-side authorization skipped; UI-only role checks | Implement route-level middleware first; write a `403` test for every protected route |
| Product master data | Missing SKU uniqueness; no reorder threshold enforcement | Add `UNIQUE` constraint on SKU; require threshold at creation |
| Stock transaction (warehouse) | Race conditions; negative stock; no immutable audit trail | DB transaction + row lock + CHECK constraint + no DELETE policy from day one |
| PO goods receipt | PO status and inventory update not atomic | Single API endpoint; single DB transaction; integrity check query in test suite |
| Low-stock alerts | Alert fatigue from miscalibrated thresholds | Visual severity tiers; require threshold per product; no global defaults |
| Dashboard KPIs | N+1 queries; full-table aggregations on every load | Index on `created_at`/`product_id`/`status`; cache summaries with short TTL |
| Report generation | Unbounded queries timing out; report built before data is reliable | Default date-range filter; `LIMIT`; build reports only after transaction data is verified |
| Every phase | Scope creep into delivery tracking, multi-warehouse, billing | Actively maintain and defend the out-of-scope list at every phase review |

---

## Sources

- AppMaster: Common IMS Implementation Mistakes — https://appmaster.io/blog/ims-implementation-mistakes
- Argos Software: Stock Discrepancies Causes and Prevention — https://www.argosoftware.com/blog/avoid-stock-discrepancies/
- Retail Insight: Inventory Drift — https://www.retailinsight.io/blog/how-to-tackle-inventory-drift
- Logward: Purchase Order Errors — https://logward.com/blog/purchase-order-errors/
- Workbymc: 10 Common PO Workflow Mistakes — https://www.workbymc.com/10-common-mistakes-in-po-workflows-and-how-to-avoid-them/
- Leapcell: Race Conditions with SELECT FOR UPDATE — https://leapcell.io/blog/preventing-race-conditions-with-select-for-update-in-web-applications
- Medium / Ahmed Maher: Fixing Race Conditions in Inventory Systems — https://medium.com/@ahmedmaher22292/fixing-race-conditions-in-inventory-systems-spring-boot-00f5d9b3cbb1
- OSO HQ: RBAC Best Practices — https://www.osohq.com/learn/rbac-best-practices
- App-Scoop: Scope Creep and Feature Bloat — https://app-scoop.com/scope-creep-and-feature-bloat-managing-requirements-in-software-project-management/
- Suppliflex: Inventory Management Mistakes for SMBs — https://blog.suppliflex.tech/2025/11/18/inventory-management-mistakes-smbs/

**Confidence:** MEDIUM — findings cross-checked across multiple independent sources. No LOW-confidence claims presented as authoritative.
