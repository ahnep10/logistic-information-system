---
phase: 04
slug: procurement
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-05
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Server Action → Prisma → Postgres | All PO mutations (04-03/04-04) cross this boundary; the schema is the last line of defense if application-level validation is bypassed | Supplier/product references, quantities, prices |
| Browser → Server Component | Read-only PO list/detail pages; no user input crosses into a query parameter or mutation here | PO records rendered to the page |
| Browser (form submission) → Server Action → Prisma | User-controlled `supplierId`/`lineItems` cross this boundary as `FormData`, including a JSON-encoded nested array | Draft PO create/edit payload |
| Concurrent Server Action invocations → same `PurchaseOrder` row | Two overlapping calls (double-click, retry, two staff members, or a direct devtools-forged request bypassing the UI) racing against one physical record | Status transitions (DRAFT → ORDERED → RECEIVED), line-item edits |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering | `totalAmount` / `unitPrice` precision | medium | mitigate | `Decimal(12,2)` columns, never `Float` (prisma/schema.prisma:110,128) | closed |
| T-04-02 | Elevation of Privilege / Integrity | `PurchaseOrderLineItem` orphaning on Draft delete | medium | mitigate | `onDelete: Cascade` on the line-item→PO relation (prisma/schema.prisma:124) | closed |
| T-04-03 | Repudiation | RECEIVED-immutability choke point | high | mitigate | `assertPOEditable(status)` guards `confirmPurchaseOrder`; `updateDraftPurchaseOrder`/`deletePurchaseOrder` independently enforce the same property via atomic status-filtered `updateMany`/`deleteMany` (CR-01, commit a9cb914) — a stronger DB-level mechanism than the original single-function plan, verified equivalent | closed |
| T-04-04 | Information Disclosure | `/purchase-orders` route access | low | accept | Gated by Phase 1 middleware session check; no row-level sensitivity difference between Manager/Staff for PO data (D-14) | closed (accepted) |
| T-04-05 | Tampering | Raw Prisma `Decimal` crossing RSC boundary | medium | mitigate | Explicit `.toNumber()` conversion before Client Component props (app/(protected)/purchase-orders/page.tsx:15, [id]/page.tsx:57,68) | closed |
| T-04-06 | Tampering | Client-submitted `totalAmount` | high | mitigate | Create/edit forms never send `totalAmount`; server always computes it via `computeTotalAmount()` from persisted line items (actions/purchase-orders.ts:44,83) | closed |
| T-04-07 | Tampering | Draft PO referencing a deactivated supplier/product | medium | mitigate | `new/page.tsx` only fetches `isActive: true` suppliers/products for create-mode dropdowns; authoritative re-check at confirm time is T-04-10 | closed |
| T-04-08 | Tampering / Injection | Malformed/crafted JSON in the `lineItems` FormData field | medium | mitigate | `JSON.parse` wrapped in try/catch (parseLineItems), parsed result always passed through Zod `safeParse` before any DB write (actions/purchase-orders.ts:21,35,74,164,243) | closed |
| T-04-09 | Tampering / Repudiation | `receivePurchaseOrder` double-receipt race | high | mitigate | `SELECT ... FOR UPDATE` row lock as the first statement inside `prisma.$transaction`, status re-check strictly after, before any write (actions/purchase-orders.ts:253,257) | closed |
| T-04-10 | Tampering | Confirming a Draft against a since-deactivated supplier/product | medium | mitigate | `confirmPurchaseOrder` re-queries `supplier.isActive`/`product.isActive` at confirm time inside the same row-locked transaction as the write — strengthened this session (2026-07-05) from a plain unlocked read to a `SELECT ... FOR UPDATE`-guarded re-validation, closing a TOCTOU gap discovered via Phase 04 UAT test 4's real-Postgres concurrency suite (actions/purchase-orders.ts:137-224) | closed |
| T-04-11 | Elevation of Privilege / Tampering | Post-receipt mutation attempt bypassing hidden UI buttons | high | mitigate | Every mutating action rejects server-side regardless of UI state: `confirmPurchaseOrder` via `assertPOEditable` + row lock; `updateDraftPurchaseOrder`/`deletePurchaseOrder` via atomic status-filtered writes; `receivePurchaseOrder` via its own row-locked status check | closed |
| T-04-12 | Tampering | SQL injection via `tx.$queryRaw` template literal | high | mitigate | Prisma's tagged-template `$queryRaw` auto-parameterizes interpolated values in both `receivePurchaseOrder` and `confirmPurchaseOrder`'s row-lock queries (actions/purchase-orders.ts:137,253) — never `$queryRawUnsafe` or string concatenation | closed |
| T-04-13 | Tampering | Hard-deleting a non-Draft PO via a forged direct call | medium | mitigate | `deletePurchaseOrder` uses `deleteMany({ where: { id, status: "DRAFT" } })`, atomically rejecting unless the row is still Draft at the moment of the write (actions/purchase-orders.ts:195) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-04 | `/purchase-orders` list exposes no data more sensitive to Staff than Manager (D-14); Phase 1 session middleware already gates the entire route | Phase 04 plan (04-02-PLAN.md) | 2026-07-05 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-05 | 13 | 13 | 0 | /gsd-secure-phase (grep-level verification, ASVS L1, register authored at plan time — short-circuit per workflow rule) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-05
