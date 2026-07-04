---
phase: 04-procurement
plan: 02
subsystem: ui
tags: [nextjs, prisma, react, tabs, decimal-serialization]

requires:
  - phase: 04-procurement (04-01)
    provides: PurchaseOrder/PurchaseOrderLineItem Prisma models, lib/utils/po-status.ts, lib/utils/po-number.ts
provides:
  - "/purchase-orders list page with server-fetched PO data and Decimal-to-number conversion"
  - "PurchaseOrdersClient — status Tabs filter (All/Draft/Ordered/Received) over client-side array"
  - "Row-click navigation pattern to /purchase-orders/{id} (consumed by 04-04 detail page)"
affects: [04-03, 04-04]

tech-stack:
  added: []
  patterns:
    - "Link-wrapped TableCell children for whole-row keyboard-accessible navigation (each cell wraps its content in a block-level Link instead of a row-level onClick handler)"
    - "Client-side Tabs filter over a server-fetched-once array (matches Phase 2 Suppliers pattern), reused verbatim for PO status"

key-files:
  created:
    - app/(protected)/purchase-orders/purchase-orders-client.tsx
  modified:
    - app/(protected)/purchase-orders/page.tsx

key-decisions:
  - "Row navigation implemented via Link wrapping each TableCell's content (not a row-level onClick/div), satisfying the UI-SPEC accessibility requirement for keyboard-reachable row navigation"
  - "Create Purchase Order button implemented as base-ui Button with render={<Link .../>} — confirmed via Button.d.ts that BaseUIComponentProps supports the render prop for polymorphic rendering, matching the render-prop convention already established for Dialog/AlertDialog triggers in this codebase"

requirements-completed: [PROC-05]

coverage:
  - id: D1
    description: "/purchase-orders list page fetches all POs server-side, converts totalAmount Decimal to number, and renders through PurchaseOrdersClient"
    requirement: "PROC-05"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit"
        status: pass
      - kind: manual_procedural
        ref: "dev server GET /purchase-orders redirects unauthenticated request to /login (307) with no server error in logs, confirming the route compiles and the Prisma query executes without throwing"
        status: pass
    human_judgment: false
  - id: D2
    description: "Status Tabs filter (All/Draft/Ordered/Received) filters the already-fetched array client-side with correct table columns (PO #, Supplier, Status badge, Total, Created, Created By) and both empty-state copy variants"
    requirement: "PROC-05"
    verification:
      - kind: unit
        ref: "npm test (33 passed, 24 todo — no regression)"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "Visual rendering of Tabs, badge colors, currency/date formatting, and both empty-state copy variants require human eyes against 04-UI-SPEC.md Screen 1 — no PO data exists yet (04-03 not built), so only the database-empty state is currently reachable for live verification."

duration: 20min
completed: 2026-07-04
status: complete
---

# Phase 4 Plan 2: Purchase Orders List Page Summary

**Server-fetched `/purchase-orders` list page with client-side status Tabs filter, formatted PO#/currency/date columns, and Link-wrapped whole-row navigation to the detail route.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-04T04:34:00Z (approx.)
- **Completed:** 2026-07-04T04:51:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced the Phase 1 one-line stub with a real Server Component that fetches all purchase orders (with `supplier` and `createdBy` relations) and converts `totalAmount` from Prisma `Decimal` to `number` before crossing the RSC boundary
- Built `PurchaseOrdersClient` with a client-side `all`/`draft`/`ordered`/`received` Tabs filter over the server-fetched array (no server round-trip on tab change), matching the Phase 2 Suppliers filter convention
- Table renders all six spec'd columns (PO #, Supplier, Status badge, Total in IDR currency, Created date, Created By) with whole-row click navigation to `/purchase-orders/{id}`, implemented via Link-wrapped cell content for keyboard accessibility
- Both empty-state variants implemented per UI-SPEC copy: database-empty ("No purchase orders yet") and filtered-empty ("No {status} purchase orders")

## Task Commits

Each task was committed atomically:

1. **Task 1: Purchase orders list — Server Component fetch (D-19, D-23)** - `db7a7ed` (feat)
2. **Task 2: PurchaseOrdersClient — status Tabs filter + table (D-18, D-19)** - `3cf3da3` (feat)

**Plan metadata:** (pending — this commit)

## Files Created/Modified
- `app/(protected)/purchase-orders/page.tsx` - Server Component: fetches all POs via Prisma, converts `totalAmount` Decimal → number, renders `PurchaseOrdersClient`
- `app/(protected)/purchase-orders/purchase-orders-client.tsx` - Client Component: status Tabs filter, six-column table, currency/date formatting, empty states, row-click navigation

## Decisions Made
- Row navigation: wrapped each `TableCell`'s content in a block-level `<Link>` rather than a row-level `onClick` handler, per the UI-SPEC's explicit accessibility requirement (keyboard Tab + Enter must reach each row)
- "Create Purchase Order" button uses base-ui `Button` with `render={<Link href="/purchase-orders/new" />}` — verified against `node_modules/@base-ui/react/button/Button.d.ts` that `ButtonProps` extends `BaseUIComponentProps` (which includes `render`), consistent with the render-prop pattern already used for Dialog/AlertDialog triggers elsewhere in the codebase (no prior Button+Link combination existed to copy directly, so this was newly verified rather than copied)

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched the plan's `<action>` specs and interface contracts (Decimal conversion pattern, Tabs-filter pattern, table column spec) without requiring auto-fixes.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `/purchase-orders/[id]` (04-04) can now link from this list page's row navigation (`/purchase-orders/${po.id}` pattern already wired)
- `/purchase-orders/new` (04-03) is linked from the "Create Purchase Order" button; that route does not exist yet (expected — 04-03 executes in the same wave)
- No purchase orders exist in the database yet, so only the database-empty state is currently visible live; full visual verification of the populated table, Tabs filter switching, and filtered-empty state should happen after 04-03 lands and at least one Draft PO is created
- No blockers for 04-03/04-04

---
*Phase: 04-procurement*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: `app/(protected)/purchase-orders/page.tsx`
- FOUND: `app/(protected)/purchase-orders/purchase-orders-client.tsx`
- FOUND: `.planning/phases/04-procurement/04-02-SUMMARY.md`
- FOUND: commit `db7a7ed`
- FOUND: commit `3cf3da3`
