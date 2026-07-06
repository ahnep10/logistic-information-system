// Dashboard KPI helpers — source: 05-CONTEXT.md D-10/D-11, 05-RESEARCH.md Code Examples

export type POStatusCounts = { DRAFT: number; ORDERED: number; RECEIVED: number }

export function getTodayUtcRange(): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  )
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
  )
  return { start, end }
}

export function fillPoStatusCounts(
  groups: { status: "DRAFT" | "ORDERED" | "RECEIVED"; _count: { status: number } }[]
): POStatusCounts {
  const counts: POStatusCounts = { DRAFT: 0, ORDERED: 0, RECEIVED: 0 }
  for (const g of groups) {
    counts[g.status] = g._count.status
  }
  return counts
}
