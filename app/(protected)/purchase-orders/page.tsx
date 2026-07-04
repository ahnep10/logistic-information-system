import { prisma } from "@/lib/prisma"
import PurchaseOrdersClient from "./purchase-orders-client"

export default async function PurchaseOrdersPage() {
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  })

  const serialized = purchaseOrders.map((po) => ({
    ...po,
    totalAmount: po.totalAmount.toNumber(),
  }))

  return <PurchaseOrdersClient purchaseOrders={serialized} />
}
