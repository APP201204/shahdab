import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChefHat,
  ClipboardList,
  Minus,
  MoreVertical,
  Plus,
  X,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type MenuItem, type OrderLine, type Table, type TableSplitGroup } from "@/lib/api";
import { useTables } from "@/hooks/useTables";
import { useTableGroups } from "@/hooks/useTableGroups";
import { useMenu } from "@/hooks/useMenu";
import { useSections } from "@/hooks/useSections";
import { useAuth } from "@/hooks/useAuth";
import {
  useOrders,
  useAddOrderItems,
  useSendToKitchen,
  useUpdateOrderItemNote,
  useCancelOrderItem,
} from "@/hooks/useOrders";
import {
  useSeatTable,
  useRequestBill,
  useMergeTables,
  useReleaseMerge,
  useSplitTable,
  useUnsplitTable,
  useMoveTable,
} from "@/hooks/useTableActions";

export const Route = createFileRoute("/table-service")({
  head: () => ({
    meta: [
      { title: "Table Service · SHADAB RestaurantOS" },
      {
        name: "description",
        content: "Dine-in POS: pick a table, browse the menu and send orders to the kitchen.",
      },
      { property: "og:title", content: "Table Service · SHADAB RestaurantOS" },
      {
        property: "og:description",
        content: "Dine-in point of sale for Shadab Restaurant table service.",
      },
    ],
  }),
  component: TableService,
});

const dotColor = { veg: "bg-veg", "non-veg": "bg-nonveg", egg: "bg-egg" } as const;

const orderStatusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning-soft text-warning-foreground" },
  "sent-to-kitchen": { label: "In Kitchen", className: "bg-info-soft text-info" },
  ready: { label: "Ready", className: "bg-success-soft text-success" },
  "on-table": { label: "On Table", className: "bg-success-soft text-success" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

type ServiceableUnit = {
  id: string;
  name: string;
  sectionId: string;
  sectionName: string;
  capacity: number;
  guests: number;
  waiter?: string;
  kots: number;
  kind: "table" | "group";
  occupied: boolean;
  isSubTable: boolean;
  number: number;
  suffix?: string;
};

type UnitCardProps = {
  unit: ServiceableUnit;
  orderCount: number;
  cookingCount: number;
  active: boolean;
  canMerge: boolean;
  canTransfer: boolean;
  canSplit: boolean;
  onSelect: () => void;
  onMerge: () => void;
  onTransfer: () => void;
  onSplit: () => void;
};

function UnitCard({
  unit,
  orderCount,
  cookingCount,
  active,
  canMerge,
  canTransfer,
  canSplit,
  onSelect,
  onMerge,
  onTransfer,
  onSplit,
}: UnitCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = () => {
    longPressRef.current = false;
    timerRef.current = setTimeout(() => {
      longPressRef.current = true;
      setMenuOpen(true);
    }, 500);
  };

  const endLongPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = () => {
    if (longPressRef.current) {
      longPressRef.current = false;
      return;
    }
    onSelect();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "relative w-full rounded-lg border p-2 text-left transition-colors",
        active ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-accent",
        unit.occupied && "border-l-4 border-l-success",
      )}
      onClick={handleClick}
      onPointerDown={startLongPress}
      onPointerUp={endLongPress}
      onPointerLeave={endLongPress}
      onPointerCancel={endLongPress}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ WebkitTouchCallout: "none" }}
    >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-accent"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Options for ${unit.name}`}
          >
            <MoreVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {unit.kind === "group" ? (
            <DropdownMenuItem onSelect={onSplit} disabled={!canSplit}>
              Split
            </DropdownMenuItem>
          ) : unit.isSubTable ? (
            <DropdownMenuItem onSelect={onSplit} disabled={!canSplit}>
              Unsplit
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onSelect={onMerge} disabled={!canMerge}>
                Merge
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onTransfer} disabled={!canTransfer}>
                Transfer
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSplit} disabled={!canSplit}>
                Split
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{unit.name}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">{unit.sectionName}</p>
      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1" title="Guests">
          <Users className="size-3" /> {unit.guests}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-success-soft px-1.5 py-0.5 text-success"
          title="Orders on table"
        >
          <ClipboardList className="size-3" /> {orderCount}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-1.5 py-0.5 text-warning-foreground"
          title="Still cooking"
        >
          <ChefHat className="size-3" /> {cookingCount}
        </span>
      </div>
    </div>
  );
}

function TableService() {
  const { data: tablesData } = useTables("SHADAB");
  const { data: groupsData } = useTableGroups("SHADAB");
  const { data: menuData } = useMenu("SHADAB");
  const { data: sectionsData } = useSections("SHADAB");
  const { data: auth } = useAuth();
  const { data: ordersData } = useOrders();

  const seatTable = useSeatTable();
  const requestBillApi = useRequestBill();
  const mergeTables = useMergeTables();
  const releaseMerge = useReleaseMerge();
  const splitTable = useSplitTable();
  const unsplitTable = useUnsplitTable();
  const moveTable = useMoveTable();
  const addOrderItems = useAddOrderItems();
  const sendToKitchen = useSendToKitchen();
  const updateOrderItemNote = useUpdateOrderItemNote();
  const cancelOrderItem = useCancelOrderItem();

  const [sectionFilter, setSectionFilter] = useState("all");
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [pendingQty, setPendingQty] = useState(1);
  const [pendingNote, setPendingNote] = useState("");
  const [mergeDialog, setMergeDialog] = useState<{ open: boolean; source: ServiceableUnit | null }>(
    {
      open: false,
      source: null,
    },
  );
  const [transferDialog, setTransferDialog] = useState<{
    open: boolean;
    source: ServiceableUnit | null;
  }>({
    open: false,
    source: null,
  });
  const [mergeTarget, setMergeTarget] = useState("");
  const [transferTarget, setTransferTarget] = useState("");
  const [splitDialog, setSplitDialog] = useState<{
    open: boolean;
    table: Table | null;
    count: 2 | 3;
    capacities: number[];
  }>({ open: false, table: null, count: 2, capacities: [0, 0] });

  const tables = tablesData?.tables ?? [];
  const mergeGroups = groupsData?.mergeGroups ?? [];
  const splitGroups = groupsData?.splitGroups ?? [];

  const orderMap = useMemo(() => {
    return Object.fromEntries((ordersData?.units ?? []).map((u) => [u.id, u]));
  }, [ordersData]);

  const allItems = useMemo(() => menuData?.categories.flatMap((c) => c.items) ?? [], [menuData]);
  const sections = useMemo(() => sectionsData?.sections ?? [], [sectionsData]);
  const sectionNameMap = useMemo(
    () => Object.fromEntries(sections.map((s) => [s.id, s.name])),
    [sections],
  );

  const SUFFIXES = ["a", "b", "c"];

  const defaultCapacities = (table: Table, count: number) => {
    const base = Math.floor(table.capacity / count);
    const caps = Array(count).fill(base);
    const remainder = table.capacity - base * count;
    for (let i = 0; i < remainder; i++) {
      caps[i] += 1;
    }
    const existingGuests = table.guests;
    if (existingGuests > 0) {
      let needed = existingGuests - caps[0];
      for (let i = count - 1; i > 0 && needed > 0; i--) {
        const take = Math.min(needed, Math.max(0, caps[i] - 1));
        caps[i] -= take;
        caps[0] += take;
        needed -= take;
      }
    }
    return caps;
  };

  const hasActiveOrder = (unitId: string) => (orderMap[unitId]?.lines.length ?? 0) > 0;

  const canAddToUnit = (u: ServiceableUnit | null) => {
    if (!u) return false;
    if (u.kind === "group") return hasActiveOrder(u.id);
    const table = tables.find((t) => t.id === u.id);
    return !!table && ["available", "reserved", "occupied"].includes(table.status);
  };

  const units = useMemo<ServiceableUnit[]>(() => {
    const activeGroups = mergeGroups.filter((g) => g.status === "active");
    const tableUnits = tables
      .filter((t) => !t.mergeGroupId && (!t.splitGroupId || t.parentTableId))
      .map((t) => ({
        id: t.id,
        name: t.name,
        sectionId: t.sectionId,
        sectionName: sectionNameMap[t.sectionId] ?? "",
        capacity: t.capacity,
        guests: t.guests,
        ...(t.waiter ? { waiter: t.waiter } : {}),
        kots: t.kots,
        kind: "table" as const,
        occupied: t.status === "occupied",
        isSubTable: !!t.parentTableId,
        number: t.number,
        ...(t.suffix ? { suffix: t.suffix } : {}),
      }));
    const groupUnits = activeGroups.map((g) => {
      const groupTables = tables.filter((t) => g.tableIds.includes(t.id));
      return {
        id: g.id,
        name: g.name,
        sectionId: g.sectionId,
        sectionName: sectionNameMap[g.sectionId] ?? "",
        capacity: groupTables.reduce((sum, t) => sum + t.capacity, 0),
        guests: g.guests,
        ...(g.waiter ? { waiter: g.waiter } : {}),
        kots: groupTables.reduce((sum, t) => sum + t.kots, 0),
        kind: "group" as const,
        occupied: g.guests > 0 || hasActiveOrder(g.id),
        isSubTable: false,
        number: groupTables.reduce((min, t) => Math.min(min, t.number), Infinity),
      };
    });
    const allUnits = [...tableUnits, ...groupUnits].filter(
      (u) => sectionFilter === "all" || u.sectionId === sectionFilter,
    );
    const sortKey = (u: ServiceableUnit) =>
      u.number * 100 + (u.suffix ? u.suffix.charCodeAt(0) - 96 : 0);
    return allUnits.sort((a, b) => sortKey(a) - sortKey(b));
  }, [tables, mergeGroups, orderMap, sectionNameMap, sectionFilter]);

  const selectedUnit = units.find((u) => u.id === selectedUnitId) ?? units[0] ?? null;
  const unitId = selectedUnit?.id ?? "";
  const lines = orderMap[unitId]?.lines ?? [];

  useEffect(() => {
    const first = units[0];
    if (selectedUnitId === null && first) {
      setSelectedUnitId(first.id);
    }
  }, [selectedUnitId, units]);

  const canMerge = (u: ServiceableUnit) => {
    if (u.kind !== "table") return false;
    if (hasActiveOrder(u.id)) return false;
    const source = tables.find((t) => t.id === u.id);
    if (!source || source.splitGroupId || source.parentTableId) return false;
    return tables.some(
      (t) =>
        t.sectionId === u.sectionId &&
        t.id !== u.id &&
        !t.mergeGroupId &&
        !t.splitGroupId &&
        !t.parentTableId &&
        !hasActiveOrder(t.id),
    );
  };

  const canTransfer = (u: ServiceableUnit) => {
    if (u.kind !== "table") return false;
    if (hasActiveOrder(u.id)) return false;
    const source = tables.find((t) => t.id === u.id);
    if (!source || source.splitGroupId || source.parentTableId) return false;
    return tables.some(
      (t) =>
        !t.mergeGroupId &&
        !t.splitGroupId &&
        !t.parentTableId &&
        t.status === "available" &&
        t.id !== u.id,
    );
  };

  const openSplitDialog = (table: Table) => {
    const count: 2 | 3 = 2;
    setSplitDialog({
      open: true,
      table,
      count,
      capacities: defaultCapacities(table, count),
    });
  };

  const closeSplitDialog = () => {
    setSplitDialog({ open: false, table: null, count: 2, capacities: [0, 0] });
  };

  const handleConfirmSplit = () => {
    const table = splitDialog.table;
    if (!table) return;
    const count = splitDialog.count;
    const capacities = splitDialog.capacities.slice(0, count);

    if (capacities.some((c) => c <= 0)) {
      toast.error("Each sub-table must have at least 1 seat");
      return;
    }

    const total = capacities.reduce((sum, c) => sum + c, 0);
    if (total > table.capacity) {
      toast.error("Seat allocation exceeds the original table capacity");
      return;
    }

    if (table.parentTableId || table.splitGroupId) {
      toast.error("Table is already split");
      return;
    }

    const subTables = capacities.map((c, i) => ({
      capacity: c,
      name: `Table ${table.number}${SUFFIXES[i]}`,
    }));

    splitTable.mutate(
      { tableId: table.id, subTables },
      {
        onSuccess: () => {
          const names = subTables.map((st) => st.name).join(", ");
          setSelectedUnitId(table.id);
          closeSplitDialog();
          toast.success(`${table.name} split into ${names}`);
        },
        onError: (err: any) => toast.error(err?.message ?? "Could not split table"),
      },
    );
  };

  const handleUnsplit = (groupId: string) => {
    const group = splitGroups.find((g) => g.id === groupId);
    if (!group || group.status !== "active") return;

    const allClear = group.subTableIds.every((id) => {
      const st = tables.find((t) => t.id === id);
      if (!st) return false;
      if (st.guests > 0) return false;
      if (st.status !== "available") return false;
      if (hasActiveOrder(id)) return false;
      return true;
    });

    if (!allClear) {
      toast.error("All sub-tables must be vacant with no active orders before unsplitting");
      return;
    }

    unsplitTable.mutate(groupId, {
      onSuccess: () => {
        if (selectedUnitId && group.subTableIds.includes(selectedUnitId)) {
          setSelectedUnitId(units.find((u) => u.kind === "table")?.id ?? null);
        }
        toast.success("Table restored");
      },
      onError: (err: any) => toast.error(err?.message ?? "Could not unsplit table"),
    });
  };

  const canSplit = (u: ServiceableUnit) => {
    if (u.kind === "group") return !hasActiveOrder(u.id);
    const table = tables.find((t) => t.id === u.id);
    if (!table) return false;
    if (table.parentTableId) {
      if (table.suffix !== "a") return false;
      const group = splitGroups.find((g) => g.id === table.splitGroupId);
      if (!group || group.status !== "active") return false;
      return group.subTableIds.every((id) => {
        const st = tables.find((t) => t.id === id);
        if (!st) return false;
        if (st.guests > 0) return false;
        if (st.status !== "available") return false;
        if (hasActiveOrder(id)) return false;
        return true;
      });
    }
    if (table.splitGroupId) return false;
    return table.capacity >= 2;
  };

  const items = useMemo(
    () =>
      allItems
        .filter((i) => i.status !== "disabled" && i.status !== "not-offered")
        .filter((i) =>
          category === "all"
            ? true
            : category === "favorites"
              ? i.favorite
              : i.categoryId === category,
        )
        .filter((i) => i.name.toLowerCase().includes(query.toLowerCase())),
    [allItems, category, query],
  );

  const categories = useMemo(
    () => [{ id: "all", name: "All Items" }, { id: "favorites", name: "Favorites" }, ...menuData?.categories.map((c) => ({ id: c.id, name: c.name })) ?? []],
    [menuData],
  );

  const activeVariant = selectedItem?.variants?.find((v) => v.name === selectedVariant);

  const addVariant = async (item: MenuItem, variantName?: string) => {
    if (!selectedUnit) return;
    const variant = item.variants?.find((v) => v.name === variantName);
    if (variant && !variant.available) return;
    const note = pendingNote.trim() || undefined;
    let orderId = orderMap[selectedUnit.id]?.orderId;
    if (!orderId) {
      if (selectedUnit.kind !== "table") {
        toast.error("No order found for this unit");
        return;
      }
      if (!canAddToUnit(selectedUnit)) {
        toast.error("Cannot add items to this table");
        return;
      }
      try {
        const result = await seatTable.mutateAsync({
          id: selectedUnit.id,
          guests: Math.max(1, selectedUnit.guests || 1),
        });
        orderId = result.order?.id;
      } catch (err: any) {
        toast.error(err?.message ?? "Could not seat table");
        return;
      }
    }
    if (!orderId) {
      toast.error("No order found for this unit");
      return;
    }
    addOrderItems.mutate(
      {
        orderId,
        items: [
          {
            menuItemId: item.id,
            ...(variant?.id ? { variantId: variant.id } : {}),
            qty: pendingQty,
            ...(note ? { note } : {}),
          },
        ],
      },
      {
        onError: (err: any) => toast.error(err?.message ?? "Could not add item"),
      },
    );
    setSelectedItem(null);
    setSelectedVariant(null);
    setPendingQty(1);
    setPendingNote("");
  };

  const openItem = (item: MenuItem) => {
    if (item.status === "unavailable" || item.outOfStock) return;
    if (!selectedUnit || !canAddToUnit(selectedUnit)) return;
    const first = item.variants?.find((v) => v.available) ?? item.variants?.[0];
    setSelectedItem(item);
    setSelectedVariant(first?.name ?? null);
    setPendingQty(1);
    setPendingNote("");
  };

  const changeQty = (lineId: string, delta: number) => {
    if (!selectedUnit) return;
    const orderId = orderMap[selectedUnit.id]?.orderId;
    const line = lines.find((l) => l.id === lineId);
    if (!line || !orderId) return;
    if (line.status !== "pending") {
      toast.error("Can only change quantity of pending items");
      return;
    }
    const nextQty = line.qty + delta;
    const menuItem = allItems.find((i) => i.id === line.itemId);
    const variantId = menuItem?.variants?.find((v) => v.name === (line.variant ?? ""))?.id;
    if (nextQty <= 0) {
      cancelOrderItem.mutate(line.id, {
        onSuccess: () => toast.success(`${line.name} removed`),
        onError: (err: any) => toast.error(err?.message ?? "Could not remove item"),
      });
      return;
    }
    cancelOrderItem.mutate(line.id, {
      onSuccess: () => {
        addOrderItems.mutate({
          orderId,
          items: [
            {
              menuItemId: line.itemId,
              ...(variantId ? { variantId } : {}),
              qty: nextQty,
              ...(line.note ? { note: line.note } : {}),
            },
          ],
        });
      },
      onError: (err: any) => toast.error(err?.message ?? "Could not update quantity"),
    });
  };

  const updateNote = (lineId: string, note: string) => {
    if (!selectedUnit) return;
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    if (line.status !== "pending") {
      toast.error("Can only add notes to pending items");
      return;
    }
    updateOrderItemNote.mutate({ id: lineId, note: note.trim() });
  };

  const cancelLine = (lineId: string) => {
    if (!selectedUnit) return;
    const line = lines.find((l) => l.id === lineId);
    if (!line || line.status === "cancelled") return;
    if (line.status === "on-table") {
      toast.error(
        "Item is already cooked/served — cancellation blocked. Contact the Kitchen Manager for manual handling.",
      );
      return;
    }
    cancelOrderItem.mutate(line.id, {
      onSuccess: () => toast.success(`${line.name} cancelled — removed from kitchen ticket and bill`),
      onError: (err: any) => toast.error(err?.message ?? "Could not cancel item"),
    });
  };

  const requestBill = () => {
    if (!selectedUnit || selectedUnit.kind !== "table") return;
    requestBillApi.mutate(selectedUnit.id, {
      onSuccess: () => toast.success(`${selectedUnit.name} moved to billing — ${inr(subtotal)}`),
      onError: (err: any) => toast.error(err?.message ?? "Could not request bill"),
    });
  };

  const placeOrder = () => {
    if (!selectedUnit) return;
    const hasPending = lines.some((l) => l.status === "pending");
    if (!hasPending) return;
    const orderId = orderMap[selectedUnit.id]?.orderId;
    const createdBy = auth?.staff.staffId;
    if (!orderId || !createdBy) {
      toast.error("Cannot place order");
      return;
    }
    sendToKitchen.mutate(
      { orderId, createdBy },
      {
        onSuccess: () => toast.success(`Order placed for ${selectedUnit.name}`),
        onError: (err: any) => toast.error(err?.message ?? "Could not place order"),
      },
    );
  };

  const handleSplit = (unit: ServiceableUnit) => {
    if (unit.kind === "group") {
      if (hasActiveOrder(unit.id)) {
        toast.error(`${unit.name} has an active order — settle or close it before splitting`);
        return;
      }
      releaseMerge.mutate(unit.id, {
        onSuccess: () => {
          if (selectedUnitId === unit.id) {
            setSelectedUnitId(units.find((u) => u.kind === "table")?.id ?? null);
          }
          toast.success(`${unit.name} split into individual tables`);
        },
        onError: (err: any) => toast.error(err?.message ?? "Could not release merge"),
      });
      return;
    }

    const table = tables.find((t) => t.id === unit.id);
    if (!table) return;

    if (table.parentTableId) {
      if (table.splitGroupId) handleUnsplit(table.splitGroupId);
      return;
    }

    openSplitDialog(table);
  };

  const handleMergeFromDialog = () => {
    const source = mergeDialog.source;
    if (!source || !mergeTarget) return;
    const sourceTable = tables.find((t) => t.id === source.id);
    const target = tables.find((t) => t.id === mergeTarget);
    if (!sourceTable || !target || source.kind !== "table") return;

    if (sourceTable.sectionId !== target.sectionId) {
      toast.error("Tables must be in the same section");
      return;
    }
    if (target.mergeGroupId) {
      toast.error(`${target.name} is already part of a merged group`);
      return;
    }
    if (
      sourceTable.splitGroupId ||
      sourceTable.parentTableId ||
      target.splitGroupId ||
      target.parentTableId
    ) {
      toast.error("Split tables cannot be merged");
      return;
    }
    if (hasActiveOrder(sourceTable.id) || hasActiveOrder(target.id)) {
      toast.error("Cannot merge tables with active orders");
      return;
    }

    const name = [sourceTable.name, target.name].join(" + ");
    mergeTables.mutate(
      { tableIds: [sourceTable.id, target.id] },
      {
        onSuccess: () => {
          setSelectedUnitId(null);
          setMergeDialog({ open: false, source: null });
          setMergeTarget("");
          toast.success(`${name} merged into one unit`);
        },
        onError: (err: any) => toast.error(err?.message ?? "Could not merge tables"),
      },
    );
  };

  const handleTransferFromDialog = () => {
    const source = transferDialog.source;
    if (!source || !transferTarget) return;
    const sourceTable = tables.find((t) => t.id === source.id);
    const dest = tables.find((t) => t.id === transferTarget);
    if (!sourceTable || !dest || source.kind !== "table") return;

    if (sourceTable.mergeGroupId || dest.mergeGroupId) {
      toast.error("Merged tables cannot be transferred");
      return;
    }
    if (
      sourceTable.splitGroupId ||
      sourceTable.parentTableId ||
      dest.splitGroupId ||
      dest.parentTableId
    ) {
      toast.error("Split tables cannot be transferred");
      return;
    }
    if (hasActiveOrder(sourceTable.id)) {
      toast.error(`${sourceTable.name} has an active order`);
      return;
    }
    if (dest.status !== "available") {
      toast.error(`${dest.name} is not vacant`);
      return;
    }

    moveTable.mutate(
      { from: sourceTable.id, to: dest.id },
      {
        onSuccess: () => {
          setSelectedUnitId(dest.id);
          setTransferDialog({ open: false, source: null });
          setTransferTarget("");
          toast.success(`Moved booking to ${dest.name}`);
        },
        onError: (err: any) => toast.error(err?.message ?? "Could not transfer booking"),
      },
    );
  };

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const pendingCount = lines.filter((l) => l.status === "pending").length;
  const sectionName = selectedUnit
    ? sections.find((s) => s.id === selectedUnit.sectionId)?.name
    : "";

  const mergeTargets = mergeDialog.source
    ? tables.filter(
        (t) =>
          t.sectionId === mergeDialog.source!.sectionId &&
          t.id !== mergeDialog.source!.id &&
          !t.mergeGroupId &&
          !t.splitGroupId &&
          !t.parentTableId &&
          !hasActiveOrder(t.id),
      )
    : [];

  const transferTargets = transferDialog.source
    ? tables.filter(
        (t) =>
          t.id !== transferDialog.source!.id &&
          !t.mergeGroupId &&
          !t.splitGroupId &&
          !t.parentTableId &&
          t.status === "available",
      )
    : [];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] gap-3 p-3">
      {/* Left: serviceable units */}
      <Card className="flex w-[220px] shrink-0 flex-col gap-2 overflow-hidden p-3 shadow-card">
        <div className="flex items-center gap-1">
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {sections
                .filter((s) => s.type === "dine-in")
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Refresh">
            <RefreshCw className="size-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-2">
            {units.map((u) => (
              <UnitCard
                key={u.id}
                unit={u}
                orderCount={orderMap[u.id]?.lines.length ?? 0}
                cookingCount={
                  (orderMap[u.id]?.lines ?? []).filter((l) => l.status === "sent-to-kitchen").length
                }
                active={u.id === selectedUnitId}
                canMerge={canMerge(u)}
                canTransfer={canTransfer(u)}
                canSplit={canSplit(u)}
                onSelect={() => setSelectedUnitId(u.id)}
                onMerge={() => {
                  setMergeDialog({ open: true, source: u });
                  setMergeTarget("");
                }}
                onTransfer={() => {
                  setTransferDialog({ open: true, source: u });
                  setTransferTarget("");
                }}
                onSplit={() => handleSplit(u)}
              />
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Center: menu */}
      <Card className="flex flex-1 flex-col gap-3 overflow-hidden p-3 shadow-card">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search menu items..."
            className="h-9 pl-8"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        <ScrollArea className="flex-1">
          <div className="grid gap-2 pr-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => {
              const out = item.status === "unavailable" || !!item.outOfStock;
              return (
                <button
                  key={item.id}
                  onClick={() => openItem(item)}
                  disabled={out || !selectedUnit || !canAddToUnit(selectedUnit)}
                  className={cn(
                    "relative rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-primary-soft",
                    (out || !selectedUnit || !canAddToUnit(selectedUnit)) &&
                      "cursor-not-allowed opacity-60 hover:border-border hover:bg-card",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-1 size-2.5 rounded-full", dotColor[item.foodType])} />
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-tight">
                        {item.name}
                        {item.spicy && <span className="ml-1 text-xs">🌶️</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {(item.variants?.length ?? 0) > 0
                          ? `${item.variants!.length} variant${item.variants!.length > 1 ? "s" : ""}`
                          : inr(item.basePrice, false)}
                      </p>
                    </div>
                  </div>
                  {out && (
                    <span className="absolute right-2 top-2 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-medium text-destructive">
                      Out of Stock
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </Card>

      {/* Right: order panel */}
      <Card className="flex w-[320px] shrink-0 flex-col gap-3 overflow-hidden p-3 shadow-card">
        {selectedUnit ? (
          <>
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{selectedUnit.name}</h2>
                <span className="text-xs text-muted-foreground">{sectionName}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <UserRound className="size-3.5" /> {selectedUnit.waiter ?? "Unassigned"}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={() => {
                      if (selectedUnit.kind !== "table") return;
                      seatTable.mutate({
                        id: selectedUnit.id,
                        guests: Math.max(0, selectedUnit.guests - 1),
                      });
                    }}
                    aria-label="Decrease guests"
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums">
                    {selectedUnit.guests}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={() => {
                      if (selectedUnit.kind !== "table") return;
                      seatTable.mutate({
                        id: selectedUnit.id,
                        guests: selectedUnit.guests + 1,
                      });
                    }}
                    aria-label="Increase guests"
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Order Items
            </p>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-2">
                {lines.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No items yet — tap a menu item to start the order.
                  </p>
                )}
                {lines.map((l) => {
                  const meta = orderStatusMeta[l.status ?? ""] ?? { label: l.status ?? "", className: "bg-muted text-muted-foreground" };
                  return (
                    <div
                      key={l.id}
                      className={cn(
                        "rounded-lg border p-2",
                        l.status === "pending"
                          ? "border-warning/40 bg-warning-soft/20"
                          : "border-border",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">{l.name}</p>
                          {l.variant && (
                            <p className="text-[11px] text-muted-foreground">{l.variant}</p>
                          )}
                          {l.status === "pending" ? (
                            <Textarea
                              value={l.note ?? ""}
                              onChange={(e) => updateNote(l.id, e.target.value)}
                              placeholder="Add comment..."
                              rows={1}
                              className="mt-1 h-auto min-h-0 resize-none border-0 bg-transparent p-0 text-[11px] text-warning-foreground placeholder:text-muted-foreground focus-visible:ring-0"
                            />
                          ) : (
                            l.note && (
                              <p className="text-[11px] text-warning-foreground">{l.note}</p>
                            )
                          )}
                        </div>
                        <span className="flex items-center gap-1">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              meta.className,
                            )}
                          >
                            {meta.label}
                          </span>
                          {l.status !== "cancelled" && (
                            <button
                              onClick={() => cancelLine(l.id)}
                              className="rounded-md p-0.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                              aria-label={`Cancel ${l.name}`}
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-6"
                            onClick={() => changeQty(l.id, -1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="size-3" />
                          </Button>
                          <span className="w-6 text-center text-xs font-semibold tabular-nums">
                            {l.qty}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-6"
                            onClick={() => changeQty(l.id, 1)}
                            aria-label="Increase quantity"
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {inr(l.unitPrice, false)} × {l.qty} ={" "}
                          <span className="font-semibold text-foreground">
                            {inr(l.qty * l.unitPrice, false)}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (pre-tax)</span>
                <span className="font-bold tabular-nums">{inr(subtotal)}</span>
              </div>
              <Button className="w-full" disabled={pendingCount === 0} onClick={placeOrder}>
                Place Order {pendingCount > 0 && `(${pendingCount} pending)`}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={lines.length === 0}
                onClick={requestBill}
              >
                Request Bill
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            No table or group available
          </div>
        )}
      </Card>

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
            <DialogDescription>
              {selectedItem && (selectedItem.variants?.length ?? 0) > 0
                ? "Choose a size/variant and quantity to add to the order."
                : "Choose a quantity to add to the order."}
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (selectedItem.variants?.length ?? 0) > 0 && (
            <RadioGroup
              value={selectedVariant ?? ""}
              onValueChange={setSelectedVariant}
              className="gap-2"
            >
              {selectedItem.variants!.map((v) => {
                const id = `${selectedItem.id}-${v.name}`;
                return (
                  <label
                    key={v.name}
                    htmlFor={id}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors",
                      selectedVariant === v.name
                        ? "border-primary bg-primary-soft"
                        : "border-border bg-card hover:bg-accent",
                      !v.available && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={v.name} id={id} disabled={!v.available} />
                      <span className="text-sm font-medium">{v.name}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {inr(v.price, false)}
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Quantity</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                onClick={() => setPendingQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
              >
                <Minus className="size-3" />
              </Button>
              <span className="w-8 text-center text-sm font-semibold tabular-nums">
                {pendingQty}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                onClick={() => setPendingQty((q) => q + 1)}
                aria-label="Increase quantity"
              >
                <Plus className="size-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-note" className="text-sm font-medium">
              Comment
            </Label>
            <Textarea
              id="item-note"
              value={pendingNote}
              onChange={(e) => setPendingNote(e.target.value)}
              placeholder="Add a special instruction..."
              className="min-h-[60px] resize-none text-sm"
            />
          </div>

          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              disabled={
                !selectedItem ||
                ((selectedItem.variants?.length ?? 0) > 0 && (!activeVariant || !activeVariant.available))
              }
              onClick={() => selectedItem && addVariant(selectedItem, selectedVariant ?? undefined)}
            >
              Add {pendingQty} to order ·{" "}
              {inr(pendingQty * (activeVariant?.price ?? selectedItem?.basePrice ?? 0), false)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mergeDialog.open}
        onOpenChange={(open) => !open && setMergeDialog({ open: false, source: null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge {mergeDialog.source?.name}</DialogTitle>
            <DialogDescription>
              Choose another table in the same section to merge with.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="merge-target">Target table</Label>
            <Select value={mergeTarget} onValueChange={setMergeTarget}>
              <SelectTrigger id="merge-target">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                {mergeTargets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialog({ open: false, source: null })}>
              Cancel
            </Button>
            <Button onClick={handleMergeFromDialog} disabled={!mergeTarget}>
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={transferDialog.open}
        onOpenChange={(open) => !open && setTransferDialog({ open: false, source: null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer {transferDialog.source?.name}</DialogTitle>
            <DialogDescription>Choose a vacant table to move the booking to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="transfer-target">Destination table</Label>
            <Select value={transferTarget} onValueChange={setTransferTarget}>
              <SelectTrigger id="transfer-target">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                {transferTargets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferDialog({ open: false, source: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleTransferFromDialog} disabled={!transferTarget}>
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={splitDialog.open} onOpenChange={(o) => !o && closeSplitDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Split {splitDialog.table?.name ?? "Table"}</DialogTitle>
          </DialogHeader>
          {splitDialog.table && (
            <div className="space-y-4">
              {hasActiveOrder(splitDialog.table.id) && (
                <p className="rounded-lg bg-warning-soft p-2 text-xs text-warning-foreground">
                  This table has an active order. It will be moved to sub-table 1a.
                </p>
              )}
              <div className="space-y-1.5">
                <Label>Number of sub-tables</Label>
                <Select
                  value={String(splitDialog.count)}
                  onValueChange={(v) => {
                    const count = Number(v) as 2 | 3;
                    setSplitDialog((prev) => ({
                      ...prev,
                      count,
                      capacities: defaultCapacities(prev.table!, count),
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    {splitDialog.table.capacity >= 3 && <SelectItem value="3">3</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                Seats will be divided evenly across the sub-tables.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeSplitDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSplit}
              disabled={
                !splitDialog.table ||
                splitDialog.capacities.slice(0, splitDialog.count).some((c) => c <= 0) ||
                splitDialog.capacities.slice(0, splitDialog.count).reduce((sum, c) => sum + c, 0) >
                  splitDialog.table!.capacity
              }
            >
              Split Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
