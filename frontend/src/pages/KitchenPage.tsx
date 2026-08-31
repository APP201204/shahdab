import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { db, dataService } from "@/mocks/db";
import { cn } from "@/lib/utils";
import { inputClass, messageBanner, pageHeader, pageWrapper } from "@/lib/styles";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import type { Order, OrderItem, Table } from "@/types";

type Message = { type: "error" | "success"; text: string } | null;

function orderHeader(order: Order, table: Table | undefined) {
  if (order.order_type === "takeaway") {
    return `Takeaway — ${order.customer_name ?? "Guest"}`;
  }
  return `Table ${table?.table_number ?? "?"}`;
}

function nextStatus(status: OrderItem["status"]): OrderItem["status"] | null {
  if (status === "placed") return "accepted";
  if (status === "accepted") return "cooking";
  if (status === "cooking") return "ready";
  return null;
}

function actionLabel(status: OrderItem["status"]) {
  if (status === "placed") return "Accept";
  if (status === "accepted") return "Start Cooking";
  if (status === "cooking") return "Mark Ready";
  return null;
}

export function KitchenPage() {
  const { staff, outlet, organization, assignments } = useAuth();
  const { kitchenId } = useParams<{ kitchenId: string }>();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<Message>(null);

  if (!staff || !outlet || !organization) return null;

  const kitchens = useMemo(() => {
    const all = db.kitchens.filter((k) => k.outlet_id === outlet.id);
    if (assignments.kitchens.length > 0) {
      return all.filter((k) => assignments.kitchens.includes(k.id));
    }
    return all;
  }, [outlet.id, assignments.kitchens]);

  const activeKitchen = useMemo(
    () => kitchens.find((k) => k.id === kitchenId) ?? kitchens[0],
    [kitchens, kitchenId]
  );

  const orders = useMemo(() => {
    const orderIds = new Set(
      db.orderItems
        .filter(
          (i) =>
            i.kitchen_id === activeKitchen?.id &&
            i.status !== "cancelled" &&
            i.status !== "served"
        )
        .map((i) => i.order_id)
    );
    return db.orders
      .filter((o) => orderIds.has(o.id) && o.order_type === "dine_in" && o.status !== "closed")
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
  }, [activeKitchen, version]);

  const advanceItem = (item: OrderItem) => {
    const next = nextStatus(item.status);
    if (!next) return;

    const now = new Date().toISOString();
    const patch: Partial<OrderItem> = { status: next };
    if (next === "accepted") patch.accepted_at = now;
    if (next === "cooking") patch.cooking_at = now;
    if (next === "ready") patch.ready_at = now;

    dataService("orderItems").update(item.id, patch);

    if (next === "ready") {
      const order = db.orders.find((o) => o.id === item.order_id);
      const menuItem = db.menuItems.find((m) => m.id === item.menu_item_id);
      const waiters: string[] = [];

      if (order?.table_id) {
        const table = db.tables.find((t) => t.id === order.table_id);
        const tableWaiters = db.staffTableAssignments
          .filter((a) => a.table_id === order.table_id)
          .map((a) => a.staff_id);
        waiters.push(...tableWaiters);
        if (waiters.length === 0 && order.captain_id) {
          waiters.push(order.captain_id);
        }

        for (const staffId of new Set(waiters)) {
          dataService("notifications").create({
            organization_id: organization.id,
            staff_id: staffId,
            type: "item_ready",
            message: `${menuItem?.name ?? "Item"} is ready to serve — Table ${table?.table_number ?? "?"}`,
            related_order_id: order.id,
            related_order_item_id: item.id,
            is_read: false,
            created_at: now,
          });
        }
      }
    }

    setVersion((v) => v + 1);
    setMessage({ type: "success", text: "Item status updated" });
  };

  const handleKitchenChange = (id: string) => {
    navigate(`/kitchen/${id}`);
  };

  return (
    <div className={pageWrapper}>
      <div className={pageHeader}>
        <div>
          <h1 className="text-2xl font-bold">Kitchen Board</h1>
          <p className="text-sm text-muted-foreground">
            {activeKitchen?.name ?? "No kitchen selected"}
          </p>
        </div>
        {kitchens.length > 1 && (
          <select
            className={inputClass}
            aria-label="Select kitchen"
            value={activeKitchen?.id ?? ""}
            onChange={(e) => handleKitchenChange(e.target.value)}
          >
            {kitchens.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {message && (
        <div
          className={cn(
            messageBanner,
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-100 text-green-800"
          )}
        >
          {message.text}
        </div>
      )}

      {orders.length === 0 && (
        <EmptyState
          title="No active tickets"
          description="There are no pending items for this kitchen."
        />
      )}

      <div className="space-y-4">
        {orders.map((order) => {
          const table = db.tables.find((t) => t.id === order.table_id);
          const batches = db.kotBatches
            .filter((b) => b.order_id === order.id)
            .sort((a, b) => a.batch_number - b.batch_number);
          return (
            <div key={order.id} className="rounded-md border bg-card shadow-sm">
              <div className="border-b bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{orderHeader(order, table)}</h3>
                  <span className="text-xs text-muted-foreground">
                    {order.order_type === "takeaway" ? "TA" : "Dine-in"}
                  </span>
                </div>
                {order.customer_phone && (
                  <p className="text-xs text-muted-foreground">
                    {order.customer_phone}
                  </p>
                )}
              </div>
              <div className="space-y-3 p-3">
                {batches.map((batch) => (
                  <div key={batch.id}>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      KOT #{batch.batch_number}
                    </p>
                    <ul className="space-y-2">
                      {db.orderItems
                        .filter((i) => i.kot_batch_id === batch.id)
                        .map((item) => {
                          const menuItem = db.menuItems.find(
                            (m) => m.id === item.menu_item_id
                          );
                          const variant = db.menuItemVariants.find(
                            (v) => v.id === item.menu_item_variant_id
                          );
                          const modifiers = db.orderItemModifiers
                            .filter((m) => m.order_item_id === item.id)
                            .map((m) => db.modifiers.find((mod) => mod.id === m.modifier_id)?.name)
                            .filter(Boolean)
                            .join(", ");
                          const isRelevant = item.kitchen_id === activeKitchen?.id;
                          const label = actionLabel(item.status);
                          return (
                            <li
                              key={item.id}
                              className={cn(
                                "flex items-start justify-between rounded-md border bg-background p-2",
                                !isRelevant && "bg-muted/40 opacity-50"
                              )}
                            >
                              <div className="text-sm">
                                <p className="font-medium">
                                  {menuItem?.name}
                                  {variant && (
                                    <span className="text-muted-foreground">
                                      {" "}({variant.variant_name})
                                    </span>
                                  )}
                                </p>
                                {modifiers && (
                                  <p className="text-xs text-muted-foreground">
                                    {modifiers}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Qty: {item.quantity}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <StatusBadge status={item.status} />
                                {isRelevant && label && (
                                  <Button
                                    size="sm"
                                    onClick={() => advanceItem(item)}
                                  >
                                    {label}
                                  </Button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
