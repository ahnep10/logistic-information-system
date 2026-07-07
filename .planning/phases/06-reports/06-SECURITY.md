---
phase: 06
slug: reports
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-07
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → `/reports` (Server Component) | Manager-only page reading `?type=`/`?from=`/`?to=` searchParams | Untrusted query-string input → Prisma query params |
| Browser → `/api/reports/*` (Route Handler) | Excel export endpoints, NOT covered by `middleware.ts` (`/api/*` excluded from matcher) — each handler self-enforces auth | Untrusted request + session cookie → binary `.xlsx` stream |
| STAFF-writable data → MANAGER-read export | `actions/stock-transactions.ts` `notes`/`reason` fields (any authenticated user) flow into the Movements export's cells | Free-text user input → spreadsheet cell content opened in Excel/LibreOffice by a MANAGER |
| npm registry/CDN → `node_modules` | New `xlsx` (SheetJS) dependency, first new package since Phase 5 | Third-party package code |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | Tampering / Denial of Service | `reports/page.tsx` `?type=` searchParam | high | mitigate | `resolveReportType()` whitelist-then-fallback — only exact literals accepted, anything else defaults to `"inventory"`, never throws | closed |
| T-06-02 | Tampering / Denial of Service | `reports/page.tsx` `?from=`/`?to=` (movements tab) | high | mitigate | `resolveDateRange()` regex-validates (`DATE_RE`) + `!Number.isNaN(getTime())` check, falls back to 30-day default — closes T-03-11 for this surface | closed |
| T-06-03 | Information Disclosure | `/reports` page-level report data (all 3 tabs) | low | accept | `/reports` is MANAGER-only per `middleware.ts` `MANAGER_ROUTES`; all three reports show read-only aggregations already visible elsewhere to the same role — no new exposure | closed |
| T-06-SC | Tampering (supply chain) | `npm install xlsx` (package.json, node_modules) | high | mitigate | Package Legitimacy Audit flagged `xlsx` `[SUS: stale/CVE]`; blocking `checkpoint:human-verify` required explicit human approval before install — user approved CDN tarball `xlsx@0.20.3`, which patches both flagged CVEs (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9); confirmed installed via `npm ls xlsx` | closed |
| T-06-AUTH | Elevation of Privilege / Information Disclosure | `/api/reports/*` (excluded from `middleware.ts` matcher) | high | mitigate | `requireManagerResponse()` called as first statement in all 3 `GET` handlers — 401 (no session) / 403 (non-MANAGER) before any Prisma query; confirmed 3/3 via grep and exercised in `tests/reports-export.test.ts` | closed |
| T-06-DATE | Denial of Service | `/api/reports/movements` `?from=`/`?to=` | high | mitigate | Route Handler's own `resolveDateRange` (independently duplicated, does not trust the page's validation) regex-validates before constructing a `Date`, falls back to 30-day default, never throws | closed |
| T-06-04 | Tampering | Export route diverging from displayed page data (violates D-04) | medium | mitigate | Each Route Handler re-parses its own `searchParams` and re-runs the identical Prisma query rather than trusting client-passed/cached state | closed |
| CR-01 | Tampering / Injection (CWE-1236) | All 3 `/api/reports/*` xlsx exports — string cells built from STAFF-writable `notes`/`reason` fields | critical | mitigate | Discovered during post-execution code review (not present in original plan-time threat model). Fixed via `lib/utils/xlsx-sanitize.ts` (`sanitizeRow`/`sanitizeCell`) prefixing any formula-trigger-leading string (`=`,`+`,`-`,`@`, tab, CR) with `'` before `XLSX.utils.json_to_sheet`; applied uniformly across all 3 route handlers (commit `2c48b05`). Independently re-confirmed present in code during phase verification (06-VERIFICATION.md truth #9), not merely trusted from the review/fix narrative. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-03 | Read-only report aggregations of data already visible to the same MANAGER role elsewhere in the app (`/products`, `/inventory`, `/purchase-orders`) — no new access or PII exposed by surfacing it in report form | Plan-time (06-01-PLAN.md) | 2026-07-07 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-07 | 8 | 8 | 0 | Claude (orchestrator, short-circuit path — register_authored_at_plan_time: true, asvs_level: 1, threats_open: 0; all 7 plan-time threats independently verified closed during 06-VERIFICATION.md, plus 1 post-execution finding CR-01 closed via 06-REVIEW-FIX.md and re-confirmed at verification time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-07
