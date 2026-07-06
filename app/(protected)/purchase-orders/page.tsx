import { prisma } from "@/lib/prisma"
import PurchaseOrdersClient from "./purchase-orders-client"

const VALID_STATUSES = ["DRAFT", "ORDERED", "RECEIVED"] as const

type SearchParams = { status?: string }
type Props = { searchParams: Promise<SearchParams> }

export default async function PurchaseOrdersPage({ searchParams }: Props) {
  const params = await searchParams
  const isValidStatus = (VALID_STATUSES as readonly string[]).includes(
    params.status ?? ""
  )
  const initialFilter = isValidStatus
    ? (params.status!.toLowerCase() as "draft" | "ordered" | "received")
    : undefined

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

  return (
    <PurchaseOrdersClient purchaseOrders={serialized} initialFilter={initialFilter} />
  )
}
