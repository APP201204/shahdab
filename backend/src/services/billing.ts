import { eq, and, inArray, sql, getTableColumns } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import { emitOrderUpdate, emitTableUpdate } from "./events.ts";

export function computeBillTotals(
  lines: { qty: number; unitPrice: number; mrp: boolean; kitchenStatus?: string | null }[],
  discount: { kind: "flat" | "percent"; value: number },
  serviceChargeRate: number,
  taxRates: { cgst: number; sgst: number }
) {
  const active = lines.filter((l) => l.kitchenStatus !== "cancelled");
  const standard = active.filter((l) => !l.mrp);
  const mrpItems = active.filter((l) => l.mrp);

  const standardSubtotal = standard.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const mrpSubtotal = mrpItems.reduce((s, l) => s + l.qty * l.unitPrice, 0);

  const discountAmount =
    discount.kind === "flat"
      ? Math.min(discount.value, standardSubtotal)
      : Math.round((standardSubtotal * discount.value) / 100);

  const taxable = standardSubtotal - discountAmount;
  const totalTaxRate = taxRates.cgst + taxRates.sgst;
  const tax = Math.round((taxable * totalTaxRate) / 100);
  const serviceCharge = Math.round((taxable * serviceChargeRate) / 100);
  const preRound = taxable + tax + serviceCharge + mrpSubtotal;
  const total = Math.round(preRound);

  return {
    subtotal: standardSubtotal + mrpSubtotal,
    discount: discountAmount,
    tax,
    serviceCharge,
    total,
    rounding: total - preRound,
  };
}

export async function getBillQueue({
  outletId,
  sectionId,
}: {
  outletId: string;
  sectionId?: string;
}) {
  const statusConditions = ["open", "partially-served", "fully-served", "billed"];

  const tableQuery = db
    .select({
      table: schema.tables,
      order: schema.orders,
    })
    .from(schema.tables)
    .leftJoin(schema.orders, eq(schema.tables.id, schema.orders.tableId))
    .where(
      and(
        eq(schema.tables.outletId, outletId),
        sectionId ? eq(schema.tables.sectionId, sectionId) : undefined,
        inArray(schema.tables.status, ["occupied", "bill-requested", "paid"])
      )
    );

  const mergeQuery = db
    .select({
      group: schema.tableMergeGroups,
      order: schema.orders,
    })
    .from(schema.tableMergeGroups)
    .leftJoin(schema.orders, eq(schema.tableMergeGroups.id, schema.orders.mergeGroupId))
    .where(
      and(
        eq(schema.tableMergeGroups.outletId, outletId),
        sectionId ? eq(schema.tableMergeGroups.sectionId, sectionId) : undefined,
        eq(schema.tableMergeGroups.status, "active")
      )
    );

  const takeawayQuery = db
    .select({
      order: schema.orders,
      section: schema.sections,
    })
    .from(schema.orders)
    .innerJoin(schema.sections, eq(schema.orders.sectionId, schema.sections.id))
    .where(
      and(
        eq(schema.orders.outletId, outletId),
        eq(schema.orders.orderType, "takeaway"),
        inArray(schema.orders.status, [
          "open",
          "partially-served",
          "fully-served",
          "billed",
        ]),
        sectionId ? eq(schema.orders.sectionId, sectionId) : undefined
      )
    );

  const [tables, groups, takeawayOrders] = await Promise.all([
    tableQuery,
    mergeQuery,
    takeawayQuery,
  ]);

  const orderIds = [...tables, ...groups, ...takeawayOrders]
    .map((x) => (x as any).order?.id)
    .filter(Boolean) as string[];

  const [items, allStaff] = await Promise.all([
    orderIds.length
      ? db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, orderIds))
      : Promise.resolve([]),
    db.select().from(schema.staff),
  ]);

  const staffById = new Map(allStaff.map((s) => [s.id, s.name]));

  const sectionIds = [
    ...new Set([
      ...tables.map((t) => t.table.sectionId),
      ...groups.map((g) => g.group.sectionId),
    ]),
  ];
  const sectionRows = sectionIds.length
    ? await db.select().from(schema.sections).where(inArray(schema.sections.id, sectionIds))
    : [];
  const sectionById = new Map(sectionRows.map((s) => [s.id, s.name]));

  const itemsByOrder = new Map<string, any[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push({
      ...item,
      status: item.kitchenStatus,
    });
    itemsByOrder.set(item.orderId, list);
  }

  const queue: any[] = [];
  for (const t of tables) {
    const orderItems = t.order ? (itemsByOrder.get(t.order.id) ?? []) : [];
    const hasItems = orderItems.some((i) => i.kitchenStatus !== "cancelled");
    if (
      hasItems &&
      (t.table.status === "bill-requested" ||
        (t.order && statusConditions.includes(t.order.status)))
    ) {
      queue.push({
        type: "table",
        unitId: t.table.id,
        unitName: t.table.name,
        sectionId: t.table.sectionId,
        sectionName: sectionById.get(t.table.sectionId) ?? "",
        requested: t.table.status === "bill-requested",
        waiter: t.table.waiterId ? staffById.get(t.table.waiterId) : undefined,
        guests: t.table.guests,
        startedAt: t.table.startedAt,
        order: t.order,
        items: orderItems,
      });
    }
  }
  for (const g of groups) {
    const groupItems = g.order ? (itemsByOrder.get(g.order.id) ?? []) : [];
    const hasGroupItems = groupItems.some((i) => i.kitchenStatus !== "cancelled");
    if (hasGroupItems && g.order && statusConditions.includes(g.order.status)) {
      queue.push({
        type: "merge",
        unitId: g.group.id,
        unitName: g.group.name,
        sectionId: g.group.sectionId,
        sectionName: sectionById.get(g.group.sectionId) ?? "",
        requested: true,
        waiter: g.group.waiterId ? staffById.get(g.group.waiterId) : undefined,
        guests: g.group.guests,
        order: g.order,
        items: groupItems,
      });
    }
  }
  for (const t of takeawayOrders) {
    const orderItems = itemsByOrder.get(t.order.id) ?? [];
    const activeItems = orderItems.filter((i) => i.kitchenStatus !== "cancelled");
    if (activeItems.length === 0) continue;
    queue.push({
      type: "takeaway",
      unitId: t.order.id,
      unitName: t.order.customerName ?? "Takeaway",
      sectionId: t.order.sectionId,
      sectionName: t.section.name,
      requested:
        activeItems.length > 0 &&
        activeItems.every((i) => ["ready", "served"].includes(i.kitchenStatus ?? "")),
      guests: 0,
      startedAt: t.order.createdAt,
      order: t.order,
      items: orderItems,
    });
  }

  return { queue };
}

export async function previewBill({
  orderId,
  discount = { kind: "flat", value: 0 },
}: {
  orderId: string;
  discount?: { kind: "flat" | "percent"; value: number };
}) {
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId));
  if (!order) throw new Error("order not found");

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId));

  const [section] = await db
    .select()
    .from(schema.sections)
    .where(eq(schema.sections.id, order.sectionId));

  const serviceChargeRate = section?.serviceCharge ?? 0;
  const taxRates = { cgst: 2.5, sgst: 2.5 };

  const totals = computeBillTotals(
    items.map((i) => ({ qty: i.qty, unitPrice: i.unitPrice, mrp: i.mrp, kitchenStatus: i.kitchenStatus })),
    discount,
    serviceChargeRate,
    taxRates
  );

  return {
    order,
    items,
    discountInput: discount,
    serviceChargeRate,
    taxRates,
    ...totals,
  };
}

export async function closeBill({
  orderId,
  payments,
  cashierId,
  customer,
  discount = { kind: "flat", value: 0 },
}: {
  orderId: string;
  payments: { method: "cash" | "card" | "upi" | "wallet"; amount: number }[];
  cashierId: string;
  customer?: string;
  discount?: { kind: "flat" | "percent"; value: number };
}) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for("update");
    if (!order) throw new Error("order not found");
    if (order.status === "closed" || order.status === "billed") {
      throw new Error("order is already billed");
    }

    const items = await tx
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId));

    const [section] = await tx
      .select()
      .from(schema.sections)
      .where(eq(schema.sections.id, order.sectionId));

    const serviceChargeRate = section?.serviceCharge ?? 0;
    const taxRates = { cgst: 2.5, sgst: 2.5 };
    const totals = computeBillTotals(
      items.map((i) => ({ qty: i.qty, unitPrice: i.unitPrice, mrp: i.mrp, kitchenStatus: i.kitchenStatus })),
      discount,
      serviceChargeRate,
      taxRates
    );

    const paymentTotal = payments.reduce((s, p) => s + p.amount, 0);
    if (paymentTotal !== totals.total) {
      throw new Error("payment total does not match bill total");
    }

    // atomic bill number
    const [counter] = await tx
      .select()
      .from(schema.billNumberCounters)
      .where(eq(schema.billNumberCounters.outletId, order.outletId))
      .for("update");

    let billNumber: number;
    if (counter) {
      billNumber = counter.lastNumber + 1;
      await tx
        .update(schema.billNumberCounters)
        .set({ lastNumber: billNumber })
        .where(eq(schema.billNumberCounters.outletId, order.outletId));
    } else {
      billNumber = 1;
      await tx.insert(schema.billNumberCounters).values({
        outletId: order.outletId,
        lastNumber: billNumber,
      });
    }

    const unitId = order.tableId ?? order.mergeGroupId ?? order.id;
    let unitName = order.customerName ?? "";
    if (order.tableId) {
      const [table] = await tx
        .select()
        .from(schema.tables)
        .where(eq(schema.tables.id, order.tableId));
      unitName = table?.name ?? "";
    } else if (order.mergeGroupId) {
      const [group] = await tx
        .select()
        .from(schema.tableMergeGroups)
        .where(eq(schema.tableMergeGroups.id, order.mergeGroupId));
      unitName = group?.name ?? "";
    }
    if (!unitName) unitName = "Takeaway";

    const number = `SH-${String(billNumber).padStart(5, "0")}`;
    const [bill] = await tx
      .insert(schema.bills)
      .values({
        id: randomUUID(),
        number,
        outletId: order.outletId,
        orderId: order.id,
        sectionId: order.sectionId,
        unitId,
        unitName,
        orderType: order.orderType,
        customer,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        serviceCharge: totals.serviceCharge,
        total: totals.total,
        status: "paid",
        cashierId,
        closedAt: new Date(),
      })
      .returning();

    for (const item of items) {
      if (item.kitchenStatus === "cancelled") continue;
      await tx.insert(schema.billItems).values({
        id: randomUUID(),
        billId: bill.id,
        orderItemId: item.id,
        name: item.name,
        variant: item.variant,
        qty: item.qty,
        unitPrice: item.unitPrice,
        mrp: item.mrp,
      });
    }

    for (const payment of payments) {
      await tx.insert(schema.billPayments).values({
        id: randomUUID(),
        billId: bill.id,
        method: payment.method,
        amount: payment.amount,
      });
    }

    await tx
      .update(schema.orders)
      .set({ status: "closed", closedAt: new Date() })
      .where(eq(schema.orders.id, orderId));

    if (order.tableId) {
      const [table] = await tx
        .update(schema.tables)
        .set({ status: "paid" })
        .where(eq(schema.tables.id, order.tableId))
        .returning();
      if (table) emitTableUpdate(order.outletId, table);
    } else if (order.mergeGroupId) {
      const paidTables = await tx
        .update(schema.tables)
        .set({ status: "paid" })
        .where(eq(schema.tables.mergeGroupId, order.mergeGroupId))
        .returning();
      for (const t of paidTables) emitTableUpdate(order.outletId, t);
    }

    emitOrderUpdate(order.outletId, { orderId });
    return bill;
  });
}

export async function listBills({
  outletId,
  sectionId,
}: {
  outletId: string;
  sectionId?: string;
}) {
  const conditions = [eq(schema.bills.outletId, outletId)];
  if (sectionId) conditions.push(eq(schema.bills.sectionId, sectionId));

  const bills = await db
    .select({
      ...getTableColumns(schema.bills),
      cashierName: schema.staff.name,
    })
    .from(schema.bills)
    .leftJoin(schema.staff, eq(schema.bills.cashierId, schema.staff.id))
    .where(and(...conditions))
    .orderBy(schema.bills.createdAt);

  const billIds = bills.map((b) => b.id);
  const items = billIds.length
    ? await db.select().from(schema.billItems).where(inArray(schema.billItems.billId, billIds))
    : [];
  const payments = billIds.length
    ? await db.select().from(schema.billPayments).where(inArray(schema.billPayments.billId, billIds))
    : [];

  const itemsByBill = new Map<string, any[]>();
  for (const i of items) {
    const list = itemsByBill.get(i.billId) ?? [];
    list.push(i);
    itemsByBill.set(i.billId, list);
  }
  const paymentsByBill = new Map<string, any[]>();
  for (const p of payments) {
    const list = paymentsByBill.get(p.billId) ?? [];
    list.push(p);
    paymentsByBill.set(p.billId, list);
  }

  return {
    bills: bills.map((b) => {
      const { cashierName, ...rest } = b;
      return {
        ...rest,
        cashier: cashierName ?? "Unknown",
        items: itemsByBill.get(b.id) ?? [],
        payments: paymentsByBill.get(b.id) ?? [],
      };
    }),
  };
}

export async function getBill(billId: string) {
  const [row] = await db
    .select({
      ...getTableColumns(schema.bills),
      cashierName: schema.staff.name,
    })
    .from(schema.bills)
    .leftJoin(schema.staff, eq(schema.bills.cashierId, schema.staff.id))
    .where(eq(schema.bills.id, billId));
  if (!row) throw new Error("bill not found");

  const { cashierName, ...bill } = row;
  const items = await db
    .select()
    .from(schema.billItems)
    .where(eq(schema.billItems.billId, billId));
  const payments = await db
    .select()
    .from(schema.billPayments)
    .where(eq(schema.billPayments.billId, billId));

  return { ...bill, cashier: cashierName ?? "Unknown", items, payments };
}
