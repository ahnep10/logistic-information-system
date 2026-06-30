import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import SuppliersClient from "./suppliers-client"

export default async function SuppliersPage() {
  const [suppliers, session] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { createdAt: "asc" } }),
    auth(),
  ])

  return (
    <SuppliersClient
      suppliers={suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        address: s.address,
        isActive: s.isActive,
      }))}
      isManager={session?.user?.role === "MANAGER"}
    />
  )
}
