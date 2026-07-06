# Phase 6: Reports - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 6-Reports
**Areas discussed:** Report page structure, Excel export behavior, Movement report date range, PO report scope

---

## Report page structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single page, tabbed selector | One /reports route with a Tabs control switching the visible table below | ✓ |
| Separate routes per report | /reports/inventory, /reports/movements, /reports/purchase-orders as distinct pages | |
| Single page, all 3 stacked vertically | All three report tables rendered on one long page, no tab-switching | |

**User's choice:** Single page, tabbed selector

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, ?type= searchParam | Server reads searchParams, seeds the Tab's initial state, bookmarkable | ✓ |
| No, client-only tab state | Plain useState, no URL sync | |

**User's choice:** Yes, ?type= searchParam

| Option | Description | Selected |
|--------|-------------|----------|
| Only active tab's data | Server Component reads ?type=, runs only that report's queries | ✓ |
| All 3 load upfront | All three queries run in parallel on every page visit | |

**User's choice:** Only active tab's data

**Notes:** None.

---

## Excel export behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Exactly what's filtered on screen | Export reads the same filter params the report view used | ✓ |
| Always full unfiltered data | Export ignores any on-screen filters | |

**User's choice:** Exactly what's filtered on screen

| Option | Description | Selected |
|--------|-------------|----------|
| One route per report type | /api/reports/inventory, /movements, /purchase-orders, each a dedicated Route Handler | ✓ |
| Single generic route with a type param | /api/reports/export?type=... branches internally | |

**User's choice:** One route per report type

| Option | Description | Selected |
|--------|-------------|----------|
| Plain <a href> download link | Browser handles the download natively, no client fetch/blob | ✓ |
| Client-side fetch + blob download | More code and a loading state, allows in-page spinner/error toast | |

**User's choice:** Plain <a href> download link

**Notes:** None.

---

## Movement report date range

| Option | Description | Selected |
|--------|-------------|----------|
| Last 30 days | Matches the existing /inventory page's default | ✓ |
| Last 7 days | Tighter default window | |
| All time (no default filter) | Shows every transaction ever recorded | |

**User's choice:** Last 30 days

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, validate and fall back silently | Whitelist-style validation, never-throw pattern from Phase 5, closes T-03-11 | ✓ |
| No, match /inventory's current behavior exactly | Leave unguarded, accepts the same latent crash risk | |

**User's choice:** Yes, validate and fall back silently

| Option | Description | Selected |
|--------|-------------|----------|
| Product-header sections | Table broken into sections, one per product | ✓ |
| Flat table sorted by product | Single flat table, sorted/ordered by product name | |

**User's choice:** Product-header sections

**Notes:** T-03-11 is tracked in 03-SECURITY.md; this decision closes the same class of gap for the new report and flags the pre-existing /inventory occurrence as optional follow-up.

---

## PO report scope

| Option | Description | Selected |
|--------|-------------|----------|
| All statuses: Draft, Ordered, Received | Matches success criteria wording exactly | ✓ |
| Only Ordered + Received | Excludes Drafts since not committed spend yet | |

**User's choice:** All statuses: Draft, Ordered, Received

| Option | Description | Selected |
|--------|-------------|----------|
| Flat unfiltered list | No filter UI, matches success criteria as written | ✓ |
| Filterable by status (reuse Tabs pattern) | Adds status Tabs, more consistent UI but adds scope | |

**User's choice:** Flat unfiltered list

**Notes:** None.

---

## Claude's Discretion

- Exact column sets for each report table beyond what's named in success criteria
- How "total order value" is computed for the PO report (reuse existing computation if one exists)
- Exact .xlsx file naming convention
- Whether the inventory report includes inactive/deactivated products or only active ones

## Deferred Ideas

None raised — REPT-V2-01 (PDF export) and REPT-V2-02 (per-product mini-history widget) were already deferred at roadmap time, not raised fresh in this discussion.
