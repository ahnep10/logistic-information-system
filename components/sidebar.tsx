import Link from "next/link"
import SidebarNavItem from "@/components/sidebar-nav-item"
import {
  LayoutDashboard,
  Package,
  Tag,
  Truck,
  ArrowLeftRight,
  History,
  ShoppingCart,
  BarChart2,
  Users,
  ChevronDown,
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { logout } from "@/actions/auth"

const ALL_NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-4 h-4 shrink-0" />, managerOnly: true },
  { label: "Products", href: "/products", icon: <Package className="w-4 h-4 shrink-0" />, managerOnly: false },
  { label: "Categories", href: "/categories", icon: <Tag className="w-4 h-4 shrink-0" />, managerOnly: false },
  { label: "Suppliers", href: "/suppliers", icon: <Truck className="w-4 h-4 shrink-0" />, managerOnly: false },
  { label: "Stock In/Out", href: "/stock", icon: <ArrowLeftRight className="w-4 h-4 shrink-0" />, managerOnly: false },
  { label: "Inventory History", href: "/inventory", icon: <History className="w-4 h-4 shrink-0" />, managerOnly: false },
  { label: "Purchase Orders", href: "/purchase-orders", icon: <ShoppingCart className="w-4 h-4 shrink-0" />, managerOnly: false },
  { label: "Reports", href: "/reports", icon: <BarChart2 className="w-4 h-4 shrink-0" />, managerOnly: true },
  { label: "Users", href: "/users", icon: <Users className="w-4 h-4 shrink-0" />, managerOnly: true },
]

interface SidebarProps {
  role: string
  userName: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return parts[0].slice(0, 2).toUpperCase()
}

export default function Sidebar({ role, userName }: SidebarProps) {
  // MANAGER sees all 9 items; STAFF sees only !managerOnly items (6 items)
  // Items are completely excluded from JSX — not hidden with CSS (D-07)
  const visibleItems =
    role === "MANAGER"
      ? ALL_NAV_ITEMS
      : ALL_NAV_ITEMS.filter((item) => !item.managerOnly)

  const initials = getInitials(userName)
  const roleDisplay = role === "MANAGER" ? "Manager" : "Staff"

  return (
    <aside className="flex flex-col w-60 bg-slate-900 text-white h-full shrink-0 overflow-hidden">
      {/* Logo area */}
      <div className="h-16 px-4 flex items-center">
        <span className="text-white font-semibold text-lg">Logistics MIS</span>
      </div>

      {/* Nav area */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {visibleItems.map((item) => (
          <SidebarNavItem
            key={item.href}
            label={item.label}
            href={item.href}
            icon={item.icon}
          />
        ))}
      </nav>

      {/* Separator */}
      <Separator className="bg-slate-700 mx-4" />

      {/* Footer */}
      <div className="p-4 flex items-center gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-slate-700 text-slate-100 text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-100 truncate">{userName}</p>
          <p className="text-xs text-slate-500">{roleDisplay}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="text-slate-400 hover:text-slate-100 transition-colors focus:outline-none"
            aria-label="User menu"
          >
            <ChevronDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-48">
            <DropdownMenuItem>
              <Link href="/profile" className="w-full">
                View Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <form action={logout} className="w-full">
                <button type="submit" className="w-full text-left text-sm">
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
