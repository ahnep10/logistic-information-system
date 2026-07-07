import { prisma } from "@/lib/prisma"
import { requireManagerResponse } from "@/lib/utils/route-auth"
import { getStatusBadge } from "@/lib/utils/po-status"
import { formatPONumber } from "@/lib/utils/po-number"
import * as XLSX from "xlsx"

export async function GET(request: Request) {
  const authResponse = await requireManagerResponse()
  if (authResponse) return authResponse

  // No `status` filter — all three PO statuses are always included (D-10/D-11).
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  })

  const rows = purchaseOrders.map((po) => ({
    "PO #": formatPONumber(po.poNumber),
    Supplier: po.supplier.name,
    Status: getStatusBadge(po.status).label,
    // .toNumber() converts the Prisma Decimal before it reaches json_to_sheet
    // (Pitfall 4) -- never recomputed from line items.
    Total: po.totalAmount.toNumber(),
    Created: po.createdAt.toISOString().slice(0, 10),
    "Created By": po.createdBy.name,
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, "Purchase Orders")
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="purchase-orders-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
