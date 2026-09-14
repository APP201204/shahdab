import { eq, and, inArray, notInArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import { emitKitchenTicket, emitTableUpdate } from "./events.ts";

export async function getTickets(kitchenId: string) {
  const items = await db
    .select({
      orderItem: schema.orderItems,
      order: schema.orders,
      table: schema.tables,
      batch: schema.kotBatches,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .innerJoin(schema.kotBatches, eq(schema.orderItems.kotBatchId, schema.kotBatches.id))
    .leftJoin(schema.tables, eq(schema.orders.tableId, schema.tables.id))
    .where(
      and(
        eq(schema.orderItems.kitchenId, kitchenId),
        notInArray(schema.orderItems.kitchenStatus, ["served", "cancelled"])
      )
    )
    .orderBy(schema.kotBatches.batchNumber, schema.orderItems.id);

  const byBatch = new Map<string, any>();
  for (const i of items) {
    const batchId = i.batch.id;
    if (!byBatch.has(batchId)) {
      byBatch.set(batchId, {
        id: i.batch.id,
        batchNumber: i.batch.batchNumber,
        createdAt: i.batch.createdAt,
        order: i.order,
        table: i.table,
        items: [],
      });
    }
    byBatch.get(batchId).items.push({
      ...i.orderItem,
      table: i.table,
    });
  }

  return { tickets: Array.from(byBatch.values()) };
}

export async function acceptItem({ orderItemId }: { orderItemId: string }) {
  return db.transaction(async (tx) => {
    const [orderItem] = await tx
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.id, orderItemId))
      .for("update");
    if (!orderItem) throw new Error("order item not found");
    if (orderItem.kitchenStatus !== "placed") {
      throw new Error("item is not placed");
    }
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderItem.orderId));
    if (!order) throw new Error("order not found");

    const [updated] = await tx
      .update(schema.orderItems)
      .set({ kitchenStatus: "accepted" })
      .where(eq(schema.orderItems.id, orderItemId))
      .returning();
    emitKitchenTicket(order.outletId, orderItem.kitchenId ?? "default", {
      item: updated,
      order,
    });
    return updated;
  });
}

export async function startCookingItem({ orderItemId }: { orderItemId: string }) {
  return db.transaction(async (tx) => {
    const [orderItem] = await tx
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.id, orderItemId))
      .for("update");
    if (!orderItem) throw new Error("order item not found");
    if (orderItem.kitchenStatus !== "accepted") {
      throw new Error("item is not accepted");
    }
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderItem.orderId));
    if (!order) throw new Error("order not found");

    const [updated] = await tx
      .update(schema.orderItems)
      .set({ kitchenStatus: "cooking" })
      .where(eq(schema.orderItems.id, orderItemId))
      .returning();
    emitKitchenTicket(order.outletId, orderItem.kitchenId ?? "default", {
      item: updated,
      order,
    });
    return updated;
  });
}

export async function markItemReady({ orderItemId }: { orderItemId: string }) {
  return db.transaction(async (tx) => {
    const [orderItem] = await tx
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.id, orderItemId))
      .for("update");
    if (!orderItem) throw new Error("order item not found");
    if (orderItem.kitchenStatus !== "cooking") {
      throw new Error("item is not cooking");
    }
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderItem.orderId));
    if (!order) throw new Error("order not found");

    const [updated] = await tx
      .update(schema.orderItems)
      .set({ kitchenStatus: "ready" })
      .where(eq(schema.orderItems.id, orderItemId))
      .returning();

    if (order.tableId) {
      const [table] = await tx
        .select()
        .from(schema.tables)
        .where(eq(schema.tables.id, order.tableId));
      if (table) emitTableUpdate(order.outletId, table);
    }
    emitKitchenTicket(order.outletId, orderItem.kitchenId ?? "default", {
      item: updated,
      order,
    });
    return updated;
  });
}

export async function markTakeawayAllReady({ orderId }: { orderId: string }) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for("update");
    if (!order) throw new Error("order not found");
    if (order.orderType !== "takeaway") {
      throw new Error("only takeaway orders can be marked all ready");
    }

    const items = await tx
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId));

    if (items.some((i) => !["cooking", "ready"].includes(i.kitchenStatus ?? ""))) {
      throw new Error("not all items are cooking or ready");
    }

    await tx
      .update(schema.orderItems)
      .set({ kitchenStatus: "ready" })
      .where(eq(schema.orderItems.orderId, orderId));

    const byKitchen = new Map<string, any[]>();
    for (const i of items) {
      const list = byKitchen.get(i.kitchenId ?? "default") ?? [];
      list.push(i);
      byKitchen.set(i.kitchenId ?? "default", list);
    }
    for (const [kitchenId, kitchenItems] of byKitchen.entries()) {
      emitKitchenTicket(order.outletId, kitchenId, { orderId, items: kitchenItems });
    }

    return { orderId, status: "ready" };
  });
}

export async function markTakeawayPickedUp({ orderId }: { orderId: string }) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for("update");
    if (!order) throw new Error("order not found");
    if (order.orderType !== "takeaway") {
      throw new Error("only takeaway orders can be picked up");
    }

    const items = await tx
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId));

    if (items.some((i) => !["ready"].includes(i.kitchenStatus ?? ""))) {
      throw new Error("not all items are ready");
    }

    await tx
      .update(schema.orderItems)
      .set({
        kitchenStatus: "served",
        tableStatus: "on-table",
        servedAt: new Date(),
      })
      .where(eq(schema.orderItems.orderId, orderId));

    const [updated] = await tx
      .update(schema.orders)
      .set({ status: "closed", closedAt: new Date() })
      .where(eq(schema.orders.id, orderId))
      .returning();

    return updated;
  });
}
