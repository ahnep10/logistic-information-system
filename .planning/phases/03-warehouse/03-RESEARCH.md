# Phase 3: Warehouse - Research

**Researched:** 2026-07-01
**Domain:** Prisma 6 atomic transactions, Next.js 15 URL search params, stock mutation safety
**Confidence:** MEDIUM

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** StockTransaction model: `id` (cuid), `type` (TransactionType), `productId` (FK → Product), `quantity` (Int, always positive), `reason` (String), `notes` (String?), `createdById` (FK → User), `createdAt` (DateTime @default(now())). No `updatedAt`.
- **D-02:** `reason` is a plain String (not a DB enum). Form validation constrains values to defined sets.
- **D-03:** Add `stockTransactions StockTransaction[]` relation on `Product` and `User` models.
- **D-04:** Add DB-level CHECK constraint `currentStock >= 0` on `products` table via custom migration SQL.
- **D-05:** All stock mutations use `prisma.$transaction(async (tx) => { ... })` interactive transaction.
- **D-06:** Stock-out: read `Product.currentStock`, check `currentStock >= quantity`. If check fails, throw and return `{ error: "Insufficient stock. Current stock: [N] units." }`. Form stays open, no toast.
- **D-07:** Stock-in: increment `Product.currentStock` + create transaction record in a single interactive transaction.
- **D-08:** `/stock` page has two action buttons: "Record Stock In" and "Record Stock Out", each opening a separate Dialog.
- **D-09:** Stock In Dialog: Product (Select, isActive only), Quantity (number min:1), Reason (Select: "Purchase Received"/"Return"/"Manual Adjustment"), Notes (optional Textarea).
- **D-10:** Stock Out Dialog: Product (Select, isActive only), Quantity (number min:1), Reason (Select: "Sale"/"Manual Adjustment"/"Write-Off"), Notes (optional Textarea).
- **D-11:** `/stock` page also shows "Recent Transactions" table (last 10 transactions, newest first).
- **D-12:** Both Staff and Manager can record transactions — no `requireManager()` guard; authenticated session required.
- **D-13:** `/inventory` page with URL-param filters: Product, From/To date, Type (All/In/Out).
- **D-14:** History table columns: Date/Time, Product Name, SKU, Type badge, Quantity, Reason, Notes, Recorded By.
- **D-15:** Default view: last 30 days, limit 200 rows.
- **D-16:** Filtering via URL search params (`?productId=...&from=...&to=...&type=...`). Server Component reads `searchParams`. Filter controls are a `"use client"` component using `useRouter`.
- **D-17:** Staff land on `/inventory` after login (Phase 1 D-12).
- **D-18:** Insufficient-stock error displayed inline inside Stock Out Dialog, form stays open.

### Claude's Discretion

- Prisma migration file naming and `prisma migrate dev` execution steps.
- Zod schema location: `lib/validations/stock-transaction.ts`.
- Product Select dropdown: standard Select is fine (no searchable select for MVP).
- Recent transactions limit on `/stock` page: 10 rows.
- Column ordering and responsive styling: follow Phase 2 products/suppliers table pattern.
- Badge variants for IN/OUT type: green for IN, red/destructive for OUT.
- Reason storage convention: Claude decides (display label vs. kebab-case slug).

### Deferred Ideas (OUT OF SCOPE)

- Per-product history drill-in from the products page.
- Searchable/filterable product dropdown.
- Pagination on `/inventory` history.
- Export transaction history to Excel (Phase 6).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INVT-01 | Staff can record a stock-in transaction with product, quantity, and reason category (purchase, return, adjustment) | D-05/D-07/D-09: atomic $transaction pattern + Dialog form pattern |
| INVT-02 | Staff can record a stock-out transaction with product, quantity, and reason category (sale, adjustment, write-off) | D-05/D-06/D-10: atomic $transaction + negative-stock guard + Dialog form pattern |
| INVT-03 | System maintains current stock per product, updated atomically — no negative stock at DB level | D-04: CHECK constraint migration + D-05: interactive transaction as primary guard |
| INVT-04 | System automatically flags any product at or below reorder threshold | Already implemented via `getSeverityBadge()` in `lib/utils/severity.ts` — no new logic needed |
| INVT-05 | User can view full stock movement history per product, filterable by date range | D-13/D-16: URL searchParams Server Component + Prisma gte/lte date filter |
| INVT-06 | Stock levels display severity tier indicator (Critical / Warning / OK) | Reuse existing `getSeverityBadge()` on history table rows — no new logic needed |
</phase_requirements>

---

## Summary

Phase 3 introduces the stock transaction layer on top of the catalog built in Phase 2. The two new pages — `/stock` (transaction recording) and `/inventory` (transaction history) — both follow the same server/client split pattern established in previous phases. The only genuinely new technical territory is: (1) Prisma interactive transactions for atomic stock mutations, (2) Next.js 15 async `searchParams` handling, and (3) client-side URL param management via `useRouter`.

The key blocker flagged in STATE.md is resolved: Prisma 6 interactive transactions use `prisma.$transaction(async (tx) => { ... })` where `tx` is a `Prisma.TransactionClient`. Native `SELECT FOR UPDATE` does not exist in Prisma's API; the recommended approach at SME scale is an application-level stock check inside the transaction combined with the DB-level `CHECK (currentStock >= 0)` constraint as the hard backstop. This pattern is directly analogous to the bank-transfer example in Prisma's official documentation.

The severity tier logic (INVT-04, INVT-06) is already implemented in `lib/utils/severity.ts` and requires zero new code — only import and reuse. All shadcn/ui components needed are already installed. The base-ui `render` prop pattern for Dialog triggers (established in Phase 1-2) must be followed here as well.

**Primary recommendation:** Model the stock transaction actions directly on `actions/products.ts` — same structure, same Zod-safeParse-first pattern — adding `prisma.$transaction()` wrapper around the two Prisma calls (update Product + create StockTransaction).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stock mutation (record in/out) | API / Backend (Server Action) | — | Mutations must be server-side; session check + atomic DB transaction |
| Negative-stock guard | API / Backend (Server Action) | Database (CHECK constraint) | Primary guard is application logic in tx; DB constraint is hard backstop |
| Transaction recording | Database / Storage (Prisma) | — | StockTransaction row creation happens inside interactive transaction |
| Recent transactions display | Frontend Server (SSR) | — | Server Component fetches last 10 on page load; revalidated after mutation |
| Inventory history + filtering | Frontend Server (SSR) | — | Server Component reads URL searchParams, queries Prisma, passes to Client |
| Filter controls (URL update) | Browser / Client | — | `useRouter().push()` from client component; no server round-trip for filter changes |
| Severity tier badge | Browser / Client | — | Pure computation from currentStock + reorderThreshold; existing `getSeverityBadge()` |
| Low-stock flagging | Browser / Client | — | Derived from severity tier logic; no dedicated server-side flag needed |

---

## Standard Stack

### Core (all already installed — no new packages this phase)

| Library | Installed Version | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| `@prisma/client` | 6.19.3 | Database access + interactive transactions | Schema-first; `$transaction` API handles atomicity |
| `prisma` | 6.19.3 | Migration CLI | `--create-only` flag enables custom SQL injection |
| `next` | 15.5.19 | Server Components + Server Actions | `searchParams` async prop; `revalidatePath` |
| `next-auth` | 5.0.0-beta.31 | Session in Server Actions | `auth()` import from `@/lib/auth` |
| `zod` | 4.4.3 | Schema validation | Same pattern as `lib/validations/product.ts` |
| `react-hook-form` | 7.80.0 | Form state | Uncontrolled inputs; integrates with Zod via resolvers |
| `@hookform/resolvers` | 5.4.0 | Zod bridge | `zodResolver()` for RHF |
| `@base-ui/react` | 1.6.0 | Dialog, Tabs primitives | Already installed; base-ui `render` prop pattern |

### No New Package Installs Required

Phase 3 introduces zero new npm dependencies. All required UI components (`Dialog`, `Select`, `Tabs`, `Table`, `Badge`, `Textarea`) were installed during Phase 1-2 scaffolding.

**Package Legitimacy Audit:** No new packages are installed in this phase. All packages listed above were audited and installed in Phase 1-2. Registry check (2026-07-01):
- `prisma` 6.19.3 — OK [VERIFIED: npm registry]
- `next` 15.5.19 — OK [VERIFIED: npm registry]
- `next-auth` 5.0.0-beta.31 — OK [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Status | Disposition |
|---------|----------|-----|--------|-------------|
| prisma | npm | 4+ yrs | OK — already installed in project | Approved |
| @prisma/client | npm | 4+ yrs | OK — already installed in project | Approved |
| next | npm | 6+ yrs | OK — already installed in project | Approved |
| next-auth | npm | 4+ yrs | OK — already installed in project | Approved |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious (SUS):** none (no new packages this phase)

---

## Architecture Patterns

### System Architecture Diagram

```
User (Browser)
    |
    | POST (Server Action: recordStockIn / recordStockOut)
    v
Server Action (actions/stock-transactions.ts)
    |-- auth() → session check (any authenticated user)
    |-- Zod safeParse → validate input
    |-- prisma.$transaction(async (tx) => {
    |       tx.product.findUnique()       -- read current stock
    |       [stock-out only] check qty    -- throw if insufficient
    |       tx.product.update()           -- increment/decrement currentStock
    |       tx.stockTransaction.create()  -- create audit record
    |   })
    |-- if error → return { error: "..." }
    |-- revalidatePath("/stock")
    |-- revalidatePath("/inventory")
    |-- revalidatePath("/products")
    |-- return { success: true }
    |
    +-- On success: client closes dialog, table re-renders (RSC revalidation)

User navigates to /inventory
    |
    | GET /?productId=...&from=...&to=...&type=...
    v
InventoryPage (Server Component, page.tsx)
    |-- await searchParams → extract filter values
    |-- prisma.stockTransaction.findMany({ where: { ... }, include: { product, createdBy } })
    |   Prisma WHERE: productId filter, createdAt gte/lte, type filter
    |-- passes filtered data + filter values to InventoryClient
    v
InventoryClient ("use client", inventory-client.tsx)
    |-- renders filter controls (Select, Input[date], Tabs)
    |-- useRouter().push() on filter change → updates URL → triggers Server Component refetch
    |-- renders history table with Badge (IN green / OUT red), getSeverityBadge for stock column
```

### Recommended Project Structure

```
actions/
└── stock-transactions.ts    # recordStockIn, recordStockOut Server Actions

lib/validations/
└── stock-transaction.ts     # stockInSchema, stockOutSchema (new)

app/(protected)/
├── stock/
│   ├── page.tsx             # Server Component: fetch recent transactions + active products
│   └── stock-client.tsx     # "use client": RecordStockInDialog, RecordStockOutDialog
└── inventory/
    ├── page.tsx             # Server Component: await searchParams, fetch filtered history
    └── inventory-client.tsx # "use client": FilterControls + HistoryTable

prisma/
└── migrations/
    └── YYYYMMDDHHMMSS_add_stock_transactions/
        └── migration.sql    # enum + model + CHECK constraint
```

### Pattern 1: Prisma Interactive Transaction for Stock Mutation

**What:** Wrap both the `product.update` and `stockTransaction.create` in a single `prisma.$transaction()` call so either both succeed or both roll back.

**When to use:** Any mutation that writes to two or more tables and must remain consistent — specifically stock-in and stock-out here.

**Exact syntax** [CITED: prisma.io/docs/orm/prisma-client/queries/transactions]:

```typescript
// Source: prisma.io/docs/orm/prisma-client/queries/transactions
import { Prisma } from "@prisma/client"

// Stock-out example (includes application-level guard)
const result = await prisma.$transaction(async (tx) => {
  const product = await tx.product.findUnique({
    where: { id: parsed.data.productId },
    select: { currentStock: true },
  })

  if (!product) throw new Error("Product not found.")

  if (product.currentStock < parsed.data.quantity) {
    throw new Error(
      `Insufficient stock. Current stock: ${product.currentStock} units.`
    )
  }

  const updated = await tx.product.update({
    where: { id: parsed.data.productId },
    data: { currentStock: { decrement: parsed.data.quantity } },
    select: { currentStock: true },
  })

  await tx.stockTransaction.create({
    data: {
      type: "STOCK_OUT",
      productId: parsed.data.productId,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason,
      notes: parsed.data.notes ?? null,
      createdById: session.user.id,
    },
  })

  return updated
})
// If the throw fires, prisma.$transaction automatically rolls back both operations.
```

**Timeout options** (use defaults for this use case — SME scale):

```typescript
await prisma.$transaction(async (tx) => { /* ... */ }, {
  maxWait: 5000,   // ms to acquire the transaction (default: 2000)
  timeout: 10000,  // ms max run time (default: 5000)
})
```

### Pattern 2: DB-Level CHECK Constraint via Custom Migration

**What:** Add a PostgreSQL CHECK constraint to `products.currentStock >= 0` as a hard backstop after Prisma schema migration generates the initial SQL.

**Workflow** [CITED: prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations]:

```bash
# Step 1: Create schema additions + generate draft migration SQL
npx prisma migrate dev --create-only --name add_stock_transactions

# Step 2: Edit the generated migration.sql — append at the end:
# ALTER TABLE "products"
#   ADD CONSTRAINT "products_current_stock_non_negative"
#   CHECK ("currentStock" >= 0);

# Step 3: Apply the modified migration
npx prisma migrate dev
```

**Critical detail:** The migration file already contains all the Prisma-generated SQL for the new enum and model. The CHECK constraint is appended as the last statement. Do NOT use `NOT VALID` — existing `currentStock` values are already ≥ 0.

### Pattern 3: Next.js 15 searchParams (Async Promise)

**What:** In Next.js 15, `searchParams` in page Server Components is a Promise and must be awaited.

**BREAKING CHANGE** [CITED: nextjs.org/docs/messages/sync-dynamic-apis]:

```typescript
// Source: dev.to/peterlidee/synchronous-and-asynchronous-searchparams-in-next-15
// app/(protected)/inventory/page.tsx
type SearchParamsProps = {
  searchParams: Promise<{
    productId?: string
    from?: string
    to?: string
    type?: string
  }>
}

export default async function InventoryPage({ searchParams }: SearchParamsProps) {
  const params = await searchParams  // MUST await in Next.js 15

  // Build Prisma where clause from params...
}
```

**Client filter controls — URL push pattern** [CITED: dev.to/peterlidee — Next 15 searchParams example]:

```typescript
// Source: dev.to/peterlidee/an-example-of-using-searchparams-usesearchparams-and-next-router-in-next-15
"use client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

function FilterControls() {
  const router = useRouter()
  const pathname = usePathname()
  const currentParams = useSearchParams()

  function updateFilter(key: string, value: string | null) {
    const newParams = new URLSearchParams(currentParams.toString())
    if (value && value !== "all") {
      newParams.set(key, value)
    } else {
      newParams.delete(key)
    }
    router.push(`${pathname}?${newParams.toString()}`)
  }

  return (
    <Select onValueChange={(v) => updateFilter("type", v)}>
      {/* ... */}
    </Select>
  )
}
```

**Suspense boundary required:** Wrap any Client Component using `useSearchParams` in `<Suspense>` in the parent Server Component (Next.js 15 requirement). The `InventoryClient` must be wrapped:

```typescript
// In page.tsx
import { Suspense } from "react"
import InventoryClient from "./inventory-client"

export default async function InventoryPage({ searchParams }: SearchParamsProps) {
  const params = await searchParams
  const data = await fetchFilteredTransactions(params)

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InventoryClient data={data} initialParams={params} />
    </Suspense>
  )
}
```

### Pattern 4: Prisma Date Range Filtering

**What:** Filter `StockTransaction.createdAt` by a from/to date range.

**Pattern** [CITED: prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting]:

```typescript
// Source: prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting
const where: Prisma.StockTransactionWhereInput = {}

if (from) {
  where.createdAt = {
    ...where.createdAt,
    gte: new Date(`${from}T00:00:00.000Z`),
  }
}
if (to) {
  where.createdAt = {
    ...where.createdAt,
    lte: new Date(`${to}T23:59:59.999Z`),  // end of day
  }
}

// Default: last 30 days (D-15)
if (!from && !to) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  where.createdAt = { gte: thirtyDaysAgo }
}
```

**Key detail:** `to` must be `T23:59:59.999Z` to include all records on that date. An HTML `input[type=date]` returns `YYYY-MM-DD` — append time components when constructing `new Date()`.

### Pattern 5: Multiple revalidatePath Calls

**What:** After a stock mutation, invalidate all three pages that display stock data.

**Pattern** [CITED: nextjs.org/docs/app/api-reference/functions/revalidatePath]:

```typescript
// Source: nextjs.org/docs/app/api-reference/functions/revalidatePath
revalidatePath("/stock")      // Recent transactions table on /stock
revalidatePath("/inventory")  // Full history on /inventory
revalidatePath("/products")   // Severity tiers (currentStock changed)
```

**Why revalidate /products:** The `products` page shows `currentStock` and severity badges. After a stock mutation, those values change and must be refreshed. Without this, the products page shows stale stock levels until the next navigation.

### Pattern 6: SELECT FOR UPDATE Workaround (SME Scale)

**What:** Prisma 6 has no native `SELECT FOR UPDATE`. For SME-scale concurrent access:

**Recommended approach** [CITED: prisma.io/docs/orm/prisma-client/queries/transactions + GitHub issues]:

The application-level check inside `prisma.$transaction()` plus the DB-level CHECK constraint is sufficient for this project's concurrency profile (warehouse staff, infrequent simultaneous transactions, single warehouse). If two concurrent stock-out requests race:

- Case A (application guard wins): Transaction A reads stock=5, Transaction B reads stock=5 before A commits. Transaction A decrements to 4 and commits. Transaction B checks 5 >= quantity and proceeds — but its `decrement` would bring stock below 0. The DB-level `CHECK (currentStock >= 0)` constraint fires, PostgreSQL raises an error, and Prisma returns `PrismaClientKnownRequestError` (code `P2002`/`P0001`/constraint violation). The Server Action catches this and returns `{ error: "Transaction failed due to concurrent update. Please retry." }`.
- Case B (rare at SME scale, but safe): The Server Action may return a generic retry error.

**If stricter locking is needed (future scaling):**

```typescript
// Raw SQL SELECT FOR UPDATE inside interactive transaction
await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`
// Then proceed with update — the FOR UPDATE lock blocks concurrent reads on same row
```

This approach is available but not required for MVP at SME scale.

### Anti-Patterns to Avoid

- **Splitting the stock update and transaction record into separate Prisma calls outside of `$transaction`:** If the server crashes between the two calls, stock count and transaction history are inconsistent forever.
- **Awaiting `searchParams` synchronously (not using async/await):** In Next.js 15, accessing `searchParams.productId` without awaiting the Promise returns `undefined`. This is a silent failure that causes the page to ignore all filter params.
- **Using `to` date as `T00:00:00` instead of `T23:59:59`:** Causes all records on the `to` date to be excluded from results (off-by-one day).
- **Forgetting to `revalidatePath("/products")`:** Severity badges on the products page will show stale stock levels after a stock mutation.
- **Using `requireManager()` in stock transaction actions:** D-12 explicitly states Staff can record transactions. Only session presence is required (`auth()` session check without role check).
- **Passing `searchParams` directly to `InventoryClient` as props without Suspense boundary:** Next.js 15 requires `useSearchParams` to be inside a Suspense boundary. Build the page so `InventoryClient` (the `useSearchParams` consumer) is wrapped in `<Suspense>`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic stock mutation | Manual try/catch with two separate Prisma calls | `prisma.$transaction(async (tx) => {...})` | Automatic rollback on any thrown error; two-call approach leaves DB in inconsistent state on crash |
| Negative stock prevention | Application-only check (no DB constraint) | App check + `ALTER TABLE "products" ADD CONSTRAINT ... CHECK ("currentStock" >= 0)` | Application check can be bypassed by concurrent requests; DB constraint is the hard floor |
| Severity tier logic | New isLowStock flag or new DB column | `getSeverityBadge()` from `lib/utils/severity.ts` | Already implemented and tested; INVT-04/INVT-06 are satisfied by the existing function |
| URL filter state | React `useState` for all filters | URL search params (`?productId=...`) + `useRouter().push()` | URL state is shareable, bookmarkable, survives page refresh, and allows Server Component to do the filtering at the DB level (more efficient than client-side filtering of 200 rows) |
| Date display formatting | `new Date().toISOString()` | `new Intl.DateTimeFormat('en-US', { ... }).format(date)` or `.toLocaleString()` | ISO string "2026-07-01T14:32:00.000Z" is not human-readable; required format is "Jul 1, 2026, 14:32" |

**Key insight:** The stock transaction pattern is a textbook use case for database transactions. The complexity of concurrent write safety, partial failure recovery, and audit trail consistency is solved entirely by `prisma.$transaction()` + the DB CHECK constraint. Any custom "locking" solution would reimplement a broken subset of what the DB already provides.

---

## Common Pitfalls

### Pitfall 1: Next.js 15 searchParams Not Awaited

**What goes wrong:** The page silently ignores all URL filter params — every request shows the default 30-day view regardless of what filters the user sets.

**Why it happens:** In Next.js 15, `searchParams` is a Promise. Accessing `searchParams.productId` without `await` returns `undefined`. No error is thrown — it just silently uses `undefined` for all filter values.

**How to avoid:** Always type and await `searchParams` in the Page component:

```typescript
type Props = { searchParams: Promise<{ productId?: string; from?: string; to?: string; type?: string }> }
export default async function InventoryPage({ searchParams }: Props) {
  const params = await searchParams
```

**Warning signs:** Filters appear to "work" in the browser (URL updates correctly) but the table data never changes.

---

### Pitfall 2: Missing Suspense Boundary for useSearchParams

**What goes wrong:** Build error or runtime warning: "useSearchParams() should be wrapped in a suspense boundary at page."

**Why it happens:** Next.js 15 requires client components using `useSearchParams` to be wrapped in `<Suspense>`. Without it, the entire page opts out of static rendering.

**How to avoid:** Wrap `InventoryClient` (or the filter controls component) in `<Suspense fallback={...}>` in `page.tsx`.

---

### Pitfall 3: Stock Transaction Without revalidatePath("/products")

**What goes wrong:** After recording a stock-in, the `/products` page still shows the old stock level and severity badge until a hard reload.

**Why it happens:** Next.js caches Server Component renders. Without explicit invalidation, the cached products page is served with stale data.

**How to avoid:** Include `revalidatePath("/products")` in every stock mutation action alongside `revalidatePath("/stock")` and `revalidatePath("/inventory")`.

---

### Pitfall 4: To-Date Off-By-One (Missing end-of-day time)

**What goes wrong:** Records created on the `to` date are excluded from the filtered results. User sets "To: 2026-07-01" and sees no records from July 1.

**Why it happens:** `new Date("2026-07-01")` produces `2026-07-01T00:00:00.000Z`. All records on July 1 with `createdAt > midnight` fail the `lte` check.

**How to avoid:** Always append end-of-day time for the `to` parameter: `new Date(`${to}T23:59:59.999Z`)`.

---

### Pitfall 5: Prisma Schema Relations Declared in Wrong Order

**What goes wrong:** `npx prisma migrate dev` fails with "Field 'stockTransactions' on model 'Product' is missing required argument 'references'" or similar PSL error.

**Why it happens:** The `StockTransaction` model must be fully defined before it can be referenced as a relation target, OR the relation fields must be declared on both sides consistently.

**How to avoid:** Follow the exact PSL pattern below. Both sides of a one-to-many relation must be declared. The `@relation` attribute on the FK side must specify `fields` and `references`.

---

### Pitfall 6: FormData Quantity as String in Server Action

**What goes wrong:** Prisma throws type error: `Int cannot represent non-integer value: "5"`.

**Why it happens:** `formData.get("quantity")` returns a string. If the Zod schema does not coerce it, `parseInt` or `Number()` must be called explicitly before passing to Prisma.

**How to avoid:** Use `z.preprocess((v) => Number(v), z.number().int().min(1))` in the Zod schema, matching the existing `reorderThreshold` pattern in `lib/validations/product.ts`.

---

## Code Examples

### Prisma Schema Addition

```prisma
// Source: CONTEXT.md D-01 + ASSUMED (PSL syntax)
// Add to prisma/schema.prisma

enum TransactionType {
  STOCK_IN
  STOCK_OUT
}

model StockTransaction {
  id          String          @id @default(cuid())
  type        TransactionType
  productId   String
  product     Product         @relation(fields: [productId], references: [id])
  quantity    Int
  reason      String
  notes       String?
  createdById String
  createdBy   User            @relation(fields: [createdById], references: [id])
  createdAt   DateTime        @default(now())

  @@map("stock_transactions")
}

// Update Product model — add relation:
// stockTransactions StockTransaction[]

// Update User model — add relation:
// stockTransactions StockTransaction[]
```

### Custom Migration SQL (Appended to Generated SQL)

```sql
-- Add DB-level CHECK constraint as backstop (CONTEXT.md D-04)
-- Source: prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations
ALTER TABLE "products"
  ADD CONSTRAINT "products_current_stock_non_negative"
  CHECK ("currentStock" >= 0);
```

### Server Action Pattern (stock-transactions.ts)

```typescript
// Source: actions/products.ts (established pattern) + CONTEXT.md D-05/D-06/D-07
"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { stockOutSchema } from "@/lib/validations/stock-transaction"

export async function recordStockOut(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const parsed = stockOutSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
    notes: formData.get("notes") || undefined,
  })
  if (!parsed.success) return { error: "Invalid input. Please check all fields." }

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: parsed.data.productId },
        select: { currentStock: true },
      })
      if (!product) throw new Error("Product not found.")
      if (product.currentStock < parsed.data.quantity) {
        throw new Error(
          `Insufficient stock. Current stock: ${product.currentStock} units.`
        )
      }
      await tx.product.update({
        where: { id: parsed.data.productId },
        data: { currentStock: { decrement: parsed.data.quantity } },
      })
      await tx.stockTransaction.create({
        data: {
          type: "STOCK_OUT",
          productId: parsed.data.productId,
          quantity: parsed.data.quantity,
          reason: parsed.data.reason,
          notes: parsed.data.notes ?? null,
          createdById: session.user.id,
        },
      })
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record transaction."
    return { error: msg }
  }

  revalidatePath("/stock")
  revalidatePath("/inventory")
  revalidatePath("/products")
  return { success: true }
}
```

### Zod Validation Schema

```typescript
// Source: lib/validations/product.ts (established pattern)
// lib/validations/stock-transaction.ts
import { z } from "zod"

export const stockInSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(1, "Quantity must be at least 1.")
  ),
  reason: z.enum(["Purchase Received", "Return", "Manual Adjustment"]),
  notes: z.string().optional(),
})

export const stockOutSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(1, "Quantity must be at least 1.")
  ),
  reason: z.enum(["Sale", "Manual Adjustment", "Write-Off"]),
  notes: z.string().optional(),
})

export type StockInInput = z.infer<typeof stockInSchema>
export type StockOutInput = z.infer<typeof stockOutSchema>
```

### InventoryPage Server Component (searchParams pattern)

```typescript
// Source: nextjs.org/docs/app/api-reference/functions/use-search-params
// app/(protected)/inventory/page.tsx
import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import InventoryClient from "./inventory-client"

type Props = {
  searchParams: Promise<{
    productId?: string
    from?: string
    to?: string
    type?: string
  }>
}

export default async function InventoryPage({ searchParams }: Props) {
  const params = await searchParams   // MUST await in Next.js 15

  const where: any = {}
  if (params.productId) where.productId = params.productId
  if (params.type === "STOCK_IN") where.type = "STOCK_IN"
  if (params.type === "STOCK_OUT") where.type = "STOCK_OUT"

  // Date range
  if (params.from || params.to) {
    where.createdAt = {}
    if (params.from) where.createdAt.gte = new Date(`${params.from}T00:00:00.000Z`)
    if (params.to)   where.createdAt.lte = new Date(`${params.to}T23:59:59.999Z`)
  } else {
    // Default: last 30 days (D-15)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    where.createdAt = { gte: thirtyDaysAgo }
  }

  const [transactions, products] = await Promise.all([
    prisma.stockTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,  // D-15
      include: {
        product: { select: { id: true, name: true, sku: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading...</div>}>
      <InventoryClient
        transactions={transactions}
        products={products}
        currentParams={params}
      />
    </Suspense>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `params` / `searchParams` as synchronous objects | Promise that must be `await`ed in Server Components | Next.js 15 | All page Server Components receiving searchParams must be `async` and `await searchParams` |
| Radix UI `asChild` prop for Dialog/AlertDialog trigger | Base-UI `render` prop | Phase 1 (this project) | `<DialogTrigger render={<Button>...}>` NOT `<DialogTrigger asChild><Button>` |
| Zod 3.x API | Zod 4.x (backward compatible for existing patterns) | Phase 1 (this project) | Same `z.object()`, `z.string()`, `z.enum()`, `safeParse` API; no breaking change for this phase |
| `@hookform/resolvers` 3.x | 5.x | Phase 1 (this project) | Same `zodResolver()` import; no breaking change |

**Active in this project:**
- Next.js 15 `searchParams` as Promise — affects `inventory/page.tsx` only
- Base-UI `render` prop pattern — affects Dialog triggers in `stock-client.tsx`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PSL syntax for `StockTransaction` model (enum declaration, relation fields) produces valid migration SQL | Code Examples — Prisma Schema | Migration fails; would surface during `prisma migrate dev --create-only` and be caught before apply |
| A2 | `Prisma.TransactionIsolationLevel.ReadCommitted` is the default and acceptable for SME-scale concurrent writes | Pattern 1 — $transaction | Race condition on simultaneous stock-outs could temporarily allow negative stock before DB CHECK fires; DB constraint is the backstop |
| A3 | `session.user.id` is available in the Auth.js v5 JWT session for stock transaction `createdById` | Server Action pattern | FK violation on `stockTransaction.create`; would surface immediately in testing |
| A4 | `Suspense` wrapping for `InventoryClient` is required by Next.js 15 for `useSearchParams` | Pattern 3 — searchParams | Build warning or hydration error in production; would surface in `npm run build` |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions

1. **`session.user.id` availability**
   - What we know: `lib/auth.ts` returns `id: user.id` from the Credentials `authorize()` callback. Auth.js v5 JWT session strategy stores it in the token via `jwt` callback in `auth.config.ts`.
   - What's unclear: Whether `auth()` in a Server Action returns `session.user.id` (the sub field) as a top-level `id` property or whether it requires `session.user.sub`.
   - Recommendation: Read `auth.config.ts` during Wave 0 (schema + actions task) to confirm the session shape before writing `createdById: session.user.id`. If `id` is missing, use `session.user.sub` or fix the JWT callback.

2. **`reason` storage format**
   - What we know: D-02 says reason is a plain String; form labels are "Purchase Received", "Return", "Manual Adjustment" / "Sale", "Manual Adjustment", "Write-Off".
   - What's unclear: Whether to store as display label ("Purchase Received") or kebab slug ("purchase-received").
   - Recommendation: Store as display label. The history table renders it directly without transformation, and Zod enum validates the exact string. Avoids any label→slug→label mapping.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Prisma migrations | Assumed ✓ | 16.x | — (required; was used for Phase 1-2) |
| Node.js | `npx prisma migrate dev` | ✓ | 20.x+ (inferred from @types/node ^20) | — |
| `npx prisma` CLI | Migration execution | ✓ | 6.19.3 | — |

**Missing dependencies with no fallback:** None identified.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INVT-01 | stockInSchema rejects quantity < 1 | unit | `npm test -- --reporter=verbose tests/warehouse.test.ts` | ❌ Wave 0 |
| INVT-01 | stockInSchema rejects missing productId | unit | `npm test -- --reporter=verbose tests/warehouse.test.ts` | ❌ Wave 0 |
| INVT-02 | stockOutSchema rejects quantity < 1 | unit | `npm test -- --reporter=verbose tests/warehouse.test.ts` | ❌ Wave 0 |
| INVT-02 | stockOutSchema rejects invalid reason | unit | `npm test -- --reporter=verbose tests/warehouse.test.ts` | ❌ Wave 0 |
| INVT-03 | recordStockOut with insufficient stock returns error (integration stub) | integration stub | `npm test -- --reporter=verbose tests/warehouse.test.ts` | ❌ Wave 0 |
| INVT-04/06 | getSeverityBadge already covered | unit | `npm test` | ✅ tests/catalog.test.ts |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/warehouse.test.ts` — covers INVT-01, INVT-02 Zod schema tests + INVT-03 integration stub

*(Existing `tests/catalog.test.ts` already covers the `getSeverityBadge` function — no new severity tests needed.)*

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Auth.js v5 `auth()` session check in every Server Action |
| V3 Session Management | Yes | JWT strategy; token validated on every `auth()` call |
| V4 Access Control | Yes | Session check (authenticated) — no role restriction per D-12 |
| V5 Input Validation | Yes | Zod `safeParse` before any Prisma call; server-side re-validation |
| V6 Cryptography | No | No new crypto operations this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized stock manipulation | Tampering | `auth()` session check; unauthenticated requests return `{ error: "Unauthorized" }` |
| Negative stock via race condition | Tampering | DB-level `CHECK (currentStock >= 0)` constraint; application-level check in `$transaction` |
| SQL injection via raw query | Tampering | If `$queryRaw` used for SELECT FOR UPDATE, use tagged template literals (Prisma auto-parameterizes) |
| Mass assignment via FormData | Tampering | Zod schema with explicit field allowlist; only whitelisted fields parsed |
| IDOR on productId | Tampering | Product existence validated inside transaction; only `isActive` products shown in dropdown |

---

## Sources

### Primary (MEDIUM confidence)

- [prisma.io/docs/orm/prisma-client/queries/transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) — interactive transaction syntax, isolation levels, error codes
- [prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations) — `--create-only` migration workflow
- [nextjs.org/docs/app/api-reference/functions/revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath) — multiple path revalidation pattern
- [dev.to/peterlidee — Next.js 15 searchParams example](https://dev.to/peterlidee/an-example-of-using-searchparams-usesearchparams-and-next-router-in-next-15-1b5h) — async searchParams + useRouter push pattern

### Secondary (MEDIUM confidence)

- [basedash.com/blog/how-to-filter-on-date-ranges-in-prisma](https://www.basedash.com/blog/how-to-filter-on-date-ranges-in-prisma) — DateTime gte/lte filtering
- [GitHub prisma/prisma #17136](https://github.com/prisma/prisma/issues/17136) — SELECT FOR UPDATE: confirmed not natively supported; $queryRaw workaround

### Tertiary (LOW confidence / codebase inspection)

- `actions/products.ts` — canonical Server Action structure for this project [VERIFIED: codebase]
- `lib/utils/severity.ts` — existing severity tier logic, reusable in Phase 3 [VERIFIED: codebase]
- `app/(protected)/suppliers/suppliers-client.tsx` — Tabs filter pattern [VERIFIED: codebase]
- `prisma/schema.prisma` — current schema state [VERIFIED: codebase]

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages already installed, versions confirmed from package.json
- Architecture: MEDIUM — patterns drawn from official docs and existing codebase; PSL schema syntax is ASSUMED
- Pitfalls: MEDIUM — drawn from official docs, GitHub issues, and Next.js 15 breaking change notes

**Research date:** 2026-07-01
**Valid until:** 2026-07-31 (Next.js 15 and Prisma 6 APIs are stable; no expected breaking changes within 30 days)
