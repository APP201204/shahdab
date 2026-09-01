import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { MenuItemCard } from "@/components/MenuItemCard";
import { StatusBadge } from "@/components/StatusBadge";
import { TableCard } from "@/components/TableCard";
import { TableOperations } from "@/components/TableOperations";
import {
  inputClass,
  tabList,
  tabButton,
  tabButtonActive,
  tabButtonInactive,
} from "@/lib/styles";
import { db, dataService } from "@/mocks/db";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { logAudit } from "@/services/audit";
import { mockApi } from "@/services/mockApi";
import { markTableVacant } from "@/services/waitlist";
import { Search, ShoppingBasket } from "lucide-react";
import type { Order, OrderItem, Table, MenuItem } from "@/types";

type Message = { type: "error" | "success"; text: string } | null;
type CartItem = {
  menuItemId: string;
  variantId: string;
  modifierIds: string[];
  quantity: number;
  unitPrice: number;
};

export function deriveOrderStatus(orderId: string): Order["status"] {
  const items = db.orderItems.filter(
    (i) => i.order_id === orderId && i.status !== "cancelled"
  );
  if (items.length === 0) return "open";
  const allServed = items.every((i) => i.status === "served");
  const anyServed = items.some((i) => i.status === "served");
  if (allServed) return "fully_served";
  if (anyServed) return "partially_served";
  return "open";
}

function getOrderSummary(orderId: string) {
  const items = db.orderItems.filter(
    (i) => i.order_id === orderId && i.status !== "cancelled"
  );
  const counts = {
    cooking: 0,
    ready: 0,
    served: 0,
    pending: 0,
  };
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.quantity * item.unit_price;
    if (item.status === "cooking") counts.cooking += item.quantity;
    else if (item.status === "ready") counts.ready += item.quantity;
    else if (item.status === "served") counts.served += item.quantity;
    else counts.pending += item.quantity;
  }
  return { items, counts, subtotal };
}

export function TablesPage() {
  const { staff, outlet, organization, can, assignments, roles } = useAuth();
  const [version, setVersion] = useState(0);
  const [activeFloor, setActiveFloor] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  if (!staff || !outlet || !organization) return null;

  const isWaiterView = !can("table.merge") && !can("setup.manage");

  const floors = useMemo(() => {
    const f = db.floors
      .filter((f) => f.outlet_id === outlet.id)
      .sort((a, b) => a.display_order - b.display_order);
    if (f.length > 0 && !activeFloor) setActiveFloor(f[0].id);
    return f;
  }, [outlet.id, activeFloor]);

  const tables = useMemo(() => {
    const t = db.tables
      .filter(
        (t) =>
          t.outlet_id === outlet.id &&
          (activeFloor ? t.floor_id === activeFloor : true) &&
          t.is_active
      )
      .sort((a, b) => Number(a.table_number) - Number(b.table_number));
    if (isWaiterView) {
      const allowed = new Set(assignments.tables);
      return t.filter((table) => allowed.has(table.id));
    }
    return t;
  }, [version, outlet.id, activeFloor, isWaiterView, assignments.tables]);

  useEffect(() => {
    if (selectedTable) {
      const stillHere = tables.some((t) => t.id === selectedTable.id);
      if (!stillHere && tables.length > 0) setSelectedTable(tables[0]);
    } else if (tables.length > 0) {
      setSelectedTable(tables[0]);
    }
  }, [tables]);

  const activeOrder = useMemo(() => {
    if (!selectedTable) return null;
    return (
      db.orders.find(
        (o) =>
          o.table_id === selectedTable.id &&
          o.outlet_id === outlet.id &&
          o.status !== "closed"
      ) ?? null
    );
  }, [selectedTable, outlet.id, version]);

  const orderSummary = useMemo(
    () => (activeOrder ? getOrderSummary(activeOrder.id) : null),
    [activeOrder, version]
  );

  const categories = useMemo(
    () =>
      db.menuCategories
        .filter((c) => c.outlet_id === outlet.id)
        .sort((a, b) => a.display_order - b.display_order),
    [outlet.id]
  );

  const menuItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return db.menuItems
      .filter(
        (m) =>
          m.outlet_id === outlet.id &&
          m.is_active &&
          (activeCategory ? m.category_id === activeCategory : true) &&
          (!term || m.name.toLowerCase().includes(term))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [outlet.id, activeCategory, search, version]);

  const floorName = (floorId: string) =>
    db.floors.find((f) => f.id === floorId)?.name ?? "";

  const tableCounts = (tableId: string) => {
    const order = db.orders.find(
      (o) => o.table_id === tableId && o.status !== "closed"
    );
    if (!order) return { cooking: 0, served: 0 };
    const items = db.orderItems.filter(
      (i) => i.order_id === order.id && i.status !== "cancelled"
    );
    return {
      cooking: items
        .filter((i) => i.status === "cooking")
        .reduce((sum, i) => sum + i.quantity, 0),
      served: items
        .filter((i) => i.status === "served")
        .reduce((sum, i) => sum + i.quantity, 0),
    };
  };

  const addToCart = (item: CartItem) => {
    setCart((prev) => [...prev, item]);
    setMessage(null);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const sendToKitchen = () => {
    if (cart.length === 0 || !selectedTable) {
      setMessage({ type: "error", text: "Cart is empty" });
      return;
    }

    const order =
      activeOrder ??
      dataService("orders").create({
        organization_id: organization.id,
        outlet_id: outlet.id,
        floor_id: selectedTable.floor_id,
        order_type: "dine_in",
        table_id: selectedTable.id,
        merge_group_id: null,
        customer_name: null,
        customer_phone: null,
        captain_id: staff.id,
        status: "open",
        created_at: new Date().toISOString(),
        closed_at: null,
      });

    const existingBatches = db.kotBatches.filter((b) => b.order_id === order.id);
    const batchNumber =
      existingBatches.length > 0
        ? Math.max(...existingBatches.map((b) => b.batch_number)) + 1
        : 1;

    const batch = dataService("kotBatches").create({
      order_id: order.id,
      batch_number: batchNumber,
      created_by: staff.id,
      created_at: new Date().toISOString(),
    });

    for (const cartItem of cart) {
      const menuItem = db.menuItems.find((m) => m.id === cartItem.menuItemId);
      const variant = db.menuItemVariants.find(
        (v) => v.id === cartItem.variantId
      );
      if (!menuItem || !variant) continue;

      const orderItem = dataService("orderItems").create({
        organization_id: organization.id,
        order_id: order.id,
        kot_batch_id: batch.id,
        menu_item_id: menuItem.id,
        menu_item_variant_id: variant.id,
        kitchen_id: menuItem.kitchen_id,
        quantity: cartItem.quantity,
        unit_price: cartItem.unitPrice,
        status: "placed",
        accepted_at: null,
        cooking_at: null,
        ready_at: null,
        served_at: null,
        served_by: null,
        created_at: new Date().toISOString(),
      });

      for (const modifierId of cartItem.modifierIds) {
        db.orderItemModifiers.push({
          order_item_id: orderItem.id,
          modifier_id: modifierId,
        });
      }
    }

    dataService("orders").update(order.id, {
      status: deriveOrderStatus(order.id),
    });

    if (selectedTable.status === "vacant" || selectedTable.status === "reserved") {
      const now = new Date();
      dataService("tables").update(selectedTable.id, {
        status: "occupied",
        occupied_at: now.toISOString(),
        occupied_by_count: 2,
        expected_vacant_at: new Date(
          now.getTime() + 2 * selectedTable.avg_time_per_person * 60_000
        ).toISOString(),
      });
    }

    setCart([]);
    setVersion((v) => v + 1);
    setMessage({
      type: "success",
      text: `KOT #${batchNumber} sent to kitchen`,
    });
  };

  const requestBill = () => {
    if (!selectedTable) return;
    dataService("tables").update(selectedTable.id, { status: "bill_requested" });

    const cashierRole = db.roles.find((r) => r.name === "cashier");
    if (cashierRole) {
      const cashierStaffIds = db.staffRoles
        .filter(
          (sr) => sr.role_id === cashierRole.id && sr.outlet_id === outlet.id
        )
        .map((sr) => sr.staff_id);
      for (const staffId of cashierStaffIds) {
        dataService("notifications").create({
          organization_id: organization.id,
          staff_id: staffId,
          type: "bill_requested",
          message: `Table ${selectedTable.table_number} requested the bill`,
          related_order_id: activeOrder?.id ?? null,
          related_order_item_id: null,
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }
    }
    setVersion((v) => v + 1);
    setMessage({ type: "success", text: "Bill requested" });
  };

  const markServed = (item: OrderItem) => {
    if (!activeOrder) return;
    dataService("orderItems").update(item.id, {
      status: "served",
      served_at: new Date().toISOString(),
      served_by: staff.id,
    });
    dataService("orders").update(activeOrder.id, {
      status: deriveOrderStatus(activeOrder.id),
    });
    setVersion((v) => v + 1);
    setMessage({ type: "success", text: "Item marked served" });
  };

  const cancelItem = async (item: OrderItem) => {
    if (!activeOrder) return;
    const response = await mockApi.post<OrderItem>(`/order-items/${item.id}/cancel`);
    if (response.error) {
      setMessage({ type: "error", text: response.error.message });
      return;
    }
    dataService("orders").update(activeOrder.id, {
      status: deriveOrderStatus(activeOrder.id),
    });
    logAudit({
      organization_id: organization.id,
      outlet_id: outlet.id,
      staff_id: staff.id,
      action: "order_item.cancel",
      entity_type: "order_item",
      entity_id: item.id,
      before_json: { status: item.status, quantity: item.quantity },
      after_json: { status: "cancelled", quantity: item.quantity },
    });
    setVersion((v) => v + 1);
    setMessage({ type: "success", text: "Item cancelled" });
  };

  const markTableClean = async () => {
    if (!selectedTable) return;
    try {
      const notified = await markTableVacant(selectedTable.id);
      const updated = dataService("tables").findById(selectedTable.id);
      if (updated) setSelectedTable(updated);
      setVersion((v) => v + 1);
      setMessage({
        type: "success",
        text: notified
          ? `Table cleaned — notified ${notified.customer_name} (${notified.customer_phone})`
          : "Table cleaned and ready",
      });
    } catch (err) {
      const updated = dataService("tables").findById(selectedTable.id);
      if (updated) setSelectedTable(updated);
      setVersion((v) => v + 1);
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to notify customer",
      });
    }
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  const menuItemProps = (menuItem: MenuItem) => {
    const variants = db.menuItemVariants
      .filter((v) => v.menu_item_id === menuItem.id)
      .sort(
        (a, b) =>
          Number(b.is_default) - Number(a.is_default) ||
          a.base_price - b.base_price
      )
      .map((v) => ({
        id: v.id,
        name: v.variant_name,
        price:
          db.menuItemFloorPrices.find(
            (fp) =>
              fp.menu_item_variant_id === v.id &&
              fp.floor_id === (selectedTable?.floor_id ?? floors[0]?.id)
          )?.price ?? v.base_price,
      }));

    const modifiers = db.menuItemModifiers
      .filter((m) => m.menu_item_id === menuItem.id)
      .map((m) => db.modifiers.find((mod) => mod.id === m.modifier_id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .map((m) => ({ id: m.id, name: m.name }));

    const outOfStock =
      db.menuItemStockStatus.find(
        (s) => s.menu_item_id === menuItem.id && s.outlet_id === outlet.id
      )?.is_out_of_stock ?? false;

    return { variants, modifiers, outOfStock };
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
      <h1 className="text-2xl font-bold">Table Service</h1>

      {message && (
        <div
          className={cn(
            "rounded-md p-2 text-sm",
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-100 text-green-800"
          )}
        >
          {message.text}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-3 lg:col-span-3">
          <div className="flex items-center justify-between">
            <select
              aria-label="Select floor"
              className={cn(inputClass, "w-full")}
              value={activeFloor ?? "all"}
              onChange={(e) =>
                setActiveFloor(e.target.value === "all" ? null : e.target.value)
              }
            >
              <option value="all">All Sections</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="-mr-1 flex-1 space-y-2 overflow-y-auto pr-1">
            {tables.map((t) => {
              const counts = tableCounts(t.id);
              return (
                <TableCard
                  key={t.id}
                  table={t}
                  floorName={floorName(t.floor_id)}
                  cookingCount={counts.cooking}
                  servedCount={counts.served}
                  isSelected={selectedTable?.id === t.id}
                  onClick={setSelectedTable}
                />
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:col-span-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search menu items..."
                className={cn(inputClass, "pl-9")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {cart.length > 0 && (
              <Button
                size="sm"
                onClick={sendToKitchen}
                disabled={!selectedTable}
              >
                <ShoppingBasket className="mr-1.5 h-4 w-4" />
                Send to Kitchen
              </Button>
            )}
          </div>

          <div className={tabList} role="tablist" aria-label="Menu categories">
            <button
              role="tab"
              aria-selected={activeCategory === null}
              onClick={() => setActiveCategory(null)}
              className={cn(
                tabButton,
                activeCategory === null ? tabButtonActive : tabButtonInactive
              )}
            >
              All Items
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={activeCategory === c.id}
                onClick={() => setActiveCategory(c.id)}
                className={cn(
                  tabButton,
                  activeCategory === c.id ? tabButtonActive : tabButtonInactive
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          {cart.length > 0 && (
            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">Cart</h3>
                <span className="text-sm font-medium">₹{cartTotal.toFixed(2)}</span>
              </div>
              <ul className="space-y-2">
                {cart.map((item, index) => {
                  const menuItem = db.menuItems.find((m) => m.id === item.menuItemId);
                  const variant = db.menuItemVariants.find(
                    (v) => v.id === item.variantId
                  );
                  return (
                    <li key={index} className="flex items-center justify-between text-sm">
                      <span>
                        {menuItem?.name} ({variant?.variant_name}) × {item.quantity}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFromCart(index)}
                      >
                        Remove
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {selectedTable ? (
            <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 content-start">
              {menuItems.map((item) => {
                const { variants, modifiers, outOfStock } = menuItemProps(item);
                return (
                  <MenuItemCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    description={item.description}
                    imageUrl={item.image_url}
                    variants={variants}
                    modifiers={modifiers}
                    outOfStock={outOfStock}
                    onAdd={addToCart}
                  />
                );
              })}
              {menuItems.length === 0 && (
                <EmptyState title="No items" description="Try another category or search." />
              )}
            </div>
          ) : (
            <EmptyState title="Select a table" description="Choose a table from the left to start ordering." />
          )}
        </div>

        <div className="flex flex-col gap-3 lg:col-span-3">
          {selectedTable ? (
            <>
              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">
                    Table {selectedTable.table_number}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    Cap {selectedTable.capacity} • {floorName(selectedTable.floor_id)}
                  </span>
                </div>
                <div className="mt-1">
                  <StatusBadge status={selectedTable.status} />
                </div>
              </div>

              {activeOrder && orderSummary && (
                <div className="rounded-md border p-3">
                  <h3 className="mb-2 font-semibold">Orders in Kitchen</h3>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {orderSummary.counts.cooking > 0 && (
                      <StatusBadge
                        status="cooking"
                        label={`Cooking ${orderSummary.counts.cooking}`}
                      />
                    )}
                    {orderSummary.counts.ready > 0 && (
                      <StatusBadge
                        status="ready"
                        label={`Ready ${orderSummary.counts.ready}`}
                      />
                    )}
                    {orderSummary.counts.served > 0 && (
                      <StatusBadge
                        status="served"
                        label={`On table ${orderSummary.counts.served}`}
                      />
                    )}
                    {orderSummary.counts.pending > 0 && (
                      <StatusBadge
                        status="placed"
                        label={`Pending ${orderSummary.counts.pending}`}
                      />
                    )}
                  </div>

                  <ul className="max-h-72 space-y-2 overflow-y-auto">
                    {orderSummary.items.map((item) => {
                      const menuItem = db.menuItems.find(
                        (m) => m.id === item.menu_item_id
                      );
                      const variant = db.menuItemVariants.find(
                        (v) => v.id === item.menu_item_variant_id
                      );
                      const modifiers = db.orderItemModifiers
                        .filter((m) => m.order_item_id === item.id)
                        .map((m) => db.modifiers.find((x) => x.id === m.modifier_id)?.name)
                        .filter(Boolean)
                        .join(", ");
                      const badgeLabel =
                        item.status === "served"
                          ? "On table"
                          : item.status === "cooking"
                            ? "Cooking"
                            : item.status === "ready"
                              ? "Ready"
                              : "Pending";
                      return (
                        <li key={item.id} className="rounded-md border p-2 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-medium">{menuItem?.name}</span>
                              {variant && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  ({variant.variant_name})
                                </span>
                              )}
                              {modifiers && (
                                <p className="text-xs text-muted-foreground">{modifiers}</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {item.quantity} × ₹{item.unit_price}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <StatusBadge status={item.status} label={badgeLabel} />
                              <div className="flex gap-1">
                                {(item.status === "placed" || item.status === "accepted") &&
                                  can("order.cancel") && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => cancelItem(item)}
                                    >
                                      Cancel
                                    </Button>
                                  )}
                                {item.status === "ready" &&
                                  (can("order.create") || roles.includes("waiter")) && (
                                    <Button size="sm" onClick={() => markServed(item)}>
                                      Mark Served
                                    </Button>
                                  )}
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-3 border-t pt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Placed Subtotal (pre-tax)</span>
                      <span className="font-semibold">₹{orderSummary.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="mt-2 grid gap-1.5">
                      {can("order.create") && activeOrder && (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={requestBill}
                          disabled={selectedTable.status === "bill_requested"}
                        >
                          {selectedTable.status === "bill_requested"
                            ? "Bill Requested"
                            : "Move to Billing"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!activeOrder && selectedTable.status === "needs_cleaning" && (
                <Button size="sm" className="w-full" onClick={markTableClean}>
                  Mark Clean
                </Button>
              )}

              {!activeOrder &&
                selectedTable.status !== "needs_cleaning" &&
                selectedTable.status !== "paid" &&
                can("order.create") && (
                  <p className="text-sm text-muted-foreground">
                    Add items from the menu to start an order for this table.
                  </p>
                )}

              <TableOperations
                table={selectedTable}
                onChange={() => setVersion((v) => v + 1)}
              />
            </>
          ) : (
            <EmptyState title="No table selected" description="Select a table to view details." />
          )}
        </div>
      </div>
    </div>
  );
}
