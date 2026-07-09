"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Package, Truck, Activity, AlertTriangle, ClipboardList, TrendingUp } from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"

import { Card } from "@/components/ui/card"
import type { POStatusCounts } from "@/lib/utils/dashboard"

const STATUS_COLORS: Record<"DRAFT" | "ORDERED" | "RECEIVED", string> = {
  DRAFT: "#64748b",
  ORDERED: "#3b82f6",
  RECEIVED: "#22c55e",
}

interface DashboardClientProps {
  totalProducts: number
  totalSuppliers: number
  movementsToday: number
  lowStockCount: number
  poStatusCounts: POStatusCounts
  topSellingProducts: { productId: string; name: string; totalSold: number }[]
}

export default function DashboardClient({
  totalProducts,
  totalSuppliers,
  movementsToday,
  lowStockCount,
  poStatusCounts,
  topSellingProducts,
}: DashboardClientProps) {
  const router = useRouter()

  const hasAnyPO =
    poStatusCounts.DRAFT + poStatusCounts.ORDERED + poStatusCounts.RECEIVED > 0

  const pieData = [
    { name: "Draft", status: "DRAFT" as const, value: poStatusCounts.DRAFT },
    { name: "Ordered", status: "ORDERED" as const, value: poStatusCounts.ORDERED },
    { name: "Received", status: "RECEIVED" as const, value: poStatusCounts.RECEIVED },
  ]

  function handleSliceClick(data: unknown) {
    const entry = data as { payload?: { status?: string }; status?: string }
    const status = entry?.payload?.status ?? entry?.status
    if (status) {
      router.push(`/purchase-orders?status=${status}`)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-3">
          <Package className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-2xl font-semibold">{totalProducts}</p>
            <p className="text-sm text-muted-foreground">Active Products</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <Truck className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-2xl font-semibold">{totalSuppliers}</p>
            <p className="text-sm text-muted-foreground">Active Suppliers</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <Activity className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-2xl font-semibold">{movementsToday}</p>
            <p className="text-sm text-muted-foreground">Movements Today</p>
          </div>
        </Card>

        <Link href="/products?stock=low">
          <Card className="p-4 flex items-center gap-3 hover:bg-muted/50 cursor-pointer transition-colors">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
            <div>
              <p className="text-2xl font-semibold">{lowStockCount}</p>
              <p className="text-sm text-muted-foreground">Low Stock Items</p>
            </div>
          </Card>
        </Link>
      </div>

      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-4">Purchase Order Status</h2>
        {hasAnyPO ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                onClick={handleSliceClick}
                cursor="pointer"
              >
                {pieData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center py-12 text-center">
            <ClipboardList className="w-8 h-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">No purchase orders yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a purchase order to see status breakdown here.
            </p>
          </div>
        )}
      </Card>

      <Card className="p-4 mt-6">
        <h2 className="text-xl font-semibold mb-4">Produk Paling Sering Keluar</h2>
        {topSellingProducts.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topSellingProducts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalSold" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center py-12 text-center">
            <TrendingUp className="w-8 h-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">No product movements yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Record stock-out transactions to see top-selling products here.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
