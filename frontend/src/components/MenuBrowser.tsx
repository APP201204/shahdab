import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  inputClass,
  tabList,
  tabButton,
  tabButtonActive,
  tabButtonInactive,
} from "@/lib/styles";
import { db, dataService } from "@/mocks/db";
import { cn } from "@/lib/utils";
import type { MenuItem, Order, Table } from "@/types";

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

function MenuItemRow({
  menuItem,
  tableFloorId,
  onAdd,
}: {
  menuItem: MenuItem;
  tableFloorId: string;
  onAdd: (ci: CartItem) => void;
}) {
  const { outlet } = useAuth();
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
  const [selectedVariantId, setSelectedVariantId] = useState(
    defaultVariant?.id ?? ""
  );
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Set<string>>(
    new Set()
  );

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

  const selectedVariant =
    variants.find((v) => v.id === selectedVariantId) ?? defaultVariant;

  const unitPrice = useMemo(() => {
    if (!selectedVariant) return 0;
    return (
      db.menuItemFloorPrices.find(
        (fp) =>
          fp.menu_item_variant_id === selectedVariant.id &&
          fp.floor_id === tableFloorId
      )?.price ?? selectedVariant.base_price
    );
  }, [selectedVariant, tableFloorId]);

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
              name={`variant-${menuItem.id}`}
              className="sr-only"
              value={v.id}
              checked={selectedVariantId === v.id}
              onChange={() => setSelectedVariantId(v.id)}
            />
            {v.variant_name} — ₹
            {db.menuItemFloorPrices.find(
              (fp) => fp.menu_item_variant_id === v.id && fp.floor_id === tableFloorId
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

interface MenuBrowserProps {
  table: Table;
  existingOrder: Order | null;
  onClose: () => void;
  onSent: () => void;
}

export function MenuBrowser({
  table,
  existingOrder,
  onClose,
  onSent,
}: MenuBrowserProps) {
  const { staff, outlet, organization } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);

  if (!staff || !outlet || !organization) return null;
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const categories = useMemo(
    () =>
      db.menuCategories
        .filter((c) => c.outlet_id === outlet.id)
        .sort((a, b) => a.display_order - b.display_order),
    [outlet.id]
  );

  const menuItems = useMemo(() => {
    return db.menuItems
      .filter(
        (m) =>
          m.outlet_id === outlet.id &&
          m.is_active &&
          (activeCategory ? m.category_id === activeCategory : true)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [outlet.id, activeCategory]);

  const addToCart = (item: CartItem) => {
    setCart((prev) => [...prev, item]);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const sendToKitchen = () => {
    if (cart.length === 0) {
      setMessage({ type: "error", text: "Cart is empty" });
      return;
    }
    if (!staff) return;

    const order =
      existingOrder ??
      dataService("orders").create({
        organization_id: organization.id,
        outlet_id: outlet.id,
        floor_id: table.floor_id,
        order_type: "dine_in",
        table_id: table.id,
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

    if (table.status === "vacant" || table.status === "reserved") {
      const now = new Date();
      dataService("tables").update(table.id, {
        status: "occupied",
        occupied_at: now.toISOString(),
        occupied_by_count: 2,
        expected_vacant_at: new Date(
          now.getTime() + 2 * table.avg_time_per_person * 60_000
        ).toISOString(),
      });
    }

    setCart([]);
    setMessage({ type: "success", text: `KOT #${batchNumber} sent to kitchen` });
    onSent();
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Menu</h2>
          <p className="text-sm text-muted-foreground">
            Table {table.table_number} •{" "}
            {db.floors.find((f) => f.id === table.floor_id)?.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Back
          </Button>
          <Button
            size="sm"
            onClick={sendToKitchen}
            disabled={cart.length === 0}
          >
            Send to Kitchen
          </Button>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            "mb-3 rounded-md p-2 text-sm",
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-100 text-green-800"
          )}
        >
          {message.text}
        </div>
      )}

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

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-2">
        <div className="space-y-3 overflow-y-auto pr-2">
          {menuItems.map((item) => (
            <MenuItemRow
              key={item.id}
              menuItem={item}
              tableFloorId={table.floor_id}
              onAdd={addToCart}
            />
          ))}
          {menuItems.length === 0 && (
            <p className="text-sm text-muted-foreground">No menu items.</p>
          )}
        </div>

        <div className="flex flex-col overflow-hidden rounded-md border bg-muted/20">
          <h3 className="border-b p-3 font-semibold">Order Cart</h3>
          <div className="flex-1 overflow-y-auto p-3">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cart is empty.</p>
            ) : (
              <ul className="space-y-3">
                {cart.map((item, index) => {
                  const menuItem = db.menuItems.find(
                    (m) => m.id === item.menuItemId
                  );
                  const variant = db.menuItemVariants.find(
                    (v) => v.id === item.variantId
                  );
                  const modifierNames = item.modifierIds
                    .map((id) => db.modifiers.find((m) => m.id === id)?.name)
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <li
                      key={index}
                      className="flex items-start justify-between text-sm"
                    >
                      <div>
                        <p className="font-medium">{menuItem?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {variant?.variant_name}
                          {modifierNames && ` • ${modifierNames}`}
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
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t p-3">
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
  );
}
