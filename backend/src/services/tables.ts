import { eq, and, inArray, ne, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import { emitTableUpdate } from "./events.ts";
import * as notifications from "./notifications.ts";

export async function seatTable({
  tableId,
  guests,
  waiterId,
}: {
  tableId: string;
  guests: number;
  waiterId?: string;
}) {
  return db.transaction(async (tx) => {
    const [table] = await tx
      .select()
      .from(schema.tables)
      .where(eq(schema.tables.id, tableId))
      .for("update");
    if (!table) throw new Error("table not found");

    if (table.status === "occupied") {
      if (guests < 0) throw new Error("guests cannot be negative");
      let [order] = await tx
        .select()
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.tableId, tableId),
            inArray(schema.orders.status, ["open", "partially-served", "fully-served"])
          )
        )
        .orderBy(schema.orders.createdAt)
        .limit(1);

      if (guests === 0) {
        const hasItems = order
          ? await tx
              .select({ id: schema.orderItems.id })
              .from(schema.orderItems)
              .where(
                and(
                  eq(schema.orderItems.orderId, order.id),
                  ne(schema.orderItems.tableStatus, "cancelled")
                )
              )
              .limit(1)
          : [];
        if (!order || hasItems.length === 0) {
          if (order) {
            await tx
              .update(schema.orders)
              .set({ status: "closed", closedAt: new Date() })
              .where(eq(schema.orders.id, order.id));
          }
          const [released] = await tx
            .update(schema.tables)
            .set({
              status: "available",
              guests: 0,
              waiterId: null,
              startedAt: null,
              kots: 0,
            })
            .where(eq(schema.tables.id, tableId))
            .returning();
          emitTableUpdate(released.outletId, released);
          return { table: released, order: null };
        }
      }

      const [updated] = await tx
        .update(schema.tables)
        .set({ guests })
        .where(eq(schema.tables.id, tableId))
        .returning();
      if (!order && guests > 0) {
        const [created] = await tx
          .insert(schema.orders)
          .values({
            id: randomUUID(),
            outletId: updated.outletId,
            sectionId: updated.sectionId,
            tableId: updated.id,
            orderType: "dine-in",
            status: "open",
          })
          .returning();
        order = created;
      }
      emitTableUpdate(updated.outletId, updated);
      return { table: updated, order: order ? { id: order.id } : null };
    }

    if (!["available", "reserved"].includes(table.status)) {
      throw new Error("table cannot be seated");
    }

    if (guests < 1) throw new Error("at least one guest is required to seat a table");

    if (table.status === "reserved") {
      await tx
        .update(schema.reservations)
        .set({ status: "seated" })
        .where(
          and(
            eq(schema.reservations.tableId, tableId),
            eq(schema.reservations.status, "booked")
          )
        );
    }

    const [updated] = await tx
      .update(schema.tables)
      .set({
        status: "occupied",
        guests,
        waiterId: waiterId ?? null,
        startedAt: new Date(),
      })
      .where(eq(schema.tables.id, tableId))
      .returning();

    const [order] = await tx
      .insert(schema.orders)
      .values({
        id: randomUUID(),
        outletId: updated.outletId,
        sectionId: updated.sectionId,
        tableId: updated.id,
        orderType: "dine-in",
        status: "open",
      })
      .returning();

    emitTableUpdate(updated.outletId, updated);
    return { table: updated, order: { id: order.id } };
  });
}

export async function requestBill({ tableId }: { tableId: string }) {
  return db.transaction(async (tx) => {
    const [table] = await tx
      .select()
      .from(schema.tables)
      .where(eq(schema.tables.id, tableId))
      .for("update");
    if (!table) throw new Error("table not found");
    if (!["occupied", "fully-served"].includes(table.status)) {
      throw new Error("bill can only be requested for an occupied table");
    }
    const [updated] = await tx
      .update(schema.tables)
      .set({ status: "bill-requested" })
      .where(eq(schema.tables.id, tableId))
      .returning();
    emitTableUpdate(updated.outletId, updated);

    await notifications.createAndNotify({
      outletId: updated.outletId,
      room: `outlet:${updated.outletId}:billing:${updated.sectionId}`,
      message: `Bill requested for ${updated.name}`,
    });

    if (updated.waiterId) {
      const [waiter] = await tx
        .select()
        .from(schema.staff)
        .where(eq(schema.staff.id, updated.waiterId));
      if (waiter?.userId) {
        await notifications.createAndNotify({
          outletId: updated.outletId,
          room: `waiter:${waiter.id}`,
          message: `Bill requested for ${updated.name}`,
          userId: waiter.userId,
        });
      }
    }

    return updated;
  });
}

export async function markNeedsCleaning({ tableId }: { tableId: string }) {
  return db.transaction(async (tx) => {
    const [table] = await tx
      .select()
      .from(schema.tables)
      .where(eq(schema.tables.id, tableId))
      .for("update");
    if (!table) throw new Error("table not found");
    if (table.status !== "paid") {
      throw new Error("table must be paid before marking needs cleaning");
    }
    const [updated] = await tx
      .update(schema.tables)
      .set({ status: "needs-cleaning" })
      .where(eq(schema.tables.id, tableId))
      .returning();
    emitTableUpdate(updated.outletId, updated);
    return updated;
  });
}

export async function markCleaned({ tableId }: { tableId: string }) {
  return db.transaction(async (tx) => {
    const [table] = await tx
      .select()
      .from(schema.tables)
      .where(eq(schema.tables.id, tableId))
      .for("update");
    if (!table) throw new Error("table not found");
    if (table.status !== "needs-cleaning") {
      throw new Error("table must need cleaning before marking cleaned");
    }
    const [updated] = await tx
      .update(schema.tables)
      .set({
        status: "available",
        guests: 0,
        waiterId: null,
        startedAt: null,
        kots: 0,
      })
      .where(eq(schema.tables.id, tableId))
      .returning();
    emitTableUpdate(updated.outletId, updated);
    return updated;
  });
}

export async function mergeTables({
  tableIds,
  guests,
  waiterId,
  name,
}: {
  tableIds: string[];
  guests?: number;
  waiterId?: string;
  name?: string;
}) {
  if (tableIds.length < 2) throw new Error("at least two tables are required");

  return db.transaction(async (tx) => {
    const tables = await tx
      .select()
      .from(schema.tables)
      .where(inArray(schema.tables.id, tableIds))
      .for("update");
    if (tables.length !== tableIds.length) throw new Error("one or more tables not found");

    const activeOrderStatuses: any[] = ["open", "partially-served", "fully-served", "billed"];
    const activeOrders = await tx
      .select()
      .from(schema.orders)
      .where(
        and(
          inArray(schema.orders.tableId, tableIds),
          inArray(schema.orders.status, activeOrderStatuses)
        )
      );
    if (activeOrders.length > 0) {
      const orderIds = activeOrders.map((o) => o.id);
      const items = await tx
        .select({ orderId: schema.orderItems.orderId })
        .from(schema.orderItems)
        .where(
          and(
            inArray(schema.orderItems.orderId, orderIds),
            ne(schema.orderItems.tableStatus, "cancelled")
          )
        )
        .limit(1);
      if (items.length > 0) {
        throw new Error("one or more tables has an active order");
      }
      await tx
        .update(schema.orders)
        .set({ status: "closed" })
        .where(inArray(schema.orders.id, orderIds));
    }

    const sectionId = tables[0].sectionId;
    const outletId = tables[0].outletId;
    const groupName = name ?? tables.map((t) => t.name).join(" + ");

    const [group] = await tx
      .insert(schema.tableMergeGroups)
      .values({
        id: randomUUID(),
        outletId,
        sectionId,
        name: groupName,
        status: "active",
        waiterId: waiterId ?? null,
        guests: guests ?? 0,
      })
      .returning();

    await tx.insert(schema.tableMergeGroupTables).values(
      tableIds.map((tableId) => ({ mergeGroupId: group.id, tableId }))
    );

    const updated: any[] = [];
    for (const t of tables) {
      const [u] = await tx
        .update(schema.tables)
        .set({
          status: "occupied",
          mergeGroupId: group.id,
          guests: 0,
          waiterId: null,
          startedAt: new Date(),
        })
        .where(eq(schema.tables.id, t.id))
        .returning();
      updated.push(u);
    }

    await tx.insert(schema.orders).values({
      id: randomUUID(),
      outletId,
      sectionId,
      mergeGroupId: group.id,
      orderType: "dine-in",
      status: "open",
    });

    for (const t of updated) emitTableUpdate(outletId, t);
    return { ...group, tables: updated };
  });
}

export async function releaseMerge({ mergeGroupId }: { mergeGroupId: string }) {
  return db.transaction(async (tx) => {
    const [group] = await tx
      .select()
      .from(schema.tableMergeGroups)
      .where(eq(schema.tableMergeGroups.id, mergeGroupId))
      .for("update");
    if (!group) throw new Error("merge group not found");

    await tx
      .update(schema.tableMergeGroups)
      .set({ status: "released" })
      .where(eq(schema.tableMergeGroups.id, mergeGroupId));

    const tables = await tx
      .select()
      .from(schema.tables)
      .where(eq(schema.tables.mergeGroupId, mergeGroupId))
      .for("update");

    const updated: any[] = [];
    for (const t of tables) {
      const [u] = await tx
        .update(schema.tables)
        .set({
          mergeGroupId: null,
          status: "available",
          guests: 0,
          waiterId: null,
          startedAt: null,
          kots: 0,
        })
        .where(eq(schema.tables.id, t.id))
        .returning();
      updated.push(u);
      emitTableUpdate(group.outletId, u);
    }

    return { ...group, status: "released", tables: updated };
  });
}

export async function splitTable({
  tableId,
  subTables,
}: {
  tableId: string;
  subTables: { capacity: number; name?: string }[];
}) {
  if (subTables.length < 2) throw new Error("at least two sub-tables are required");

  return db.transaction(async (tx) => {
    const [parent] = await tx
      .select()
      .from(schema.tables)
      .where(eq(schema.tables.id, tableId))
      .for("update");
    if (!parent) throw new Error("table not found");
    if (parent.status !== "occupied") {
      throw new Error("table must be occupied to split");
    }

    const total = subTables.reduce((s, st) => s + st.capacity, 0);
    if (total > parent.capacity) {
      throw new Error("sub-table capacities exceed parent capacity");
    }

    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.tableId, tableId),
          inArray(schema.orders.status, ["open", "partially-served", "fully-served"])
        )
      )
      .limit(1);
    if (!order) throw new Error("table has no active order to split");

    const [group] = await tx
      .insert(schema.tableSplitGroups)
      .values({
        id: randomUUID(),
        outletId: parent.outletId,
        parentTableId: tableId,
        sectionId: parent.sectionId,
        status: "active",
      })
      .returning();

    const created: any[] = [];
    for (let i = 0; i < subTables.length; i++) {
      const suffix = String.fromCharCode(97 + i);
      const [sub] = await tx
        .insert(schema.tables)
        .values({
          id: randomUUID(),
          outletId: parent.outletId,
          sectionId: parent.sectionId,
          number: parent.number,
          name: subTables[i].name ?? `${parent.name}${suffix}`,
          capacity: subTables[i].capacity,
          status: i === 0 ? "occupied" : "available",
          splitGroupId: group.id,
          parentTableId: tableId,
          suffix: subTables[i].name ? null : suffix,
        })
        .returning();
      created.push(sub);
    }

    await tx
      .update(schema.orders)
      .set({ tableId: created[0].id, mergeGroupId: null })
      .where(eq(schema.orders.id, order.id));

    const [updatedParent] = await tx
      .update(schema.tables)
      .set({
        splitGroupId: group.id,
        guests: 0,
        waiterId: null,
      })
      .where(eq(schema.tables.id, tableId))
      .returning();

    for (const t of [updatedParent, ...created]) emitTableUpdate(parent.outletId, t);
    return { ...group, parent: updatedParent, subTables: created };
  });
}

export async function unsplitTable({ splitGroupId }: { splitGroupId: string }) {
  return db.transaction(async (tx) => {
    const [group] = await tx
      .select()
      .from(schema.tableSplitGroups)
      .where(eq(schema.tableSplitGroups.id, splitGroupId))
      .for("update");
    if (!group) throw new Error("split group not found");

    const subTables = await tx
      .select()
      .from(schema.tables)
      .where(and(eq(schema.tables.splitGroupId, splitGroupId), ne(schema.tables.id, group.parentTableId)))
      .for("update");

    const activeStatuses: any[] = ["open", "partially-served", "fully-served"];
    const activeOrders = await tx
      .select()
      .from(schema.orders)
      .where(
        and(
          inArray(schema.orders.tableId, subTables.map((t) => t.id)),
          inArray(schema.orders.status, activeStatuses)
        )
      );

    // move any active order back to the parent table
    for (const o of activeOrders) {
      await tx
        .update(schema.orders)
        .set({ tableId: group.parentTableId, mergeGroupId: null })
        .where(eq(schema.orders.id, o.id));
    }

    const hasActiveOrder = activeOrders.length > 0;
    const activeSub = hasActiveOrder
      ? subTables.find((t) => t.id === activeOrders[0].tableId)
      : undefined;
    const [parent] = await tx
      .update(schema.tables)
      .set({
        splitGroupId: null,
        status: hasActiveOrder ? "occupied" : "available",
        guests: hasActiveOrder ? activeSub?.guests ?? 0 : 0,
        waiterId: hasActiveOrder ? activeSub?.waiterId ?? null : null,
      })
      .where(eq(schema.tables.id, group.parentTableId))
      .returning();

    const subTableIds = subTables.map((t) => t.id);
    if (subTableIds.length) {
      await tx
        .update(schema.reservations)
        .set({ tableId: group.parentTableId })
        .where(inArray(schema.reservations.tableId, subTableIds));
      await tx.delete(schema.tables).where(inArray(schema.tables.id, subTableIds));
    }
    emitTableUpdate(parent.outletId, parent);

    await tx
      .update(schema.tableSplitGroups)
      .set({ status: "released" })
      .where(eq(schema.tableSplitGroups.id, splitGroupId));

    return { ...group, status: "released", parent, removedSubTableIds: subTableIds };
  });
}

export async function moveTableBooking({
  fromTableId,
  toTableId,
}: {
  fromTableId: string;
  toTableId: string;
}) {
  if (fromTableId === toTableId) throw new Error("source and destination must be different");
  return db.transaction(async (tx) => {
    const [source, dest] = await Promise.all([
      tx.select().from(schema.tables).where(eq(schema.tables.id, fromTableId)).for("update"),
      tx.select().from(schema.tables).where(eq(schema.tables.id, toTableId)).for("update"),
    ]);
    const fromTable = source[0];
    const toTable = dest[0];
    if (!fromTable || !toTable) throw new Error("table not found");
    if (fromTable.outletId !== toTable.outletId) throw new Error("tables must be in the same outlet");
    if (fromTable.mergeGroupId || toTable.mergeGroupId) throw new Error("merged tables cannot be moved");
    if (toTable.splitGroupId || toTable.parentTableId) {
      throw new Error("destination cannot be a split table");
    }
    if (fromTable.splitGroupId && !fromTable.parentTableId) {
      throw new Error("a split parent table cannot be moved — move a sub-table instead");
    }
    const activeOrderStatuses: any[] = ["open", "partially-served", "fully-served", "billed"];
    const activeOrders = await tx
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.tableId, fromTableId), inArray(schema.orders.status, activeOrderStatuses)));
    if (toTable.status !== "available") throw new Error("destination table is not available");

    for (const o of activeOrders) {
      await tx
        .update(schema.orders)
        .set({ tableId: toTableId, mergeGroupId: null })
        .where(eq(schema.orders.id, o.id));
    }

    const [updatedFrom] = await tx
      .update(schema.tables)
      .set({
        status: "available",
        guests: 0,
        waiterId: null,
        startedAt: null,
        kots: 0,
      })
      .where(eq(schema.tables.id, fromTableId))
      .returning();
    const [updatedTo] = await tx
      .update(schema.tables)
      .set({
        status: fromTable.status,
        guests: fromTable.guests,
        waiterId: fromTable.waiterId,
        startedAt: fromTable.startedAt,
        kots: fromTable.kots,
      })
      .where(eq(schema.tables.id, toTableId))
      .returning();
    emitTableUpdate(updatedFrom.outletId, updatedFrom);
    emitTableUpdate(updatedTo.outletId, updatedTo);
    return { from: updatedFrom, to: updatedTo };
  });
}

export async function transferTable({
  tableId,
  toSectionId,
  toWaiterId,
}: {
  tableId: string;
  toSectionId?: string;
  toWaiterId?: string | null;
}) {
  return db.transaction(async (tx) => {
    const [table] = await tx
      .select()
      .from(schema.tables)
      .where(eq(schema.tables.id, tableId))
      .for("update");
    if (!table) throw new Error("table not found");

    const activeOrderStatuses: any[] = ["open", "partially-served", "fully-served", "billed"];
    const [activeOrder] = await tx
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.tableId, tableId),
          inArray(schema.orders.status, activeOrderStatuses)
        )
      )
      .limit(1);
    if (activeOrder) {
      throw new Error("cannot transfer a table with an active order");
    }

    const update: any = {};
    if (toSectionId) update.sectionId = toSectionId;
    if (toWaiterId !== undefined) update.waiterId = toWaiterId || null;

    if (Object.keys(update).length === 0) {
      throw new Error("nothing to transfer");
    }

    const [updated] = await tx
      .update(schema.tables)
      .set(update)
      .where(eq(schema.tables.id, tableId))
      .returning();
    emitTableUpdate(updated.outletId, updated);
    return updated;
  });
}

export async function createTable({
  outletId,
  sectionId,
  number,
  capacity,
  name,
  waiterId,
}: {
  outletId: string;
  sectionId: string;
  number: number;
  capacity: number;
  name?: string;
  waiterId?: string | null;
}) {
  const [section] = await db
    .select()
    .from(schema.sections)
    .where(and(eq(schema.sections.id, sectionId), eq(schema.sections.outletId, outletId)));
  if (!section) throw new Error("section not found in this outlet");
  if (section.type !== "dine-in") {
    throw new Error("tables can only be created in dine-in sections");
  }

  if (waiterId) {
    const [waiter] = await db
      .select()
      .from(schema.staff)
      .where(and(eq(schema.staff.id, waiterId), eq(schema.staff.outletId, outletId)));
    if (!waiter) throw new Error("waiter not found in this outlet");
  }

  const [created] = await db
    .insert(schema.tables)
    .values({
      outletId,
      sectionId,
      number,
      capacity,
      name: name ?? `Table ${number}`,
      waiterId: waiterId ?? null,
    })
    .returning();
  emitTableUpdate(created.outletId, created);
  return created;
}

export async function updateTable({
  tableId,
  number,
  capacity,
  name,
  waiterId,
}: {
  tableId: string;
  number?: number;
  capacity?: number;
  name?: string;
  waiterId?: string | null;
}) {
  const [table] = await db
    .select()
    .from(schema.tables)
    .where(eq(schema.tables.id, tableId));
  if (!table) throw new Error("table not found");

  const updates: any = {};
  if (number !== undefined) updates.number = number;
  if (capacity !== undefined) updates.capacity = capacity;
  if (name !== undefined) updates.name = name;
  if (waiterId !== undefined) {
    if (waiterId) {
      const [waiter] = await db
        .select()
        .from(schema.staff)
        .where(and(eq(schema.staff.id, waiterId), eq(schema.staff.outletId, table.outletId)));
      if (!waiter) throw new Error("waiter not found in this outlet");
    }
    updates.waiterId = waiterId || null;
  }

  if (Object.keys(updates).length === 0) throw new Error("nothing to update");

  const [updated] = await db
    .update(schema.tables)
    .set(updates)
    .where(eq(schema.tables.id, tableId))
    .returning();
  emitTableUpdate(updated.outletId, updated);
  return updated;
}

export async function getTableGroups({ outletId }: { outletId: string }) {
  const mergeGroups = await db
    .select()
    .from(schema.tableMergeGroups)
    .where(and(eq(schema.tableMergeGroups.outletId, outletId), eq(schema.tableMergeGroups.status, "active")));
  const splitGroups = await db
    .select()
    .from(schema.tableSplitGroups)
    .where(and(eq(schema.tableSplitGroups.outletId, outletId), eq(schema.tableSplitGroups.status, "active")));

  const allStaff = await db.select().from(schema.staff);
  const staffById = new Map(allStaff.map((s) => [s.id, s.name]));

  const [mergeLinks, mergedTables, splitTables] = await Promise.all([
    mergeGroups.length
      ? db
          .select()
          .from(schema.tableMergeGroupTables)
          .where(inArray(schema.tableMergeGroupTables.mergeGroupId, mergeGroups.map((g) => g.id)))
      : Promise.resolve([]),
    mergeGroups.length
      ? db
          .select()
          .from(schema.tables)
          .where(inArray(schema.tables.mergeGroupId, mergeGroups.map((g) => g.id)))
      : Promise.resolve([]),
    splitGroups.length
      ? db
          .select()
          .from(schema.tables)
          .where(inArray(schema.tables.splitGroupId, splitGroups.map((g) => g.id)))
      : Promise.resolve([]),
  ]);

  const linksByGroup = new Map<string, string[]>();
  for (const link of mergeLinks) {
    const list = linksByGroup.get(link.mergeGroupId) ?? [];
    list.push(link.tableId);
    linksByGroup.set(link.mergeGroupId, list);
  }
  for (const t of mergedTables) {
    if (!t.mergeGroupId) continue;
    const list = linksByGroup.get(t.mergeGroupId) ?? [];
    if (!list.includes(t.id)) {
      list.push(t.id);
      linksByGroup.set(t.mergeGroupId, list);
    }
  }

  const subTablesByGroup = new Map<string, string[]>();
  for (const t of splitTables) {
    if (t.splitGroupId) {
      const list = subTablesByGroup.get(t.splitGroupId) ?? [];
      list.push(t.id);
      subTablesByGroup.set(t.splitGroupId, list);
    }
  }

  return {
    mergeGroups: mergeGroups.map((g) => ({
      ...g,
      tableIds: linksByGroup.get(g.id) ?? [],
      waiter: g.waiterId ? staffById.get(g.waiterId) : undefined,
    })),
    splitGroups: splitGroups.map((g) => ({
      ...g,
      subTableIds: (subTablesByGroup.get(g.id) ?? []).filter((id) => id !== g.parentTableId),
    })),
  };
}
