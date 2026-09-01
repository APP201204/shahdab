import { useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { db, dataService } from "@/mocks/db";
import { cn } from "@/lib/utils";
import { inputClass, selectClass, pageWrapper, tabList, tabButton, tabButtonActive, tabButtonInactive, messageBanner } from "@/lib/styles";
import { getFirstError, organizationSchema, outletSchema } from "@/lib/validation";
import { Plus, Trash2 } from "lucide-react";
import type { TaxApplicableOn } from "@/types";

const now = new Date().toISOString();

type TabKey =
  | "org"
  | "outlet"
  | "floor"
  | "kitchen"
  | "billing"
  | "table"
  | "menu"
  | "tax";

type Message = { type: "error" | "success"; text: string } | null;

type SectionProps = {
  orgId: string;
  outletId?: string | null;
  setMessage: (m: Message) => void;
};

export function SetupPage() {
  const { staff, outlet } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("org");
  const [message, setMessage] = useState<Message>(null);

  if (!staff) return null;

  const tabs = [
    { key: "org", label: "Organization" },
    { key: "outlet", label: "Outlets" },
    { key: "floor", label: "Floors" },
    { key: "kitchen", label: "Kitchens" },
    { key: "billing", label: "Billing" },
    { key: "table", label: "Tables" },
    { key: "menu", label: "Menu" },
    { key: "tax", label: "Taxes" },
  ] as const;

  return (
    <div className={cn(pageWrapper, "!space-y-3")}>
      <h1 className="text-2xl font-bold">Outlet Setup</h1>
      <div className={tabList}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setActiveTab(t.key);
              setMessage(null);
            }}
            className={cn(
              tabButton,
              activeTab === t.key ? tabButtonActive : tabButtonInactive
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <div
          className={cn(
            messageBanner,
            "!p-2",
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-100 text-green-800"
          )}
        >
          {message.text}
        </div>
      )}

      {activeTab === "org" && (
        <OrgSection
          orgId={staff.organization_id}
          outletId={outlet?.id ?? null}
          setMessage={setMessage}
        />
      )}
      {activeTab === "outlet" && (
        <OutletSection
          orgId={staff.organization_id}
          outletId={outlet?.id ?? null}
          setMessage={setMessage}
        />
      )}
      {activeTab === "floor" && (
        <FloorSection
          orgId={staff.organization_id}
          outletId={outlet?.id ?? null}
          setMessage={setMessage}
        />
      )}
      {activeTab === "kitchen" && (
        <KitchenSection
          orgId={staff.organization_id}
          outletId={outlet?.id ?? null}
          setMessage={setMessage}
        />
      )}
      {activeTab === "billing" && (
        <BillingSection
          orgId={staff.organization_id}
          outletId={outlet?.id ?? null}
          setMessage={setMessage}
        />
      )}
      {activeTab === "table" && (
        <TableSection
          orgId={staff.organization_id}
          outletId={outlet?.id ?? null}
          setMessage={setMessage}
        />
      )}
      {activeTab === "menu" && (
        <MenuSection
          orgId={staff.organization_id}
          outletId={outlet?.id ?? null}
          setMessage={setMessage}
        />
      )}
      {activeTab === "tax" && (
        <TaxSection
          orgId={staff.organization_id}
          outletId={outlet?.id ?? null}
          setMessage={setMessage}
        />
      )}
    </div>
  );
}

function OrgSection({ setMessage }: SectionProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");
  const [items, setItems] = useState(() => [...db.organizations]);

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = organizationSchema.safeParse({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      timezone,
      currency,
    });
    if (!parsed.success) {
      setMessage({ type: "error", text: getFirstError(parsed) });
      return;
    }
    dataService("organizations").create({
      ...parsed.data,
      status: "active",
      created_at: now,
      updated_at: now,
    });
    setItems([...db.organizations]);
    setName("");
    setSlug("");
    setMessage({ type: "success", text: "Organization created" });
  };

  return (
    <section className="space-y-3">
      <form onSubmit={add} className="rounded-md border p-3 grid gap-2 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Name"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Slug"
          value={slug}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSlug(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Timezone"
          value={timezone}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setTimezone(e.target.value)
          }
        />
        <input
          className={inputClass}
          placeholder="Currency"
          value={currency}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setCurrency(e.target.value)
          }
        />
        <div className="sm:col-span-2">
          <Button type="submit" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add Organization
          </Button>
        </div>
      </form>
      <ul className="divide-y rounded-md border">
        {items.map((o) => (
          <li
            key={o.id}
            className="flex items-center justify-between px-2 py-1.5"
          >
            <span className="text-sm">
              {o.name} ({o.slug}) — {o.timezone}/{o.currency}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                dataService("organizations").remove(o.id);
                setItems([...db.organizations]);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OutletSection({ orgId, setMessage }: SectionProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");
  const [selectedOrg, setSelectedOrg] = useState(orgId);
  const [items, setItems] = useState(() => [...db.outlets]);

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = outletSchema.safeParse({
      name: name.trim(),
      address: address.trim() || null,
      timezone,
      currency,
    });
    if (!parsed.success) {
      setMessage({ type: "error", text: getFirstError(parsed) });
      return;
    }
    dataService("outlets").create({
      organization_id: selectedOrg,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
      is_active: true,
      created_at: now,
    });
    setItems([...db.outlets]);
    setName("");
    setAddress("");
    setMessage({ type: "success", text: "Outlet created" });
  };

  return (
    <section className="space-y-3">
      <form onSubmit={add} className="rounded-md border p-3 grid gap-2 sm:grid-cols-2">
        <select
          className={selectClass}
          value={selectedOrg}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setSelectedOrg(e.target.value)
          }
        >
          {db.organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <input
          className={inputClass}
          placeholder="Outlet name"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Address"
          value={address}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setAddress(e.target.value)
          }
        />
        <input
          className={inputClass}
          placeholder="Timezone"
          value={timezone}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setTimezone(e.target.value)
          }
        />
        <input
          className={inputClass}
          placeholder="Currency"
          value={currency}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setCurrency(e.target.value)
          }
        />
        <div className="sm:col-span-2">
          <Button type="submit" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add Outlet
          </Button>
        </div>
      </form>
      <ul className="divide-y rounded-md border">
        {items.map((o) => (
          <li
            key={o.id}
            className="flex items-center justify-between px-2 py-1.5"
          >
            <span className="text-sm">
              {o.name} — {o.address}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                dataService("outlets").remove(o.id);
                setItems([...db.outlets]);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FloorSection({ orgId, setMessage }: SectionProps) {
  const [name, setName] = useState("");
  const [outletId, setOutletId] = useState("");
  const [displayOrder, setDisplayOrder] = useState("1");
  const [items, setItems] = useState(() => [...db.floors]);
  const orgOutlets = db.outlets.filter((o) => o.organization_id === orgId);

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !outletId) {
      setMessage({ type: "error", text: "Floor name and outlet are required" });
      return;
    }
    dataService("floors").create({
      organization_id: orgId,
      outlet_id: outletId,
      name: name.trim(),
      display_order: Number(displayOrder) || 1,
      is_active: true,
    });
    setItems([...db.floors]);
    setName("");
    setDisplayOrder("1");
    setMessage({ type: "success", text: "Floor created" });
  };

  return (
    <section className="space-y-3">
      <form onSubmit={add} className="rounded-md border p-3 grid gap-2 sm:grid-cols-3">
        <input
          className={inputClass}
          placeholder="Floor name"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        />
        <select
          className={selectClass}
          value={outletId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setOutletId(e.target.value)
          }
        >
          <option value="">Select outlet</option>
          {orgOutlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <input
          className={inputClass}
          type="number"
          placeholder="Display order"
          value={displayOrder}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setDisplayOrder(e.target.value)
          }
        />
        <div className="sm:col-span-3">
          <Button type="submit" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add Floor
          </Button>
        </div>
      </form>
      <ul className="divide-y rounded-md border">
        {items.map((f) => (
          <li
            key={f.id}
            className="flex items-center justify-between px-2 py-1.5"
          >
            <span className="text-sm">
              {f.name} — order {f.display_order}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                dataService("floors").remove(f.id);
                setItems([...db.floors]);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function KitchenSection({ orgId, setMessage }: SectionProps) {
  const [name, setName] = useState("");
  const [outletId, setOutletId] = useState("");
  const [items, setItems] = useState(() => [...db.kitchens]);
  const orgOutlets = db.outlets.filter((o) => o.organization_id === orgId);

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !outletId) {
      setMessage({
        type: "error",
        text: "Kitchen name and outlet are required",
      });
      return;
    }
    dataService("kitchens").create({
      organization_id: orgId,
      outlet_id: outletId,
      name: name.trim(),
      is_active: true,
    });
    setItems([...db.kitchens]);
    setName("");
    setMessage({ type: "success", text: "Kitchen created" });
  };

  return (
    <section className="space-y-3">
      <form onSubmit={add} className="rounded-md border p-3 grid gap-2 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Kitchen name"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        />
        <select
          className={selectClass}
          value={outletId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setOutletId(e.target.value)
          }
        >
          <option value="">Select outlet</option>
          {orgOutlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add Kitchen
          </Button>
        </div>
      </form>
      <ul className="divide-y rounded-md border">
        {items.map((k) => (
          <li
            key={k.id}
            className="flex items-center justify-between px-2 py-1.5"
          >
            <span className="text-sm">{k.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                dataService("kitchens").remove(k.id);
                setItems([...db.kitchens]);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BillingSection({ orgId, setMessage }: SectionProps) {
  const [name, setName] = useState("");
  const [floorId, setFloorId] = useState("");
  const [items, setItems] = useState(() => [...db.billingStations]);
  const floors = db.floors.filter((f) => f.organization_id === orgId);

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !floorId) {
      setMessage({
        type: "error",
        text: "Billing station name and floor are required",
      });
      return;
    }
    if (db.billingStations.some((b) => b.floor_id === floorId)) {
      setMessage({
        type: "error",
        text: "A billing station already exists for this floor",
      });
      return;
    }
    const floor = db.floors.find((f) => f.id === floorId);
    if (!floor) return;
    dataService("billingStations").create({
      organization_id: orgId,
      outlet_id: floor.outlet_id,
      floor_id: floorId,
      name: name.trim(),
      is_active: true,
    });
    setItems([...db.billingStations]);
    setName("");
    setFloorId("");
    setMessage({ type: "success", text: "Billing station created" });
  };

  return (
    <section className="space-y-3">
      <form onSubmit={add} className="rounded-md border p-3 grid gap-2 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Billing station name"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        />
        <select
          className={selectClass}
          value={floorId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setFloorId(e.target.value)
          }
        >
          <option value="">Select floor</option>
          {floors.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add Billing Station
          </Button>
        </div>
      </form>
      <ul className="divide-y rounded-md border">
        {items.map((b) => {
          const floor = db.floors.find((f) => f.id === b.floor_id);
          return (
            <li
              key={b.id}
              className="flex items-center justify-between px-2 py-1.5"
            >
              <span className="text-sm">
                {b.name} — {floor?.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  dataService("billingStations").remove(b.id);
                  setItems([...db.billingStations]);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TableSection({ orgId, setMessage }: SectionProps) {
  const [tableNumber, setTableNumber] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [floorId, setFloorId] = useState("");
  const [items, setItems] = useState(() => [...db.tables]);
  const floors = db.floors.filter((f) => f.organization_id === orgId);

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tableNumber.trim() || !floorId) {
      setMessage({
        type: "error",
        text: "Table number and floor are required",
      });
      return;
    }
    const floor = db.floors.find((f) => f.id === floorId);
    if (!floor) return;
    dataService("tables").create({
      organization_id: orgId,
      outlet_id: floor.outlet_id,
      floor_id: floorId,
      table_number: tableNumber.trim(),
      capacity: Number(capacity) || 1,
      status: "vacant",
      merge_group_id: null,
      is_active: true,
      avg_time_per_person: 30,
      occupied_at: null,
      occupied_by_count: null,
      expected_vacant_at: null,
    });
    setItems([...db.tables]);
    setTableNumber("");
    setCapacity("4");
    setMessage({ type: "success", text: "Table created" });
  };

  return (
    <section className="space-y-3">
      <form onSubmit={add} className="rounded-md border p-3 grid gap-2 sm:grid-cols-3">
        <input
          className={inputClass}
          placeholder="Table number"
          value={tableNumber}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setTableNumber(e.target.value)
          }
        />
        <select
          className={selectClass}
          value={floorId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setFloorId(e.target.value)
          }
        >
          <option value="">Select floor</option>
          {floors.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <input
          className={inputClass}
          type="number"
          min={1}
          placeholder="Capacity"
          value={capacity}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setCapacity(e.target.value)
          }
        />
        <div className="sm:col-span-3">
          <Button type="submit" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add Table
          </Button>
        </div>
      </form>
      <ul className="divide-y rounded-md border">
        {items.map((t) => {
          const floor = db.floors.find((f) => f.id === t.floor_id);
          return (
            <li
              key={t.id}
              className="flex items-center justify-between px-2 py-1.5"
            >
              <span className="text-sm">
                Table {t.table_number} — cap {t.capacity} — {floor?.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  dataService("tables").remove(t.id);
                  setItems([...db.tables]);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type VariantForm = {
  name: string;
  base: string;
  floorPrices: Record<string, string>;
};

function MenuSection({ orgId, setMessage }: SectionProps) {
  const [menuTab, setMenuTab] = useState<"categories" | "items">("categories");
  return (
    <section className="space-y-3">
      <div className={tabList}>
        <button
          onClick={() => setMenuTab("categories")}
          className={cn(
            tabButton,
            menuTab === "categories" ? tabButtonActive : tabButtonInactive
          )}
        >
          Categories
        </button>
        <button
          onClick={() => setMenuTab("items")}
          className={cn(
            tabButton,
            menuTab === "items" ? tabButtonActive : tabButtonInactive
          )}
        >
          Items
        </button>
      </div>
      {menuTab === "categories" ? (
        <MenuCategorySection orgId={orgId} setMessage={setMessage} />
      ) : (
        <MenuItemSection orgId={orgId} setMessage={setMessage} />
      )}
    </section>
  );
}

function MenuCategorySection({ orgId, setMessage }: SectionProps) {
  const [name, setName] = useState("");
  const [outletId, setOutletId] = useState("");
  const [displayOrder, setDisplayOrder] = useState("1");
  const [categories, setCategories] = useState(() => [...db.menuCategories]);
  const orgOutlets = db.outlets.filter((o) => o.organization_id === orgId);

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !outletId) {
      setMessage({
        type: "error",
        text: "Category name and outlet are required",
      });
      return;
    }
    dataService("menuCategories").create({
      organization_id: orgId,
      outlet_id: outletId,
      name: name.trim(),
      display_order: Number(displayOrder) || 1,
      is_active: true,
    });
    setCategories([...db.menuCategories]);
    setName("");
    setDisplayOrder("1");
    setMessage({ type: "success", text: "Category created" });
  };

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="rounded-md border p-3 grid gap-2 sm:grid-cols-3">
        <input
          className={inputClass}
          placeholder="Category name"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        />
        <select
          className={selectClass}
          value={outletId}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setOutletId(e.target.value)
          }
        >
          <option value="">Select outlet</option>
          {orgOutlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <input
          className={inputClass}
          type="number"
          placeholder="Display order"
          value={displayOrder}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setDisplayOrder(e.target.value)
          }
        />
        <div className="sm:col-span-3">
          <Button type="submit" size="sm">
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        </div>
      </form>
      <ul className="divide-y rounded-md border">
        {categories.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between px-2 py-1.5"
          >
            <span className="text-sm">
              {c.name} — order {c.display_order}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                dataService("menuCategories").remove(c.id);
                setCategories([...db.menuCategories]);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MenuItemSection({ orgId, setMessage }: SectionProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [kitchenId, setKitchenId] = useState("");
  const [modifierIds, setModifierIds] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantForm[]>([
    { name: "Full", base: "", floorPrices: {} },
  ]);
  const [items, setItems] = useState(() => [...db.menuItems]);

  const categories = db.menuCategories.filter((c) => c.organization_id === orgId);
  const kitchens = db.kitchens.filter((k) => k.organization_id === orgId);
  const modifiers = db.modifiers.filter((m) => m.organization_id === orgId);

  const updateVariant = (
    index: number,
    field: keyof Omit<VariantForm, "floorPrices">,
    value: string
  ) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const updateFloorPrice = (
    index: number,
    floorId: string,
    value: string
  ) => {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === index
          ? { ...v, floorPrices: { ...v.floorPrices, [floorId]: value } }
          : v
      )
    );
  };

  const toggleModifier = (id: string) => {
    setModifierIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const addVariant = () => {
    setVariants((prev) => [...prev, { name: "", base: "", floorPrices: {} }]);
  };

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !categoryId || !kitchenId) {
      setMessage({
        type: "error",
        text: "Item name, category and kitchen are required",
      });
      return;
    }
    const category = db.menuCategories.find((c) => c.id === categoryId);
    if (!category) return;
    const activeVariants = variants.filter(
      (v) => v.name.trim() && v.base !== ""
    );
    if (activeVariants.length === 0) {
      setMessage({ type: "error", text: "At least one variant is required" });
      return;
    }
    const item = dataService("menuItems").create({
      organization_id: orgId,
      outlet_id: category.outlet_id,
      category_id: categoryId,
      kitchen_id: kitchenId,
      name: name.trim(),
      description: description.trim() || null,
      image_url: null,
      is_active: true,
    });
    const floors = db.floors.filter((f) => f.outlet_id === category.outlet_id);
    for (let i = 0; i < activeVariants.length; i += 1) {
      const v = activeVariants[i];
      const base = Number(v.base);
      const variant = dataService("menuItemVariants").create({
        menu_item_id: item.id,
        variant_name: v.name.trim(),
        base_price: base,
        is_default: i === 0,
      });
      for (const floor of floors) {
        const price =
          v.floorPrices[floor.id] !== undefined
            ? Number(v.floorPrices[floor.id])
            : base;
        dataService("menuItemFloorPrices").create({
          menu_item_variant_id: variant.id,
          floor_id: floor.id,
          price,
        });
      }
    }
    for (const modifierId of modifierIds) {
      db.menuItemModifiers.push({ menu_item_id: item.id, modifier_id: modifierId });
    }
    setItems([...db.menuItems]);
    setName("");
    setDescription("");
    setCategoryId("");
    setKitchenId("");
    setModifierIds([]);
    setVariants([{ name: "Full", base: "", floorPrices: {} }]);
    setMessage({ type: "success", text: "Menu item created" });
  };

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="rounded-md border p-3 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
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
        </div>

        <div>
          <h4 className="mb-1 text-sm font-medium">Modifiers</h4>
          <div className="flex flex-wrap gap-2">
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

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Variants & floor prices</h4>
          {variants.map((v, i) => {
            const category = db.menuCategories.find((c) => c.id === categoryId);
            const floors = category
              ? db.floors.filter((f) => f.outlet_id === category.outlet_id)
              : [];
            return (
              <div key={i} className="rounded-md border p-2 space-y-1">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className={inputClass}
                    placeholder="Variant name"
                    value={v.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateVariant(i, "name", e.target.value)
                    }
                  />
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="Base price"
                    value={v.base}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateVariant(i, "base", e.target.value)
                    }
                  />
                </div>
                {floors.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {floors.map((f) => (
                      <div key={f.id}>
                        <label className="text-xs text-muted-foreground">
                          {f.name} price
                        </label>
                        <input
                          className={inputClass}
                          type="number"
                          placeholder={v.base || "Same as base"}
                          value={v.floorPrices[f.id] ?? ""}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateFloorPrice(i, f.id, e.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <Button type="button" variant="outline" size="sm" onClick={addVariant}>
            Add variant
          </Button>
        </div>

        <Button type="submit" size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add Menu Item
        </Button>
      </form>

      <ul className="divide-y rounded-md border">
        {items.map((item) => {
          const category = db.menuCategories.find((c) => c.id === item.category_id);
          const kitchen = db.kitchens.find((k) => k.id === item.kitchen_id);
          const variant = db.menuItemVariants.find(
            (v) => v.menu_item_id === item.id && v.is_default
          );
          return (
            <li
              key={item.id}
              className="flex items-center justify-between px-2 py-1.5"
            >
              <span className="text-sm">
                {item.name} — {category?.name} — {kitchen?.name} — ₹
                {variant?.base_price ?? "-"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  dataService("menuItems").remove(item.id);
                  setItems([...db.menuItems]);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TaxSection({ orgId, setMessage }: SectionProps) {
  const [name, setName] = useState("");
  const [outletId, setOutletId] = useState("");
  const [percentage, setPercentage] = useState("");
  const [applicableOn, setApplicableOn] = useState<TaxApplicableOn>("bill");
  const [isActive, setIsActive] = useState(true);
  const [taxes, setTaxes] = useState(() => [...db.taxes]);
  const orgOutlets = db.outlets.filter((o) => o.organization_id === orgId);

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !outletId || percentage === "") {
      setMessage({
        type: "error",
        text: "Tax name, outlet and percentage are required",
      });
      return;
    }
    const pct = Number(percentage);
    if (Number.isNaN(pct) || pct < 0) {
      setMessage({ type: "error", text: "Percentage must be a positive number" });
      return;
    }
    dataService("taxes").create({
      organization_id: orgId,
      outlet_id: outletId,
      name: name.trim(),
      percentage: pct,
      applicable_on: applicableOn,
      is_active: isActive,
    });
    setTaxes([...db.taxes]);
    setName("");
    setPercentage("");
    setIsActive(true);
    setMessage({ type: "success", text: "Tax created" });
  };

  return (
    <section className="space-y-3">
      <form onSubmit={add} className="rounded-md border p-3 grid gap-2 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Tax name"
        value={name}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
      />
      <select
        className={selectClass}
        value={outletId}
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          setOutletId(e.target.value)
        }
      >
        <option value="">Select outlet</option>
        {orgOutlets.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <input
        className={inputClass}
        type="number"
        step="0.01"
        placeholder="Percentage"
        value={percentage}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setPercentage(e.target.value)
        }
      />
      <select
        className={selectClass}
        value={applicableOn}
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          setApplicableOn(e.target.value as TaxApplicableOn)
        }
      >
        <option value="bill">Bill</option>
        <option value="item">Item</option>
      </select>
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
      <div className="sm:col-span-2">
        <Button type="submit" size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add Tax
        </Button>
      </div>
    </form>
    <ul className="divide-y rounded-md border">
      {taxes.map((t) => (
        <li
          key={t.id}
          className="flex items-center justify-between px-2 py-1.5"
        >
          <span className="text-sm">
            {t.name} — {t.percentage}% on {t.applicable_on} —{" "}
            {t.is_active ? "active" : "inactive"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              dataService("taxes").remove(t.id);
              setTaxes([...db.taxes]);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  </section>
);
}
