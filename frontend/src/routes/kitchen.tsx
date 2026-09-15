import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Flame, PackageX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useMenu } from "@/hooks/useMenu";
import { useStaff } from "@/hooks/useStaff";
import { useKitchenTickets, useKitchenItemActions } from "@/hooks/useKitchen";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/kitchen")({
  head: () => ({
    meta: [
      { title: "Kitchen Display · SHADAB RestaurantOS" },
      {
        name: "description",
        content: "Live KOT queue for the Shadab kitchen — tickets by table, section and age.",
      },
      { property: "og:title", content: "Kitchen Display · SHADAB RestaurantOS" },
      { property: "og:description", content: "Live KOT queue for the Shadab kitchen." },
    ],
  }),
  component: KitchenDisplay,
});

type ItemStatus = "placed" | "accepted" | "cooking" | "ready";

type TicketItem = {
  id: string;
  name: string;
  qty: number;
  note?: string;
  status: ItemStatus;
  mine: boolean;
};

type Ticket = {
  id: string;
  orderId: string;
  kot: string;
  table: string;
  section: string;
  age: string;
  takeaway: boolean;
  items: TicketItem[];
};

const statusStyle: Record<ItemStatus, string> = {
  placed: "bg-primary-soft text-primary",
  accepted: "bg-primary-soft text-primary",
  cooking: "bg-warning-soft text-warning-foreground",
  ready: "bg-success-soft text-success",
} as const;

const statusText: Record<ItemStatus, string> = {
  placed: "New",
  accepted: "Accepted",
  cooking: "Cooking",
  ready: "Ready",
};

const actionLabel: Record<ItemStatus, string> = {
  placed: "Accept",
  accepted: "Start",
  cooking: "Ready",
  ready: "Done",
};

function ticketStatus(t: Ticket): ItemStatus {
  const mine = t.items.filter((i) => i.mine);
  if (mine.every((i) => i.status === "ready")) return "ready";
  if (mine.some((i) => i.status === "cooking" || i.status === "ready")) return "cooking";
  if (mine.some((i) => i.status === "accepted")) return "accepted";
  return "placed";
}

const OUTLET = "SHADAB";

function KitchenDisplay() {
  const queryClient = useQueryClient();
  const { data } = useKitchenTickets();
  const { data: menuData } = useMenu(OUTLET, true);
  const { data: staffData } = useStaff(OUTLET);
  const { advance, markAllReady } = useKitchenItemActions();

  const [tab, setTab] = useState<"dine-in" | "takeaway">("dine-in");
  const [showStock, setShowStock] = useState(false);

  const menuItems = menuData?.categories.flatMap((c) => c.items) ?? [];
  const kitchenManager = staffData?.staff.find((s) => s.roles.includes("kitchen-manager"))?.id;

  const tickets = useMemo<Ticket[]>(
    () =>
      (data?.tickets ?? []).map((t) => ({
        id: t.id,
        orderId: t.order.id,
        kot: `KOT-${t.batchNumber}`,
        table: t.table?.name ?? t.order.customerName ?? "Takeaway",
        section: t.section?.name ?? (t.order.orderType === "takeaway" ? "Takeaway" : "Dine In"),
        age: formatDistanceToNow(new Date(t.createdAt), { addSuffix: true }),
        takeaway: t.order.orderType === "takeaway",
        items: t.items.map((i: any) => ({
          id: i.id,
          name: i.variant ? `${i.name} (${i.variant})` : i.name,
          qty: i.qty,
          note: i.note ?? undefined,
          status: i.kitchenStatus as ItemStatus,
          mine: true,
        })),
      })),
    [data],
  );

  const advanceItem = (ticketId: string, itemIndex: number) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    const item = ticket.items[itemIndex];
    if (!item || item.status === "ready") return;
    advance(item.id, item.status);
  };

  const handleMarkAllReady = (ticketId: string) => {
    const t = tickets.find((x) => x.id === ticketId);
    if (!t) return;
    markAllReady.mutate(t.orderId, {
      onSuccess: () => toast.success(`Takeaway order for ${t.table} is ready for pickup`),
    });
  };

  const visible = tickets.filter((t) => t.takeaway === (tab === "takeaway"));

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Flame className="size-5 text-brand-alt" /> Kitchen Display
          </h1>
          <p className="text-sm text-muted-foreground">
            Live KOT queue — oldest tickets first, bump each item when plated.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            {(["dine-in", "takeaway"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setTab(v)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium capitalize",
                  tab === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {v === "dine-in" ? "Dine-In" : "Takeaway"}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => setShowStock((s) => !s)}>
            <PackageX className="size-4" /> Stock
          </Button>
        </div>
      </div>

      {showStock && (
        <Card className="gap-2 p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Item Availability — toggling off disables the item on every ordering screen
          </p>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {menuItems.map((m) => {
              const out = m.outOfStock || m.status !== "available";
              return (
                <label key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className={cn("truncate", out && "text-muted-foreground line-through")}>
                    {m.name}
                  </span>
                  <Switch
                    checked={!out}
                    disabled={!kitchenManager}
                    onCheckedChange={async (on) => {
                      if (!kitchenManager) return;
                      try {
                        await api.menuItems.toggleStockOut(m.id, kitchenManager);
                        await queryClient.invalidateQueries({ queryKey: ["menu"] });
                        if (!on) {
                          toast.success(`${m.name} is now unavailable for new orders`);
                        } else {
                          toast.success(`${m.name} is back in stock`);
                        }
                      } catch (err: any) {
                        toast.error(err.message ?? "Failed to update stock");
                      }
                    }}
                  />
                </label>
              );
            })}
          </div>
        </Card>
      )}

      {visible.length === 0 && (
        <Card className="flex min-h-[160px] items-center justify-center p-4 shadow-card">
          <p className="text-sm text-muted-foreground">No {tab} tickets in the queue.</p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visible.map((t) => {
          const overall = ticketStatus(t);
          const allActionable = t.items
            .filter((i) => i.mine)
            .every((i) => i.status === "cooking" || i.status === "ready");
          return (
            <Card key={t.id} className="gap-3 p-4 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold">{t.kot}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.table} · {t.section}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    statusStyle[overall],
                  )}
                >
                  {statusText[overall]}
                </span>
              </div>
              <ul className="space-y-2 text-sm">
                {t.items.map((i, idx) => (
                  <li
                    key={i.id}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border border-border bg-card/50 p-2",
                      !i.mine && "opacity-40",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate">{i.name}</span>
                        <span className="shrink-0 font-semibold tabular-nums">×{i.qty}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[10px] font-medium",
                            statusStyle[i.status].split(" ")[1],
                          )}
                        >
                          {statusText[i.status]}
                        </span>
                        {i.note && <p className="text-[11px] text-warning-foreground">{i.note}</p>}
                      </div>
                    </div>
                    {i.mine && (
                      <Button
                        size="sm"
                        className="shrink-0"
                        disabled={i.status === "ready"}
                        onClick={() => advanceItem(t.id, idx)}
                      >
                        {actionLabel[i.status]}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t.age}</span>
                {t.takeaway && (
                  <Button size="sm" disabled={!allActionable} onClick={() => handleMarkAllReady(t.id)}>
                    Mark All Ready
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
