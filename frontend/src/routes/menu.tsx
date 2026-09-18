import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type FoodType,
  type MenuItem,
  type Variant,
} from "@/data/seed";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMenu } from "@/hooks/useMenu";
import { useSections } from "@/hooks/useSections";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu Management · SHADAB RestaurantOS" },
      {
        name: "description",
        content:
          "One catalog for Shadab — price and availability set per size and per section, with variant control.",
      },
      { property: "og:title", content: "Menu Management · SHADAB RestaurantOS" },
      {
        property: "og:description",
        content: "Catalog, categories, variants and per-section pricing for Shadab Restaurant.",
      },
    ],
  }),
  component: MenuManagement,
});

const dotColor = { veg: "bg-veg", "non-veg": "bg-nonveg", egg: "bg-egg" } as const;
const avatarPalette = [
  "bg-primary-soft text-primary",
  "bg-success-soft text-success",
  "bg-warning-soft text-warning-foreground",
  "bg-info-soft text-info",
  "bg-danger-soft text-destructive",
];

type VariantDraft = { name: string; price: string; available: boolean };

type ItemDraft = {
  name: string;
  categoryId: string;
  foodType: FoodType;
  price: string;
  favorite: boolean;
  spicy: boolean;
  mrp: boolean;
  status: MenuItem["status"];
  variants: VariantDraft[];
  sectionIds: string[];
};

const emptyItemDraft: ItemDraft = {
  name: "",
  categoryId: "",
  foodType: "veg",
  price: "",
  favorite: false,
  spicy: false,
  mrp: false,
  status: "available",
  variants: [],
  sectionIds: [],
};

function toDraft(item: MenuItem): ItemDraft {
  return {
    name: item.name,
    categoryId: item.categoryId,
    foodType: item.foodType,
    price: String(item.price),
    favorite: item.favorite,
    spicy: item.spicy ?? false,
    mrp: item.mrp ?? false,
    status: item.status,
    variants: item.variants.map((v) => ({
      name: v.name,
      price: String(v.price),
      available: v.available,
    })),
    sectionIds: item.sectionIds,
  };
}

function parseItemDraft(draft: ItemDraft): Omit<MenuItem, "id"> | null {
  const name = draft.name.trim();
  if (!name) {
    toast.error("Item name is required");
    return null;
  }
  if (!draft.categoryId) {
    toast.error("Please select a category");
    return null;
  }
  if (draft.sectionIds.length === 0) {
    toast.error("Please select at least one section");
    return null;
  }
  const base = Number(draft.price);
  if (Number.isNaN(base) || base < 0) {
    toast.error("Please enter a valid base price");
    return null;
  }

  const validVariants: Variant[] = [];
  for (const v of draft.variants) {
    const vName = v.name.trim();
    const vPrice = v.price === "" ? NaN : Number(v.price);
    if (!vName && Number.isNaN(vPrice)) continue;
    if (!vName || Number.isNaN(vPrice) || vPrice < 0) {
      toast.error("Each variant needs a name and a valid price");
      return null;
    }
    validVariants.push({ name: vName, price: vPrice, available: v.available });
  }

  const price = validVariants.length > 0 ? Math.min(...validVariants.map((v) => v.price)) : base;

  const parsed: Omit<MenuItem, "id"> = {
    name,
    categoryId: draft.categoryId,
    foodType: draft.foodType,
    price,
    favorite: draft.favorite,
    status: draft.status,
    variants: validVariants,
    sectionIds: draft.sectionIds,
  };
  if (draft.spicy) parsed.spicy = true;
  if (draft.mrp) parsed.mrp = true;
  return parsed;
}

function ItemForm({
  value,
  onChange,
  categories,
  sections,
}: {
  value: ItemDraft;
  onChange: (value: ItemDraft) => void;
  categories: { id: string; name: string }[];
  sections: { id: string; name: string }[];
}) {
  const id = useId();
  const update = (patch: Partial<ItemDraft>) => onChange({ ...value, ...patch });
  const updateVariant = (idx: number, patch: Partial<VariantDraft>) =>
    onChange({
      ...value,
      variants: value.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
    });
  const addVariant = () =>
    onChange({ ...value, variants: [...value.variants, { name: "", price: "", available: true }] });
  const removeVariant = (idx: number) =>
    onChange({ ...value, variants: value.variants.filter((_, i) => i !== idx) });
  const toggleSection = (sectionId: string, checked: boolean) =>
    onChange({
      ...value,
      sectionIds: checked
        ? [...value.sectionIds, sectionId]
        : value.sectionIds.filter((s) => s !== sectionId),
    });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${id}-name`}>Item Name</Label>
          <Input
            id={`${id}-name`}
            value={value.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g., Paneer Tikka"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={value.categoryId} onValueChange={(v) => update({ categoryId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-price`}>Base Price</Label>
          <Input
            id={`${id}-price`}
            type="number"
            min={0}
            value={value.price}
            onChange={(e) => update({ price: e.target.value })}
            placeholder="0"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Food Type</Label>
        <RadioGroup
          value={value.foodType}
          onValueChange={(v) => update({ foodType: v as FoodType })}
          className="flex flex-wrap gap-4"
        >
          {(["veg", "non-veg", "egg"] as FoodType[]).map((t) => (
            <div key={t} className="flex items-center gap-2">
              <RadioGroupItem value={t} id={`${id}-food-${t}`} />
              <Label htmlFor={`${id}-food-${t}`} className="capitalize">
                {t}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select
          value={value.status}
          onValueChange={(v) => update({ status: v as MenuItem["status"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="unavailable">Unavailable</SelectItem>
            <SelectItem value="not-offered">Not offered</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Available in Sections</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sections.map((s) => {
            const checked = value.sectionIds.includes(s.id);
            return (
              <label
                key={s.id}
                htmlFor={`${id}-section-${s.id}`}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  checked
                    ? "border-primary bg-primary-soft font-medium"
                    : "border-border hover:bg-accent",
                )}
              >
                <Checkbox
                  id={`${id}-section-${s.id}`}
                  checked={checked}
                  onCheckedChange={(c) => toggleSection(s.id, c === true)}
                />
                {s.name}
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id={`${id}-fav`}
            checked={value.favorite}
            onCheckedChange={(checked) => update({ favorite: checked })}
          />
          <Label htmlFor={`${id}-fav`}>Favorite</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id={`${id}-spicy`}
            checked={value.spicy}
            onCheckedChange={(checked) => update({ spicy: checked })}
          />
          <Label htmlFor={`${id}-spicy`}>Spicy</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id={`${id}-mrp`}
            checked={value.mrp}
            onCheckedChange={(checked) => update({ mrp: checked })}
          />
          <Label htmlFor={`${id}-mrp`}>MRP (tax inclusive)</Label>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <Label>Variants / Sizes</Label>
          <Button type="button" variant="outline" size="sm" onClick={addVariant}>
            <Plus className="size-4" /> Add variant
          </Button>
        </div>
        {value.variants.length === 0 && (
          <p className="text-xs text-muted-foreground">No variants. Base price will be used.</p>
        )}
        {value.variants.map((v, idx) => (
          <div key={idx} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={v.name}
                onChange={(e) => updateVariant(idx, { name: e.target.value })}
                placeholder="e.g., Full"
              />
            </div>
            <div className="w-28 space-y-1">
              <Label className="text-xs">Price</Label>
              <Input
                type="number"
                min={0}
                value={v.price}
                onChange={(e) => updateVariant(idx, { price: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch
                id={`${id}-variant-${idx}`}
                checked={v.available}
                onCheckedChange={(checked) => updateVariant(idx, { available: checked })}
              />
              <Label htmlFor={`${id}-variant-${idx}`} className="text-xs">
                Active
              </Label>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => removeVariant(idx)}
              aria-label="Remove variant"
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuManagement() {
  const queryClient = useQueryClient();
  const { data: menuData } = useMenu("SHADAB", true);
  const { data: sectionsData } = useSections();
  const sections = useMemo(() => sectionsData?.sections ?? [], [sectionsData]);
  const apiCategories = useMemo(
    () => (menuData?.categories ?? []).map((c) => ({ id: c.id, name: c.name })),
    [menuData],
  );
  const apiItemCounts = useMemo(
    () => Object.fromEntries((menuData?.categories ?? []).map((c) => [c.id, c.items.length])),
    [menuData],
  );

  const menuItems: MenuItem[] = useMemo(
    () =>
      (menuData?.categories ?? []).flatMap((c) =>
        c.items.map((i) => ({
          id: i.id,
          name: i.name,
          categoryId: i.categoryId,
          foodType: i.foodType as FoodType,
          price: i.basePrice,
          favorite: i.favorite,
          spicy: i.spicy,
          mrp: i.mrp,
          status: i.status,
          variants: (i.variants ?? []).map((v) => ({
            name: v.name,
            price: v.price,
            available: v.available,
          })),
          sectionIds: i.sectionIds ?? [],
        })),
      ),
    [menuData],
  );
  const categories = apiCategories;
  const [section, setSection] = useState("all");
  const [query, setQuery] = useState("");
  const [foodFilter, setFoodFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [manageOpen, setManageOpen] = useState(false);
  const [managedCategories, setManagedCategories] = useState<{ id: string; name: string }[]>([]);
  const [savingCategories, setSavingCategories] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customizeItemId, setCustomizeItemId] = useState("");
  const [customizeDraft, setCustomizeDraft] = useState<ItemDraft>(emptyItemDraft);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<ItemDraft>(emptyItemDraft);

  useEffect(() => {
    if (manageOpen) setManagedCategories(apiCategories);
  }, [manageOpen, apiCategories]);

  const items = useMemo(
    () =>
      menuItems
        .filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
        .filter((i) => (foodFilter === "all" ? true : i.foodType === foodFilter))
        .filter((i) => (categoryFilter === "all" ? true : i.categoryId === categoryFilter))
        .filter((i) => (section === "all" ? true : i.sectionIds.includes(section))),
    [menuItems, query, foodFilter, categoryFilter, section],
  );

  const stats = [
    { label: "Total Items", value: menuItems.length, tone: "text-foreground", hint: "in catalog" },
    {
      label: "Available",
      value: menuItems.filter((i) => i.status === "available").length,
      tone: "text-success",
      hint: "on sale now",
    },
    {
      label: "Unavailable",
      value: menuItems.filter((i) => i.status === "unavailable").length,
      tone: "text-destructive",
      hint: "temporarily 86'd",
    },
    {
      label: "Not Offered",
      value: menuItems.filter((i) => i.status === "not-offered").length,
      tone: "text-muted-foreground",
      hint: "not on this section's menu",
    },
    {
      label: "Disabled",
      value: menuItems.filter((i) => i.status === "disabled").length,
      tone: "text-foreground",
      hint: "hidden everywhere",
    },
  ];

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("Category name is required");
      return;
    }
    if (apiCategories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error("A category with this name already exists");
      return;
    }
    try {
      await api.menuCategories.create({ outlet: "SHADAB", name });
      await queryClient.invalidateQueries({ queryKey: ["menu"] });
      setNewCategoryName("");
      setAddCategoryOpen(false);
      toast.success("Category added");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not add category");
    }
  };

  const moveCategory = (idx: number, delta: -1 | 1) => {
    setManagedCategories((prev) => {
      const target = idx + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const a = next[idx];
      const b = next[target];
      if (!a || !b) return prev;
      next[idx] = b;
      next[target] = a;
      return next;
    });
  };

  const handleSaveCategories = async () => {
    const trimmed = managedCategories.map((c) => ({ ...c, name: c.name.trim() }));
    if (trimmed.some((c) => !c.name)) {
      toast.error("Category names cannot be empty");
      return;
    }
    const names = trimmed.map((c) => c.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      toast.error("Category names must be unique");
      return;
    }

    setSavingCategories(true);
    try {
      const keptIds = new Set(trimmed.map((c) => c.id));
      const removed = apiCategories.filter((c) => !keptIds.has(c.id));
      for (const c of removed) {
        await api.menuCategories.remove(c.id);
      }
      for (const c of trimmed) {
        const original = apiCategories.find((a) => a.id === c.id);
        if (original && original.name !== c.name) {
          await api.menuCategories.rename(c.id, c.name);
        }
      }
      if (trimmed.length > 0) {
        await api.menuCategories.reorder({
          outlet: "SHADAB",
          categoryIds: trimmed.map((c) => c.id),
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["menu"] });
      setManageOpen(false);
      toast.success("Categories updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update categories");
    } finally {
      setSavingCategories(false);
    }
  };

  const reloadMenu = () => queryClient.invalidateQueries({ queryKey: ["menu"] });

  const handleAddItem = async () => {
    const parsed = parseItemDraft(addDraft);
    if (!parsed) return;
    try {
      await api.menuItems.create({ outlet: "SHADAB", ...parsed });
      await reloadMenu();
      setAddDraft(emptyItemDraft);
      setAddItemOpen(false);
      toast.success(`${parsed.name} added to menu`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not add item");
    }
  };

  const handleCustomizeSave = async () => {
    if (!customizeItemId) return;
    const parsed = parseItemDraft(customizeDraft);
    if (!parsed) return;
    try {
      await api.menuItems.update(customizeItemId, parsed);
      await reloadMenu();
      setCustomizeOpen(false);
      setCustomizeItemId("");
      setCustomizeDraft(emptyItemDraft);
      toast.success(`${parsed.name} updated`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update item");
    }
  };

  const handleDuplicate = async (item: MenuItem) => {
    try {
      await api.menuItems.create({
        outlet: "SHADAB",
        name: `${item.name} (Copy)`,
        categoryId: item.categoryId,
        foodType: item.foodType,
        price: item.price,
        favorite: item.favorite,
        spicy: item.spicy ?? false,
        mrp: item.mrp ?? false,
        status: item.status,
        variants: item.variants.map((v) => ({ ...v })),
        sectionIds: item.sectionIds,
      });
      await reloadMenu();
      toast.success(`${item.name} duplicated`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not duplicate item");
    }
  };

  const handleToggleHidden = async (item: MenuItem) => {
    const hidden = item.status !== "available";
    try {
      await api.menuItems.update(item.id, {
        status: hidden ? "available" : "disabled",
      });
      await reloadMenu();
      toast.success(hidden ? `${item.name} is now available` : `${item.name} hidden from menu`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update item");
    }
  };

  const handleSetStatus = async (item: MenuItem, status: MenuItem["status"]) => {
    try {
      await api.menuItems.update(item.id, { status });
      await reloadMenu();
      toast.success(`${item.name} marked as ${status.replace("-", " ")}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update item");
    }
  };

  const handleToggleFavorite = async (item: MenuItem) => {
    try {
      await api.menuItems.update(item.id, { favorite: !item.favorite });
      await reloadMenu();
      toast.success(
        item.favorite ? `${item.name} removed from favorites` : `${item.name} added to favorites`,
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update item");
    }
  };

  const handleDelete = async (item: MenuItem) => {
    try {
      await api.menuItems.remove(item.id);
      await reloadMenu();
      toast.success(`${item.name} deleted`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not delete item");
    }
  };

  const loadItemToCustomize = (itemId: string) => {
    setCustomizeItemId(itemId);
    const item = menuItems.find((i) => i.id === itemId);
    setCustomizeDraft(item ? toDraft(item) : emptyItemDraft);
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            RestaurantOS · Catalog · Menu
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Menu Management</h1>
          <p className="text-sm text-muted-foreground">
            One catalog — price and availability set per size, per section.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
            <Settings className="size-4" /> Manage Categories
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddCategoryOpen(true)}>
            Add Category
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCustomizeOpen(true)}>
            Customize
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setAddDraft({ ...emptyItemDraft, sectionIds: sections.map((s) => s.id) });
              setAddItemOpen(true);
            }}
          >
            <Plus className="size-4" /> Add item
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="gap-1 p-4 shadow-card">
            <p className={cn("text-2xl font-bold tabular-nums", s.tone)}>{s.value}</p>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-[11px] text-muted-foreground">{s.hint}</p>
          </Card>
        ))}
      </div>

      <Card className="gap-4 p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {[{ id: "all", name: "All sections" }, ...sections].map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  section === s.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items..."
                className="h-9 w-[180px] pl-8"
              />
            </div>
            <Select value={foodFilter} onValueChange={setFoodFilter}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All items</SelectItem>
                <SelectItem value="veg">Veg only</SelectItem>
                <SelectItem value="non-veg">Non-veg only</SelectItem>
                <SelectItem value="egg">Egg</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Sections</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Variant availability</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => {
                const prices = item.variants.length
                  ? item.variants.map((v) => v.price)
                  : [item.price];
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex size-9 items-center justify-center rounded-lg text-sm font-bold",
                            avatarPalette[idx % avatarPalette.length],
                          )}
                        >
                          {item.name.charAt(0)}
                        </span>
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-medium">
                            <span
                              className={cn("size-2.5 rounded-full", dotColor[item.foodType])}
                            />
                            {item.name}
                            {item.favorite && (
                              <Star className="size-3.5 fill-warning text-warning" />
                            )}
                            {item.variants.length > 0 && (
                              <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                                {item.variants.length} sizes
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] capitalize text-muted-foreground">
                            {item.status.replace("-", " ")}
                            {item.mrp && " · MRP (tax inclusive)"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {categories.find((c) => c.id === item.categoryId)?.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {sections.filter((s) => item.sectionIds.includes(s.id)).map((s) => (
                          <span
                            key={s.id}
                            className="rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-medium text-info"
                          >
                            {s.name}
                          </span>
                        ))}
                        {item.sectionIds.length === 0 && (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {min === max ? inr(min, false) : `${inr(min, false)}–${inr(max, false)}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(item.variants.length
                          ? item.variants
                          : [{ name: "Standard", available: item.status === "available" }]
                        ).map((v) => (
                          <span
                            key={v.name}
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              v.available && item.status === "available"
                                ? "bg-success-soft text-success"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {v.name}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1 text-muted-foreground">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Edit"
                          onClick={() => {
                            setCustomizeOpen(true);
                            loadItemToCustomize(item.id);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Duplicate"
                          onClick={() => handleDuplicate(item)}
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={item.status === "available" ? "Hide" : "Show"}
                          onClick={() => handleToggleHidden(item)}
                        >
                          {item.status === "available" ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label="More"
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setCustomizeOpen(true);
                                loadItemToCustomize(item.id);
                              }}
                            >
                              <Pencil className="size-4" /> Edit item
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(item)}>
                              <Copy className="size-4" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleFavorite(item)}>
                              <Star className="size-4" />
                              {item.favorite ? "Remove favorite" : "Mark as favorite"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleSetStatus(item, "available")}
                            >
                              Mark available
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleSetStatus(item, "unavailable")}
                            >
                              Mark unavailable (86'd)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleSetStatus(item, "not-offered")}
                            >
                              Mark not offered
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(item)}
                            >
                              <Trash2 className="size-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Manage Categories */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>Rename or remove menu categories.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {managedCategories.map((c, idx) => {
              const used = (apiItemCounts[c.id] ?? 0) > 0;
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <Input
                    value={c.name}
                    onChange={(e) =>
                      setManagedCategories((prev) =>
                        prev.map((cat, i) => (i === idx ? { ...cat, name: e.target.value } : cat)),
                      )
                    }
                    className="flex-1"
                  />
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={idx === 0}
                      onClick={() => moveCategory(idx, -1)}
                      aria-label="Move up"
                      title="Move up"
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={idx === managedCategories.length - 1}
                      onClick={() => moveCategory(idx, 1)}
                      aria-label="Move down"
                      title="Move down"
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={used}
                    onClick={() => setManagedCategories((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Delete"
                    title={used ? "Category has menu items" : "Delete category"}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageOpen(false)}>
              Cancel
            </Button>
            <Button disabled={savingCategories} onClick={handleSaveCategories}>
              {savingCategories ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category */}
      <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>Create a new menu category.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Tandoori"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddCategoryOpen(false);
                setNewCategoryName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddCategory}>Save Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customize Item */}
      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Customize Item</DialogTitle>
            <DialogDescription>
              Select an item and update its details, variants and availability.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Item to customize</Label>
              <Select value={customizeItemId} onValueChange={loadItemToCustomize}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an item" />
                </SelectTrigger>
                <SelectContent>
                  {menuItems.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {customizeItemId && (
              <div className="max-h-[55vh] overflow-y-auto pr-2">
                <ItemForm
                  value={customizeDraft}
                  onChange={setCustomizeDraft}
                  categories={categories}
                  sections={sections}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCustomizeOpen(false);
                setCustomizeItemId("");
                setCustomizeDraft(emptyItemDraft);
              }}
            >
              Cancel
            </Button>
            <Button disabled={!customizeItemId} onClick={handleCustomizeSave}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
            <DialogDescription>Create a new menu item and its variants.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <ItemForm
              value={addDraft}
              onChange={setAddDraft}
              categories={categories}
              sections={sections}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddItemOpen(false);
                setAddDraft(emptyItemDraft);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddItem}>Add to Menu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
