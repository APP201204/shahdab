import { eq, and, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";

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

  const [tables, groups] = await Promise.all([tableQuery, mergeQuery]);

  const queue: any[] = [];
  for (const t of tables) {
    if (t.table.status === "bill-requested" || (t.order && statusConditions.includes(t.order.status))) {
      queue.push({
        type: "table",
        unitId: t.table.id,
        unitName: t.table.name,
        table: t.table,
        order: t.order,
      });
    }
  }
  for (const g of groups) {
    if (g.order && statusConditions.includes(g.order.status)) {
      queue.push({
        type: "merge",
        unitId: g.group.id,
        unitName: g.group.name,
        group: g.group,
        order: g.order,
      });
    }
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
    discount,
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

    const unitId = order.tableId ?? order.mergeGroupId!;
    let unitName = "";
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
      await tx
        .update(schema.tables)
        .set({ status: "paid" })
        .where(eq(schema.tables.id, order.tableId));
    } else if (order.mergeGroupId) {
      await tx
        .update(schema.tables)
        .set({ status: "paid" })
        .where(eq(schema.tables.mergeGroupId, order.mergeGroupId));
    }

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
    .select()
    .from(schema.bills)
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
    bills: bills.map((b) => ({
      ...b,
      items: itemsByBill.get(b.id) ?? [],
      payments: paymentsByBill.get(b.id) ?? [],
    })),
  };
}

export async function getBill(billId: string) {
  const [bill] = await db.select().from(schema.bills).where(eq(schema.bills.id, billId));
  if (!bill) throw new Error("bill not found");

  const items = await db
    .select()
    .from(schema.billItems)
    .where(eq(schema.billItems.billId, billId));
  const payments = await db
    .select()
    .from(schema.billPayments)
    .where(eq(schema.billPayments.billId, billId));

  return { ...bill, items, payments };
}
