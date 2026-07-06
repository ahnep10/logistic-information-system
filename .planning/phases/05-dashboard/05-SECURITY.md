---
phase: 05
slug: dashboard
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-06
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → project dependencies | `npm install recharts@3.9.2` pulls third-party code into `node_modules`; that code executes inside this app's build and runtime process | package source code |
| Manager browser → `/dashboard` Server Component | Requires an authenticated MANAGER session, enforced by `middleware.ts`'s `MANAGER_ROUTES` before this page's code ever runs | session/auth token |
| `dashboard/page.tsx` → PostgreSQL via Prisma | 5 read-only aggregation queries; declares no `searchParams`, so no user-controlled string reaches any query | aggregate counts (no PII) |
| Browser URL bar → `/products?stock=` searchParams | Any string value is attacker/user-controllable and reaches the Server Component as raw text | untrusted query string |
| `page.tsx` → Prisma `where` clause (products) | Only a validated boolean (`isLowStockFiltered`) branches into the FieldRef `where` object — raw string never reaches Prisma | validated boolean |
| Browser URL bar → `/purchase-orders?status=` searchParams | Any string value is attacker/user-controllable and reaches the Server Component as raw text | untrusted query string |
| `page.tsx` → `initialFilter` prop (purchase-orders) | Only a validated, enum-narrowed value (or `undefined`) crosses into the Client Component | validated enum |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-SC | Tampering | `npm install recharts@3.9.2` (package.json, node_modules) | high | mitigate | RESEARCH.md Package Legitimacy Audit confirmed recharts as a 10-year-old, 51.3M-weekly-download, official-repo package; 05-01-PLAN.md Task 0 blocking `checkpoint:human-verify` required human confirmation before install — pre-approved by orchestrating session per 05-01-SUMMARY.md ("Task 0: Verify recharts package legitimacy before install — pre-approved") | closed |
| T-05-01 | Information Disclosure | dashboard/page.tsx KPI aggregation queries | low | accept | `/dashboard` is MANAGER-only (verified via `middleware.ts`); the 4 KPI counts and PO status breakdown reveal no PII — only aggregate totals independently derivable from `/products`, `/inventory`, `/purchase-orders` | closed |
| T-05-02 | Denial of Service | dashboard-client.tsx Recharts pie chart on all-zero PO data | low | mitigate | `hasAnyPO` check renders `ClipboardList` empty state instead of a degenerate all-zero pie; verified in 05-VERIFICATION.md truth 5 (live DB spot-check, `poStatusGroups` non-empty) and confirmed in UAT test 1 | closed |
| T-05-03 | Denial of Service | `app/(protected)/products/page.tsx` `searchParams.stock` | high | mitigate | Whitelist-validated: only exact literal `"low"` sets `isLowStockFiltered = true`; every other value falls through to `{}`, never reaching `new Date()` or any throwing parser. Verified in 05-VERIFICATION.md truth 4 and `tests/products.test.ts`; confirmed live in UAT test 2 (`?stock=bogus` renders unfiltered list, no error) | closed |
| T-05-04 | Information Disclosure | `/products?stock=low` filtered list | low | accept | No new fields or access exposed — `/products` already visible to MANAGER and STAFF; filter only narrows already-visible rows | closed |
| T-05-05 | Denial of Service | `app/(protected)/purchase-orders/page.tsx` `searchParams.status` | high | mitigate | Whitelist-validated against exactly `"DRAFT"` \| `"ORDERED"` \| `"RECEIVED"` (case-sensitive); any other value resolves to `undefined` → `"all"` tab, never thrown. Verified in 05-VERIFICATION.md truth 7 and `tests/purchase-orders.test.ts`; confirmed live in UAT test 3 (`?status=bogus` behaves identically to `/purchase-orders`) | closed |
| T-05-06 | Information Disclosure | `/purchase-orders?status=X` | low | accept | No new fields or access exposed — `/purchase-orders` already visible to MANAGER and STAFF; only pre-selects an already-existing client-side Tab | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-01 | Aggregate KPI counts on a MANAGER-only route carry no PII and are independently derivable from other already-accessible pages | Plan author (05-01-PLAN.md) | 2026-07-06 |
| AR-05-02 | T-05-04 | Low-stock filter narrows an already-visible product list; no new access granted | Plan author (05-02-PLAN.md) | 2026-07-06 |
| AR-05-03 | T-05-06 | Status filter only pre-selects an existing client-side Tab on an already-visible page | Plan author (05-03-PLAN.md) | 2026-07-06 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-06 | 7 | 7 | 0 | Claude (gsd-secure-phase, L1 grep-depth — register authored at plan time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-06
