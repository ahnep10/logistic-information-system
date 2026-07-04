import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import PurchaseOrderDetailClient from "./po-detail-client"

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [po, suppliers, products] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        createdBy: { select: { name: true } },
        lineItems: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, isActive: true },
            },
          },
        },
      },
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
  ])

  if (!po) notFound()

  const serializedPo = {
    id: po.id,
    poNumber: po.poNumber,
    status: po.status,
    supplierId: po.supplierId,
    supplier: { name: po.supplier.name },
    createdBy: { name: po.createdBy.name },
    createdAt: po.createdAt,
    totalAmount: po.totalAmount.toNumber(),
    lineItems: po.lineItems.map((li) => ({
      id: li.id,
      productId: li.productId,
      product: {
        id: li.product.id,
        name: li.product.name,
        sku: li.product.sku,
        isActive: li.product.isActive,
      },
      quantity: li.quantity,
      unitPrice: li.unitPrice.toNumber(),
      receivedQuantity: li.receivedQuantity,
    })),
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <PurchaseOrderDetailClient po={serializedPo} suppliers={suppliers} products={products} />
    </div>
  )
}
