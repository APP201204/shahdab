import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { MoreVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SECTIONS,
  type RTable,
  type TableMergeGroup,
  type TableSplitGroup,
  type TableStatus,
} from "@/data/seed";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/app-state";
import { toast } from "sonner";

export const Route = createFileRoute("/tables")({
  head: () => ({
    meta: [
      { title: "Table Management · SHADAB RestaurantOS" },
      {
        name: "description",
        content: "Floor plan, seat guests, reserve and clean tables across every Shadab section.",
      },
      { property: "og:title", content: "Table Management · SHADAB RestaurantOS" },
      {
        property: "og:description",
        content: "Floor plan and table statuses across every Shadab section.",
      },
    ],
  }),
  component: TableManagement,
});

const statusStyles: Record<TableStatus, string> = {
  available: "bg-success-soft text-success",
  reserved: "bg-primary-soft text-primary",
  occupied: "bg-danger-soft text-destructive",
  "bill-requested": "bg-warning-soft text-warning-foreground",
  paid: "bg-success-soft text-success",
  "needs-cleaning": "bg-muted text-muted-foreground",
};

const statusLabel: Record<TableStatus, string> = {
  available: "Vacant",
  reserved: "Reserved",
  occupied: "Occupied",
  "bill-requested": "Bill Requested",
  paid: "Paid",
  "needs-cleaning": "Needs Cleaning",
};

const SUFFIXES = ["a", "b", "c"];

function defaultCapacities(table: RTable, count: number) {
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
}

type Unit =
  { kind: "table"; table: RTable } | { kind: "group"; group: TableMergeGroup; tables: RTable[] };

function TableManagement() {
  const {
    tables,
    setTables,
    mergeGroups,
    setMergeGroups,
    splitGroups,
    setSplitGroups,
    orders,
    setOrders,
    guestCounts,
    setGuestCounts,
    notify,
  } = useAppState();
  const [sectionId, setSectionId] = useState("dine-in");
  const [editing, setEditing] = useState<RTable | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSource, setTransferSource] = useState("");
  const [transferDest, setTransferDest] = useState("");
  const [splitDialog, setSplitDialog] = useState<{
    open: boolean;
    table: RTable | null;
    count: 2 | 3;
    capacities: number[];
  }>({ open: false, table: null, count: 2, capacities: [0, 0] });

  const sectionName = SECTIONS.find((s) => s.id === sectionId)!.name;

  const hasActiveOrder = useCallback(
    (unitId: string) => (orders[unitId]?.length ?? 0) > 0,
    [orders],
  );

  const isSplitTable = (t: RTable) => t.splitGroupId && !t.parentTableId;
  const isSubTable = (t: RTable) => !!t.parentTableId;

  const visibleUnits = useMemo<Unit[]>(() => {
    const activeGroups = mergeGroups.filter(
      (g) => g.status === "active" && g.sectionId === sectionId,
    );
    const visibleTables = tables.filter(
      (t) => t.sectionId === sectionId && !t.mergeGroupId && !isSplitTable(t),
    );
    const units: Unit[] = visibleTables.map((t) => ({ kind: "table", table: t }));
    activeGroups.forEach((g) => {
      units.push({
        kind: "group",
        group: g,
        tables: tables.filter((t) => g.tableIds.includes(t.id)),
      });
    });
    const sortKey = (u: Unit) => {
      if (u.kind === "table") {
        const t = u.table;
        return t.number * 100 + (t.suffix ? t.suffix.charCodeAt(0) - 96 : 0);
      }
      const minNumber = u.tables.reduce((min, t) => Math.min(min, t.number), Infinity);
      return minNumber * 100;
    };
    return units.sort((a, b) => sortKey(a) - sortKey(b));
  }, [tables, mergeGroups, sectionId]);

  const stats = useMemo(() => {
    const total = visibleUnits.length;
    const occupied = visibleUnits.filter((u) => {
      if (u.kind === "table") {
        const guests = guestCounts[u.table.id] ?? u.table.guests;
        return guests > 0 || hasActiveOrder(u.table.id);
      }
      const guests = guestCounts[u.group.id] ?? u.group.guests;
      return guests > 0 || hasActiveOrder(u.group.id);
    }).length;
    return { total, occupied, vacant: total - occupied };
  }, [visibleUnits, guestCounts, hasActiveOrder]);

  const setStatus = (id: string, status: TableStatus) => {
    const guests = status === "occupied" ? 2 : status === "available" ? 0 : undefined;
    setTables((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status, ...(guests !== undefined ? { guests } : {}) } : t,
      ),
    );
    if (guests !== undefined) setGuestCounts((prev) => ({ ...prev, [id]: guests }));
  };

  const requestBill = (t: RTable) => {
    setTables((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: "bill-requested" } : x)));
    notify(`Bill requested for ${t.name} — ${sectionName}`);
    toast.success(`Bill requested for ${t.name} — cashier notified`);
  };

  const handleMerge = () => {
    const selectedTables = tables.filter((t) => selectedForMerge.includes(t.id));
    if (selectedTables.length < 2) {
      toast.error("Select at least 2 tables to merge");
      return;
    }

    const section = selectedTables[0]!.sectionId;
    if (selectedTables.some((t) => t.sectionId !== section)) {
      toast.error("All selected tables must be in the same section");
      return;
    }

    for (const t of selectedTables) {
      if (t.mergeGroupId) {
        toast.error(`${t.name} is already part of a merged group`);
        return;
      }
      if (t.splitGroupId || t.parentTableId) {
        toast.error(`${t.name} is already split or is a sub-table`);
        return;
      }
      if (hasActiveOrder(t.id)) {
        toast.error(`${t.name} has an active order — settle or close it before merging`);
        return;
      }
    }

    const id = `mg-${Date.now()}`;
    const name = selectedTables.map((t) => t.name).join(" + ");
    const groupGuests = selectedTables.reduce((sum, t) => sum + (guestCounts[t.id] ?? t.guests), 0);
    const waiter = selectedTables.find((t) => t.waiter)?.waiter;

    const group: TableMergeGroup = {
      id,
      name,
      sectionId: section,
      tableIds: selectedForMerge,
      status: "active",
      guests: groupGuests,
      ...(waiter ? { waiter } : {}),
    };

    setMergeGroups((prev) => [...prev, group]);
    setTables((prev) =>
      prev.map((t) => (selectedForMerge.includes(t.id) ? { ...t, mergeGroupId: id } : t)),
    );
    setGuestCounts((prev) => {
      const next = { ...prev };
      let sum = 0;
      selectedForMerge.forEach((tableId) => {
        sum += next[tableId] ?? 0;
        next[tableId] = 0;
      });
      next[id] = sum;
      return next;
    });

    setMergeMode(false);
    setSelectedForMerge([]);
    toast.success(`${name} merged into one unit`);
  };

  const handleMergeGroupSplit = (groupId: string) => {
    const group = mergeGroups.find((g) => g.id === groupId);
    if (!group) return;

    if (hasActiveOrder(groupId)) {
      toast.error(`${group.name} has an active order — settle or close it before splitting`);
      return;
    }

    setMergeGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, status: "released" } : g)),
    );
    setTables((prev) =>
      prev.map((t) => {
        if (!group.tableIds.includes(t.id)) return t;
        const { mergeGroupId: _, waiter: _w, ...rest } = t;
        return { ...rest, status: "available", guests: 0 } as RTable;
      }),
    );
    setGuestCounts((prev) => {
      const next = { ...prev };
      delete next[groupId];
      group.tableIds.forEach((tableId) => {
        next[tableId] = 0;
      });
      return next;
    });

    toast.success(`${group.name} split into individual tables`);
  };

  const openSplitDialog = (table: RTable) => {
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

    if (isSubTable(table) || isSplitTable(table)) {
      toast.error("Table is already split");
      return;
    }

    if (splitGroups.some((g) => g.parentTableId === table.id && g.status === "active")) {
      toast.error("Table is already split");
      return;
    }

    const groupId = `sg-${Date.now()}`;
    const suffixes = SUFFIXES.slice(0, count);
    const existingGuests = guestCounts[table.id] ?? table.guests;
    const existingOrder = orders[table.id] ?? [];

    const subTables: RTable[] = [];
    const subTableIds: string[] = [];

    for (let i = 0; i < count; i++) {
      const suffix = suffixes[i]!;
      const id = `${table.id}${suffix}`;
      const isFirst = i === 0;
      const guests = isFirst ? existingGuests : 0;
      const kots = isFirst ? table.kots : 0;
      const waiter = isFirst ? table.waiter : undefined;
      const startedAt = isFirst ? table.startedAt : undefined;
      const hasOrder = isFirst && existingOrder.length > 0;
      const status: TableStatus = guests > 0 || hasOrder ? "occupied" : "available";

      subTableIds.push(id);
      subTables.push({
        id,
        number: table.number,
        name: `Table ${table.number}${suffix}`,
        sectionId: table.sectionId,
        capacity: capacities[i] ?? 0,
        status,
        guests,
        ...(waiter ? { waiter } : {}),
        ...(startedAt ? { startedAt } : {}),
        kots,
        parentTableId: table.id,
        splitGroupId: groupId,
        suffix,
      });
    }

    const group: TableSplitGroup = {
      id: groupId,
      parentTableId: table.id,
      sectionId: table.sectionId,
      subTableIds,
      status: "active",
    };

    setSplitGroups((prev) => [...prev, group]);
    setTables((prev) => [
      ...prev.map((t) => {
        if (t.id !== table.id) return t;
        const { waiter, startedAt, ...rest } = t;
        return {
          ...rest,
          splitGroupId: groupId,
          status: "available" as TableStatus,
          guests: 0,
          kots: 0,
        };
      }),
      ...subTables,
    ]);
    setGuestCounts((prev) => {
      const next = { ...prev };
      delete next[table.id];
      subTables.forEach((st) => {
        next[st.id] = st.guests;
      });
      return next;
    });
    setOrders((prev) => {
      const next = { ...prev };
      if (existingOrder.length > 0) {
        next[subTableIds[0]!] = existingOrder;
      }
      delete next[table.id];
      return next;
    });

    closeSplitDialog();
    toast.success(`${table.name} split into ${subTables.map((t) => t.name).join(", ")}`);
  };

  const canUnsplit = (subTable: RTable) => {
    if (subTable.suffix !== "a") return false;
    const group = splitGroups.find((g) => g.id === subTable.splitGroupId);
    if (!group || group.status !== "active") return false;
    return group.subTableIds.every((id) => {
      const st = tables.find((t) => t.id === id);
      if (!st) return false;
      const guests = guestCounts[id] ?? st.guests;
      if (guests > 0) return false;
      if (st.status !== "available") return false;
      if (hasActiveOrder(id)) return false;
      return true;
    });
  };

  const handleUnsplit = (groupId: string) => {
    const group = splitGroups.find((g) => g.id === groupId);
    if (!group || group.status !== "active") return;

    const allClear = group.subTableIds.every((id) => {
      const st = tables.find((t) => t.id === id);
      if (!st) return false;
      const guests = guestCounts[id] ?? st.guests;
      if (guests > 0) return false;
      if (st.status !== "available") return false;
      if (hasActiveOrder(id)) return false;
      return true;
    });

    if (!allClear) {
      toast.error("All sub-tables must be vacant with no active orders before unsplitting");
      return;
    }

    setTables((prev) =>
      prev
        .filter((t) => !group.subTableIds.includes(t.id))
        .map((t) => {
          if (t.id !== group.parentTableId) return t;
          const { splitGroupId, waiter, startedAt, ...rest } = t;
          return { ...rest, status: "available" as TableStatus, guests: 0, kots: 0 };
        }),
    );
    setSplitGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, status: "released" } : g)),
    );
    setGuestCounts((prev) => {
      const next = { ...prev };
      group.subTableIds.forEach((id) => delete next[id]);
      next[group.parentTableId] = 0;
      return next;
    });
    setOrders((prev) => {
      const next = { ...prev };
      group.subTableIds.forEach((id) => delete next[id]);
      return next;
    });

    toast.success("Table restored");
  };

  const handleTransfer = () => {
    if (!transferSource || !transferDest || transferSource === transferDest) {
      toast.error("Choose different source and destination tables");
      return;
    }

    const source = tables.find((t) => t.id === transferSource);
    const dest = tables.find((t) => t.id === transferDest);
    if (!source || !dest) return;

    if (source.mergeGroupId || dest.mergeGroupId) {
      toast.error("Merged tables must be split before transferring");
      return;
    }
    if (source.splitGroupId || source.parentTableId || dest.splitGroupId || dest.parentTableId) {
      toast.error("Split tables cannot be transferred");
      return;
    }
    if (hasActiveOrder(source.id)) {
      toast.error(`${source.name} has an active order — settle or close it before transferring`);
      return;
    }
    if (dest.status !== "available") {
      toast.error(`${dest.name} is not vacant`);
      return;
    }

    const sourceGuests = guestCounts[source.id] ?? source.guests;
    const sourceWaiter = source.waiter;

    setTables((prev) =>
      prev.map((t) => {
        if (t.id === source.id) {
          const { waiter: _w, ...rest } = t;
          return { ...rest, status: "available", guests: 0 } as RTable;
        }
        if (t.id === dest.id) {
          return {
            ...t,
            status: source.status,
            guests: sourceGuests,
            ...(sourceWaiter ? { waiter: sourceWaiter } : {}),
          };
        }
        return t;
      }),
    );
    setGuestCounts((prev) => ({
      ...prev,
      [source.id]: 0,
      [dest.id]: sourceGuests,
    }));

    setTransferOpen(false);
    setTransferSource("");
    setTransferDest("");
    toast.success(`Moved booking from ${source.name} to ${dest.name}`);
  };

  const transferSources = tables.filter(
    (t) => !t.mergeGroupId && !t.splitGroupId && !t.parentTableId && !hasActiveOrder(t.id),
  );
  const transferDests = tables.filter(
    (t) =>
      !t.mergeGroupId &&
      !t.splitGroupId &&
      !t.parentTableId &&
      t.status === "available" &&
      t.id !== transferSource,
  );

  const splitTotal = splitDialog.table
    ? splitDialog.capacities.slice(0, splitDialog.count).reduce((sum, c) => sum + c, 0)
    : 0;
  const splitValid =
    splitDialog.table &&
    splitDialog.capacities.slice(0, splitDialog.count).every((c) => c > 0) &&
    splitTotal <= splitDialog.table.capacity;

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Table Management</h1>
          <p className="text-sm text-muted-foreground">
            Floor plan, statuses and seating for every room.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mergeMode ? (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedForMerge.length} selected
              </span>
              <Button onClick={handleMerge} disabled={selectedForMerge.length < 2}>
                Merge
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setMergeMode(false);
                  setSelectedForMerge([]);
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setMergeMode(true)}>
                Merge Tables
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setTransferOpen(true);
                  setTransferSource("");
                  setTransferDest("");
                }}
              >
                Transfer
              </Button>
            </>
          )}
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="h-9 w-[180px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECTIONS.filter((s) => s.type === "dine-in").map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Units", value: stats.total },
          { label: "Occupied", value: stats.occupied },
          { label: "Vacant", value: stats.vacant },
        ].map((s) => (
          <Card key={s.label} className="gap-1 p-4 shadow-card">
            <p className="text-3xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-primary-soft px-4 py-2 text-sm text-primary">
        New tables will be created in the &quot;{sectionName}&quot; section.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {visibleUnits.map((u) => {
          if (u.kind === "group") {
            const groupGuests = guestCounts[u.group.id] ?? u.group.guests;
            const groupOccupied = groupGuests > 0 || hasActiveOrder(u.group.id);
            const capacity = u.tables.reduce((sum, t) => sum + t.capacity, 0);
            return (
              <Card key={u.group.id} className="gap-3 border-primary/30 p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
                    G
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{u.group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {capacity} seats · {sectionName}
                    </p>
                    <span
                      className={cn(
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                        groupOccupied ? "bg-success-soft text-success" : "bg-muted text-foreground",
                      )}
                    >
                      {groupOccupied ? "Occupied" : "Vacant"}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleMergeGroupSplit(u.group.id)}
                >
                  Split
                </Button>
              </Card>
            );
          }

          const t = u.table;
          const subTable = isSubTable(t);
          const showUnsplit = subTable && canUnsplit(t);
          const tableNumber = t.suffix ? `${t.number}${t.suffix}` : t.number;

          return (
            <Card key={t.id} className="gap-3 p-4 shadow-card">
              <div className="flex items-start gap-3">
                {mergeMode && !subTable && (
                  <Checkbox
                    className="mt-1"
                    checked={selectedForMerge.includes(t.id)}
                    onCheckedChange={(checked) =>
                      setSelectedForMerge((prev) =>
                        checked === true ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                      )
                    }
                    aria-label={`Select ${t.name}`}
                  />
                )}
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-lg text-lg font-bold",
                    t.status === "occupied" || t.status === "bill-requested"
                      ? "bg-success text-success-foreground"
                      : t.status === "reserved"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                  )}
                >
                  {tableNumber}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{t.name}</p>
                  {subTable && <p className="text-[11px] text-muted-foreground">Sub-table</p>}
                  <p className="text-xs text-muted-foreground">
                    {t.capacity} seats · {sectionName}
                  </p>
                  <span
                    className={cn(
                      "mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                      statusStyles[t.status],
                    )}
                  >
                    {statusLabel[t.status]}
                  </span>
                </div>
                {!mergeMode && (
                  <button
                    onClick={() => setEditing(t)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                    aria-label={`Edit ${t.name}`}
                  >
                    <MoreVertical className="size-4" />
                  </button>
                )}
              </div>

              {!mergeMode && (
                <div className="flex gap-2">
                  {t.status === "available" && (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => setStatus(t.id, "occupied")}
                    >
                      Seat Guests
                    </Button>
                  )}
                  {t.status === "reserved" && (
                    <>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => setStatus(t.id, "occupied")}
                      >
                        Seat
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setStatus(t.id, "available")}
                      >
                        Release
                      </Button>
                    </>
                  )}
                  {t.status === "occupied" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => requestBill(t)}
                    >
                      Request Bill
                    </Button>
                  )}
                  {t.status === "bill-requested" && (
                    <Button size="sm" variant="outline" className="flex-1" asChild>
                      <Link to="/billing">Go to Billing</Link>
                    </Button>
                  )}
                  {t.status === "paid" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStatus(t.id, "needs-cleaning")}
                    >
                      Send for Cleaning
                    </Button>
                  )}
                  {t.status === "needs-cleaning" && (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => setStatus(t.id, "available")}
                    >
                      Mark Cleaned
                    </Button>
                  )}
                  {!subTable ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => openSplitDialog(t)}
                    >
                      Split
                    </Button>
                  ) : showUnsplit ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => t.splitGroupId && handleUnsplit(t.splitGroupId)}
                    >
                      Unsplit
                    </Button>
                  ) : null}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Table</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tnum">Table Number</Label>
                <Input
                  id="tnum"
                  type="number"
                  value={editing.number}
                  onChange={(e) => setEditing({ ...editing, number: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tcap">Number of Seats</Label>
                <Input
                  id="tcap"
                  type="number"
                  value={editing.capacity}
                  onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editing) {
                  setTables((prev) =>
                    prev.map((t) =>
                      t.id === editing.id
                        ? {
                            ...editing,
                            name: editing.suffix
                              ? `Table ${editing.number}${editing.suffix}`
                              : `Table ${editing.number}`,
                          }
                        : t,
                    ),
                  );
                }
                setEditing(null);
              }}
            >
              Update Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={splitDialog.open} onOpenChange={(o) => !o && closeSplitDialog()}>
        <DialogContent>
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
                    <SelectItem value="3">3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                {splitDialog.capacities.slice(0, splitDialog.count).map((cap, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <Label htmlFor={`cap-${idx}`}>Sub-table {SUFFIXES[idx]} capacity</Label>
                    <Input
                      id={`cap-${idx}`}
                      type="number"
                      min={1}
                      max={splitDialog.table?.capacity}
                      value={cap}
                      onChange={(e) => {
                        const next = [...splitDialog.capacities];
                        next[idx] = Number(e.target.value);
                        setSplitDialog((prev) => ({ ...prev, capacities: next }));
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Total allocated: {splitTotal} / {splitDialog.table.capacity} seats
              </p>
              {!splitValid && (
                <p className="text-sm text-destructive">
                  Each sub-table needs at least 1 seat and the total cannot exceed the table
                  capacity.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeSplitDialog}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSplit} disabled={!splitValid}>
              Split Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={(o) => !o && setTransferOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Source table</Label>
              <Select value={transferSource} onValueChange={setTransferSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {transferSources.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Destination table</Label>
              <Select value={transferDest} onValueChange={setTransferDest}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {transferDests.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransfer}>Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
