# Phase 2: Catalog — Research

**Researched:** 2026-06-30
**Domain:** Prisma schema extension, Next.js 15 Server Actions, React Hook Form + Zod v4, base-ui component patterns
**Confidence:** HIGH — all findings drawn from verified codebase inspection of Phase 1 implementation

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Category Model**
- D-01: Category is a full CRUD entity with its own `/categories` management page. Same dialog/modal UX as the Users page.
- D-02: Soft-deactivation only — never hard-deleted. Deactivated categories hidden from product dropdown but existing product associations are preserved.
- D-03: Category name globally unique (DB constraint). A deactivated category's name cannot be reused.

**Stock Tracking**
- D-04: `currentStock Int @default(0)` added to Product model in Phase 2. All new products start at 0.
- D-05: No "initial stock" field on product creation form. All stock changes via Phase 3 transactions.

**Severity Tier Logic**
- D-06: Three tiers computed from `currentStock` vs `reorderThreshold`:
  - Critical = `currentStock === 0`
  - Warning = `0 < currentStock <= reorderThreshold`
  - OK = `currentStock > reorderThreshold`
- D-07: "Low-stock" definition for Phase 5 and INVT-04 = Warning + Critical combined (`currentStock <= reorderThreshold`).
- D-08: Severity displayed using existing `components/ui/badge.tsx` with `className` overrides.

**Form UX**
- D-09: All create/edit forms use the Dialog/modal pattern from Phase 1 users page.
- D-10: Supplier address = single `<textarea>` field (no structured breakdown).
- D-11: Deactivated products excluded from Phase 3 stock transaction dropdowns.

### Claude's Discretion

- Prisma schema field ordering and optional vs required fields
- No pagination needed for MVP (lists expected to be small)
- Zod schema file locations: `lib/validations/category.ts`, `lib/validations/product.ts`, `lib/validations/supplier.ts`
- SKU format: non-empty string, trimmed, max length ~50
- Deactivate confirmation: use `alert-dialog.tsx` pattern (same as Users page)
- Category dropdown in product form: `<Select>` from `components/ui/select.tsx`, active categories only
- Role enforcement: Manager-only mutations; Staff can view but not mutate

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROD-01 | Admin can create a product with name, SKU, category, and reorder threshold | Schema: Product model with SKU unique; Server Action: createProduct; Form: Dialog with RHF + Zod |
| PROD-02 | Admin can edit product details (name, category, reorder threshold) | Server Action: updateProduct; Form: Edit Dialog pre-filled; Category Select active-only |
| PROD-03 | Admin can deactivate a product (soft-delete; does not remove history) | Server Action: toggleProductActive; AlertDialog confirmation; `isActive: false` update only |
| PROD-04 | User can view the product list showing current stock level and severity tier (Critical / Warning / OK) | `getSeverityBadge()` helper in `lib/utils/severity.ts`; Badge component with className overrides |
| SUPL-01 | Staff can create a supplier profile (name, contact person, phone, email, address) | Schema: Supplier model; Server Action: createSupplier; Dialog with 5 fields including textarea |
| SUPL-02 | Staff can edit supplier details | Server Action: updateSupplier; Edit Dialog pre-filled |
| SUPL-03 | Staff can deactivate a supplier (soft-delete; preserves linked PO history) | Server Action: toggleSupplierActive; AlertDialog; `isActive: false` only |
| SUPL-04 | User can view the supplier list with active/inactive filter | Tabs component (new in Phase 2); client-side `useState` filter; all suppliers fetched once |
</phase_requirements>

---

## Summary

Phase 2 extends the Prisma schema with three new models (Category, Product, Supplier) and implements three full-CRUD management pages following the exact pattern established in Phase 1. Every implementation detail has a confirmed prior-art example in `actions/users.ts`, `app/(protected)/users/users-client.tsx`, and `lib/validations/user.ts`. The research confirms the pattern is fully replicable with no novel frameworks or patterns.

The most important technical finding for the planner is the **base-ui render prop pattern**: this project uses `@base-ui/react` (v1.6.0), not standard Radix UI. `DialogTrigger`, `DialogClose`, and `AlertDialogTrigger` all require a `render` prop (`<DialogTrigger render={<Button>...</Button>} />`) rather than the Radix `asChild` pattern. Every new dialog component must follow this pattern exactly.

A secondary finding: the project uses **Zod v4** (`^4.4.3`) and `@hookform/resolvers` v5.x, both of which are backward-compatible with the patterns in Phase 1 code. No API changes needed.

Two new shadcn components must be installed before implementation begins: `textarea` (for supplier address field) and `tabs` (for supplier active/inactive filter).

**Primary recommendation:** Copy the users implementation as a structural template for all three Phase 2 entities. The only genuinely new patterns are: (1) severity tier computation, (2) category Select with active-only filtering and inactive-category handling, and (3) client-side tab filter for suppliers.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Data persistence (Category, Product, Supplier) | Database (Prisma + PostgreSQL) | — | Relational data with FK constraints; Prisma schema enforces unique indexes |
| CRUD mutations (create, update, deactivate) | API / Backend (Server Actions) | — | `"use server"` functions; role guard `requireManager()` at server boundary |
| Data fetching for list pages | Frontend Server (page.tsx async) | — | Server Components fetch via Prisma directly; no API roundtrip |
| Form state, dialog open/close | Browser / Client (xxx-client.tsx) | — | Requires `useState`, `useForm` — client context mandatory per base-ui |
| Severity tier computation | Browser / Client | — | Pure function from props; computed at render time from server-provided data |
| Supplier active/inactive filter | Browser / Client | — | Client-side `useState` filter over the full list fetched server-side |
| Role-based button visibility | Browser / Client | API / Backend | UI hides buttons for STAFF; Server Actions re-enforce via `requireManager()` |
| Category dropdown population | Frontend Server (page.tsx) | Browser / Client | Active categories fetched server-side alongside products; passed as prop to client |

---

## Standard Stack

All packages are already installed in Phase 1. No new runtime dependencies are required for Phase 2 except two new shadcn component definitions (`textarea`, `tabs`).

### Already Installed (verified from package.json)

| Library | Installed Version | Purpose |
|---------|------------------|---------|
| `@prisma/client` | ^6.19.3 | Database ORM — schema models, migrations |
| `prisma` | ^6.19.3 | Prisma CLI — `db push`, `migrate dev` |
| `zod` | ^4.4.3 | Validation schema definitions |
| `react-hook-form` | ^7.80.0 | Form state management |
| `@hookform/resolvers` | ^5.4.0 | RHF + Zod bridge (v5 = Zod v4 compatible) |
| `@base-ui/react` | ^1.6.0 | Component primitives — Dialog, Select, AlertDialog |
| `shadcn` | ^4.12.0 | CLI for installing new shadcn components |
| `lucide-react` | ^1.22.0 | Icons (Pencil, EyeOff, Eye, Package, Tag, Truck) |
| `next` | 15.5.19 | App Router, Server Actions, `revalidatePath` |

[VERIFIED: codebase — package.json]

### New shadcn Components (install before implementation)

```bash
npx shadcn@latest add textarea tabs
```

| Component | File created | Used for |
|-----------|-------------|---------|
| `textarea` | `components/ui/textarea.tsx` | Supplier address field in create/edit dialog |
| `tabs` | `components/ui/tabs.tsx` | Active/Inactive/All filter on Suppliers page |

[VERIFIED: codebase — components/ui/ listing confirmed these two files are absent]

### Components Already Installed (do NOT re-add)

`button`, `form`, `input`, `label`, `table`, `badge`, `dialog`, `alert-dialog`, `select`, `card`, `separator`

[VERIFIED: codebase — `ls components/ui/`]

---

## Schema Design

### Prisma Schema Additions

Append the following to `prisma/schema.prisma` after the existing `User` model:

```prisma
model Category {
  id        String    @id @default(cuid())
  name      String    @unique
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  products  Product[]

  @@map("categories")
}

model Product {
  id               String    @id @default(cuid())
  name             String
  sku              String    @unique
  categoryId       String
  category         Category  @relation(fields: [categoryId], references: [id])
  reorderThreshold Int       @default(0)
  currentStock     Int       @default(0)
  isActive         Boolean   @default(true)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@map("products")
}

model Supplier {
  id            String    @id @default(cuid())
  name          String
  contactPerson String
  phone         String
  email         String
  address       String
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@map("suppliers")
}
```

[ASSUMED: field ordering and `@@map` names — follows Phase 1 User model convention]

### Schema Design Decisions

| Decision | Implementation | Rationale |
|----------|---------------|-----------|
| `Category.name @unique` | DB-level unique index | D-03: deactivated name cannot be reused |
| `Product.sku @unique` | DB-level unique index | PROD-01: duplicate SKUs rejected |
| `Product.currentStock Int @default(0)` | D-04: Phase 3 increments/decrements | No initial stock on create form |
| `Product.categoryId String` + `@relation` | FK to Category | Required for join queries in page fetch |
| `Supplier.email String` | Required, not unique | SUPL-01 does not require uniqueness |
| No `@default(0)` on `reorderThreshold` | D-06: threshold 0 means OK when stock > 0 | DB allows 0 as a valid non-default choice |

**Note on cascade behavior:** Prisma 6 does not cascade-delete child records by default. When a Category is soft-deactivated (not deleted), Products that reference it are unaffected — the FK remains valid. No cascade configuration needed. [ASSUMED: Prisma v6 default behavior — consistent with documented ORM behavior]

### Migration Approach

```bash
npm run db:push
# equivalent to: prisma db push
```

This is the established dev approach from STATE.md. It syncs the schema to the database without creating migration files. Run after appending the new models. [VERIFIED: codebase — STATE.md decisions + package.json scripts]

The existing migration at `prisma/migrations/20260630045322_init/` was created during Phase 1 setup and is untracked in git (per git status). Phase 2 continues with `db:push` for schema iteration.

---

## Server Action Patterns

### Canonical Template

All Server Actions in this phase follow the exact pattern in `actions/users.ts` [VERIFIED: codebase]:

```typescript
"use server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { createCategorySchema } from "@/lib/validations/category"

async function requireManager() {
  const session = await auth()
  if (session?.user?.role !== "MANAGER") {
    throw new Error("Unauthorized — Manager role required")
  }
  return session
}

export async function createCategory(formData: FormData) {
  await requireManager()

  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
  })
  if (!parsed.success) {
    return { error: "Invalid input. Please check all fields." }
  }

  // Pre-check uniqueness (same pattern as email check in users.ts)
  const existing = await prisma.category.findUnique({
    where: { name: parsed.data.name },
  })
  if (existing) {
    return { error: "Category name already exists." }
  }

  await prisma.category.create({
    data: { name: parsed.data.name },
  })

  revalidatePath("/categories")
  return { success: true }
}
```

### Action File Map

| File | Actions | Protected by |
|------|---------|-------------|
| `actions/categories.ts` | `createCategory`, `updateCategory`, `toggleCategoryActive` | `requireManager()` on all three |
| `actions/products.ts` | `createProduct`, `updateProduct`, `toggleProductActive` | `requireManager()` on all three |
| `actions/suppliers.ts` | `createSupplier`, `updateSupplier`, `toggleSupplierActive` | `requireManager()` on all three |

**Do NOT put `requireManager` in a shared helper file.** Copy the implementation into each action file — this is the Phase 1 precedent [VERIFIED: codebase — `actions/users.ts` line 12-17].

### Uniqueness Pre-Check vs Catch-P2002

Phase 1 uses a pre-check (`findUnique` before `create`) rather than catching Prisma's `P2002` error code. Follow the same pattern for Category name and Product SKU uniqueness. This is simpler and returns user-friendly error messages.

For SKU uniqueness on **edit**: the pre-check must exclude the product being edited:
```typescript
const existing = await prisma.product.findFirst({
  where: {
    sku: parsed.data.sku,
    NOT: { id: parsed.data.id },
  },
})
if (existing) {
  return { error: "SKU already exists." }  // exact copy required per UI-SPEC
}
```

### Product Create Action — Category Validation

After Zod passes for `createProduct`, validate that the `categoryId` refers to an active category:

```typescript
const category = await prisma.category.findUnique({
  where: { id: parsed.data.categoryId },
})
if (!category || !category.isActive) {
  return { error: "Selected category is not available." }
}
```

This prevents a race condition where a category is deactivated between page load and form submit.

### Toggle Deactivate Pattern

```typescript
export async function toggleCategoryActive(id: string, isActive: boolean) {
  await requireManager()
  await prisma.category.update({
    where: { id },
    data: { isActive },
  })
  revalidatePath("/categories")
  return { success: true }
}
```

Same pattern as `toggleUserActive` in `actions/users.ts` [VERIFIED: codebase — users.ts line 92-102].

---

## Validation (Zod v4 Schemas)

The project uses Zod v4 (`^4.4.3`). The API for patterns used in Phase 1 is **fully backward-compatible** — `z.object()`, `z.string()`, `z.number()`, `z.enum()`, `.safeParse()`, `.min()`, `.max()`, `.optional()` all work identically. [VERIFIED: codebase — package.json, lib/validations/user.ts patterns]

### Category Schema

```typescript
// lib/validations/category.ts
import { z } from "zod"

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required.").max(100).trim(),
})

export const updateCategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Category name is required.").max(100).trim(),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
```

### Product Schema

```typescript
// lib/validations/product.ts
import { z } from "zod"

export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required."),
  sku: z.string().min(1, "SKU is required.").max(50).trim(),
  categoryId: z.string().min(1, "Category is required."),
  reorderThreshold: z.coerce.number().int().min(0, "Must be 0 or greater"),
})

export const updateProductSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Product name is required."),
  sku: z.string().min(1, "SKU is required.").max(50).trim(),
  categoryId: z.string().min(1, "Category is required."),
  reorderThreshold: z.coerce.number().int().min(0, "Must be 0 or greater"),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
```

**Note:** `z.coerce.number()` is used for `reorderThreshold` because `FormData.get()` returns a string, and `coerce` handles the string-to-number conversion. This avoids manually calling `Number()`. [ASSUMED: Zod v4 coerce behavior — consistent with documented Zod API]

### Supplier Schema

```typescript
// lib/validations/supplier.ts
import { z } from "zod"

export const createSupplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required."),
  contactPerson: z.string().min(1, "Contact person is required."),
  phone: z.string().min(1, "Phone is required."),
  email: z.string().email("Please enter a valid email."),
  address: z.string().min(1, "Address is required."),
})

export const updateSupplierSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Supplier name is required."),
  contactPerson: z.string().min(1, "Contact person is required."),
  phone: z.string().min(1, "Phone is required."),
  email: z.string().email("Please enter a valid email."),
  address: z.string().min(1, "Address is required."),
})

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>
```

---

## Server Component Page Pattern

### Page Fetch Pattern (verified from Phase 1)

```typescript
// app/(protected)/categories/page.tsx
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import CategoriesClient from "./categories-client"

export default async function CategoriesPage() {
  const [categories, session] = await Promise.all([
    prisma.category.findMany({ orderBy: { createdAt: "asc" } }),
    auth(),
  ])
  return (
    <CategoriesClient
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        isActive: c.isActive,
      }))}
      isManager={session?.user?.role === "MANAGER"}
    />
  )
}
```

[VERIFIED: codebase — pattern confirmed in `app/(protected)/users/page.tsx`]

**Note on `"use client"` in page.tsx:** The existing `app/(protected)/users/page.tsx` has `"use client"` at line 1 despite being an async server component that imports Prisma directly. This appears to be a residual artifact that Next.js App Router handles gracefully for route-level page files. **Follow the exact same pattern** — do not attempt to "fix" it, since Phase 1 is complete and working.

### Products Page — Parallel Fetch

The products page must fetch both products AND active categories (for the category name display in the table):

```typescript
// app/(protected)/products/page.tsx
const [products, categories, session] = await Promise.all([
  prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    include: { category: { select: { id: true, name: true } } },
  }),
  prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  }),
  auth(),
])
```

The `include: { category: ... }` join avoids a separate lookup for each product's category name. Pass `categories` as a prop to the client component for the product create/edit Select dropdown. [ASSUMED: Prisma `include` join syntax — standard documented Prisma pattern]

---

## Severity Tier Logic

### Placement

Create `lib/utils/severity.ts` as a **shared utility** — both Phase 2 (Products page) and Phase 3 (Warehouse inventory screens) import from this file. Do NOT inline the logic or duplicate it across pages. [VERIFIED: UI-SPEC Phase 3 contract note]

### Implementation

```typescript
// lib/utils/severity.ts
// Source: 02-CONTEXT.md D-06 + 02-UI-SPEC.md Color section

export type SeverityTier = "Critical" | "Warning" | "OK"

export interface SeverityBadgeProps {
  label: SeverityTier
  className: string
}

export function getSeverityBadge(
  currentStock: number,
  reorderThreshold: number
): SeverityBadgeProps {
  if (currentStock === 0) {
    return {
      label: "Critical",
      className: "bg-red-100 text-red-700 border border-red-200 hover:bg-red-100",
    }
  }
  if (currentStock <= reorderThreshold) {
    return {
      label: "Warning",
      className: "bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100",
    }
  }
  return {
    label: "OK",
    className: "bg-green-100 text-green-700 border border-green-200 hover:bg-green-100",
  }
}
```

### Usage in Table Row

```tsx
import { getSeverityBadge } from "@/lib/utils/severity"
import { Badge } from "@/components/ui/badge"

// In table row render:
const severity = getSeverityBadge(product.currentStock, product.reorderThreshold)
<Badge className={severity.className}>{severity.label}</Badge>
```

[VERIFIED: UI-SPEC — exact className values from Severity Tier Badge Colors section]

---

## Client Component Patterns

### Base-ui Render Prop — Critical Pattern

This project uses `@base-ui/react` v1.6.0, NOT standard Radix UI. The key behavioral difference: interactive trigger components use a `render` prop instead of `asChild`.

**WRONG (Radix pattern — do NOT use):**
```tsx
<DialogTrigger asChild>
  <Button>Create category</Button>
</DialogTrigger>
```

**CORRECT (base-ui pattern — use this):**
```tsx
<DialogTrigger render={<Button>Create category</Button>} />
```

Applies to: `DialogTrigger`, `DialogClose`, `AlertDialogTrigger`
[VERIFIED: codebase — `app/(protected)/users/users-client.tsx` lines 171, 242, 399]

### Dialog + Form Pattern

```tsx
"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createCategorySchema, type CreateCategoryInput } from "@/lib/validations/category"
import { createCategory } from "@/actions/categories"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

function CreateCategoryDialog() {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: "" },
  })

  async function onSubmit(values: CreateCategoryInput) {
    setServerError(null)
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => fd.append(k, String(v)))
    const result = await createCategory(fd)
    if (result?.error) {
      setServerError(typeof result.error === "string" ? result.error : "An error occurred.")
      return
    }
    form.reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create category</Button>} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create category</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Electronics" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline">Discard</Button>} />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create category
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

[VERIFIED: codebase — follows `users-client.tsx` CreateUserDialog pattern exactly]

### AlertDialog Pattern

```tsx
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

function DeactivateCategoryDialog({ category }: { category: Category }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Deactivate category">
            <EyeOff className="h-4 w-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate {category.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Products in this category will keep their association, but this category
            will no longer appear in the product category dropdown.
            You can reactivate it at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep active</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              await toggleCategoryActive(category.id, false)
            }}
          >
            Deactivate category
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

[VERIFIED: codebase — `users-client.tsx` DeactivateDialog lines 396-427]

### Select Component for Category Dropdown

The Select in `components/ui/select.tsx` uses `@base-ui/react/select` internally. The wrapper API (`Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`) mirrors the Radix API used in Phase 1 (`users-client.tsx`). Use the same invocation pattern:

```tsx
<Select onValueChange={field.onChange} defaultValue={field.value}>
  <FormControl>
    <SelectTrigger>
      <SelectValue placeholder="Select category" />
    </SelectTrigger>
  </FormControl>
  <SelectContent>
    {categories.map((cat) => (
      <SelectItem key={cat.id} value={cat.id}>
        {cat.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

[VERIFIED: codebase — `users-client.tsx` Select usage lines 210-223]

**When no active categories exist:** Disable the Select and show an inline message:
```tsx
{categories.length === 0 && (
  <p className="text-xs text-zinc-500 mt-1">No active categories — create a category first</p>
)}
```

**Edit product — inactive current category:** Include the product's current category as a disabled item if it is now inactive:
```tsx
{currentCategory && !currentCategory.isActive && (
  <SelectItem value={currentCategory.id} disabled>
    {currentCategory.name} (inactive)
  </SelectItem>
)}
{categories.filter(c => c.isActive).map(cat => (
  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
))}
```

The `disabled` prop on `SelectItem` triggers `data-disabled:opacity-50` via the base-ui styling in `select.tsx`. [VERIFIED: codebase — `components/ui/select.tsx` line 120: `data-disabled:pointer-events-none data-disabled:opacity-50`]

### Supplier Client-Side Filter (Tabs)

The supplier page uses `useState` to track the active filter tab. All suppliers are fetched server-side; the client component filters the array:

```tsx
"use client"
import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type FilterTab = "all" | "active" | "inactive"

export default function SuppliersClient({ suppliers, isManager }) {
  const [filter, setFilter] = useState<FilterTab>("all")

  const visibleSuppliers = suppliers.filter((s) => {
    if (filter === "active") return s.isActive
    if (filter === "inactive") return !s.isActive
    return true
  })

  return (
    <>
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>
      </Tabs>
      {/* table rendering visibleSuppliers */}
    </>
  )
}
```

[ASSUMED: `Tabs` onValueChange API — based on shadcn tabs pattern; verify after `npx shadcn@latest add tabs`]

### Role-Based Button Visibility

Pass `isManager: boolean` from the server component to the client component. In the client, conditionally render action buttons:

```tsx
{isManager && (
  <>
    <EditCategoryDialog category={category} />
    <DeactivateCategoryDialog category={category} />
  </>
)}
```

[VERIFIED: codebase — Phase 1 passes `currentUserId` as prop; this extends the pattern for role awareness]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique constraint detection | Parse Prisma error codes (P2002) | Pre-check with `findUnique()` before `create()` | Phase 1 pattern; simpler, returns user-friendly messages |
| Form validation | Manual `onChange` validation | Zod schema + RHF `zodResolver` | Type-safe, declarative; Phase 1 precedent |
| Dialog focus trap | Custom overlay/focus logic | `Dialog` from `components/ui/dialog.tsx` (base-ui) | Already handles focus trap, Escape key, ARIA |
| Severity tier custom component | New badge component | `Badge` with `className` override | D-08; UI-SPEC specifies this exact approach |
| Stock level display | Custom stock component | Plain `text-sm font-semibold` table cell | PROD-04 is display-only; no special component needed |

---

## Role Guards

The `requireManager()` function is defined inline at the top of each Server Action file. Do NOT export it from a shared module. This is the Phase 1 pattern.

```typescript
// Exact copy from actions/users.ts — replicate verbatim in categories.ts, products.ts, suppliers.ts
async function requireManager() {
  const session = await auth()
  if (session?.user?.role !== "MANAGER") {
    throw new Error("Unauthorized — Manager role required")
  }
  return session
}
```

[VERIFIED: codebase — `actions/users.ts` lines 12-17]

**SUPL-01 note:** The requirements say "Staff can create a supplier" (SUPL-01/02/03). However, the CONTEXT.md D-09 says "Only Manager can create, edit, or deactivate." **The CONTEXT.md locked decision overrides the REQUIREMENTS.md wording.** All three supplier mutations (`createSupplier`, `updateSupplier`, `toggleSupplierActive`) use `requireManager()`.

---

## Integration Points

### Stub Pages to Replace

| Route | Current content | Replace with |
|-------|-----------------|-------------|
| `app/(protected)/products/page.tsx` | `<h1>Products</h1>` | Async server component with Prisma fetch |
| `app/(protected)/categories/page.tsx` | `<h1>Categories</h1>` | Async server component with Prisma fetch |
| `app/(protected)/suppliers/page.tsx` | `<h1>Suppliers</h1>` | Async server component with Prisma fetch |

[VERIFIED: codebase — read all three stub files]

### New Files to Create

| File | Purpose |
|------|---------|
| `app/(protected)/categories/categories-client.tsx` | Client component: table, dialogs, forms |
| `app/(protected)/products/products-client.tsx` | Client component: table, dialogs, category select, severity badge |
| `app/(protected)/suppliers/suppliers-client.tsx` | Client component: table, tabs filter, dialogs, textarea |
| `actions/categories.ts` | Server Actions: createCategory, updateCategory, toggleCategoryActive |
| `actions/products.ts` | Server Actions: createProduct, updateProduct, toggleProductActive |
| `actions/suppliers.ts` | Server Actions: createSupplier, updateSupplier, toggleSupplierActive |
| `lib/validations/category.ts` | Zod schemas for category |
| `lib/validations/product.ts` | Zod schemas for product |
| `lib/validations/supplier.ts` | Zod schemas for supplier |
| `lib/utils/severity.ts` | `getSeverityBadge()` utility function |

### Sidebar

Already wired. Routes `/categories`, `/products`, `/suppliers` are in the sidebar from Phase 1 D-11. No sidebar changes needed. [VERIFIED: codebase — `01-CONTEXT.md` D-11 + STATE.md confirms]

---

## Common Pitfalls

### Pitfall 1: Using Radix `asChild` Instead of base-ui `render` Prop

**What goes wrong:** `<DialogTrigger asChild><Button>...</Button></DialogTrigger>` compiles without error but `asChild` is not a prop on base-ui's DialogTrigger — the button does not open the dialog.
**Why it happens:** Standard shadcn documentation uses Radix; this project uses base-ui.
**How to avoid:** Always use `render={<Button>...</Button>}` for `DialogTrigger`, `DialogClose`, `AlertDialogTrigger`.
**Warning signs:** Dialog does not open when button is clicked; no runtime error.
[VERIFIED: codebase — STATE.md decision "[01-04]: base-ui components use render prop (not Radix asChild)"]

### Pitfall 2: Sending `categoryId` vs `categoryName` from Product Form

**What goes wrong:** Storing the category name in the Product model instead of the `categoryId`. The product form's `Select` value must be the category's `id` (cuid string), not its display name.
**Why it happens:** The Select displays the category name as `children` but the `value` prop is the ID.
**How to avoid:** `createProductSchema.categoryId = z.string()` — verify the FK, not the display name. The Server Action creates a Product with `{ categoryId: parsed.data.categoryId }`.

### Pitfall 3: Forgetting `z.coerce.number()` for Numeric FormData Fields

**What goes wrong:** `reorderThreshold` arrives as a string from `FormData.get("reorderThreshold")`. Using `z.number()` (not `z.coerce.number()`) causes Zod to fail because the value is a string `"5"`, not a number `5`.
**How to avoid:** Always use `z.coerce.number().int().min(0)` for numeric fields coming from FormData.

### Pitfall 4: `currentStock` Mutated Outside of Phase 3

**What goes wrong:** Including `currentStock` in the product create or edit form, allowing direct stock edits bypassing the Phase 3 transaction layer.
**How to avoid:** Do NOT include `currentStock` in `createProductSchema` or `updateProductSchema`. The Prisma `create` call uses `@default(0)` and `update` never touches `currentStock` in Phase 2. [Verified: D-04, D-05]

### Pitfall 5: Category Name Uniqueness Check Must Be Case-Insensitive Consideration

**What goes wrong:** DB unique constraint on `Category.name` is case-sensitive in PostgreSQL by default. "Electronics" and "electronics" would be two different records.
**How to avoid:** Either (a) normalize to lowercase before storing, or (b) add a `@@unique` on a case-insensitive expression via Prisma's `@@unique` with a `map` — but this requires `prisma migrate dev`, not `db:push`. **Simplest path for MVP:** The Zod schema trims whitespace; the pre-check uses `prisma.category.findFirst({ where: { name: { equals: parsed.data.name, mode: 'insensitive' } } })` to catch case-insensitive duplicates.
[ASSUMED: PostgreSQL case-sensitivity on unique constraint — standard PostgreSQL behavior]

### Pitfall 6: Edit Product Dialog — Inactive Category Not Shown

**What goes wrong:** The edit product dialog only shows active categories. If the product's current category is now inactive, the Select shows no selected value and the form appears broken.
**How to avoid:** When fetching product data for the edit dialog, also fetch the product's current category (even if inactive). Pass it separately. Show the inactive category as a `disabled` SelectItem with "(inactive)" suffix. Validate server-side that the submitted `categoryId` refers to an active category (reject inactive ones).

### Pitfall 7: Supplier Filter Breaks on Empty State

**What goes wrong:** The empty-state message for the supplier table must be tab-aware (three different messages for All/Active/Inactive). Using a single "No suppliers" message confuses users who switch to the "Active" tab.
**How to avoid:** Conditionally render the empty state message based on the `filter` state.

---

## Architecture Patterns

### Recommended Project Structure After Phase 2

```
actions/
├── users.ts           # Phase 1 (existing)
├── categories.ts      # Phase 2 new
├── products.ts        # Phase 2 new
└── suppliers.ts       # Phase 2 new

lib/
├── auth.ts
├── prisma.ts
├── utils.ts
├── utils/
│   └── severity.ts    # Phase 2 new — shared with Phase 3
└── validations/
    ├── auth.ts
    ├── user.ts
    ├── category.ts    # Phase 2 new
    ├── product.ts     # Phase 2 new
    └── supplier.ts    # Phase 2 new

app/(protected)/
├── categories/
│   ├── page.tsx             # Server component (Phase 2, replaces stub)
│   └── categories-client.tsx  # Client component (Phase 2 new)
├── products/
│   ├── page.tsx             # Server component (Phase 2, replaces stub)
│   └── products-client.tsx  # Client component (Phase 2 new)
└── suppliers/
    ├── page.tsx             # Server component (Phase 2, replaces stub)
    └── suppliers-client.tsx # Client component (Phase 2 new)
```

### System Architecture Diagram

```
Browser
  │
  ├── /categories  ──── page.tsx (async server) ──── prisma.category.findMany()
  │                         │                              │
  │                         └── CategoriesClient           │
  │                               ├── Dialog              PostgreSQL
  │                               ├── AlertDialog          │
  │                               └── onClick ──── Server Actions ──── prisma.category.*
  │
  ├── /products   ──── page.tsx (async server) ──── Promise.all([
  │                         │                         prisma.product.findMany({ include: category })
  │                         │                         prisma.category.findMany({ where: isActive })
  │                         │                       ])
  │                         └── ProductsClient
  │                               ├── getSeverityBadge()
  │                               ├── Category Select (active only)
  │                               └── onClick ──── Server Actions ──── prisma.product.*
  │
  └── /suppliers  ──── page.tsx (async server) ──── prisma.supplier.findMany()
                            │
                            └── SuppliersClient
                                  ├── useState(filter)
                                  ├── Tabs (All/Active/Inactive)
                                  └── onClick ──── Server Actions ──── prisma.supplier.*
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + React Testing Library 16.x |
| Config file | `vitest.config.ts` (already configured, `passWithNoTests: true`) |
| Quick run command | `npm test` |
| Full suite command | `npm run test:coverage` |
| Environment | jsdom (configured in vitest.config.ts) |

[VERIFIED: codebase — `vitest.config.ts`, `package.json` scripts]

### Phase 2 Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| PROD-01 | `createProductSchema` rejects empty SKU | unit | `npm test -- tests/catalog.test.ts` | Wave 0 |
| PROD-01 | `createProductSchema` rejects negative reorderThreshold | unit | `npm test -- tests/catalog.test.ts` | Wave 0 |
| PROD-01 | `createProductSchema` accepts valid product input | unit | `npm test -- tests/catalog.test.ts` | Wave 0 |
| PROD-04 | `getSeverityBadge(0, 10)` returns Critical | unit | `npm test -- tests/catalog.test.ts` | Wave 0 |
| PROD-04 | `getSeverityBadge(5, 10)` returns Warning | unit | `npm test -- tests/catalog.test.ts` | Wave 0 |
| PROD-04 | `getSeverityBadge(11, 10)` returns OK | unit | `npm test -- tests/catalog.test.ts` | Wave 0 |
| SUPL-01 | `createSupplierSchema` rejects invalid email | unit | `npm test -- tests/catalog.test.ts` | Wave 0 |
| SUPL-01 | `createSupplierSchema` accepts valid supplier input | unit | `npm test -- tests/catalog.test.ts` | Wave 0 |
| PROD-01 | `createProduct` action rejects duplicate SKU | integration (it.todo) | `npm test -- tests/catalog.test.ts` | Wave 0 |
| PROD-03 | `toggleProductActive(id, false)` calls prisma.product.update with isActive:false | integration (it.todo) | `npm test -- tests/catalog.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test` (all existing + new unit tests, ~5s)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/catalog.test.ts` — covers all Phase 2 Zod schema tests and severity tier unit tests
- [ ] `tests/catalog.test.ts` — `it.todo()` stubs for Server Action integration tests (following `tests/users.test.ts` pattern)

The existing `tests/setup.ts` (cleanup after each test) covers Phase 2 test files without modification.

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Handled by Auth.js v5 (Phase 1) |
| V3 Session Management | No | JWT sessions (Phase 1) |
| V4 Access Control | Yes | `requireManager()` in every mutation Server Action |
| V5 Input Validation | Yes | Zod `safeParse` client + server-side re-validation |
| V6 Cryptography | No | No new crypto in Phase 2 |

### Threat Patterns for Phase 2 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Direct Server Action call bypassing UI role check | Elevation of Privilege | `requireManager()` throws before any Prisma mutation — enforced server-side |
| Mass assignment (extra FormData fields) | Tampering | Zod `safeParse` with explicit schema — unknown keys discarded |
| SKU injection (special chars in SKU field) | Tampering | `z.string().trim()` + Prisma parameterized queries — no raw SQL |
| Negative stock via product creation | Tampering | `reorderThreshold` validated `>= 0`; `currentStock` not in create schema |
| Category ID forgery in product form | Tampering | Server Action validates `categoryId` via Prisma `findUnique` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@@map("categories")`, `@@map("products")`, `@@map("suppliers")` table names | Schema Design | Table names differ; low risk — functional, just cosmetic naming |
| A2 | `reorderThreshold @default(0)` is NOT included | Schema Design | If default is needed, add it; low risk |
| A3 | `Tabs` onValueChange API after shadcn install | Client Component Patterns | API might differ; verify after `npx shadcn@latest add tabs` |
| A4 | PostgreSQL case-sensitive unique constraint on Category.name | Pitfall 5 | Duplicate category names with different casing allowed; use `mode: 'insensitive'` in pre-check |
| A5 | `z.coerce.number()` works for FormData string-to-number in Zod v4 | Validation | Low risk — documented Zod behavior; alternative is manual `Number()` cast |

---

## Open Questions

1. **SUPL-01 says "Staff can create a supplier" but D-09 from CONTEXT.md says Manager-only**
   - What we know: REQUIREMENTS.md uses "Staff"; CONTEXT.md D-09 uses "Only Manager"
   - Recommendation: Trust CONTEXT.md (user's explicit locked decision overrides requirements wording). Use `requireManager()` for all supplier mutations. Flag this discrepancy in the plan for human confirmation.

2. **`db:push` vs `db:migrate` for Phase 2 schema changes**
   - What we know: STATE.md says `db:push` for dev. A migration file exists from Phase 1 init.
   - Recommendation: Use `npm run db:push` for Phase 2 schema iteration (existing dev pattern). Document that production deployment will need `prisma migrate deploy`.

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| PostgreSQL | Prisma schema push | Assumed available | Phase 1 complete with DB seed |
| Node.js | `npm run db:push`, dev server | Available | Phase 1 complete |
| `npx shadcn@latest` | Install textarea + tabs | Available | shadcn ^4.12.0 in package.json |
| `prisma db push` | Schema migration | Available | Script in package.json |

---

## Sources

### Primary (HIGH confidence)
- `actions/users.ts` — canonical Server Action pattern, `requireManager()` implementation
- `app/(protected)/users/users-client.tsx` — Dialog, AlertDialog, RHF Form, Select, base-ui render prop patterns
- `app/(protected)/users/page.tsx` — async server component pattern with `Promise.all`
- `lib/validations/user.ts` — Zod schema structure, export pattern, infer types
- `components/ui/select.tsx` — base-ui Select component API
- `components/ui/badge.tsx` — Badge component variants
- `prisma/schema.prisma` — existing schema structure to extend
- `package.json` — exact installed versions, npm scripts
- `.planning/phases/02-catalog/02-CONTEXT.md` — all locked decisions
- `.planning/phases/02-catalog/02-UI-SPEC.md` — screen layouts, severity badge classNames, copy strings

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — `prisma db push` for dev, base-ui render prop decision note
- `vitest.config.ts`, `tests/` — test infrastructure

---

## Metadata

**Confidence breakdown:**
- Schema design: HIGH — models are straightforward relational extensions of the User pattern; field types are standard
- Server Action patterns: HIGH — directly verified from Phase 1 working code
- base-ui render prop pattern: HIGH — explicitly documented in STATE.md + verified in users-client.tsx
- Severity tier logic: HIGH — exact className values verified in UI-SPEC
- Zod v4 schema patterns: HIGH — backward-compatible API verified in package.json + existing user.ts schemas
- Tabs component API: MEDIUM — `npx shadcn@latest add tabs` not yet run; API assumed from shadcn documentation

**Research date:** 2026-06-30
**Valid until:** 2026-07-30 (stable stack — all packages already installed)
