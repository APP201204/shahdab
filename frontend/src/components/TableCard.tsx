import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { Users, Flame, CheckCircle2 } from "lucide-react";
import type { Table } from "@/types";

interface TableCardProps {
  table: Table;
  onClick?: (table: Table) => void;
  floorName?: string;
  cookingCount?: number;
  servedCount?: number;
  isSelected?: boolean;
}

const statusContainer: Record<Table["status"], string> = {
  vacant: "border-border bg-background",
  reserved: "border-blue-200 bg-blue-50/50",
  occupied: "border-green-200 bg-green-50",
  bill_requested: "border-purple-200 bg-purple-50/50",
  paid: "border-emerald-200 bg-emerald-50/50",
  needs_cleaning: "border-gray-200 bg-gray-50/50",
};

export function TableCard({
  table,
  onClick,
  floorName,
  cookingCount = 0,
  servedCount = 0,
  isSelected = false,
}: TableCardProps) {
  return (
    <button
      onClick={() => onClick?.(table)}
      className={cn(
        "w-full rounded-md border p-3 text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring",
        statusContainer[table.status],
        isSelected && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-base font-bold">Table {table.table_number}</span>
        <div className="flex items-center gap-1.5">
          {servedCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {servedCount}
            </span>
          )}
          {cookingCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-orange-500">
              <Flame className="h-3.5 w-3.5" />
              {cookingCount}
            </span>
          )}
        </div>
      </div>

      <div className="mt-1 flex items-center gap-2 text-xs">
        {table.status === "occupied" ? (
          <span className="font-medium text-green-600">Dine In</span>
        ) : (
          <StatusBadge status={table.status} className="scale-90" />
        )}
      </div>

      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{floorName}</span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {table.capacity}
        </span>
      </div>
    </button>
  );
}
