import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  LayoutGrid,
  Calendar,
  Clock,
  Utensils,
  Package,
  CreditCard,
  History,
  Ban,
  Users,
  Settings,
  SlidersHorizontal,
  Bell,
  BarChart3,
  FileText,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: string | string[];
}

export const navItems: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Tables", to: "/tables", icon: LayoutGrid, permission: ["table.merge", "order.read", "setup.manage"] },
  { label: "Reservations", to: "/reservations", icon: Calendar, permission: "reservation.create" },
  { label: "Queue", to: "/waitlist", icon: Clock, permission: "reservation.create" },
  { label: "Menu", to: "/menu", icon: Utensils, permission: "menu.read" },
  { label: "Takeaway", to: "/takeaway", icon: Package, permission: ["order.create", "bill.create"] },
  { label: "Billing", to: "/billing", icon: CreditCard, permission: "bill.create" },
  { label: "Bill History", to: "/bills/history", icon: History, permission: "bill.read" },
  { label: "Stock Out", to: "/stock-out", icon: Ban, permission: "stock.update" },
  { label: "Staff", to: "/staff", icon: Users, permission: "staff.create" },
  { label: "Setup", to: "/setup", icon: Settings, permission: "setup.manage" },
  { label: "Settings", to: "/settings", icon: SlidersHorizontal, permission: "outlet.update" },
  { label: "Notifications", to: "/notifications", icon: Bell, permission: "notification.read" },
  { label: "Analytics", to: "/analytics", icon: BarChart3, permission: "analytics.read" },
  { label: "Audit Logs", to: "/audit-logs", icon: FileText, permission: "audit.read" },
];
