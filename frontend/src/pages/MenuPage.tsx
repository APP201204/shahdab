import { useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { db, dataService } from "@/mocks/db";
import { cn } from "@/lib/utils";
import {
  inputClass,
  selectClass,
  pageWrapper,
  messageBanner,
} from "@/lib/styles";
import { Plus, Pencil, Trash2, X } from "lucide-react";

type Message = { type: "error" | "success"; text: string } | null;

export function MenuPage() {
  const { staff, can } = useAuth();
  const [message, setMessage] = useState<Message>(null);

  if (!staff) return null;

  const canManage = can("menu.create") || can("menu.update");

  return (
    <div className={pageWrapper}>
      <h1 className="text-2xl font-bold">Menu</h1>

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

      <MenuItemsSection
        orgId={staff.organization_id}
        setMessage={setMessage}
        canManage={canManage}
      />
    </div>
  );
}

function MenuItemsSection({
  orgId,
  setMessage,
  canManage,
}: {
  orgId: string;
  setMessage: (m: Message) => void;
  canManage: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [kitchenId, setKitchenId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [floorPrices, setFloorPrices] = useState<Record<string, string>>({});
  const [modifierIds, setModifierIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState(() => [...db.menuItems]);

  const categories = db.menuCategories.filter((c) => c.organization_id === orgId);
  const kitchens = db.kitchens.filter((k) => k.organization_id === orgId);
  const modifiers = db.modifiers.filter((m) => m.organization_id === orgId);

  const selectedCategory = db.menuCategories.find((c) => c.id === categoryId);
  const floors = selectedCategory
    ? db.floors.filter((f) => f.outlet_id === selectedCategory.outlet_id)
    : [];

  const reset = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setCategoryId("");
    setKitchenId("");
    setBasePrice("");
    setFloorPrices({});
    setModifierIds([]);
    setIsActive(true);
  };

  const toggleModifier = (id: string) => {
    setModifierIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const loadItem = (item: (typeof db.menuItems)[number]) => {
    setEditingId(item.id);
    setName(item.name);
    setDescription(item.description ?? "");
    setCategoryId(item.category_id);
    setKitchenId(item.kitchen_id);
    setIsActive(item.is_active);

    const itemModifiers = db.menuItemModifiers
      .filter((m) => m.menu_item_id === item.id)
      .map((m) => m.modifier_id);
    setModifierIds(itemModifiers);

    const defaultVariant = db.menuItemVariants.find(
      (v) => v.menu_item_id === item.id && v.is_default
    );
    if (defaultVariant) {
      setBasePrice(String(defaultVariant.base_price));
      const prices: Record<string, string> = {};
      for (const fp of db.menuItemFloorPrices) {
        if (fp.menu_item_variant_id === defaultVariant.id) {
          prices[fp.floor_id] = String(fp.price);
        }
      }
      setFloorPrices(prices);
    } else {
      setBasePrice("");
      setFloorPrices({});
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name.trim() || !categoryId || !kitchenId) {
      setMessage({
        type: "error",
        text: "Item name, category and kitchen are required",
      });
      return;
    }

    const price = Number(basePrice);
    if (Number.isNaN(price) || price < 0) {
      setMessage({ type: "error", text: "Base price must be a positive number" });
      return;
    }

    const category = db.menuCategories.find((c) => c.id === categoryId);
    if (!category) return;

    if (editingId) {
      const item = dataService("menuItems").update(editingId, {
        name: name.trim(),
        description: description.trim() || null,
        category_id: categoryId,
        kitchen_id: kitchenId,
        is_active: isActive,
      });
      if (!item) {
        setMessage({ type: "error", text: "Item not found" });
        return;
      }

      const defaultVariant = db.menuItemVariants.find(
        (v) => v.menu_item_id === item.id && v.is_default
      );
      if (defaultVariant) {
        dataService("menuItemVariants").update(defaultVariant.id, {
          base_price: price,
        });
        for (const floor of floors) {
          const override = floorPrices[floor.id];
          const floorPrice =
            override !== undefined && override !== ""
              ? Number(override)
              : price;
          const existing = db.menuItemFloorPrices.find(
            (fp) =>
              fp.menu_item_variant_id === defaultVariant.id &&
              fp.floor_id === floor.id
          );
          if (existing) {
            existing.price = floorPrice;
          } else {
            dataService("menuItemFloorPrices").create({
              menu_item_variant_id: defaultVariant.id,
              floor_id: floor.id,
              price: floorPrice,
            });
          }
        }
      }

      const existingMods = db.menuItemModifiers.filter(
        (m) => m.menu_item_id === item.id
      );
      for (const m of existingMods) {
        const index = db.menuItemModifiers.indexOf(m);
        if (index !== -1) db.menuItemModifiers.splice(index, 1);
      }
      for (const modifierId of modifierIds) {
        db.menuItemModifiers.push({ menu_item_id: item.id, modifier_id: modifierId });
      }

      setMessage({ type: "success", text: "Menu item updated" });
    } else {
      const newItem = dataService("menuItems").create({
        organization_id: orgId,
        outlet_id: category.outlet_id,
        category_id: categoryId,
        kitchen_id: kitchenId,
        name: name.trim(),
        description: description.trim() || null,
        image_url: null,
        is_active: isActive,
      });

      const variant = dataService("menuItemVariants").create({
        menu_item_id: newItem.id,
        variant_name: "Full",
        base_price: price,
        is_default: true,
      });

      for (const floor of floors) {
        const override = floorPrices[floor.id];
        const floorPrice =
          override !== undefined && override !== "" ? Number(override) : price;
        dataService("menuItemFloorPrices").create({
          menu_item_variant_id: variant.id,
          floor_id: floor.id,
          price: floorPrice,
        });
      }

      for (const modifierId of modifierIds) {
        db.menuItemModifiers.push({ menu_item_id: newItem.id, modifier_id: modifierId });
      }

      setMessage({ type: "success", text: "Menu item created" });
    }

    setItems([...db.menuItems]);
    reset();
  };

  const remove = (id: string) => {
    const item = db.menuItems.find((i) => i.id === id);
    if (!item) return;
    const variants = db.menuItemVariants.filter((v) => v.menu_item_id === id);
    for (const v of variants) {
      dataService("menuItemVariants").remove(v.id);
    }
    const prices = db.menuItemFloorPrices.filter((p) =>
      variants.some((v) => v.id === p.menu_item_variant_id)
    );
    for (const p of prices) {
      const index = db.menuItemFloorPrices.indexOf(p);
      if (index !== -1) db.menuItemFloorPrices.splice(index, 1);
    }
    const mods = db.menuItemModifiers.filter((m) => m.menu_item_id === id);
    for (const m of mods) {
      const index = db.menuItemModifiers.indexOf(m);
      if (index !== -1) db.menuItemModifiers.splice(index, 1);
    }
    dataService("menuItems").remove(id);
    setItems([...db.menuItems]);
    setMessage({ type: "success", text: "Menu item removed" });
  };

  const visibleItems = items.filter((i) => i.organization_id === orgId);

  return (
    <section className="space-y-4">
      {canManage ? (
        <form onSubmit={handleSubmit} className="rounded-md border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit item" : "Add item"}
            </h2>
            {editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                <X className="mr-1 h-4 w-4" /> Cancel
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className={inputClass}
              placeholder="Item name"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
            />
            <input
              className={inputClass}
              placeholder="Description"
              value={description}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setDescription(e.target.value)
              }
            />
            <select
              className={selectClass}
              value={categoryId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setCategoryId(e.target.value)
              }
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={kitchenId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setKitchenId(e.target.value)
              }
            >
              <option value="">Select kitchen</option>
              {kitchens.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              type="number"
              step="0.01"
              min={0}
              placeholder="Base price"
              value={basePrice}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setBasePrice(e.target.value)
              }
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setIsActive(e.target.checked)
                }
                className="h-4 w-4"
              />
              Active
            </label>
          </div>

          {floors.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium">Floor price overrides</h4>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {floors.map((f) => (
                  <div key={f.id}>
                    <label className="text-xs text-muted-foreground">
                      {f.name} price
                    </label>
                    <input
                      className={inputClass}
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder={basePrice || "Same as base"}
                      value={floorPrices[f.id] ?? ""}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setFloorPrices((prev) => ({
                          ...prev,
                          [f.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-medium">Modifiers</h4>
            <div className="flex flex-wrap gap-4">
              {modifiers.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={modifierIds.includes(m.id)}
                    onChange={() => toggleModifier(m.id)}
                    className="h-4 w-4"
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </div>

          <Button type="submit">
            <Plus className="mr-2 h-4 w-4" />
            {editingId ? "Update Menu Item" : "Add Menu Item"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          You do not have permission to manage menu items.
        </p>
      )}

      <ul className="divide-y rounded-md border">
        {visibleItems.map((item) => {
          const category = db.menuCategories.find((c) => c.id === item.category_id);
          const kitchen = db.kitchens.find((k) => k.id === item.kitchen_id);
          const variant = db.menuItemVariants.find(
            (v) => v.menu_item_id === item.id && v.is_default
          );
          const itemModifiers = db.menuItemModifiers
            .filter((m) => m.menu_item_id === item.id)
            .map((m) => db.modifiers.find((mod) => mod.id === m.modifier_id)?.name)
            .filter(Boolean)
            .join(", ");
          return (
            <li
              key={item.id}
              className="flex items-center justify-between px-3 py-3"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {item.name}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    — {category?.name} — {kitchen?.name}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  ₹{variant?.base_price ?? "-"} {itemModifiers ? `— ${itemModifiers}` : ""}
                  {item.is_active ? "" : " — inactive"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadItem(item)}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(item.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
