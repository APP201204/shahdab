import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarCheck, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { SECTIONS, type Reservation, type ReservationStatus } from "@/data/seed";
import { cn } from "@/lib/utils";
import { timeOf } from "@/lib/format";
import { useAppState } from "@/lib/app-state";
import { toast } from "sonner";

export const Route = createFileRoute("/reservations")({
  head: () => ({
    meta: [
      { title: "Reservations · SHADAB RestaurantOS" },
      {
        name: "description",
        content: "Table bookings, seating and no-show handling for Shadab Restaurant.",
      },
      { property: "og:title", content: "Reservations · SHADAB RestaurantOS" },
    ],
  }),
  component: Reservations,
});

const statusStyle: Record<ReservationStatus, string> = {
  booked: "bg-primary-soft text-primary",
  seated: "bg-success-soft text-success",
  cancelled: "bg-muted text-muted-foreground",
  "no-show": "bg-danger-soft text-destructive",
};

const statusText: Record<ReservationStatus, string> = {
  booked: "Booked",
  seated: "Seated",
  cancelled: "Cancelled",
  "no-show": "No Show",
};

type Draft = {
  guestName: string;
  phone: string;
  partySize: string;
  time: string;
  sectionId: string;
  tableId: string;
};

const EMPTY: Draft = {
  guestName: "",
  phone: "",
  partySize: "2",
  time: "19:30",
  sectionId: "dine-in",
  tableId: "",
};

function Reservations() {
  const { reservations, setReservations, tables, setTables, notify } = useAppState();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const dineInSections = SECTIONS.filter((s) => s.type === "dine-in");
  const availableTables = tables.filter(
    (t) =>
      t.sectionId === draft.sectionId &&
      t.status === "available" &&
      !t.mergeGroupId &&
      !t.splitGroupId,
  );

  const sorted = [...reservations].sort((a, b) => {
    const order = (s: ReservationStatus) => (s === "booked" ? 0 : s === "seated" ? 1 : 2);
    return order(a.status) - order(b.status) || a.time.localeCompare(b.time);
  });

  const save = () => {
    if (!draft.guestName.trim() || !draft.phone.trim()) {
      toast.error("Guest name and phone are required");
      return;
    }
    const [h, m] = draft.time.split(":").map(Number);
    const when = new Date();
    when.setHours(h ?? 19, m ?? 30, 0, 0);
    const r: Reservation = {
      id: `r${Date.now()}`,
      guestName: draft.guestName.trim(),
      phone: draft.phone.trim(),
      partySize: Math.max(1, Number(draft.partySize) || 1),
      time: when.toISOString(),
      sectionId: draft.sectionId,
      ...(draft.tableId ? { tableId: draft.tableId } : {}),
      status: "booked",
    };
    setReservations((prev) => [...prev, r]);
    if (draft.tableId) {
      setTables((prev) =>
        prev.map((t) => (t.id === draft.tableId ? { ...t, status: "reserved" } : t)),
      );
    }
    toast.success(`Reserved for ${r.guestName} at ${timeOf(r.time)}`);
    setOpen(false);
    setDraft(EMPTY);
  };

  const update = (id: string, status: ReservationStatus, tableId?: string) => {
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    const r = reservations.find((x) => x.id === id);
    const tid = tableId ?? r?.tableId;
    if (tid) {
      setTables((prev) =>
        prev.map((t) =>
          t.id === tid
            ? {
                ...t,
                status: status === "seated" ? "occupied" : "available",
                guests: status === "seated" ? (r?.partySize ?? 2) : 0,
              }
            : t,
        ),
      );
    }
    if (status === "seated" && r)
      notify(`Reservation seated: ${r.guestName} · party of ${r.partySize}`);
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <CalendarCheck className="size-5 text-brand-alt" /> Reservations
          </h1>
          <p className="text-sm text-muted-foreground">
            Bookings, seating and no-show handling for today.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New Reservation
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((r) => {
          const section = SECTIONS.find((s) => s.id === r.sectionId);
          const table = r.tableId ? tables.find((t) => t.id === r.tableId) : undefined;
          return (
            <Card key={r.id} className="gap-3 p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{r.guestName}</h2>
                  <p className="text-xs text-muted-foreground">{r.phone}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    statusStyle[r.status],
                  )}
                >
                  {statusText[r.status]}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-0.5">
                  {timeOf(r.time)} · {r.partySize} guests
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                  <span className="size-2 rounded-full" style={{ background: section?.color }} />
                  {section?.name}
                </span>
                {table && <span className="rounded-full bg-muted px-2 py-0.5">{table.name}</span>}
              </div>
              {r.status === "booked" && (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => update(r.id, "seated")}>
                    Seat
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => update(r.id, "no-show")}
                  >
                    No Show
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-destructive"
                    onClick={() => update(r.id, "cancelled")}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Reservation</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gname">Guest Name</Label>
              <Input
                id="gname"
                value={draft.guestName}
                onChange={(e) => setDraft({ ...draft, guestName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gphone">Phone</Label>
              <Input
                id="gphone"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gsize">Party Size</Label>
              <Input
                id="gsize"
                type="number"
                min={1}
                value={draft.partySize}
                onChange={(e) => setDraft({ ...draft, partySize: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gtime">Time</Label>
              <Input
                id="gtime"
                type="time"
                value={draft.time}
                onChange={(e) => setDraft({ ...draft, time: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Select
                value={draft.sectionId}
                onValueChange={(v) => setDraft({ ...draft, sectionId: v, tableId: "" })}
              >
                <SelectTrigger>
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
            <div className="space-y-1.5">
              <Label>Table (optional)</Label>
              <Select
                value={draft.tableId}
                onValueChange={(v) => setDraft({ ...draft, tableId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign later" />
                </SelectTrigger>
                <SelectContent>
                  {availableTables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {t.capacity} seats
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Create Reservation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
