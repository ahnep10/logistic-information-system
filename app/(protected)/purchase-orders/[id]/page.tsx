import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import PurchaseOrderDetailClient from "./po-detail-client"

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const po = await prisma.purchaseOrder.findUnique({
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
  })

  if (!po) notFound()

  // WR-06: include the PO's currently-referenced supplier/products even if
  // they've since been deactivated, so editing a Draft doesn't render a
  // blank Select or a raw product id in place of a name.
  const referencedProductIds = po.lineItems.map((li) => li.productId)

  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({
      where: { OR: [{ isActive: true }, { id: po.supplierId }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, isActive: true },
    }),
    prisma.product.findMany({
      where: {
        OR: [{ isActive: true }, { id: { in: referencedProductIds } }],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
  ])

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
