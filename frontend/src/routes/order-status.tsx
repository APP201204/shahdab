import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { ClipboardCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/format";
import { useOrders, useServeItem } from "@/hooks/useOrders";
import { OrderLine } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/order-status")({
  head: () => ({
    meta: [
      { title: "Order Status · SHADAB RestaurantOS" },
      {
        name: "description",
        content: "Waiter view — mark served items and track per-table order progress.",
      },
      { property: "og:title", content: "Order Status · SHADAB RestaurantOS" },
    ],
  }),
  component: OrderStatus,
});

function derivedStatus(lines: OrderLine[]): string {
  if (lines.length === 0) return "Open";
  const served = lines.filter((l) => l.served).length;
  if (served === 0) return "Open";
  if (served === lines.length) return "Fully Served";
  return "Partially Served";
}

const derivedStyle: Record<string, string> = {
  Open: "bg-primary-soft text-primary",
  "Partially Served": "bg-warning-soft text-warning-foreground",
  "Fully Served": "bg-success-soft text-success",
};

function OrderStatus() {
  const { data } = useOrders();
  const serve = useServeItem();

  const units = useMemo(() => data?.units ?? [], [data]);

  const markServed = (
    _unitId: string,
    lineId: string,
    unitName: string,
    itemName: string
  ) => {
    serve.mutate(lineId, {
      onSuccess: () => toast.success(`${itemName} served at ${unitName}`),
      onError: (err: any) => toast.error(err?.message ?? "Could not mark served"),
    });
  };

  return (
    <div className="space-y-5 p-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ClipboardCheck className="size-5 text-brand-alt" /> Order Status
        </h1>
        <p className="text-sm text-muted-foreground">
          Waiter view — mark dishes served as they reach the table.
        </p>
      </div>

      {units.length === 0 && (
        <Card className="flex min-h-[200px] items-center justify-center p-4 shadow-card">
          <p className="text-sm text-muted-foreground">No active orders right now.</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {units.map((u) => {
          const status = derivedStatus(u.lines);
          const batches = [...new Set(u.lines.map((l) => l.batch ?? 1))].sort();
          return (
            <Card key={u.id} className="gap-3 p-4 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{u.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.sectionName ?? ""}
                    {u.waiter ? ` · ${u.waiter}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    derivedStyle[status]
                  )}
                >
                  {status}
                </span>
              </div>

              {batches.map((b) => (
                <div key={b} className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    KOT Batch #{b}
                  </p>
                  {u.lines
                    .filter((l) => (l.batch ?? 1) === b)
                    .map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate",
                              l.served && "text-muted-foreground line-through"
                            )}
                          >
                            {l.name}
                            {l.variant ? ` (${l.variant})` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            ×{l.qty} · {inr(l.qty * l.unitPrice, false)}
                          </p>
                        </div>
                        {l.served ? (
                          <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                            Served
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markServed(u.id, l.id, u.name, l.name)}
                            disabled={serve.isPending}
                          >
                            Mark Served
                          </Button>
                        )}
                      </div>
                    ))}
                </div>
              ))}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
