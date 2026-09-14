import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  ClipboardList,
  Package,
  Flame,
  Car,
  Table2,
  BookOpen,
  MapPin,
  CreditCard,
  IndianRupee,
  LogOut,
  CalendarCheck,
  ClipboardCheck,
  Receipt,
  History,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: null,
    items: [{ to: "/", label: "Dashboard", icon: LayoutGrid }],
  },
  {
    label: "Operations",
    items: [
      { to: "/table-service", label: "Table Service", icon: ClipboardList },
      { to: "/quick-order", label: "Quick Order", icon: Package },
      { to: "/kitchen", label: "Kitchen Display", icon: Flame },
      { to: "/order-status", label: "Order Status", icon: ClipboardCheck },
      { to: "/delivery", label: "Delivery", icon: Car },
    ],
  },
  {
    label: "Tables & Guests",
    items: [
      { to: "/tables", label: "Table Management", icon: Table2 },
      { to: "/reservations", label: "Reservations", icon: CalendarCheck },
    ],
  },
  {
    label: "Menu",
    items: [
      { to: "/menu", label: "Menu Management", icon: BookOpen },
      { to: "/sections", label: "Sections", icon: MapPin },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/billing", label: "Cashier", icon: Receipt },
      { to: "/bill-history", label: "Bill History", icon: History },
      { to: "/billing-stations", label: "Billing Stations", icon: CreditCard },
      { to: "/reports", label: "Reports & Discounts", icon: IndianRupee },
    ],
  },
  {
    label: "Admin",
    items: [{ to: "/staff", label: "Staff & Roles", icon: UsersRound }],
  },
] as const;

export function SideNav() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <nav className="flex w-[86px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar py-3 lg:w-[190px]">
      <div className="flex-1 space-y-4 overflow-y-auto px-2">
        {groups.map((group, i) => (
          <div key={group.label ?? `g${i}`} className="space-y-1">
            {group.label && (
              <p className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="hidden lg:inline">{group.label}</span>
                <span className="lg:hidden">·</span>
              </p>
            )}
            {group.items.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent lg:flex-row lg:gap-2 lg:text-[13px]",
                    active && "bg-sidebar-accent text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="text-center leading-tight lg:text-left">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="px-2 pt-2">
        <button className="flex w-full flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium text-muted-foreground hover:bg-sidebar-accent lg:flex-row lg:gap-2 lg:text-[13px]">
          <LogOut className="size-4" />
          Logout
        </button>
      </div>
    </nav>
  );
}
