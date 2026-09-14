import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { useTables } from "@/hooks/useTables";
import { useTableGroups } from "@/hooks/useTableGroups";
import { useSections } from "@/hooks/useSections";
import { useStaff } from "@/hooks/useStaff";
import {
  useSeatTable,
  useMarkCleaned,
  useNeedsCleaning,
  useRequestBill,
  useMergeTables,
  useReleaseMerge,
  useSplitTable,
  useUnsplitTable,
  useMoveTable,
  useUpdateTable,
} from "@/hooks/useTableActions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Table, TableMergeGroup, TableSplitGroup } from "@/lib/api";

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

type TableStatus = Table["status"];

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

const OUTLET = "SHADAB";

function defaultCapacities(table: Table, count: number) {
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
  | { kind: "table"; table: Table }
  | { kind: "group"; group: TableMergeGroup; tables: Table[] };

function TableManagement() {
  const { data: tablesData } = useTables(OUTLET);
  const { data: groupsData } = useTableGroups(OUTLET);
  const { data: sectionsData } = useSections(OUTLET);
  const { data: staffData } = useStaff(OUTLET);

  const tables = tablesData?.tables ?? [];
  const mergeGroups = groupsData?.mergeGroups ?? [];
  const splitGroups = groupsData?.splitGroups ?? [];
  const sections = sectionsData?.sections ?? [];
  const staff = staffData?.staff ?? [];

  const [sectionId, setSectionId] = useState("dine-in");
  const [editing, setEditing] = useState<Table | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSource, setTransferSource] = useState("");
  const [transferDest, setTransferDest] = useState("");
  const [splitDialog, setSplitDialog] = useState<{
    open: boolean;
    table: Table | null;
    count: 2 | 3;
    capacities: number[];
  }>({ open: false, table: null, count: 2, capacities: [0, 0] });

  const section = sections.find((s) => s.id === sectionId);
  const sectionName = section?.name ?? "";
  const sectionColor = section?.color;

  const tableById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  const splitById = useMemo(() => new Map(splitGroups.map((g) => [g.id, g])), [splitGroups]);

  const isSplitTable = (t: Table) => t.splitGroupId && !t.parentTableId;
  const isSubTable = (t: Table) => !!t.parentTableId;

  const visibleUnits = useMemo<Unit[]>(() => {
    const activeGroups = mergeGroups.filter((g) => g.status === "active" && g.sectionId === sectionId);
    const visibleTables = tables.filter(
      (t) => t.sectionId === sectionId && !t.mergeGroupId && !isSplitTable(t),
    );
    const units: Unit[] = visibleTables.map((t) => ({ kind: "table", table: t }));
    activeGroups.forEach((g) => {
      units.push({
        kind: "group",
        group: g,
        tables: g.tableIds.map((id) => tableById.get(id)).filter(Boolean) as Table[],
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
  }, [tables, mergeGroups, sectionId, tableById]);

  const stats = useMemo(() => {
    const total = visibleUnits.length;
    const occupied = visibleUnits.filter((u) => {
      if (u.kind === "table") {
        return u.table.guests > 0 || u.table.status === "occupied" || u.table.status === "bill-requested";
      }
      return u.group.guests > 0 || u.tables.some((t) => t.status !== "available" && t.status !== "reserved");
    }).length;
    return { total, occupied, vacant: total - occupied };
  }, [visibleUnits]);

  const seat = useSeatTable();
  const markCleaned = useMarkCleaned();
  const needsCleaning = useNeedsCleaning();
  const requestBill = useRequestBill();
  const merge = useMergeTables();
  const releaseMerge = useReleaseMerge();
  const split = useSplitTable();
  const unsplit = useUnsplitTable();
  const move = useMoveTable();
  const updateTable = useUpdateTable();

  const setStatus = (id: string, status: TableStatus) => {
    const table = tableById.get(id);
    if (!table) return;
    if (status === "occupied") {
      seat.mutate({ id, guests: 2 }, { onError: (err: any) => toast.error(err?.message ?? "Could not seat") });
    } else if (status === "available") {
      markCleaned.mutate(id, { onError: (err: any) => toast.error(err?.message ?? "Could not release") });
    } else if (status === "needs-cleaning") {
      needsCleaning.mutate(id, { onError: (err: any) => toast.error(err?.message ?? "Could not send for cleaning") });
    }
  };

  const handleRequestBill = (t: Table) => {
    requestBill.mutate(t.id, { onError: (err: any) => toast.error(err?.message ?? "Could not request bill") });
  };

  const handleMerge = () => {
    if (selectedForMerge.length < 2) {
      toast.error("Select at least 2 tables to merge");
      return;
    }
    merge.mutate(
      { tableIds: selectedForMerge },
      {
        onSuccess: () => {
          setMergeMode(false);
          setSelectedForMerge([]);
          toast.success("Tables merged");
        },
        onError: (err: any) => toast.error(err?.message ?? "Could not merge"),
      }
    );
  };

  const handleMergeGroupSplit = (groupId: string) => {
    releaseMerge.mutate(groupId, {
      onSuccess: () => toast.success("Merge group released"),
      onError: (err: any) => toast.error(err?.message ?? "Could not release merge"),
    });
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
    split.mutate(
      { tableId: table.id, subTables: capacities.map((capacity) => ({ capacity })) },
      {
        onSuccess: () => {
          closeSplitDialog();
          toast.success(`${table.name} split`);
        },
        onError: (err: any) => toast.error(err?.message ?? "Could not split"),
      }
    );
  };

  const canUnsplit = (t: Table) => {
    if (t.suffix !== "a") return false;
    const group = t.splitGroupId ? splitById.get(t.splitGroupId) : undefined;
    if (!group || group.status !== "active") return false;
    return true;
  };

  const handleUnsplit = (groupId: string) => {
    unsplit.mutate(groupId, {
      onSuccess: () => toast.success("Table restored"),
      onError: (err: any) => toast.error(err?.message ?? "Could not unsplit"),
    });
  };

  const handleTransfer = () => {
    if (!transferSource || !transferDest || transferSource === transferDest) {
      toast.error("Choose different source and destination tables");
      return;
    }
    move.mutate(
      { from: transferSource, to: transferDest },
      {
        onSuccess: () => {
          setTransferOpen(false);
          setTransferSource("");
          setTransferDest("");
          toast.success("Booking moved");
        },
        onError: (err: any) => toast.error(err?.message ?? "Could not transfer"),
      }
    );
  };

  const transferSources = tables.filter(
    (t) => !t.mergeGroupId && !t.splitGroupId && !t.parentTableId,
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
    !!splitDialog.table &&
    splitDialog.capacities.slice(0, splitDialog.count).every((c) => c > 0) &&
    splitTotal <= splitDialog.table.capacity;

  const dineInSections = sections.filter((s) => s.type === "dine-in");

  const handleUpdateTable = () => {
    if (!editing) return;
    const name = editing.suffix
      ? `Table ${editing.number}${editing.suffix}`
      : `Table ${editing.number}`;
    updateTable.mutate(
      { id: editing.id, number: editing.number, capacity: editing.capacity, name },
      {
        onSuccess: () => {
          setEditing(null);
          toast.success("Table updated");
        },
        onError: (err: any) => toast.error(err?.message ?? "Could not update"),
      }
    );
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Table Management</h1>
          <p className="text-sm text-muted-foreground">Floor plan, statuses and seating for every room.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mergeMode ? (
            <>
              <span className="text-sm text-muted-foreground">{selectedForMerge.length} selected</span>
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
              {dineInSections.map((s) => (
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
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-primary-soft px-4 py-2 text-sm text-primary">
        New tables will be created in the &quot;{sectionName}&quot; section.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {visibleUnits.map((u) => {
          if (u.kind === "group") {
            const groupOccupied =
              u.group.guests > 0 ||
              u.tables.some((t) => t.status !== "available" && t.status !== "reserved");
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
                        groupOccupied ? "bg-success-soft text-success" : "bg-muted text-foreground"
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
                        checked === true ? [...prev, t.id] : prev.filter((id) => id !== t.id)
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
                      : "bg-muted text-foreground"
                  )}
                >
                  {tableNumber}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{t.name}</p>
                  {subTable && <p className="text-[11px] text-muted-foreground">Sub-table</p>}
                  <p className="text-xs text-muted-foreground">
                    {t.capacity} seats · {sectionName}
                    {t.waiter ? ` · ${t.waiter}` : ""}
                  </p>
                  <span
                    className={cn(
                      "mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                      statusStyles[t.status]
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
                    <Button size="sm" className="flex-1" onClick={() => setStatus(t.id, "occupied")}>
                      Seat Guests
                    </Button>
                  )}
                  {t.status === "reserved" && (
                    <>
                      <Button size="sm" className="flex-1" onClick={() => setStatus(t.id, "occupied")}>
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
                      onClick={() => handleRequestBill(t)}
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
                    <Button size="sm" className="flex-1" onClick={() => setStatus(t.id, "available")}>
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
              <div className="space-y-1.5">
                <Label htmlFor="twaiter">Waiter</Label>
                <Select
                  value={editing.waiterId ?? ""}
                  onValueChange={(v) => setEditing({ ...editing, waiterId: v || null })}
                >
                  <SelectTrigger id="twaiter">
                    <SelectValue placeholder="No waiter" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTable}>Update Table</Button>
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
                  Each sub-table needs at least 1 seat and the total cannot exceed the table capacity.
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
