---
phase: 04-procurement
plan: 03
subsystem: procurement
tags: [server-actions, react-hook-form, useFieldArray, zod, prisma-decimal, next.js]

# Dependency graph
requires:
  - phase: 04-01
    provides: PurchaseOrder/PurchaseOrderLineItem Prisma models, createPurchaseOrderSchema (lib/validations/purchase-order.ts), assertPOEditable guard
provides:
  - "createDraftPurchaseOrder / updateDraftPurchaseOrder Server Actions in actions/purchase-orders.ts"
  - "/purchase-orders/new page (Server Component fetching active suppliers/products)"
  - "Shared PurchaseOrderForm component (app/(protected)/purchase-orders/po-form-client.tsx) with mode=create/edit interface for 04-04 reuse"
affects: [04-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useFieldArray-based repeating line-item form with a separate controlled inline add-line row (first repeating-array form in codebase, per RESEARCH.md Pattern 4)"
    - "FormData JSON-string field for a nested array (lineItems) parsed server-side via JSON.parse in try/catch, then Zod safeParse"
    - "Server-side Prisma.Decimal recompute of totalAmount from persisted line items — client never sends a totalAmount field at all (D-07)"

key-files:
  created:
    - actions/purchase-orders.ts
    - app/(protected)/purchase-orders/new/page.tsx
    - app/(protected)/purchase-orders/po-form-client.tsx
  modified: []

key-decisions:
  - "updateDraftPurchaseOrder checks status === 'DRAFT' exactly (not just !== 'RECEIVED') since assertPOEditable only guards RECEIVED and D-02/D-17 require ORDERED to also be non-editable"
  - "Line-item table rows in po-form-client.tsx are read-only display (product/qty/price/subtotal) with a remove-only action — no per-row editing after Add Line, matching 04-UI-SPEC.md Screen 2 spec exactly"
  - "zodResolver(createPurchaseOrderSchema) as any cast applied per Pitfall 3 convention — adds one new @typescript-eslint/no-explicit-any error to the pre-existing, tracked, non-blocking ESLint gate failure (now 5 total, was 4)"

patterns-established:
  - "po-form-client.tsx lives one directory above new/ (app/(protected)/purchase-orders/po-form-client.tsx, not app/(protected)/purchase-orders/new/po-form-client.tsx) so it can be imported unmodified by the future [id]/page.tsx Draft-state edit view (04-04) via a sibling relative import"

requirements-completed: [PROC-01]

coverage:
  - id: D1
    description: "createDraftPurchaseOrder Server Action: session-only guard, JSON-parses lineItems FormData field, Zod-validates, recomputes totalAmount server-side via Prisma.Decimal, creates PurchaseOrder with nested lineItems, returns { success, id }"
    requirement: "PROC-01"
    verification:
      - kind: unit
        ref: "tests/purchase-orders.test.ts — Draft Purchase Order Validation describe block (11 passing tests cover createPurchaseOrderSchema behavior the action relies on)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "No integration/DB test exercises the live Server Action end-to-end (Wave 0 test plan scopes this to Zod-schema unit coverage only, per 04-RESEARCH.md Validation Architecture — PROC-05/manual UAT note). End-to-end create-and-redirect flow requires the /purchase-orders/[id] route, which does not exist until 04-04 lands (per plan's own <verification> note)."
  - id: D2
    description: "updateDraftPurchaseOrder Server Action: rejects non-DRAFT status, transactionally replaces line items and recomputes totalAmount"
    requirement: "PROC-01"
    verification:
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "No caller exists yet (04-04 wires the Draft-state edit view that invokes this action) — cannot be exercised end-to-end until then. Logic reviewed against plan's <behavior> spec but not integration-tested."
  - id: D3
    description: "/purchase-orders/new page + PurchaseOrderForm: supplier select (active only), inline add-line row (product/qty/unit price), removable line-item table, live client-side total, Save Draft submit"
    requirement: "PROC-01"
    verification:
      - kind: other
        ref: "npx tsc --noEmit && npm test"
        status: pass
    human_judgment: true
    rationale: "UI rendering, useFieldArray add/remove behavior, and the live total calculation require manual browser verification per the plan's own <verification> section, which explicitly defers full manual UAT to 04-04's end-of-phase checkpoint since the post-save redirect target (/purchase-orders/[id]) doesn't exist until that wave lands."

duration: 18min
completed: 2026-07-04
status: complete
---

# Phase 04 Plan 03: Draft Purchase Order Creation Summary

**Draft PO creation Server Actions (create/update) plus the `/purchase-orders/new` page and a reusable `useFieldArray`-based line-item form component, delivering PROC-01 end to end.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-04T12:23:48+07:00
- **Completed:** 2026-07-04T12:41:27+07:00
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `actions/purchase-orders.ts` — `createDraftPurchaseOrder` and `updateDraftPurchaseOrder`, both session-only guarded (no `requireManager()`, per D-14), both recomputing `totalAmount` server-side from parsed `lineItems` via `Prisma.Decimal` arithmetic (D-07)
- `/purchase-orders/new` Server Component page — fetches active suppliers and active products, renders inside the `max-w-4xl mx-auto p-6` wrapper per 04-UI-SPEC.md Screen 2
- `po-form-client.tsx` — shared `PurchaseOrderForm` component with `useFieldArray` line-item management (inline add-line row + removable table + live total), built to accept `mode="edit"` unmodified for 04-04's Draft-state detail view reuse

## Task Commits

Each task was committed atomically:

1. **Task 1: createDraftPurchaseOrder + updateDraftPurchaseOrder Server Actions** - `3ef5a36` (feat)
2. **Task 2: /purchase-orders/new page + shared PurchaseOrderForm component** - `4b4ba42` (feat)

**Plan metadata:** (pending — this commit)

## Files Created/Modified
- `actions/purchase-orders.ts` - `createDraftPurchaseOrder`/`updateDraftPurchaseOrder` Server Actions, session-only guard, Decimal recompute, JSON-parsed nested lineItems FormData field
- `app/(protected)/purchase-orders/new/page.tsx` - Server Component fetching active suppliers/products, renders page header + `PurchaseOrderForm`
- `app/(protected)/purchase-orders/po-form-client.tsx` - Shared `PurchaseOrderForm` default export: supplier Select, inline add-line row, `useFieldArray`-driven removable line-item table, live currency-formatted total, Save Draft submit with redirect-on-create

## Decisions Made
- `updateDraftPurchaseOrder` implements its own `status === "DRAFT"` exact-match check rather than reusing `assertPOEditable` (which only throws on `RECEIVED`) — required because D-02/D-17 mandate ORDERED POs are also non-editable, a stricter rule than the shared immutability guard provides.
- Line-item table rows are read-only (no per-row inline editing after Add Line) exactly per 04-UI-SPEC.md Screen 2 — only a remove action is available per row, matching the plan's `<action>` spec.
- `po-form-client.tsx` is placed at `app/(protected)/purchase-orders/po-form-client.tsx` (sibling to `page.tsx`, one level above `new/`) so 04-04's `[id]/page.tsx` can import it via a simple relative sibling path without duplication.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed base-ui Select `onValueChange` type mismatch on the inline product-select row**
- **Found during:** Task 2 (`npx tsc --noEmit` verification)
- **Issue:** `useState<string>` setter passed directly to `Select`'s `onValueChange` prop failed to type-check — base-ui's `onValueChange` signature is `(value: string | null, eventDetails) => void`, incompatible with a bare `Dispatch<SetStateAction<string>>`.
- **Fix:** Wrapped in an inline arrow function `(v) => setDraftProductId(v ?? "")`, matching the existing `onValueChange={(v) => setFilter(v as FilterTab)}` convention already used in `purchase-orders-client.tsx`.
- **Files modified:** `app/(protected)/purchase-orders/po-form-client.tsx`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `4b4ba42` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial type-signature fix required to satisfy the plan's own `<verify>` command (`npx tsc --noEmit`). No scope creep, no behavior change.

## Issues Encountered
- `npm run build`'s ESLint gate now reports 5 `@typescript-eslint/no-explicit-any` errors (was 4, tracked as a pre-existing non-blocking concern in STATE.md). The new one is in `po-form-client.tsx` at the `zodResolver(createPurchaseOrderSchema) as any` cast — this is the exact, mandated Pitfall 3 convention from 04-RESEARCH.md/04-PATTERNS.md ("copy verbatim, do not attempt a 'cleaner' typed fix"), so it was intentionally not suppressed, consistent with how `stock-client.tsx`/`products-client.tsx` already carry this same class of error unsuppressed. `npm test` and `npx tsc --noEmit` both remain green — this is a lint-only, pre-accepted convention, not a functional defect.
- Discovered (not fixed, out of scope): `.planning/REQUIREMENTS.md` already marks `PROC-02`/`PROC-03`/`PROC-04` as Complete as of the 04-01 commit, even though only PROC-01 (this plan) has actually shipped a working feature — 04-02 delivered PROC-05's list half, and PROC-02/03/04 (confirm/receive/immutability) are 04-04's scope. Logged in `.planning/phases/04-procurement/deferred-items.md` for 04-04 or a manual follow-up to reconcile; not corrected here per scope-boundary rules (pre-existing, not caused by this plan's changes).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PROC-01 is fully deliverable: `/purchase-orders/new` lets a user pick a supplier, add/remove line items with a live total, and save a Draft whose `totalAmount`/`poNumber` are server-computed/assigned.
- `PurchaseOrderForm`'s `mode="edit"` + `purchaseOrder` prop contract is ready for 04-04 to reuse unmodified in the Draft-state detail view.
- End-to-end manual verification (create → redirect → reload → confirm persisted total matches live preview) is deferred to 04-04's end-of-phase checkpoint, since `/purchase-orders/[id]` does not exist until that wave lands — this was an explicit, planned deferral in 04-03-PLAN.md's `<verification>` section, not a gap introduced by this execution.
- No blockers for 04-04.

---
*Phase: 04-procurement*
*Completed: 2026-07-04*
