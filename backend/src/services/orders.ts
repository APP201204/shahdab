import { eq, and, inArray, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import { emitKitchenTicket, emitOrderUpdate, emitTableUpdate } from "./events.ts";

async function updateOrderStatus(orderId: string, tx: any) {
  const items = await tx
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId));
  const total = items.length;
  const onTable = items.filter((i: any) => i.tableStatus === "on-table").length;
  const pending = items.filter((i: any) => i.tableStatus === "pending").length;
  const cancelled = items.filter((i: any) => i.tableStatus === "cancelled").length;

  let status = "open" as "open" | "partially-served" | "fully-served";
  if (total === 0 || (onTable === 0 && pending > 0)) {
    status = "open";
  } else if (onTable + cancelled === total) {
    status = "fully-served";
  } else if (onTable > 0) {
    status = "partially-served";
  }

  await tx
    .update(schema.orders)
    .set({ status })
    .where(eq(schema.orders.id, orderId));
}

export async function getOrderByUnit({
  tableId,
  mergeGroupId,
}: {
  tableId?: string;
  mergeGroupId?: string;
}) {
  if (!tableId && !mergeGroupId) {
    throw new Error("tableId or mergeGroupId is required");
  }

  const conditions = [];
  if (tableId) conditions.push(eq(schema.orders.tableId, tableId));
  if (mergeGroupId) conditions.push(eq(schema.orders.mergeGroupId, mergeGroupId));

  const [order] = await db
    .select()
    .from(schema.orders)
    .where(and(...conditions))
    .orderBy(schema.orders.createdAt)
    .limit(1);

  if (!order) return null;

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, order.id));
  const batches = await db
    .select()
    .from(schema.kotBatches)
    .where(eq(schema.kotBatches.orderId, order.id));

  return { ...order, items, batches };
}

export async function addOrderItems({
  orderId,
  items,
}: {
  orderId: string;
  items: { menuItemId: string; variantId?: string; qty: number; note?: string }[];
}) {
  if (items.length === 0) throw new Error("no items to add");

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for("update");
    if (!order) throw new Error("order not found");
    if (["closed", "billed"].includes(order.status)) {
      throw new Error("order is closed");
    }

    const menuItemIds = items.map((i) => i.menuItemId);
    const menuRows = await tx
      .select()
      .from(schema.menuItems)
      .where(inArray(schema.menuItems.id, menuItemIds));
    const menuMap = new Map(menuRows.map((m) => [m.id, m]));

    const variantIds = items
      .map((i) => i.variantId)
      .filter((id): id is string => Boolean(id));
    const variantRows = variantIds.length
      ? await tx
          .select()
          .from(schema.menuItemVariants)
          .where(inArray(schema.menuItemVariants.id, variantIds))
      : [];
    const variantMap = new Map(variantRows.map((v) => [v.id, v]));

    const inserted: any[] = [];
    for (const item of items) {
      const menu = menuMap.get(item.menuItemId);
      if (!menu) throw new Error("menu item not found");
      const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
      if (item.variantId && !variant) throw new Error("variant not found");

      const [row] = await tx
        .insert(schema.orderItems)
        .values({
          id: randomUUID(),
          orderId,
          kitchenId: menu.kitchenId,
          menuItemId: item.menuItemId,
          variantId: item.variantId,
          name: menu.name,
          variant: variant?.name ?? null,
          qty: item.qty,
          unitPrice: variant ? variant.price : menu.basePrice,
          tableStatus: "pending",
          kitchenStatus: null,
          mrp: menu.mrp,
          note: item.note ?? null,
        })
        .returning();
      inserted.push(row);
    }

    await updateOrderStatus(orderId, tx);
    return { order, items: inserted };
  }).then((result) => {
    emitOrderUpdate(result.order.outletId, { orderId });
    return result;
  });
}

export async function createTakeawayOrder({
  sectionId,
  customerName,
  customerPhone,
  items,
  createdBy,
}: {
  sectionId: string;
  customerName: string;
  customerPhone: string;
  items: { menuItemId: string; variantId?: string; qty: number; note?: string }[];
  createdBy: string;
}) {
  const [section] = await db
    .select()
    .from(schema.sections)
    .where(eq(schema.sections.id, sectionId));
  if (!section) throw new Error("section not found");
  if (section.type !== "takeaway") {
    throw new Error("orders can only be placed against a takeaway section");
  }

  const [order] = await db
    .insert(schema.orders)
    .values({
      id: randomUUID(),
      outletId: section.outletId,
      sectionId: section.id,
      customerName,
      customerPhone,
      orderType: "takeaway",
      status: "open",
    })
    .returning();

  await addOrderItems({ orderId: order.id, items });
  const batch = await sendToKitchen({ orderId: order.id, createdBy });

  return { order, batch };
}

export async function sendToKitchen({
  orderId,
  createdBy,
}: {
  orderId: string;
  createdBy: string;
}) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for("update");
    if (!order) throw new Error("order not found");

    const batchRes = await tx
      .select({ n: sql`max(${schema.kotBatches.batchNumber})` })
      .from(schema.kotBatches)
      .where(eq(schema.kotBatches.orderId, orderId));
    const lastNumber = Number(batchRes[0]?.n) || 0;
    const batchNumber = lastNumber + 1;

    const [batch] = await tx
      .insert(schema.kotBatches)
      .values({
        id: randomUUID(),
        orderId,
        batchNumber,
        createdBy,
      })
      .returning();

    const cartItems = await tx
      .select()
      .from(schema.orderItems)
      .where(
        and(
          eq(schema.orderItems.orderId, orderId),
          eq(schema.orderItems.tableStatus, "pending"),
          isNull(schema.orderItems.kitchenStatus)
        )
      );

    if (cartItems.length === 0) {
      throw new Error("no cart items to send");
    }

    await tx
      .update(schema.orderItems)
      .set({
        kotBatchId: batch.id,
        kitchenStatus: "placed",
      })
      .where(
        and(
          eq(schema.orderItems.orderId, orderId),
          eq(schema.orderItems.tableStatus, "pending"),
          isNull(schema.orderItems.kitchenStatus)
        )
      );

    const byKitchen = new Map<string, typeof cartItems>();
    for (const item of cartItems) {
      const list = byKitchen.get(item.kitchenId ?? "default") ?? [];
      list.push(item);
      byKitchen.set(item.kitchenId ?? "default", list);
    }

    if (order.tableId) {
      const [table] = await tx
        .update(schema.tables)
        .set({ kots: sql`${schema.tables.kots} + 1` })
        .where(eq(schema.tables.id, order.tableId))
        .returning();
      if (table) emitTableUpdate(order.outletId, table);
    }

    for (const [kitchenId, ticketItems] of byKitchen.entries()) {
      emitKitchenTicket(order.outletId, kitchenId, { batch, items: ticketItems });
    }

    await updateOrderStatus(orderId, tx);
    emitOrderUpdate(order.outletId, { orderId });
    return { ...batch, items: cartItems };
  });
}

export async function updateItemNote({
  orderItemId,
  note,
}: {
  orderItemId: string;
  note: string;
}) {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.id, orderItemId))
      .for("update");
    if (!item) throw new Error("order item not found");

    const [updated] = await tx
      .update(schema.orderItems)
      .set({ note })
      .where(eq(schema.orderItems.id, orderItemId))
      .returning();
    return updated;
  });
}

export async function cancelItem({ orderItemId }: { orderItemId: string }) {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.id, orderItemId))
      .for("update");
    if (!item) throw new Error("order item not found");

    if (["cooking", "ready", "served"].includes(item.kitchenStatus ?? "")) {
      throw new Error("item cannot be cancelled");
    }

    const [updated] = await tx
      .update(schema.orderItems)
      .set({ tableStatus: "cancelled", kitchenStatus: "cancelled" })
      .where(eq(schema.orderItems.id, orderItemId))
      .returning();
    await updateOrderStatus(item.orderId, tx);

    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, item.orderId));
    if (order) emitOrderUpdate(order.outletId, { orderId: item.orderId });
    return updated;
  });
}

export async function getActiveOrderUnits({ outletId }: { outletId: string }) {
  const activeOrders = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.outletId, outletId),
        inArray(schema.orders.status, ["open", "partially-served", "fully-served"])
      )
    );

  const orderIds = activeOrders.map((o) => o.id);
  const items = orderIds.length
    ? await db
        .select()
        .from(schema.orderItems)
        .where(inArray(schema.orderItems.orderId, orderIds))
    : [];
  const batches = orderIds.length
    ? await db
        .select()
        .from(schema.kotBatches)
        .where(inArray(schema.kotBatches.orderId, orderIds))
    : [];

  const tableIds = activeOrders.map((o) => o.tableId).filter(Boolean) as string[];
  const mergeGroupIds = activeOrders.map((o) => o.mergeGroupId).filter(Boolean) as string[];

  const [tables, groups, allStaff] = await Promise.all([
    tableIds.length
      ? db.select().from(schema.tables).where(inArray(schema.tables.id, tableIds))
      : Promise.resolve([]),
    mergeGroupIds.length
      ? db
          .select()
          .from(schema.tableMergeGroups)
          .where(inArray(schema.tableMergeGroups.id, mergeGroupIds))
      : Promise.resolve([]),
    db.select().from(schema.staff),
  ]);

  const sectionIds = [
    ...new Set([
      ...tables.map((t) => t.sectionId),
      ...groups.map((g) => g.sectionId),
      ...activeOrders.map((o) => o.sectionId),
    ]),
  ];
  const sections = sectionIds.length
    ? await db.select().from(schema.sections).where(inArray(schema.sections.id, sectionIds))
    : [];

  const sectionById = new Map(sections.map((s) => [s.id, s.name]));
  const batchById = new Map(batches.map((b) => [b.id, b.batchNumber]));
  const staffById = new Map(allStaff.map((s) => [s.id, s.name]));

  const tableById = new Map(tables.map((t) => [t.id, t]));
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const units = [];
  for (const order of activeOrders) {
    const table = order.tableId ? tableById.get(order.tableId) : undefined;
    const group = order.mergeGroupId ? groupById.get(order.mergeGroupId) : undefined;
    const name = table?.name ?? group?.name ?? order.customerName ?? "Takeaway";
    const sectionId = table?.sectionId ?? group?.sectionId ?? order.sectionId;
    const waiterId = table?.waiterId ?? group?.waiterId;
    const unit = {
      id: order.mergeGroupId ?? order.tableId ?? order.id,
      orderId: order.id,
      name,
      orderType: order.orderType,
      sectionId,
      sectionName: sectionId ? (sectionById.get(sectionId) ?? "") : "",
      waiter: waiterId ? staffById.get(waiterId) : undefined,
      lines: [] as any[],
    };
    for (const item of items.filter((i) => i.orderId === order.id)) {
      let status = "pending";
      if (item.tableStatus === "cancelled") {
        status = "cancelled";
      } else if (item.tableStatus === "on-table" || item.servedAt !== null) {
        status = "on-table";
      } else if (item.kitchenStatus === "ready") {
        status = "ready";
      } else if (item.kitchenStatus) {
        status = "sent-to-kitchen";
      }
      unit.lines.push({
        id: item.id,
        orderId: order.id,
        itemId: item.menuItemId,
        name: item.name,
        variant: item.variant,
        qty: item.qty,
        unitPrice: item.unitPrice,
        batch: item.kotBatchId ? batchById.get(item.kotBatchId) : undefined,
        note: item.note,
        served: item.tableStatus === "on-table" || item.servedAt !== null,
        mrp: item.mrp,
        status,
        kitchenStatus: item.kitchenStatus,
      });
    }
    units.push(unit);
  }

  return { units };
}

export async function serveItem({ orderItemId }: { orderItemId: string }) {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.id, orderItemId))
      .for("update");
    if (!item) throw new Error("order item not found");

    if (item.kitchenStatus !== "ready") {
      throw new Error("item is not ready to serve yet");
    }

    const [updated] = await tx
      .update(schema.orderItems)
      .set({
        kitchenStatus: "served",
        tableStatus: "on-table",
        servedAt: new Date(),
      })
      .where(eq(schema.orderItems.id, orderItemId))
      .returning();
    await updateOrderStatus(item.orderId, tx);

    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, item.orderId));
    if (order) emitOrderUpdate(order.outletId, { orderId: item.orderId });
    return updated;
  });
}
