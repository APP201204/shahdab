import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { inputClass, messageBanner } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { db } from "@/mocks/db";
import { EmptyState } from "@/components/EmptyState";
import {
  activeWaitlist,
  cancelWaitlistEntry,
  noShowWaitlistEntry,
  seatWaitlistEntry,
} from "@/services/waitlist";
import { format, parseISO } from "date-fns";
import type { Table, WaitlistEntry } from "@/types";

type Message = { type: "error" | "success"; text: string } | null;

export function WaitlistPage() {
  const { outlet } = useAuth();
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<Message>(null);
  const [tableIds, setTableIds] = useState<Record<string, string>>({});

  if (!outlet) return null;

  const entries = useMemo(
    () => activeWaitlist(outlet.id),
    [outlet.id, version]
  );

  const vacantTables = useMemo(
    () =>
      db.tables
        .filter(
          (t) =>
            t.outlet_id === outlet.id && t.is_active && t.status === "vacant"
        )
        .sort((a, b) => Number(a.table_number) - Number(b.table_number)),
    [outlet.id, version]
  );

  const seat = (entry: WaitlistEntry) => {
    setMessage(null);
    const tableId = tableIds[entry.id];
    if (!tableId) {
      setMessage({ type: "error", text: "Select a table first" });
      return;
    }
    const table = db.tables.find((t) => t.id === tableId);
    if (!table) {
      setMessage({ type: "error", text: "Table not found" });
      return;
    }
    const result = seatWaitlistEntry(entry, table);
    if (!result) {
      setMessage({
        type: "error",
        text: "Table is no longer available or too small",
      });
      return;
    }
    setMessage({
      type: "success",
      text: `Seated ${entry.customer_name} at Table ${table.table_number}`,
    });
    setVersion((v) => v + 1);
  };

  const cancel = (entry: WaitlistEntry) => {
    cancelWaitlistEntry(entry.id);
    setMessage({ type: "success", text: "Removed from queue" });
    setVersion((v) => v + 1);
  };

  const noShow = (entry: WaitlistEntry) => {
    noShowWaitlistEntry(entry.id);
    setMessage({ type: "success", text: "Marked as no show" });
    setVersion((v) => v + 1);
  };

  const tableName = (t: Table | undefined) =>
    t ? `Table ${t.table_number} (cap ${t.capacity})` : "";

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Waitlist</h1>

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

      {entries.length === 0 && (
        <EmptyState
          title="No one is waiting"
          description="The queue is empty. Customers who scan the QR code will appear here."
        />
      )}

      <div className="grid gap-2">
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className="rounded-md border bg-card p-3 shadow-sm"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-0.5">
                <p className="font-semibold leading-tight">
                  #{index + 1} {entry.customer_name}
                </p>
                <p className="text-sm leading-tight text-muted-foreground">
                  {entry.customer_phone} · {entry.party_size} people
                </p>
                <p className="text-xs leading-tight text-muted-foreground">
                  Joined {format(parseISO(entry.created_at), "h:mm a")} ·
                  status: {entry.status}
                </p>
                {entry.table_id && (
                  <p className="text-xs leading-tight text-muted-foreground">
                    Held table: {tableName(db.tables.find((t) => t.id === entry.table_id))}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                <select
                  className={cn(inputClass, "w-auto min-w-[10rem] py-1.5")}
                  value={tableIds[entry.id] ?? ""}
                  onChange={(e) =>
                    setTableIds((prev) => ({
                      ...prev,
                      [entry.id]: e.target.value,
                    }))
                  }
                  aria-label={`Select table for ${entry.customer_name}`}
                >
                  <option value="">Select a table</option>
                  {vacantTables
                    .filter((t) => t.capacity >= entry.party_size)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {tableName(t)}
                      </option>
                    ))}
                </select>
                <Button size="sm" onClick={() => seat(entry)}>
                  Seat
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => noShow(entry)}
                >
                  No Show
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => cancel(entry)}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
