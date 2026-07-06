# Phase 5: Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 5-Dashboard
**Areas discussed:** Low-stock drill-in target, Dashboard layout & KPI tile style, "Today" boundary for movements count, PO status summary interactivity

---

## Low-stock drill-in target

| Option | Description | Selected |
|--------|-------------|----------|
| URL param (?stock=low) | Server Component reads searchParams, Prisma query filters server-side; bookmarkable, matches /inventory's URL-driven filtering convention | ✓ |
| Client-side Tabs | Add an All/Low-stock Tabs toggle like the Suppliers active/inactive pattern | |

**User's choice:** URL param (?stock=low)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show a banner/badge | e.g. "Showing 4 low-stock products" with a link back to the unfiltered list | ✓ |
| No, just filter silently | Table simply shows fewer rows with no extra messaging | |

**User's choice:** Yes, show a banner/badge

| Option | Description | Selected |
|--------|-------------|----------|
| Active products only | Consistent with the "total active products" KPI tile and Phase 2/3 convention | ✓ |
| All products regardless of status | Counts and lists every product whose stock is at/below threshold | |

**User's choice:** Active products only

**Notes:** Surfaced a discrepancy between REQUIREMENTS.md phrasing ("inventory list") and the actual codebase — the severity-tiered product view lives at `/products`, not `/inventory` (which is transaction history with no severity data). Resolved by targeting `/products`.

---

## Dashboard layout & KPI tile style

| Option | Description | Selected |
|--------|-------------|----------|
| Card grid with icons | Reuse existing Card component in a 4-column grid, each tile with a Lucide icon | ✓ |
| Card grid, no icons | Same grid, plain number + label | |

**User's choice:** Card grid with icons

| Option | Description | Selected |
|--------|-------------|----------|
| Plain count cards/badges | Three simple stat blocks, no charting library | |
| Recharts bar/pie chart | Visual chart using Recharts for the status distribution | ✓ |

**User's choice:** Recharts pie chart

| Option | Description | Selected |
|--------|-------------|----------|
| Single page: KPI row, then PO panel below | One /dashboard page, 4 tiles at top, PO panel underneath | ✓ |
| Other | — | |

**User's choice:** Single page: KPI row, then PO panel below

---

## "Today" boundary for movements count

| Option | Description | Selected |
|--------|-------------|----------|
| UTC calendar day | Matches the exact convention already used in /inventory's date-range filters | ✓ |
| Local server calendar day | Uses the server's local timezone for the day boundary | |

**User's choice:** UTC calendar day

---

## PO status summary interactivity

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, clickable slices | Clicking Draft/Ordered/Received navigates to /purchase-orders?status=X | ✓ |
| No, display only | The pie chart is a static visual | |

**User's choice:** Yes, clickable slices

---

## Claude's Discretion

- Exact Prisma query shape for the `currentStock <= reorderThreshold` cross-column comparison (raw SQL vs. fetch-then-filter)
- KPI tile icon choices and Recharts pie chart color/legend styling
- Styling of the "back to full list" affordance on the filtered `/products` banner
- Responsive grid breakpoints for the 4-tile KPI row

## Deferred Ideas

None new — DASH-V2-01 (auto-refresh) and DASH-V2-02 (sparklines) were already tracked as v2 deferrals in REQUIREMENTS.md prior to this discussion.
