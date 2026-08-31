import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";
import type { Table } from "@/types";

interface TableCardProps {
  table: Table;
  onClick?: (table: Table) => void;
  waiterNames?: string[];
  mergedWith?: string | null;
  nextReservationTime?: string | null;
}

const statusContainer: Record<Table["status"], string> = {
  vacant: "border-green-200 bg-green-50/50",
  reserved: "border-blue-200 bg-blue-50/50",
  occupied: "border-amber-200 bg-amber-50/50",
  bill_requested: "border-purple-200 bg-purple-50/50",
  paid: "border-emerald-200 bg-emerald-50/50",
  needs_cleaning: "border-gray-200 bg-gray-50/50",
};

export function TableCard({
  table,
  onClick,
  waiterNames = [],
  mergedWith,
  nextReservationTime,
}: TableCardProps) {
  return (
    <button
      onClick={() => onClick?.(table)}
      className={cn(
        "w-full rounded-md border p-3 text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring",
        statusContainer[table.status]
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-lg font-bold">{table.table_number}</span>
        <StatusBadge status={table.status} />
      </div>

      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="h-3 w-3" />
        Capacity {table.capacity}
      </p>

      {mergedWith && (
        <p className="text-xs font-medium text-amber-700">
          Merged with {mergedWith}
        </p>
      )}

      {nextReservationTime && (
        <p className="text-xs font-medium text-blue-700">
          Reserved {nextReservationTime}
        </p>
      )}

      {waiterNames.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {waiterNames.join(", ")}
        </p>
      )}
    </button>
  );
}
