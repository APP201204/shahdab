import { cn } from "@/lib/utils";
import type { Bill, Order, OrderItem, Reservation, Table } from "@/types";

type StatusBadgeVariant =
  | "table"
  | "order"
  | "item"
  | "bill"
  | "reservation";

type StatusValue =
  | Table["status"]
  | Order["status"]
  | OrderItem["status"]
  | Bill["status"]
  | Reservation["status"];

const baseClass =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize";

const statusColors: Record<string, string> = {
  vacant: "bg-green-100 text-green-800",
  reserved: "bg-blue-100 text-blue-800",
  occupied: "bg-amber-100 text-amber-800",
  bill_requested: "bg-purple-100 text-purple-800",
  paid: "bg-emerald-100 text-emerald-800",
  needs_cleaning: "bg-gray-100 text-gray-800",
  placed: "bg-slate-100 text-slate-800",
  accepted: "bg-blue-100 text-blue-800",
  cooking: "bg-orange-100 text-orange-800",
  ready: "bg-yellow-100 text-yellow-800",
  served: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  open: "bg-slate-100 text-slate-800",
  partially_served: "bg-sky-100 text-sky-800",
  fully_served: "bg-green-100 text-green-800",
  billed: "bg-purple-100 text-purple-800",
  closed: "bg-gray-100 text-gray-800",
  booked: "bg-blue-100 text-blue-800",
  seated: "bg-green-100 text-green-800",
  no_show: "bg-red-100 text-red-800",
  refunded: "bg-red-100 text-red-800",
};

interface StatusBadgeProps {
  variant?: StatusBadgeVariant;
  status: StatusValue;
  className?: string;
  label?: string;
}

export function StatusBadge({
  status,
  className,
  label,
}: StatusBadgeProps) {
  const content = label ?? status.replace(/_/g, " ");
  return (
    <span
      role="status"
      aria-label={content}
      className={cn(baseClass, statusColors[status] ?? "bg-muted text-muted-foreground", className)}
    >
      {content}
    </span>
  );
}
