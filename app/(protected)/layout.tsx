import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Sidebar from "@/components/sidebar"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Belt-and-suspenders: middleware should catch this first
  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        role={session.user.role}
        userName={session.user.name ?? "User"}
      />
      <main className="flex-1 overflow-y-auto bg-white">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
