// Report helpers — source: 06-CONTEXT.md D-02 + 06-RESEARCH.md Pattern 1
// Shared between the /reports page and the /api/reports/* export Route Handlers (Plan 06-02)

export const REPORT_TYPES = ["inventory", "movements", "purchase-orders"] as const
export type ReportType = (typeof REPORT_TYPES)[number]

// Whitelist-then-fallback: only the exact literals in REPORT_TYPES are accepted
// (case-sensitive); any other value (wrong case, unrelated string) or absence
// resolves to "inventory", never throws — mirrors the pattern established for
// ?stock= (Phase 5) and ?status= (Phase 5).
export function resolveReportType(type?: string): ReportType {
  const isValidType = (REPORT_TYPES as readonly string[]).includes(type ?? "")
  return isValidType ? (type as ReportType) : "inventory"
}
