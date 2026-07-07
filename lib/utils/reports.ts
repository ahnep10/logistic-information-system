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

// Movements date-range validation — source: 06-CONTEXT.md D-08 + 06-RESEARCH.md
// Pattern 2. Regex-validates the date SHAPE before ever constructing a Date,
// falling back to the 30-day default on any mismatch — this is the fix for
// T-03-11 (03-SECURITY.md), which /inventory's current unguarded
// `new Date(params.from)` does NOT apply. Do not copy /inventory's pattern
// forward (RESEARCH.md Pitfall 3).
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function resolveDateRange(
  from?: string,
  to?: string
): { gte: Date; lte: Date } {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const now = new Date()

  const fromDate =
    from && DATE_RE.test(from) ? new Date(`${from}T00:00:00.000Z`) : undefined
  const gte =
    fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : thirtyDaysAgo

  const toDate =
    to && DATE_RE.test(to) ? new Date(`${to}T23:59:59.999Z`) : undefined
  const lte = toDate && !Number.isNaN(toDate.getTime()) ? toDate : now

  return { gte, lte }
}

// Movement report grouping — source: 06-CONTEXT.md D-09
// Groups an already product-name-ordered transaction list into one section per
// product, preserving first-seen order.
export interface GroupableTransaction {
  id: string
  type: "STOCK_IN" | "STOCK_OUT"
  quantity: number
  reason: string
  notes: string | null
  createdAt: Date
  product: { id: string; name: string; sku: string }
  createdBy: { name: string | null }
}

export interface TransactionGroup {
  productId: string
  productName: string
  sku: string
  transactions: GroupableTransaction[]
}

export function groupTransactionsByProduct(
  transactions: GroupableTransaction[]
): TransactionGroup[] {
  const groups = new Map<string, TransactionGroup>()

  for (const tx of transactions) {
    const existing = groups.get(tx.product.id)
    if (existing) {
      existing.transactions.push(tx)
    } else {
      groups.set(tx.product.id, {
        productId: tx.product.id,
        productName: tx.product.name,
        sku: tx.product.sku,
        transactions: [tx],
      })
    }
  }

  return Array.from(groups.values())
}
