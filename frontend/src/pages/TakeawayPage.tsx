import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
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
import { getFirstError, orderSchema } from "@/lib/validation";
import type { MenuItem, Order, PaymentMethod } from "@/types";

type Message = { type: "error" | "success"; text: string } | null;
type CartItem = {
  menuItemId: string;
  variantId: string;
  modifierIds: string[];
  quantity: number;
  unitPrice: number;
};

function deriveOrderStatus(orderId: string): Order["status"] {
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


export function TakeawayPage() {
  const { staff, outlet, organization, can } = useAuth();
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<Message>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [floorId, setFloorId] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [billingOrderId, setBillingOrderId] = useState<string | null>(null);

  if (!staff || !outlet || !organization) return null;

  const floors = useMemo(
    () =>
      db.floors
        .filter((f) => f.outlet_id === outlet.id && f.is_active)
        .sort((a, b) => a.display_order - b.display_order),
    [outlet.id]
  );

  useEffect(() => {
    if (floors.length > 0 && !floorId) {
      setFloorId(floors[0].id);
    }
  }, [floors, floorId]);

  const categories = useMemo(
    () =>
      db.menuCategories
        .filter((c) => c.outlet_id === outlet.id && c.is_active)
        .sort((a, b) => a.display_order - b.display_order),
    [outlet.id]
  );

  const menuItems = useMemo(
    () =>
      db.menuItems
        .filter(
          (m) =>
            m.outlet_id === outlet.id &&
            m.is_active &&
            (activeCategory ? m.category_id === activeCategory : true)
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [outlet.id, activeCategory]
  );

  const addToCart = (item: CartItem) => setCart((prev) => [...prev, item]);
  const removeFromCart = (index: number) =>
    setCart((prev) => prev.filter((_, i) => i !== index));

  const sendToKitchen = () => {
    if (cart.length === 0) {
      setMessage({ type: "error", text: "Cart is empty" });
      return;
    }
    const parsed = orderSchema.safeParse({
      order_type: "takeaway",
      floor_id: floorId,
      customer_name: customerName,
      customer_phone: customerPhone,
      table_id: null,
    });
    if (!parsed.success) {
      setMessage({ type: "error", text: getFirstError(parsed) });
      return;
    }

    const now = new Date().toISOString();
    const order = dataService("orders").create({
      organization_id: organization.id,
      outlet_id: outlet.id,
      floor_id: floorId,
      order_type: "takeaway",
      table_id: null,
      merge_group_id: null,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      captain_id: staff.id,
      status: "open",
      created_at: now,
      closed_at: null,
    });

    const batch = dataService("kotBatches").create({
      order_id: order.id,
      batch_number: 1,
      created_by: staff.id,
      created_at: now,
    });

    for (const cartItem of cart) {
      const menuItem = db.menuItems.find((m) => m.id === cartItem.menuItemId);
      const variant = db.menuItemVariants.find((v) => v.id === cartItem.variantId);
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
        created_at: now,
      });

      for (const modifierId of cartItem.modifierIds) {
        db.orderItemModifiers.push({
          order_item_id: orderItem.id,
          modifier_id: modifierId,
        });
      }
    }

    dataService("orders").update(order.id, { status: deriveOrderStatus(order.id) });

    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setMessage({ type: "success", text: `Takeaway order sent to kitchen` });
    setVersion((v) => v + 1);
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  const takeawayOrders = useMemo(() => {
    return db.orders
      .filter(
        (o) =>
          o.outlet_id === outlet.id &&
          o.order_type === "takeaway" &&
          o.status !== "closed"
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }, [outlet.id, version]);

  const billAndClose = (order: Order) => {
    const items = db.orderItems.filter(
      (i) => i.order_id === order.id && i.status !== "cancelled"
    );
    const subtotal = items.reduce(
      (sum, i) => sum + i.unit_price * i.quantity,
      0
    );

    const activeTaxes = db.taxes.filter(
      (t) => t.outlet_id === outlet.id && t.is_active && t.applicable_on === "bill"
    );
    const taxAmount = activeTaxes.reduce(
      (sum, t) => sum + subtotal * (t.percentage / 100),
      0
    );
    const total = subtotal + taxAmount;

    const billingStation =
      db.billingStations.find(
        (b) => b.outlet_id === outlet.id && b.floor_id === order.floor_id
      ) ?? db.billingStations.find((b) => b.outlet_id === outlet.id);

    if (!billingStation) {
      setMessage({ type: "error", text: "No billing station configured" });
      return;
    }

    const now = new Date().toISOString();
    const billNumber = `BILL-${String(db.bills.length + 1).padStart(4, "0")}`;

    const bill = dataService("bills").create({
      organization_id: organization.id,
      outlet_id: outlet.id,
      billing_station_id: billingStation.id,
      order_id: order.id,
      bill_number: billNumber,
      subtotal,
      discount_amount: 0,
      tax_amount: taxAmount,
      total_amount: total,
      status: "paid",
      created_by: staff.id,
      created_at: now,
      closed_at: now,
    });

    for (const tax of activeTaxes) {
      db.billTaxes.push({
        bill_id: bill.id,
        tax_id: tax.id,
        amount: subtotal * (tax.percentage / 100),
      });
    }

    dataService("payments").create({
      bill_id: bill.id,
      bill_split_id: null,
      payment_method: paymentMethod,
      amount: total,
      transaction_ref: null,
      paid_at: now,
    });

    for (const item of items) {
      dataService("orderItems").update(item.id, {
        status: "served",
        served_at: now,
        served_by: staff.id,
      });
    }

    dataService("orders").update(order.id, {
      status: "closed",
      closed_at: now,
    });

    setBillingOrderId(null);
    setMessage({ type: "success", text: `Bill ${billNumber} paid and order closed` });
    setVersion((v) => v + 1);
  };

  const isReadyForPickup = (order: Order) => {
    const items = db.orderItems.filter(
      (i) => i.order_id === order.id && i.status !== "cancelled"
    );
    return items.length > 0 && items.every((i) => i.status === "ready" || i.status === "served");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Takeaway Orders</h1>

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

      <div className="rounded-md border p-4">
        <h2 className="mb-3 font-semibold">New Takeaway Order</h2>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <input
            className={inputClass}
            placeholder="Customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Customer phone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
          <select
            className={inputClass}
            value={floorId}
            onChange={(e) => setFloorId(e.target.value)}
          >
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className={cn("mb-3", tabList)} role="tablist" aria-label="Menu categories">
          <button
            role="tab"
            aria-selected={activeCategory === null}
            onClick={() => setActiveCategory(null)}
            className={cn(
              tabButton,
              activeCategory === null ? tabButtonActive : tabButtonInactive
            )}
          >
            All
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {menuItems.map((menuItem) => (
              <TakeawayMenuItemRow
                key={menuItem.id}
                menuItem={menuItem}
                floorId={floorId}
                onAdd={addToCart}
              />
            ))}
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <h3 className="mb-2 border-b pb-2 font-semibold">Order Cart</h3>
            <div className="space-y-2">
              {cart.length === 0 ? (
                <EmptyState
                  title="Cart is empty"
                  description="Add menu items to build the takeaway order."
                />
              ) : (
                cart.map((item, index) => {
                  const m = db.menuItems.find((x) => x.id === item.menuItemId);
                  const v = db.menuItemVariants.find((x) => x.id === item.variantId);
                  const names = item.modifierIds
                    .map((id) => db.modifiers.find((mod) => mod.id === id)?.name)
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <div
                      key={index}
                      className="flex items-start justify-between text-sm"
                    >
                      <div>
                        <p className="font-medium">{m?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {v?.variant_name}
                          {names && ` • ${names}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} × ₹{item.unitPrice}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          ₹{(item.unitPrice * item.quantity).toFixed(2)}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromCart(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-3 border-t pt-2">
              <div className="mb-2 flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span>₹{cartTotal.toFixed(2)}</span>
              </div>
              <Button
                className="w-full"
                onClick={sendToKitchen}
                disabled={cart.length === 0}
              >
                Send to Kitchen
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Active Takeaway Orders</h2>
        {takeawayOrders.length === 0 && (
          <EmptyState
            title="No active takeaway orders"
            description="Takeaway orders in progress will appear here."
          />
        )}
        {takeawayOrders.map((order) => (
          <div key={order.id} className="rounded-md border p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{order.customer_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {order.customer_phone}
                </p>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <ul className="space-y-2">
              {db.orderItems
                .filter((i) => i.order_id === order.id)
                .map((item) => {
                  const m = db.menuItems.find((x) => x.id === item.menu_item_id);
                  const v = db.menuItemVariants.find((x) => x.id === item.menu_item_variant_id);
                  return (
                    <li
                      key={item.id}
                      className="flex items-start justify-between text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {m?.name}
                          {v && (
                            <span className="text-muted-foreground">
                              {" "}({v.variant_name})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} × ₹{item.unit_price}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </li>
                  );
                })}
            </ul>

            {can("bill.create") && (
              <div className="mt-4 border-t pt-3">
                {billingOrderId === order.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className={inputClass}
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="wallet">Wallet</option>
                    </select>
                    <Button
                      size="sm"
                      onClick={() => billAndClose(order)}
                      disabled={!isReadyForPickup(order)}
                    >
                      Pay & Pick Up
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setBillingOrderId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setBillingOrderId(order.id)}
                    disabled={!isReadyForPickup(order)}
                  >
                    Bill & Pick Up
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TakeawayMenuItemRow({
  menuItem,
  floorId,
  onAdd,
}: {
  menuItem: MenuItem;
  floorId: string;
  onAdd: (ci: CartItem) => void;
}) {
  const { outlet } = useAuth();
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Set<string>>(
    new Set()
  );

  if (!outlet) return null;

  const variants = useMemo(
    () =>
      db.menuItemVariants
        .filter((v) => v.menu_item_id === menuItem.id)
        .sort(
          (a, b) =>
            Number(b.is_default) - Number(a.is_default) ||
            a.base_price - b.base_price
        ),
    [menuItem.id]
  );

  const defaultVariant = variants.find((v) => v.is_default) ?? variants[0];

  if (!selectedVariantId && defaultVariant) {
    setSelectedVariantId(defaultVariant.id);
  }

  const selectedVariant =
    variants.find((v) => v.id === selectedVariantId) ?? defaultVariant;

  const modifiers = useMemo(
    () =>
      db.menuItemModifiers
        .filter((m) => m.menu_item_id === menuItem.id)
        .map((m) => db.modifiers.find((mod) => mod.id === m.modifier_id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m)),
    [menuItem.id]
  );

  const outOfStock = useMemo(
    () =>
      db.menuItemStockStatus.find(
        (s) => s.menu_item_id === menuItem.id && s.outlet_id === outlet.id
      )?.is_out_of_stock ?? false,
    [menuItem.id, outlet.id]
  );

  const unitPrice = useMemo(() => {
    if (!selectedVariant) return 0;
    return (
      db.menuItemFloorPrices.find(
        (fp) =>
          fp.menu_item_variant_id === selectedVariant.id &&
          fp.floor_id === floorId
      )?.price ?? selectedVariant.base_price
    );
  }, [selectedVariant, floorId]);

  const add = () => {
    if (!selectedVariant || outOfStock) return;
    onAdd({
      menuItemId: menuItem.id,
      variantId: selectedVariant.id,
      modifierIds: Array.from(selectedModifiers),
      quantity,
      unitPrice,
    });
    setQuantity(1);
    setSelectedModifiers(new Set());
  };

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        outOfStock && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium">{menuItem.name}</h4>
          {menuItem.description && (
            <p className="text-xs text-muted-foreground">
              {menuItem.description}
            </p>
          )}
        </div>
        {outOfStock && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
            Out of stock
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {variants.map((v) => (
          <label
            key={v.id}
            className={cn(
              "cursor-pointer rounded-md border px-2 py-1 text-sm",
              selectedVariantId === v.id
                ? "border-primary bg-primary/10"
                : "border-input hover:bg-muted"
            )}
          >
            <input
              type="radio"
              name={`takeaway-variant-${menuItem.id}`}
              className="sr-only"
              value={v.id}
              checked={selectedVariantId === v.id}
              onChange={() => setSelectedVariantId(v.id)}
            />
            {v.variant_name} — ₹
            {db.menuItemFloorPrices.find(
              (fp) =>
                fp.menu_item_variant_id === v.id && fp.floor_id === floorId
            )?.price ?? v.base_price}
          </label>
        ))}
      </div>

      {modifiers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {modifiers.map((mod) => (
            <label
              key={mod.id}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 text-xs",
                selectedModifiers.has(mod.id)
                  ? "border-primary bg-primary/10"
                  : "border-input hover:bg-muted"
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selectedModifiers.has(mod.id)}
                onChange={(e) => {
                  const next = new Set(selectedModifiers);
                  if (e.target.checked) next.add(mod.id);
                  else next.delete(mod.id);
                  setSelectedModifiers(next);
                }}
              />
              {mod.name}
            </label>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          className={cn(inputClass, "w-16 px-2 py-1")}
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
        />
        <Button size="sm" onClick={add} disabled={outOfStock}>
          Add
        </Button>
      </div>
    </div>
  );
}
