import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { MenuBrowser } from "@/components/MenuBrowser";
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
import { format, isFuture, parseISO } from "date-fns";
import type { Order, OrderItem, Table } from "@/types";

type Message = { type: "error" | "success"; text: string } | null;

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


export function TablesPage() {
  const { staff, outlet, organization, can, assignments, roles } = useAuth();
  const [version, setVersion] = useState(0);
  const [activeFloor, setActiveFloor] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [waiterId, setWaiterId] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  if (!staff || !outlet || !organization) return null;

  const isWaiterView = !can("table.merge") && !can("setup.manage");
  const isWaiter = roles.includes("waiter");

  const floors = useMemo(() => {
    const f = db.floors
      .filter((f) => f.outlet_id === outlet.id)
      .sort((a, b) => a.display_order - b.display_order);
    if (f.length > 0 && !activeFloor) setActiveFloor(f[0].id);
    return f;
  }, [outlet.id, activeFloor]);

  const tables = useMemo(() => {
    const t = db.tables.filter(
      (t) =>
        t.outlet_id === outlet.id &&
        (activeFloor ? t.floor_id === activeFloor : true) &&
        t.is_active
    );
    if (isWaiterView) {
      const allowed = new Set(assignments.tables);
      return t.filter((table) => allowed.has(table.id));
    }
    return t;
  }, [version, outlet.id, activeFloor, isWaiterView, assignments.tables]);

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

  const openDetail = (table: Table) => {
    setSelectedTable(table);
    setMessage(null);
    setWaiterId("");
    setShowMenu(false);
  };

  const closeDetail = () => {
    setSelectedTable(null);
    setMessage(null);
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

  const assignWaiter = () => {
    if (!selectedTable || !waiterId) return;
    const exists = db.staffTableAssignments.some(
      (a) => a.staff_id === waiterId && a.table_id === selectedTable.id
    );
    if (exists) {
      setMessage({ type: "error", text: "Waiter already assigned" });
      return;
    }
    db.staffTableAssignments.push({
      staff_id: waiterId,
      table_id: selectedTable.id,
      assigned_at: new Date().toISOString(),
    });
    setVersion((v) => v + 1);
    setWaiterId("");
    setMessage({ type: "success", text: "Waiter assigned" });
  };

  const markTableClean = () => {
    if (!selectedTable) return;
    const notified = markTableVacant(selectedTable.id);
    const updated = dataService("tables").findById(selectedTable.id);
    if (updated) setSelectedTable(updated);
    setVersion((v) => v + 1);
    setMessage({
      type: "success",
      text: notified
        ? `Table cleaned — notified ${notified.customer_name} (${notified.customer_phone})`
        : "Table cleaned and ready",
    });
  };

  const reservationsForTable = (tableId: string) =>
    db.reservations.filter(
      (r) =>
        r.table_id === tableId &&
        r.status === "booked" &&
        isFuture(parseISO(r.reservation_time))
    );

  const mergeGroup = (table: Table) => {
    if (!table.merge_group_id) return null;
    return (
      db.tableMergeGroups.find(
        (g) => g.id === table.merge_group_id && g.status === "active"
      ) ?? null
    );
  };

  const mergedTableNumbers = (table: Table) => {
    const group = mergeGroup(table);
    if (!group) return null;
    const members = db.tableMergeGroupMembers
      .filter((m) => m.merge_group_id === group.id)
      .map((m) => db.tables.find((t) => t.id === m.table_id))
      .filter((t): t is Table => Boolean(t));
    const others = members.filter((t) => t.id !== table.id);
    if (others.length === 0) return null;
    return others.map((t) => t.table_number).join("+");
  };

  const assignedWaiters = (tableId: string) => {
    const ids = db.staffTableAssignments
      .filter((a) => a.table_id === tableId)
      .map((a) => a.staff_id);
    return db.staff.filter((s) => ids.includes(s.id));
  };

  const floorWaiters = useMemo(() => {
    const waiterRole = db.roles.find((r) => r.name === "waiter");
    if (!waiterRole) return [];
    const waiterIds = db.staffRoles
      .filter(
        (sr) => sr.role_id === waiterRole.id && sr.outlet_id === outlet.id
      )
      .map((sr) => sr.staff_id);
    return db.staff.filter(
      (s) => waiterIds.includes(s.id) && s.status === "active"
    );
  }, [outlet.id]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{isWaiter ? "My Tables" : "Tables"}</h1>

      {message && (
        <div
          className={cn(
            "rounded-md p-3 text-sm",
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-100 text-green-800"
          )}
        >
          {message.text}
        </div>
      )}

      <div className={tabList} role="tablist" aria-label="Floors">
        {floors.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={activeFloor === f.id}
            onClick={() => setActiveFloor(f.id)}
            className={cn(
              tabButton,
              activeFloor === f.id ? tabButtonActive : tabButtonInactive
            )}
          >
            {f.name}
          </button>
        ))}
      </div>

      {tables.length === 0 && (
        <EmptyState
          title="No tables"
          description={
            isWaiter
              ? "You are not assigned to any tables on this floor."
              : "There are no tables for the selected floor."
          }
        />
      )}

      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        aria-label="Tables"
      >
        {tables.map((t) => {
          const reservations = reservationsForTable(t.id);
          const nextReservation = reservations[0];
          const merged = mergedTableNumbers(t);
          const waiters = assignedWaiters(t.id);
          return (
            <TableCard
              key={t.id}
              table={t}
              onClick={openDetail}
              waiterNames={waiters.map((w) => w.name)}
              mergedWith={merged}
              nextReservationTime={
                nextReservation
                  ? format(
                      parseISO(nextReservation.reservation_time),
                      "h:mm a"
                    )
                  : null
              }
            />
          );
        })}
      </section>

      {selectedTable && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 p-0">
          <div
            className={cn(
              "h-full w-full border-l bg-background p-4 shadow-xl",
              showMenu
                ? "overflow-hidden sm:w-[720px]"
                : "overflow-y-auto sm:w-96"
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                Table {selectedTable.table_number}
              </h2>
              <Button variant="ghost" size="sm" onClick={closeDetail}>
                Close
              </Button>
            </div>

            {showMenu ? (
              <div className="h-[calc(100%-4rem)]">
                <MenuBrowser
                  table={selectedTable}
                  existingOrder={activeOrder}
                  onClose={() => setShowMenu(false)}
                  onSent={() => {
                    setVersion((v) => v + 1);
                    setShowMenu(false);
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
              <div className="rounded-md border p-3">
                <p className="text-sm text-muted-foreground">
                  Capacity {selectedTable.capacity} •{" "}
                  <StatusBadge status={selectedTable.status} />
                </p>
                {activeOrder && (
                  <p className="mt-1 text-sm">
                    Order status:{" "}
                    <StatusBadge status={activeOrder.status} />
                  </p>
                )}
              </div>

              <div className="rounded-md border p-3">
                <h3 className="mb-2 font-semibold">Waiter Assignment</h3>
                <div className="mb-2 text-sm text-muted-foreground">
                  {assignedWaiters(selectedTable.id).length > 0
                    ? assignedWaiters(selectedTable.id)
                        .map((w) => w.name)
                        .join(", ")
                    : "No waiter assigned"}
                </div>
                {can("order.create") && (
                  <div className="flex gap-2">
                    <select
                      className={inputClass}
                      value={waiterId}
                      onChange={(e) => setWaiterId(e.target.value)}
                      aria-label="Select waiter"
                    >
                      <option value="">Select waiter</option>
                      {floorWaiters.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      onClick={assignWaiter}
                      disabled={!waiterId}
                    >
                      Assign
                    </Button>
                  </div>
                )}
              </div>

              <TableOperations
                table={selectedTable}
                onChange={() => setVersion((v) => v + 1)}
              />

              {activeOrder && (
                <div className="rounded-md border p-3">
                  <h3 className="mb-2 font-semibold">Current Order</h3>
                  <ul className="space-y-2">
                    {db.orderItems
                      .filter((i) => i.order_id === activeOrder.id)
                      .map((item) => {
                        const menuItem = db.menuItems.find(
                          (m) => m.id === item.menu_item_id
                        );
                        const variant = db.menuItemVariants.find(
                          (v) => v.id === item.menu_item_variant_id
                        );
                        const modifiers = db.orderItemModifiers
                          .filter((m) => m.order_item_id === item.id)
                          .map((m) => {
                            const mod = db.modifiers.find(
                              (x) => x.id === m.modifier_id
                            );
                            return mod?.name ?? "";
                          })
                          .filter(Boolean)
                          .join(", ");
                        return (
                          <li
                            key={item.id}
                            className="flex items-start justify-between text-sm"
                          >
                            <div>
                              <span className="font-medium">
                                {menuItem?.name}
                              </span>
                              {variant && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  ({variant.variant_name})
                                </span>
                              )}
                              {modifiers && (
                                <p className="text-xs text-muted-foreground">
                                  {modifiers}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {item.quantity} × ₹{item.unit_price}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <StatusBadge status={item.status} />
                              {(item.status === "placed" ||
                                item.status === "accepted") &&
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
                                (can("order.create") || isWaiter) && (
                                  <Button
                                    size="sm"
                                    onClick={() => markServed(item)}
                                  >
                                    Mark Served
                                  </Button>
                                )}
                            </div>
                          </li>
                        );
                      })}
                  </ul>

                  <div className="mt-4 grid gap-2">
                    {can("order.create") && (
                      <Button
                        className="w-full"
                        onClick={() => setShowMenu(true)}
                      >
                        Add Items
                      </Button>
                    )}
                    {(can("order.create") || isWaiter) &&
                      (activeOrder.status === "open" ||
                        activeOrder.status === "partially_served" ||
                        activeOrder.status === "fully_served") && (
                        <Button
                          className="w-full"
                          onClick={requestBill}
                          disabled={selectedTable.status === "bill_requested"}
                        >
                          Request Bill
                        </Button>
                      )}
                  </div>
                </div>
              )}

              {!activeOrder &&
                (selectedTable.status === "needs_cleaning" ||
                  selectedTable.status === "paid") && (
                  <Button
                    className="w-full"
                    onClick={markTableClean}
                  >
                    Mark Clean
                  </Button>
                )}
              {!activeOrder &&
                selectedTable.status !== "needs_cleaning" &&
                selectedTable.status !== "paid" &&
                can("order.create") && (
                  <Button
                    className="w-full"
                    onClick={() => setShowMenu(true)}
                  >
                    Start Order
                  </Button>
                )}
              {!activeOrder &&
                selectedTable.status !== "needs_cleaning" &&
                selectedTable.status !== "paid" &&
                !can("order.create") && (
                  <p className="text-sm text-muted-foreground">
                    No active order for this table.
                  </p>
                )}
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
