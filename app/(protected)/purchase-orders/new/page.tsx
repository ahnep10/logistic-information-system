import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import PurchaseOrderForm from "../po-form-client"

export default async function NewPurchaseOrderPage() {
  const [suppliers, products] = await Promise.all([
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

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Create Purchase Order</h1>
        <Button variant="ghost" nativeButton={false} render={<Link href="/purchase-orders" />}>
          Cancel
        </Button>
      </div>
      <PurchaseOrderForm mode="create" suppliers={suppliers} products={products} />
    </div>
  )
}
