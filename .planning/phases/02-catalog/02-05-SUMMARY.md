---
phase: 02-catalog
plan: "05"
subsystem: catalog/suppliers
status: complete
tags:
  - server-actions
  - suppliers
  - crud
  - tabs-filter
  - soft-deactivate
  - role-guard
dependency_graph:
  requires:
    - 02-01  # Prisma Supplier model (name, contactPerson, phone, email, address, isActive)
    - 02-02  # lib/validations/supplier.ts, shadcn textarea + tabs installed
  provides:
    - actions/suppliers.ts (createSupplier, updateSupplier, toggleSupplierActive)
    - app/(protected)/suppliers/page.tsx (server page — fetches all suppliers + session)
    - app/(protected)/suppliers/suppliers-client.tsx (Tabs filter, full Dialog/AlertDialog CRUD)
  affects:
    - 04-procurement  # Phase 4 POs reference Supplier model; deactivated suppliers excluded from PO dropdowns
tech_stack:
  added: []
  patterns:
    - Server Action with requireManager() guard (inline, not exported) — fourth inline copy across action files
    - Soft-deactivate via toggleSupplierActive(id, isActive) — no prisma.supplier.delete() call
    - Client-side Tabs filter (FilterTab useState) — all suppliers fetched once server-side; client filters
    - Tab-aware empty states — three distinct heading/body pairs based on current FilterTab value
    - Textarea (not Input) for address field — D-10 from 02-CONTEXT.md
    - AlertDialog for both Deactivate and Reactivate (consistent with products pattern)
    - render prop pattern for DialogTrigger/DialogClose/AlertDialogTrigger (base-ui)
    - isManager prop gates Create button and Actions column rendering
key_files:
  created:
    - actions/suppliers.ts
    - app/(protected)/suppliers/suppliers-client.tsx
  modified:
    - app/(protected)/suppliers/page.tsx
decisions:
  - "requireManager() defined inline in suppliers.ts (not exported) — same pattern as users.ts, categories.ts, products.ts; no shared helper module created (plan decision)"
  - "All three supplier mutations are Manager-only (createSupplier/updateSupplier/toggleSupplierActive) — CONTEXT.md Manager-only decision overrides REQUIREMENTS.md SUPL-01/02/03 'Staff' wording"
  - "No uniqueness pre-check for supplier name or email — supplier name is not unique per schema design (multiple regional offices); email also not unique per RESEARCH.md"
  - "All suppliers fetched from server (no isActive filter in Prisma query) — client-side useState drives FilterTab filtering"
  - "Tabs onValueChange callback casts string to FilterTab — consistent with RESEARCH.md pattern"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-30"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 02 Plan 05: Suppliers Full CRUD Slice Summary

**One-liner:** Suppliers management with client-side Tabs filter (All/Active/Inactive), tab-aware empty states, Textarea address field, Manager-only CRUD dialogs (create/edit/deactivate/reactivate), and soft-deactivation via toggleSupplierActive.

## What Was Built

### Task 1 — actions/suppliers.ts

Three exported Server Actions, all guarded by inline `requireManager()`:

- **createSupplier(formData)** — Zod safeParse on five fields (name, contactPerson, phone, email, address) → `prisma.supplier.create` → `revalidatePath("/suppliers")`
- **updateSupplier(formData)** — Zod safeParse with id included → `prisma.supplier.update` → `revalidatePath("/suppliers")`
- **toggleSupplierActive(id, isActive)** — `prisma.supplier.update({ data: { isActive } })` → `revalidatePath("/suppliers")`

No uniqueness pre-check — supplier name and email are intentionally non-unique (multiple regional offices for the same company). No call to `prisma.supplier.delete()` — soft-deactivation only per SUPL-03. Implements the CONTEXT.md Manager-only override for SUPL-01/02/03.

### Task 2 — Suppliers page + client component

**app/(protected)/suppliers/page.tsx** (replaced stub):
- Server component with `Promise.all` fetching `prisma.supplier.findMany({ orderBy: { createdAt: "asc" } })` and `auth()` in parallel
- Fetches ALL suppliers (no `isActive` filter) — client handles filtering
- Maps to flat Supplier shape and passes `isManager={session?.user?.role === "MANAGER"}` to `SuppliersClient`

**app/(protected)/suppliers/suppliers-client.tsx** (new — 330+ lines):
- **FilterTab type**: `"all" | "active" | "inactive"` — `useState<FilterTab>("all")`
- **visibleSuppliers**: computed by filtering the full supplier array based on `filter` state
- **Tabs component** (controlled): `value={filter}` + `onValueChange={(v) => setFilter(v as FilterTab)}` above the Card
- **6-column table** (Manager) / 5-column (Staff): Name (auto, font-medium), Contact Person (160px), Phone (130px, zinc-500), Email (auto, zinc-500), Status badge, Actions (80px, Manager only)
- **Tab-aware empty states**: Three distinct messages selected by `filter` value:
  - `"all"` → "No suppliers yet" / "Create a supplier to link purchase orders."
  - `"active"` → "No active suppliers" / "All suppliers are currently deactivated."
  - `"inactive"` → "No inactive suppliers" / "All suppliers are currently active."
- **CreateSupplierDialog**: 5 fields including Textarea for address (rows=3); form reset + dialog close on success
- **EditSupplierDialog**: Pre-filled defaults from supplier prop; calls `updateSupplier`
- **DeactivateSupplierDialog**: AlertDialog — "Keep active" cancel, "Deactivate supplier" action, calls `toggleSupplierActive(id, false)`
- **ReactivateSupplierDialog**: AlertDialog — "Cancel" cancel, "Reactivate supplier" action, calls `toggleSupplierActive(id, true)`
- All `DialogTrigger`, `DialogClose`, `AlertDialogTrigger` use `render` prop (base-ui pattern)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `463ffdc` | feat(02-05): add supplier Server Actions |
| Task 2 | `6f4e056` | feat(02-05): add Suppliers page with Tabs filter and CRUD dialogs |

## Verification

- `npx tsc --noEmit` exits with code 0 after both tasks
- `createSupplier`, `updateSupplier`, `toggleSupplierActive` all exported from `actions/suppliers.ts`
- `requireManager()` defined inline, not exported
- No call to `prisma.supplier.delete()` in `actions/suppliers.ts`
- `FilterTab` type defined as `"all" | "active" | "inactive"`
- `visibleSuppliers` filter logic gates on `filter` state
- Tab-aware empty states render different heading/body per tab
- Address field uses `Textarea` from `@/components/ui/textarea`
- `DialogTrigger`/`DialogClose`/`AlertDialogTrigger` all use `render` prop pattern
- `Tabs` uses controlled `value` + `onValueChange` from `@/components/ui/tabs`

## Deviations from Plan

None — plan executed exactly as written. The existing `actions/suppliers.ts` (untracked from prior agent run) was verified against all Task 1 acceptance criteria before committing. No corrections were needed.

## Known Stubs

None — all data flows are wired to real Prisma queries and Server Actions. Supplier list renders from live database records. Filter tabs drive real computed views over the fetched data.

## Threat Flags

None — all mitigations from threat model implemented:
- T-02-05-01: `requireManager()` called before all three mutations (Elevation of Privilege — high severity)
- T-02-05-02: `createSupplierSchema.safeParse` with `z.object()` discards unknown FormData keys (Tampering — medium)
- T-02-05-03: Large textarea input handled by PostgreSQL TEXT type + Prisma parameterized queries (accepted — low)
- T-02-05-04: Supplier contact details visible to Staff (read-only); mutations Manager-only (accepted — low)

## Self-Check: PASSED

- [x] `actions/suppliers.ts` exists and committed (`463ffdc`)
- [x] `app/(protected)/suppliers/page.tsx` modified (stub replaced, committed `6f4e056`)
- [x] `app/(protected)/suppliers/suppliers-client.tsx` created (committed `6f4e056`)
- [x] TypeScript compiles cleanly (`npx tsc --noEmit` = exit 0)
- [x] Both commits exist in git log
