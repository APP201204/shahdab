import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyText?: string;
  emptyDescription?: string;
  sortable?: boolean;
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
}

type SortState = {
  key: string;
  direction: "asc" | "desc";
} | null;

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  return String(a).localeCompare(String(b));
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyText = "No data available.",
  emptyDescription,
  sortable,
  isLoading,
  onRowClick,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);

  const sortedRows = useMemo(() => {
    if (!sort || !sortable) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const next = [...rows];
    next.sort((a, b) => {
      const av = col.render(a);
      const bv = col.render(b);
      const dir = sort.direction === "asc" ? 1 : -1;
      return compareValues(av, bv) * dir;
    });
    return next;
  }, [rows, sort, sortable, columns]);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const headerAlign = (align?: Column<T>["align"]) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted text-left text-muted-foreground">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-2 text-xs font-medium",
                  headerAlign(col.align),
                  sortable && col.sortable !== false && "cursor-pointer select-none"
                )}
                onClick={() => sortable && col.sortable !== false && toggleSort(col.key)}
              >
                <span className="flex items-center gap-1">
                  {col.header}
                  {sort?.key === col.key && (
                    <span className="text-xs">
                      {sort.direction === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sortedRows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn(
                "hover:bg-muted/50",
                onRowClick && "cursor-pointer"
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-4 py-2",
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={`sk-${i}`}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2">
                    <Skeleton className="h-4 w-3/4" />
                  </td>
                ))}
              </tr>
            ))}
          {!isLoading && sortedRows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-4">
                <EmptyState title={emptyText} description={emptyDescription} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
