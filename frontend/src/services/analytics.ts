import { db } from "@/mocks/db";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";

export type Granularity = "daily" | "weekly" | "monthly" | "annual";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface TrendPoint {
  period: string;
  revenue: number;
  orders: number;
}

export interface PaymentSplit {
  method: string;
  amount: number;
  count: number;
}

export interface DishMetric {
  name: string;
  quantity: number;
  revenue: number;
}

export interface CategoryMetric {
  category: string;
  revenue: number;
  quantity: number;
  discount: number;
}

export interface StaffMetric {
  staff: string;
  servedItems: number;
  closedOrders: number;
  avgTurnoverMinutes: number;
}

export interface KitchenMetric {
  kitchen: string;
  avgPrepMinutes: number;
  items: number;
}

export interface TableMetric {
  table: string;
  floor: string;
  avgDiningMinutes: number;
  orders: number;
}

export interface HourMetric {
  hour: number;
  orders: number;
}

export interface VoidDiscountMetric {
  staff: string;
  cancelledItems: number;
  discountValue: number;
}

export interface AnalyticsMetrics {
  revenueTrend: TrendPoint[];
  paymentSplit: PaymentSplit[];
  bestDishes: DishMetric[];
  worstDishes: DishMetric[];
  categoryPerformance: CategoryMetric[];
  staffPerformance: StaffMetric[];
  kitchenEfficiency: KitchenMetric[];
  tableTurnover: TableMetric[];
  peakHours: HourMetric[];
  voidsAndDiscounts: VoidDiscountMetric[];
}

function inRange(date: string | Date, range: DateRange): boolean {
  const t = new Date(date).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

function periodKey(date: Date, granularity: Granularity): string {
  const base = startOfDay(date);
  if (granularity === "weekly") {
    return format(startOfWeek(base, { weekStartsOn: 1 }), "yyyy-'W'ww");
  }
  if (granularity === "monthly") {
    return format(startOfMonth(base), "yyyy-MM");
  }
  if (granularity === "annual") {
    return format(startOfYear(base), "yyyy");
  }
  return format(base, "yyyy-MM-dd");
}

function staffInOutlet(outletId: string) {
  return db.staff.filter((s) =>
    db.staffRoles.some((sr) => sr.staff_id === s.id && sr.outlet_id === outletId)
  );
}

function menuItemName(id: string): string {
  return db.menuItems.find((m) => m.id === id)?.name ?? "Unknown";
}

function categoryName(id: string): string {
  return db.menuCategories.find((c) => c.id === id)?.name ?? "Unknown";
}

function kitchenName(id: string): string {
  return db.kitchens.find((k) => k.id === id)?.name ?? "Unknown";
}

function floorName(id: string): string {
  return db.floors.find((f) => f.id === id)?.name ?? "Unknown";
}

function staffName(id: string): string {
  return db.staff.find((s) => s.id === id)?.name ?? "Unknown";
}

export function getAnalytics(
  outletId: string,
  range: DateRange,
  granularity: Granularity
): AnalyticsMetrics {
  const paidBills = db.bills.filter(
    (b) => b.outlet_id === outletId && b.status === "paid" && b.closed_at && inRange(b.closed_at, range)
  );

  const closedOrders = db.orders.filter(
    (o) => o.outlet_id === outletId && o.status === "closed" && o.closed_at && inRange(o.closed_at, range)
  );

  const ordersInRange = db.orders.filter(
    (o) => o.outlet_id === outletId && inRange(o.created_at, range)
  );

  const orderIdsInRange = new Set(ordersInRange.map((o) => o.id));

  const orderItemsInRange = db.orderItems.filter(
    (i) => orderIdsInRange.has(i.order_id) && i.status !== "cancelled"
  );

  const trendMap = new Map<string, { revenue: number; orders: number }>();
  for (const bill of paidBills) {
    const key = periodKey(new Date(bill.closed_at!), granularity);
    const current = trendMap.get(key) ?? { revenue: 0, orders: 0 };
    current.revenue += bill.total_amount;
    current.orders += 1;
    trendMap.set(key, current);
  }
  const revenueTrend: TrendPoint[] = Array.from(trendMap.entries())
    .map(([period, value]) => ({ period, ...value }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const paymentMap = new Map<string, { amount: number; count: number }>();
  for (const payment of db.payments) {
    const bill = db.bills.find((b) => b.id === payment.bill_id);
    if (!bill || bill.outlet_id !== outletId || !inRange(payment.paid_at, range)) continue;
    const current = paymentMap.get(payment.payment_method) ?? { amount: 0, count: 0 };
    current.amount += payment.amount;
    current.count += 1;
    paymentMap.set(payment.payment_method, current);
  }
  const paymentSplit: PaymentSplit[] = Array.from(paymentMap.entries())
    .map(([method, value]) => ({ method, ...value }))
    .sort((a, b) => b.amount - a.amount);

  const dishMap = new Map<string, { quantity: number; revenue: number }>();
  const categoryMap = new Map<string, { revenue: number; quantity: number; discount: number }>();

  for (const item of orderItemsInRange) {
    const name = menuItemName(item.menu_item_id);
    const menuItem = db.menuItems.find((m) => m.id === item.menu_item_id);
    const category = menuItem ? categoryName(menuItem.category_id) : "Unknown";
    const itemRevenue = item.quantity * item.unit_price;

    const dish = dishMap.get(name) ?? { quantity: 0, revenue: 0 };
    dish.quantity += item.quantity;
    dish.revenue += itemRevenue;
    dishMap.set(name, dish);

    const cat = categoryMap.get(category) ?? { revenue: 0, quantity: 0, discount: 0 };
    cat.revenue += itemRevenue;
    cat.quantity += item.quantity;
    for (const discount of db.discounts) {
      if (discount.order_item_id === item.id && inRange(discount.created_at, range)) {
        cat.discount += discount.amount_deducted;
      }
    }
    categoryMap.set(category, cat);
  }

  const allDishes: DishMetric[] = Array.from(dishMap.entries())
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.revenue - a.revenue);
  const bestDishes = allDishes.slice(0, 5);
  const worstDishes = allDishes.slice(-5).reverse();

  const categoryPerformance: CategoryMetric[] = Array.from(categoryMap.entries())
    .map(([category, value]) => ({ category, ...value }))
    .sort((a, b) => b.revenue - a.revenue);

  const staffMap = new Map<
    string,
    { servedItems: number; totalMinutes: number; closedOrderIds: Set<string> }
  >();

  for (const item of db.orderItems) {
    if (!item.served_by || !item.served_at || !inRange(item.served_at, range)) continue;
    const order = db.orders.find((o) => o.id === item.order_id);
    if (!order || order.outlet_id !== outletId) continue;

    const staff = staffMap.get(item.served_by) ?? { servedItems: 0, totalMinutes: 0, closedOrderIds: new Set<string>() };
    staff.servedItems += item.quantity;
    if (order.closed_at) {
      const minutes = (new Date(order.closed_at).getTime() - new Date(order.created_at).getTime()) / 60000;
      staff.totalMinutes += minutes;
      staff.closedOrderIds.add(order.id);
    }
    staffMap.set(item.served_by, staff);
  }

  const staffPerformance: StaffMetric[] = Array.from(staffMap.entries()).map(([id, value]) => ({
    staff: staffName(id),
    servedItems: value.servedItems,
    closedOrders: value.closedOrderIds.size,
    avgTurnoverMinutes:
      value.closedOrderIds.size > 0 ? value.totalMinutes / value.closedOrderIds.size : 0,
  }));

  const kitchenMap = new Map<string, { totalMinutes: number; count: number }>();
  for (const item of db.orderItems) {
    if (!item.ready_at || !item.accepted_at) continue;
    const order = db.orders.find((o) => o.id === item.order_id);
    if (!order || order.outlet_id !== outletId || !inRange(item.ready_at, range)) continue;
    const minutes = (new Date(item.ready_at).getTime() - new Date(item.accepted_at).getTime()) / 60000;
    const kitchen = kitchenName(item.kitchen_id);
    const current = kitchenMap.get(kitchen) ?? { totalMinutes: 0, count: 0 };
    current.totalMinutes += minutes;
    current.count += 1;
    kitchenMap.set(kitchen, current);
  }
  const kitchenEfficiency: KitchenMetric[] = Array.from(kitchenMap.entries())
    .map(([kitchen, value]) => ({
      kitchen,
      avgPrepMinutes: value.count > 0 ? value.totalMinutes / value.count : 0,
      items: value.count,
    }))
    .sort((a, b) => a.avgPrepMinutes - b.avgPrepMinutes);

  const tableMap = new Map<string, { totalMinutes: number; count: number; floor: string }>();
  for (const order of closedOrders) {
    if (!order.table_id) continue;
    const table = db.tables.find((t) => t.id === order.table_id);
    if (!table) continue;
    const key = table.table_number;
    const minutes = (new Date(order.closed_at!).getTime() - new Date(order.created_at).getTime()) / 60000;
    const current = tableMap.get(key) ?? { totalMinutes: 0, count: 0, floor: floorName(table.floor_id) };
    current.totalMinutes += minutes;
    current.count += 1;
    tableMap.set(key, current);
  }
  const tableTurnover: TableMetric[] = Array.from(tableMap.entries())
    .map(([table, value]) => ({
      table,
      floor: value.floor,
      avgDiningMinutes: value.count > 0 ? value.totalMinutes / value.count : 0,
      orders: value.count,
    }))
    .sort((a, b) => a.table.localeCompare(b.table));

  const hours = new Map<number, number>();
  for (let i = 0; i < 24; i += 1) hours.set(i, 0);
  for (const order of ordersInRange) {
    const hour = new Date(order.created_at).getHours();
    hours.set(hour, (hours.get(hour) ?? 0) + 1);
  }
  const peakHours: HourMetric[] = Array.from(hours.entries())
    .map(([hour, orders]) => ({ hour, orders }))
    .sort((a, b) => a.hour - b.hour);

  const staffList = staffInOutlet(outletId);
  const voidsAndDiscounts: VoidDiscountMetric[] = staffList.map((s) => {
    const cancelledItems = db.orderItems.filter((i) => {
      if (i.status !== "cancelled") return false;
      const order = db.orders.find((o) => o.id === i.order_id);
      return order && order.outlet_id === outletId && order.captain_id === s.id && inRange(i.created_at, range);
    }).length;
    const discountValue = db.discounts
      .filter((d) => d.applied_by === s.id && inRange(d.created_at, range))
      .reduce((sum, d) => sum + d.amount_deducted, 0);
    return { staff: s.name, cancelledItems, discountValue };
  });

  return {
    revenueTrend,
    paymentSplit,
    bestDishes,
    worstDishes,
    categoryPerformance,
    staffPerformance,
    kitchenEfficiency,
    tableTurnover,
    peakHours,
    voidsAndDiscounts,
  };
}
