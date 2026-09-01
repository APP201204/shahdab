import { dataService, db } from "@/mocks/db";
import { sendWhatsapp } from "@/services/whatsapp";
import type { Table, WaitlistEntry } from "@/types";

export function activeWaitlist(outletId: string): WaitlistEntry[] {
  return db.waitlist
    .filter(
      (e) =>
        e.outlet_id === outletId &&
        (e.status === "waiting" || e.status === "notified")
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
}

function getTablesForWaitlist(outletId: string): Table[] {
  return db.tables.filter((t) => t.outlet_id === outletId && t.is_active);
}

export function estimatedWaitMinutes(
  outletId: string,
  partySize: number,
  now = new Date()
): number {
  const tables = getTablesForWaitlist(outletId);
  const active = activeWaitlist(outletId);
  const hasVacant = tables.some(
    (t) => t.status === "vacant" && t.capacity >= partySize
  );
  if (hasVacant) return 0;

  const releasing = tables
    .filter(
      (t) =>
        t.expected_vacant_at !== null &&
        t.capacity >= partySize
    )
    .map((t) => new Date(t.expected_vacant_at!).getTime())
    .sort((a, b) => a - b);

  const waitingCount = active.filter((e) => e.status === "waiting").length;
  if (releasing.length === 0) return 0;
  const index = Math.min(waitingCount, releasing.length - 1);
  const diff = Math.max(
    0,
    Math.ceil((releasing[index] - now.getTime()) / 60_000)
  );
  return diff;
}

export function addToWaitlist(
  entry: Omit<
    WaitlistEntry,
    "id" | "estimated_wait_minutes" | "status" | "table_id" | "notified_at" | "seated_at"
  >
): WaitlistEntry {
  const wait = estimatedWaitMinutes(entry.outlet_id, entry.party_size);
  return dataService("waitlist").create({
    ...entry,
    status: "waiting",
    estimated_wait_minutes: wait,
    table_id: null,
    notified_at: null,
    seated_at: null,
  });
}

export async function notifyNextCustomer(
  table: Table
): Promise<WaitlistEntry | null> {
  const waiting = activeWaitlist(table.outlet_id).filter(
    (e) => e.status === "waiting" && e.party_size <= table.capacity
  );
  const next = waiting[0];
  if (!next) return null;
  await sendWhatsapp(
    next.customer_phone,
    `Hi ${next.customer_name}, your table is ready for a party of ${next.party_size}. Please check in with the host.`
  );
  const now = new Date().toISOString();
  dataService("waitlist").update(next.id, {
    status: "notified",
    table_id: table.id,
    notified_at: now,
  });
  return dataService("waitlist").findById(next.id) ?? null;
}

export function seatWaitlistEntry(
  entry: WaitlistEntry,
  table: Table
): WaitlistEntry | null {
  if (table.status !== "vacant" || table.capacity < entry.party_size)
    return null;
  const now = new Date();
  const expectedVacantAt = new Date(
    now.getTime() + entry.party_size * table.avg_time_per_person * 60_000
  ).toISOString();
  dataService("tables").update(table.id, {
    status: "occupied",
    occupied_at: now.toISOString(),
    occupied_by_count: entry.party_size,
    expected_vacant_at: expectedVacantAt,
  });
  dataService("waitlist").update(entry.id, {
    status: "seated",
    table_id: table.id,
    seated_at: now.toISOString(),
  });
  return dataService("waitlist").findById(entry.id) ?? null;
}

export async function markTableVacant(
  tableId: string
): Promise<WaitlistEntry | null> {
  const table = dataService("tables").findById(tableId);
  if (!table) return null;
  dataService("tables").update(table.id, {
    status: "vacant",
    occupied_at: null,
    occupied_by_count: null,
    expected_vacant_at: null,
  });
  return notifyNextCustomer(table);
}

export function cancelWaitlistEntry(entryId: string): WaitlistEntry | null {
  const entry = dataService("waitlist").findById(entryId);
  if (!entry) return null;
  dataService("waitlist").update(entry.id, { status: "cancelled" });
  return dataService("waitlist").findById(entry.id) ?? null;
}

export function noShowWaitlistEntry(entryId: string): WaitlistEntry | null {
  const entry = dataService("waitlist").findById(entryId);
  if (!entry) return null;
  dataService("waitlist").update(entry.id, { status: "no_show" });
  return dataService("waitlist").findById(entry.id) ?? null;
}
