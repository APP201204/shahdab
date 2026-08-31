import { useMemo, useState } from "react";
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
import { getFirstError, reservationSchema } from "@/lib/validation";
import { endOfDay, format, isAfter, isToday, parseISO } from "date-fns";
import type { Reservation, Table } from "@/types";

type Message = { type: "error" | "success"; text: string } | null;
type View = "today" | "upcoming";

export function ReservationsPage() {
  const { staff, outlet, organization } = useAuth();
  const [version, setVersion] = useState(0);
  const [view, setView] = useState<View>("today");
  const [message, setMessage] = useState<Message>(null);

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [reservationTime, setReservationTime] = useState("");
  const [floorId, setFloorId] = useState("");
  const [tableId, setTableId] = useState("");

  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignTableId, setAssignTableId] = useState("");

  if (!staff || !outlet || !organization) return null;

  const now = new Date();

  const reservations = useMemo(() => {
    return db.reservations
      .filter(
        (r) =>
          r.organization_id === organization.id &&
          r.outlet_id === outlet.id &&
          (view === "today"
            ? isToday(parseISO(r.reservation_time))
            : isAfter(parseISO(r.reservation_time), endOfDay(now)))
      )
      .sort(
        (a, b) =>
          new Date(a.reservation_time).getTime() -
          new Date(b.reservation_time).getTime()
      );
  }, [version, view, organization.id, outlet.id, now]);

  const floors = useMemo(
    () =>
      db.floors
        .filter((f) => f.outlet_id === outlet.id)
        .sort((a, b) => a.display_order - b.display_order),
    [outlet.id]
  );

  const tablesForFloor = (fid: string) =>
    db.tables.filter(
      (t) =>
        t.floor_id === fid &&
        t.organization_id === organization.id &&
        t.outlet_id === outlet.id
    );

  const vacantTables = (fid: string) =>
    tablesForFloor(fid).filter((t) => t.status === "vacant");

  const create = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const parsed = reservationSchema.safeParse({
      guest_name: guestName,
      guest_phone: guestPhone,
      party_size: partySize,
      reservation_time: reservationTime,
      floor_id: floorId,
      table_id: tableId || null,
    });
    if (!parsed.success) {
      setMessage({ type: "error", text: getFirstError(parsed) });
      return;
    }
    const floor = db.floors.find((f) => f.id === floorId);
    if (!floor) return;

    let table: Table | undefined;
    if (tableId) {
      table = db.tables.find((t) => t.id === tableId);
      if (!table) {
        setMessage({ type: "error", text: "Selected table not found" });
        return;
      }
      if (table.status !== "vacant") {
        setMessage({ type: "error", text: "Selected table is not vacant" });
        return;
      }
      if (table.capacity < Number(partySize)) {
        setMessage({
          type: "error",
          text: "Table capacity is less than party size",
        });
        return;
      }
    }

    const reservation = dataService("reservations").create({
      organization_id: organization.id,
      outlet_id: outlet.id,
      floor_id: floorId,
      table_id: tableId || null,
      guest_name: guestName.trim(),
      guest_phone: guestPhone.trim(),
      party_size: Number(partySize) || 1,
      reservation_time: new Date(reservationTime).toISOString(),
      status: "booked",
      created_by: staff.id,
      created_at: new Date().toISOString(),
    });

    if (table) {
      dataService("tables").update(table.id, { status: "reserved" });
    }

    setVersion((v) => v + 1);
    setGuestName("");
    setGuestPhone("");
    setPartySize("2");
    setReservationTime("");
    setFloorId("");
    setTableId("");
    setMessage({
      type: "success",
      text: `Reservation created for ${reservation.guest_name}`,
    });
  };

  const setTable = (reservation: Reservation) => {
    if (!assignTableId) return;
    const table = db.tables.find((t) => t.id === assignTableId);
    if (!table) return;
    if (table.status !== "vacant") {
      setMessage({ type: "error", text: "Selected table is not vacant" });
      return;
    }
    dataService("reservations").update(reservation.id, {
      table_id: assignTableId,
    });
    dataService("tables").update(assignTableId, { status: "reserved" });
    setAssigning(null);
    setAssignTableId("");
    setVersion((v) => v + 1);
    setMessage({ type: "success", text: "Table assigned" });
  };

  const seat = (reservation: Reservation) => {
    if (!reservation.table_id) {
      setMessage({ type: "error", text: "Assign a table before seating" });
      return;
    }
    const table = db.tables.find((t) => t.id === reservation.table_id);
    if (!table) return;
    if (table.status !== "reserved") {
      setMessage({ type: "error", text: "Table is not reserved" });
      return;
    }
    dataService("reservations").update(reservation.id, { status: "seated" });
    const now = new Date();
    dataService("tables").update(table.id, {
      status: "occupied",
      occupied_at: now.toISOString(),
      occupied_by_count: reservation.party_size,
      expected_vacant_at: new Date(
        now.getTime() + reservation.party_size * table.avg_time_per_person * 60_000
      ).toISOString(),
    });
    setVersion((v) => v + 1);
    setMessage({ type: "success", text: "Guest seated" });
  };

  const noShow = (reservation: Reservation) => {
    dataService("reservations").update(reservation.id, { status: "no_show" });
    if (reservation.table_id) {
      const table = db.tables.find((t) => t.id === reservation.table_id);
      if (table && table.status === "reserved") {
        dataService("tables").update(table.id, { status: "vacant" });
      }
    }
    setVersion((v) => v + 1);
    setMessage({ type: "success", text: "Marked as no show" });
  };

  const cancel = (reservation: Reservation) => {
    dataService("reservations").update(reservation.id, {
      status: "cancelled",
    });
    if (reservation.table_id) {
      const table = db.tables.find((t) => t.id === reservation.table_id);
      if (table && table.status === "reserved") {
        dataService("tables").update(table.id, { status: "vacant" });
      }
    }
    setVersion((v) => v + 1);
    setMessage({ type: "success", text: "Reservation cancelled" });
  };


  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reservations</h1>

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

      <section className="rounded-md border p-4">
        <h2 className="mb-3 text-lg font-semibold">New Booking</h2>
        <form
          onSubmit={create}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input
            className={inputClass}
            placeholder="Guest name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Phone"
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
          />
          <input
            className={inputClass}
            type="number"
            min={1}
            placeholder="Party size"
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
          />
          <input
            className={inputClass}
            type="datetime-local"
            value={reservationTime}
            onChange={(e) => setReservationTime(e.target.value)}
          />
          <select
            className={inputClass}
            value={floorId}
            onChange={(e) => {
              setFloorId(e.target.value);
              setTableId("");
            }}
          >
            <option value="">Select floor</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
            disabled={!floorId}
          >
            <option value="">Any table (unassigned)</option>
            {floorId &&
              vacantTables(floorId).map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.table_number} (cap {t.capacity})
                </option>
              ))}
          </select>
          <div className="sm:col-span-2 lg:col-span-2">
            <Button type="submit">Create Booking</Button>
          </div>
        </form>
      </section>

      <div className={tabList} role="tablist" aria-label="Reservations view">
        <button
          role="tab"
          aria-selected={view === "today"}
          onClick={() => setView("today")}
          className={cn(
            tabButton,
            view === "today" ? tabButtonActive : tabButtonInactive
          )}
        >
          Today
        </button>
        <button
          role="tab"
          aria-selected={view === "upcoming"}
          onClick={() => setView("upcoming")}
          className={cn(
            tabButton,
            view === "upcoming" ? tabButtonActive : tabButtonInactive
          )}
        >
          Upcoming
        </button>
      </div>

      <section className="space-y-3">
        {reservations.length === 0 ? (
          <EmptyState
            title="No reservations"
            description="There are no reservations for the selected view."
          />
        ) : (
          reservations.map((r) => {
            const floor = db.floors.find((f) => f.id === r.floor_id);
            const table = r.table_id
              ? db.tables.find((t) => t.id === r.table_id)
              : undefined;
            const canAct = r.status === "booked";
            return (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.guest_name}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {r.guest_phone} • {r.party_size} guests
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(r.reservation_time), "PPp")} • {floor?.name}
                    {table
                      ? ` • Table ${table.table_number}`
                      : " • No table assigned"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.table_id === null && canAct && (
                    <div className="flex items-center gap-2">
                      <select
                        className={inputClass}
                        value={assigning === r.id ? assignTableId : ""}
                        onChange={(e) => {
                          setAssigning(r.id);
                          setAssignTableId(e.target.value);
                        }}
                      >
                        <option value="">Assign table</option>
                        {vacantTables(r.floor_id).map((t) => (
                          <option key={t.id} value={t.id}>
                            Table {t.table_number}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        onClick={() => setTable(r)}
                        disabled={!assignTableId || assigning !== r.id}
                      >
                        Assign
                      </Button>
                    </div>
                  )}
                  {canAct && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => seat(r)}
                        disabled={!r.table_id}
                      >
                        Seat
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => noShow(r)}
                      >
                        No Show
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => cancel(r)}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
