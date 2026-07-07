import { prisma } from "@/lib/prisma"
import { requireManagerResponse } from "@/lib/utils/route-auth"
import { getSeverityBadge } from "@/lib/utils/severity"
import { sanitizeRow } from "@/lib/utils/xlsx-sanitize"
import * as XLSX from "xlsx"

export async function GET(request: Request) {
  const authResponse = await requireManagerResponse()
  if (authResponse) return authResponse

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: { category: { select: { name: true } } },
  })

  // sanitizeRow neutralizes leading =/+/-/@/tab/CR on every string cell to
  // prevent CSV/Excel formula injection (CWE-1236) — 06-REVIEW.md CR-01.
  const rows = products.map((p) =>
    sanitizeRow({
      Name: p.name,
      SKU: p.sku,
      Category: p.category.name,
      Threshold: p.reorderThreshold,
      Stock: p.currentStock,
      Severity: getSeverityBadge(p.currentStock, p.reorderThreshold).label,
      Status: p.isActive ? "Active" : "Inactive",
    })
  )

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, "Inventory")
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventory-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
