import { prisma } from "@/lib/prisma"
import { requireManagerResponse } from "@/lib/utils/route-auth"
import * as XLSX from "xlsx"

// Regex-then-fallback date validation — duplicated intentionally from
// lib/utils/reports.ts (Plan 06-01), not imported. This Route Handler
// independently re-derives and re-validates its own query rather than
// sharing state with the page (06-RESEARCH.md Pattern 3, D-04).
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function resolveDateRange(from?: string, to?: string) {
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

export async function GET(request: Request) {
  const authResponse = await requireManagerResponse()
  if (authResponse) return authResponse

  const { searchParams } = new URL(request.url)
  const { gte, lte } = resolveDateRange(
    searchParams.get("from") ?? undefined,
    searchParams.get("to") ?? undefined
  )

  const transactions = await prisma.stockTransaction.findMany({
    where: { createdAt: { gte, lte } },
    orderBy: [{ product: { name: "asc" } }, { createdAt: "desc" }],
    include: {
      product: { select: { name: true, sku: true } },
      createdBy: { select: { name: true } },
    },
  })

  const rows = transactions.map((t) => ({
    Product: t.product.name,
    SKU: t.product.sku,
    Type: t.type,
    Quantity: t.quantity,
    Reason: t.reason,
    Date: t.createdAt.toISOString().slice(0, 10),
    "Recorded By": t.createdBy.name,
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, "Movements")
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="movements-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
