"use client"
import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface SidebarNavItemProps {
  label: string
  href: string
  icon: ReactNode
}

export default function SidebarNavItem({ label, href, icon }: SidebarNavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + "/")

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 px-3 h-10 rounded-md text-sm transition-colors",
        isActive
          ? "bg-slate-800 text-slate-100 border-l-2 border-blue-600"
          : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}
