import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import { emitTableUpdate, emitReservationUpdate } from "./events.ts";

export async function createReservation(input: {
  outletId: string;
  guestName: string;
  phone: string;
  partySize: number;
  time: Date;
  sectionId: string;
  tableId?: string;
}) {
  return db.transaction(async (tx) => {
    if (input.tableId) {
      const [table] = await tx
        .select()
        .from(schema.tables)
        .where(eq(schema.tables.id, input.tableId))
        .for("update");
      if (!table) throw new Error("table not found");
      if (table.status !== "available") {
        throw new Error("table is not available for reservation");
      }
      await tx
        .update(schema.tables)
        .set({ status: "reserved" })
        .where(eq(schema.tables.id, input.tableId));
      emitTableUpdate(table.outletId, { ...table, status: "reserved" });
    }

    const [reservation] = await tx
      .insert(schema.reservations)
      .values({
        id: randomUUID(),
        ...input,
        status: "booked",
      })
      .returning();
    emitReservationUpdate(input.outletId, reservation);
    return reservation;
  });
}

export async function seatReservation({
  reservationId,
  waiterId,
}: {
  reservationId: string;
  waiterId?: string;
}) {
  return db.transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(schema.reservations)
      .where(eq(schema.reservations.id, reservationId))
      .for("update");
    if (!reservation) throw new Error("reservation not found");
    if (reservation.status !== "booked") {
      throw new Error("reservation is not booked");
    }

    if (!reservation.tableId) {
      throw new Error("reservation has no assigned table");
    }

    const [table] = await tx
      .select()
      .from(schema.tables)
      .where(eq(schema.tables.id, reservation.tableId))
      .for("update");
    if (!table) throw new Error("table not found");

    const [updatedTable] = await tx
      .update(schema.tables)
      .set({
        status: "occupied",
        guests: reservation.partySize,
        waiterId: waiterId ?? null,
        startedAt: new Date(),
      })
      .where(eq(schema.tables.id, table.id))
      .returning();

    await tx.insert(schema.orders).values({
      id: randomUUID(),
      outletId: reservation.outletId,
      sectionId: reservation.sectionId,
      tableId: table.id,
      orderType: "dine-in",
      status: "open",
    });

    const [updated] = await tx
      .update(schema.reservations)
      .set({ status: "seated" })
      .where(eq(schema.reservations.id, reservationId))
      .returning();

    emitTableUpdate(updatedTable.outletId, updatedTable);
    emitReservationUpdate(reservation.outletId, updated);
    return updated;
  });
}

export async function cancelReservation({ reservationId }: { reservationId: string }) {
  return db.transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(schema.reservations)
      .where(eq(schema.reservations.id, reservationId))
      .for("update");
    if (!reservation) throw new Error("reservation not found");
    if (reservation.status !== "booked") {
      throw new Error("reservation cannot be cancelled");
    }

    if (reservation.tableId) {
      await tx
        .update(schema.tables)
        .set({ status: "available" })
        .where(eq(schema.tables.id, reservation.tableId));
      const [table] = await tx
        .select()
        .from(schema.tables)
        .where(eq(schema.tables.id, reservation.tableId));
      if (table) emitTableUpdate(table.outletId, table);
    }

    const [updated] = await tx
      .update(schema.reservations)
      .set({ status: "cancelled" })
      .where(eq(schema.reservations.id, reservationId))
      .returning();
    emitReservationUpdate(reservation.outletId, updated);
    return updated;
  });
}

export async function noShowReservation({ reservationId }: { reservationId: string }) {
  return db.transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(schema.reservations)
      .where(eq(schema.reservations.id, reservationId))
      .for("update");
    if (!reservation) throw new Error("reservation not found");
    if (reservation.status !== "booked") {
      throw new Error("reservation cannot be marked no-show");
    }

    if (reservation.tableId) {
      await tx
        .update(schema.tables)
        .set({ status: "available" })
        .where(eq(schema.tables.id, reservation.tableId));
      const [table] = await tx
        .select()
        .from(schema.tables)
        .where(eq(schema.tables.id, reservation.tableId));
      if (table) emitTableUpdate(table.outletId, table);
    }

    const [updated] = await tx
      .update(schema.reservations)
      .set({ status: "no-show" })
      .where(eq(schema.reservations.id, reservationId))
      .returning();
    emitReservationUpdate(reservation.outletId, updated);
    return updated;
  });
}

export async function listReservations({
  outletId,
  sectionId,
  status,
}: {
  outletId: string;
  sectionId?: string;
  status?: string;
}) {
  const conditions = [eq(schema.reservations.outletId, outletId)];
  if (sectionId) conditions.push(eq(schema.reservations.sectionId, sectionId));
  if (status) conditions.push(eq(schema.reservations.status, status as any));

  return db
    .select()
    .from(schema.reservations)
    .where(and(...conditions))
    .orderBy(schema.reservations.time);
}
