import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { db, dataService } from "@/mocks/db";
import { cn } from "@/lib/utils";
import { inputClass, messageBanner, pageHeader, pageWrapper } from "@/lib/styles";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import type { Kitchen, Order, OrderItem } from "@/types";

type Message = { type: "error" | "success"; text: string } | null;

function nextTakeawayStatus(status: OrderItem["status"]): OrderItem["status"] | null {
  if (status === "placed") return "accepted";
  if (status === "accepted") return "cooking";
  return null;
}

function takeawayActionLabel(status: OrderItem["status"]) {
  if (status === "placed") return "Accept";
  if (status === "accepted") return "Start Cooking";
  return null;
}

export function KitchenTakeawayPage() {
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
      .filter(
        (o) =>
          o.order_type === "takeaway" &&
          orderIds.has(o.id) &&
          o.status !== "closed"
      )
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
  }, [activeKitchen, version]);

  const activeItemsForOrder = (orderId: string) =>
    db.orderItems.filter(
      (i) =>
        i.order_id === orderId &&
        i.status !== "cancelled" &&
        i.status !== "served"
    );

  const advanceTakeawayItem = (item: OrderItem) => {
    const next = nextTakeawayStatus(item.status);
    if (!next) return;

    const now = new Date().toISOString();
    const patch: Partial<typeof item> = { status: next };
    if (next === "accepted") patch.accepted_at = now;
    if (next === "cooking") patch.cooking_at = now;

    dataService("orderItems").update(item.id, patch);
    setVersion((v) => v + 1);
    setMessage({ type: "success", text: "Item status updated" });
  };

  const canMarkAllReady = (order: Order) => {
    const items = activeItemsForOrder(order.id);
    return items.length > 0 && items.every((i) => i.status === "cooking" || i.status === "ready");
  };

  const markAllReady = (order: Order) => {
    const items = activeItemsForOrder(order.id);
    if (!canMarkAllReady(order)) {
      setMessage({ type: "error", text: "All items must be cooking or ready" });
      return;
    }

    const now = new Date().toISOString();
    for (const item of items) {
      if (item.status === "cooking") {
        dataService("orderItems").update(item.id, {
          status: "ready",
          ready_at: now,
        });
      }
    }

    const cashierRole = db.roles.find((r) => r.name === "cashier");
    if (cashierRole) {
      const cashierIds = db.staffRoles
        .filter((sr) => sr.role_id === cashierRole.id && sr.outlet_id === outlet.id)
        .map((sr) => sr.staff_id);
      for (const cashierId of new Set(cashierIds)) {
        dataService("notifications").create({
          organization_id: organization.id,
          staff_id: cashierId,
          type: "general",
          message: `Takeaway order for ${order.customer_name ?? "Guest"} is ready for pickup`,
          related_order_id: order.id,
          related_order_item_id: null,
          is_read: false,
          created_at: now,
        });
      }
    }

    setVersion((v) => v + 1);
    setMessage({ type: "success", text: "All items marked ready" });
  };

  const handleKitchenChange = (id: string) => {
    navigate(`/kitchen/${id}/takeaway`);
  };

  return (
    <div className={cn(pageWrapper, "space-y-4")}>
      <div className={cn(pageHeader, "gap-2")}>
        <div>
          <h1 className="text-2xl font-bold">Takeaway Queue</h1>
          <p className="text-sm text-muted-foreground">
            {activeKitchen?.name ?? "No kitchen selected"}
          </p>
        </div>
        {kitchens.length > 1 && (
          <select
            className={cn(inputClass, "px-2.5 py-1.5 sm:w-auto")}
            aria-label="Select kitchen"
            value={activeKitchen?.id ?? ""}
            onChange={(e) => handleKitchenChange(e.target.value)}
          >
            {kitchens.map((k: Kitchen) => (
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
          title="No takeaway tickets"
          description="There are no pending takeaway orders for this kitchen."
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {orders.map((order) => {
          const batches = db.kotBatches
            .filter((b) => b.order_id === order.id)
            .sort((a, b) => a.batch_number - b.batch_number);
          const ready = canMarkAllReady(order);
          return (
            <div key={order.id} className="rounded-md border bg-card shadow-sm">
              <div className="border-b bg-muted/30 p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {order.customer_name ?? "Guest"}
                    </h3>
                    {order.customer_phone && (
                      <p className="text-xs text-muted-foreground">
                        {order.customer_phone}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => markAllReady(order)}
                    disabled={!ready}
                  >
                    Mark All Ready
                  </Button>
                </div>
              </div>
              <div className="space-y-2 p-2">
                {batches.map((batch) => (
                  <div key={batch.id}>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      KOT #{batch.batch_number}
                    </p>
                    <ul className="space-y-1.5">
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
                          return (
                            <li
                              key={item.id}
                              className={cn(
                                "flex items-start justify-between rounded-md border bg-background p-1.5",
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
                              <div className="flex items-center gap-2">
                                <StatusBadge status={item.status} />
                                {isRelevant && takeawayActionLabel(item.status) && (
                                  <Button
                                    size="sm"
                                    onClick={() => advanceTakeawayItem(item)}
                                  >
                                    {takeawayActionLabel(item.status)}
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
