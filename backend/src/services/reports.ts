import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";

function hourLabel(hour: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "a" : "p";
  return `${h}${ampm}`;
}

export async function hourlyRevenue(date: string) {
  const rows = await db
    .select({
      hour: sql`extract(hour from ${schema.bills.createdAt})`.as<number>("hour"),
      revenue: sql`sum(${schema.bills.total})`.as<number>("revenue"),
    })
    .from(schema.bills)
    .where(sql`${schema.bills.createdAt}::date = ${date}::date`)
    .groupBy(sql`extract(hour from ${schema.bills.createdAt})`);

  return rows.map((r) => ({
    hour: hourLabel(r.hour),
    revenue: Number(r.revenue),
  }));
}

export async function sectionRevenue(date: string) {
  const rows = await db
    .select({
      sectionId: schema.bills.sectionId,
      amount: sql`sum(${schema.bills.total})`.as<number>("amount"),
      bills: sql`count(*)`.as<number>("bills"),
    })
    .from(schema.bills)
    .where(sql`${schema.bills.createdAt}::date = ${date}::date`)
    .groupBy(schema.bills.sectionId);

  const sectionIds = rows.map((r) => r.sectionId);
  const sections =
    sectionIds.length > 0
      ? await db
          .select()
          .from(schema.sections)
          .where(sql`${schema.sections.id} in ${sectionIds}`)
      : [];
  const nameById = new Map(sections.map((s) => [s.id, s.name]));

  return rows.map((r) => ({
    sectionId: r.sectionId,
    name: nameById.get(r.sectionId),
    amount: Number(r.amount),
    bills: Number(r.bills),
  }));
}

export async function dashboard() {
  const [totals] = await db
    .select({
      revenue: sql`sum(${schema.bills.total})`.as<number>("revenue"),
      taxes: sql`sum(${schema.bills.tax})`.as<number>("taxes"),
      service: sql`sum(${schema.bills.serviceCharge})`.as<number>("service"),
      discounts: sql`sum(${schema.bills.discount})`.as<number>("discounts"),
      rounded: sql`0`.as<number>("rounded"),
      sessions: sql`count(*)`.as<number>("sessions"),
    })
    .from(schema.bills);

  const payments = await db
    .select({
      method: schema.billPayments.method,
      amount: sql`sum(${schema.billPayments.amount})`.as<number>("amount"),
    })
    .from(schema.billPayments)
    .groupBy(schema.billPayments.method);

  const paymentMap = new Map(payments.map((p) => [p.method, Number(p.amount)]));

  const [itemCount] = await db
    .select({
      items: sql`sum(${schema.billItems.qty})`.as<number>("items"),
    })
    .from(schema.billItems);

  const [completed] = await db
    .select({
      completed: sql`count(*)`.as<number>("completed"),
    })
    .from(schema.orders)
    .where(eq(schema.orders.status, "closed"));

  const [cancelled] = await db
    .select({
      cancelled: sql`count(*)`.as<number>("cancelled"),
    })
    .from(schema.orderItems)
    .where(eq(schema.orderItems.kitchenStatus, "cancelled"));

  return {
    revenue: Number(totals?.revenue ?? 0),
    revenueChange: 0,
    taxes: Number(totals?.taxes ?? 0),
    service: Number(totals?.service ?? 0),
    rounded: 0,
    creditNotes: 0,
    cash: paymentMap.get("cash") ?? 0,
    cashChange: 0,
    card: paymentMap.get("card") ?? 0,
    cardChange: 0,
    upi: paymentMap.get("upi") ?? 0,
    upiChange: 0,
    wallet: paymentMap.get("wallet") ?? 0,
    discounts: Number(totals?.discounts ?? 0),
    creditNotesOwed: 0,
    expenses: 0,
    sessions: Number(totals?.sessions ?? 0),
    completed: Number(completed?.completed ?? 0),
    cancelled: Number(cancelled?.cancelled ?? 0),
    items: Number(itemCount?.items ?? 0),
  };
}
