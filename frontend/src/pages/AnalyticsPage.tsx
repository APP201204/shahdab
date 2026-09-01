import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AnalyticsChart } from "@/components/AnalyticsChart";
import { EmptyState } from "@/components/EmptyState";
import { getAnalytics } from "@/services/analytics";
import type { Granularity } from "@/services/analytics";
import { inputClass, pageWrapper, pageHeader, sectionCard } from "@/lib/styles";
import { format, parseISO, startOfDay, endOfDay, subDays } from "date-fns";

export function AnalyticsPage() {
  const { outlet } = useAuth();
  const [start, setStart] = useState<Date>(() => startOfDay(subDays(new Date(), 30)));
  const [end, setEnd] = useState<Date>(() => endOfDay(new Date()));
  const [granularity, setGranularity] = useState<Granularity>("daily");

  if (!outlet) return null;

  const metrics = useMemo(
    () => getAnalytics(outlet.id, { start, end }, granularity),
    [outlet.id, start, end, granularity]
  );

  const totalRevenue = useMemo(
    () => metrics.revenueTrend.reduce((sum, p) => sum + p.revenue, 0),
    [metrics.revenueTrend]
  );
  const totalOrders = useMemo(
    () => metrics.revenueTrend.reduce((sum, p) => sum + p.orders, 0),
    [metrics.revenueTrend]
  );
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalPayments = useMemo(
    () => metrics.paymentSplit.reduce((sum, p) => sum + p.count, 0),
    [metrics.paymentSplit]
  );

  const formatCurrency = (n: number) => `${outlet.currency} ${n.toFixed(2)}`;

  const handleStartChange = (value: string) => {
    const date = parseISO(value);
    if (!isNaN(date.getTime())) setStart(startOfDay(date));
  };

  const handleEndChange = (value: string) => {
    const date = parseISO(value);
    if (!isNaN(date.getTime())) setEnd(endOfDay(date));
  };

  return (
    <div className={pageWrapper + " !space-y-3"}>
      <div className={pageHeader + " !gap-3"}>
        <div>
          <h2 className="text-2xl font-bold">Analytics</h2>
          <p className="text-muted-foreground">Performance and operational insights for this outlet.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <input
              type="date"
              value={format(start, "yyyy-MM-dd")}
              onChange={(e) => handleStartChange(e.target.value)}
              className={inputClass + " !py-1.5"}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <input
              type="date"
              value={format(end, "yyyy-MM-dd")}
              onChange={(e) => handleEndChange(e.target.value)}
              className={inputClass + " !py-1.5"}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Granularity</label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as Granularity)}
              className={inputClass + " !py-1.5"}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={sectionCard + " !p-3"}>
          <p className="text-sm text-muted-foreground">Revenue</p>
          <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className={sectionCard + " !p-3"}>
          <p className="text-sm text-muted-foreground">Closed Orders</p>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </div>
        <div className={sectionCard + " !p-3"}>
          <p className="text-sm text-muted-foreground">Avg. Order Value</p>
          <p className="text-2xl font-bold">{formatCurrency(avgOrderValue)}</p>
        </div>
        <div className={sectionCard + " !p-3"}>
          <p className="text-sm text-muted-foreground">Payments Recorded</p>
          <p className="text-2xl font-bold">{totalPayments}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnalyticsChart
          type="line"
          data={metrics.revenueTrend}
          xKey="period"
          yKey="revenue"
          color="#8884d8"
          title="Revenue trend"
        />
        <AnalyticsChart
          type="pie"
          data={metrics.paymentSplit}
          nameKey="method"
          valueKey="amount"
          title="Payment method split"
        />
        <AnalyticsChart
          type="bar"
          data={metrics.categoryPerformance}
          xKey="category"
          yKey="revenue"
          color="#8884d8"
          title="Revenue by category"
        />
        <AnalyticsChart
          type="bar"
          data={metrics.peakHours}
          xKey="hour"
          yKey="orders"
          color="#82ca9d"
          title="Peak hours (order volume)"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={sectionCard + " !p-3"}>
          <h3 className="mb-1.5 text-sm font-medium">Best dishes</h3>
          {metrics.bestDishes.length === 0 ? (
            <EmptyState title="No served items" description="No served items in this range." />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-medium">Dish</th>
                  <th className="py-1.5 font-medium">Qty</th>
                  <th className="py-1.5 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {metrics.bestDishes.map((d) => (
                  <tr key={d.name} className="border-b last:border-0">
                    <td className="py-1.5">{d.name}</td>
                    <td className="py-1.5">{d.quantity}</td>
                    <td className="py-1.5 text-right">{formatCurrency(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={sectionCard + " !p-3"}>
          <h3 className="mb-1.5 text-sm font-medium">Worst dishes</h3>
          {metrics.worstDishes.length === 0 ? (
            <EmptyState title="No served items" description="No served items in this range." />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-medium">Dish</th>
                  <th className="py-1.5 font-medium">Qty</th>
                  <th className="py-1.5 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {metrics.worstDishes.map((d) => (
                  <tr key={d.name} className="border-b last:border-0">
                    <td className="py-1.5">{d.name}</td>
                    <td className="py-1.5">{d.quantity}</td>
                    <td className="py-1.5 text-right">{formatCurrency(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={sectionCard + " !p-3"}>
          <h3 className="mb-1.5 text-sm font-medium">Staff performance</h3>
          {metrics.staffPerformance.length === 0 ? (
            <EmptyState title="No serving activity" description="No serving activity in this range." />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-medium">Staff</th>
                  <th className="py-1.5 font-medium">Items Served</th>
                  <th className="py-1.5 font-medium">Closed Orders</th>
                  <th className="py-1.5 font-medium text-right">Avg Turnover (min)</th>
                </tr>
              </thead>
              <tbody>
                {metrics.staffPerformance.map((s) => (
                  <tr key={s.staff} className="border-b last:border-0">
                    <td className="py-1.5">{s.staff}</td>
                    <td className="py-1.5">{s.servedItems}</td>
                    <td className="py-1.5">{s.closedOrders}</td>
                    <td className="py-1.5 text-right">{Math.round(s.avgTurnoverMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={sectionCard + " !p-3"}>
          <h3 className="mb-1.5 text-sm font-medium">Kitchen efficiency</h3>
          {metrics.kitchenEfficiency.length === 0 ? (
            <EmptyState title="No ready items" description="No ready items in this range." />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-medium">Kitchen</th>
                  <th className="py-1.5 font-medium">Items</th>
                  <th className="py-1.5 font-medium text-right">Avg Prep (min)</th>
                </tr>
              </thead>
              <tbody>
                {metrics.kitchenEfficiency.map((k) => (
                  <tr key={k.kitchen} className="border-b last:border-0">
                    <td className="py-1.5">{k.kitchen}</td>
                    <td className="py-1.5">{k.items}</td>
                    <td className="py-1.5 text-right">{Math.round(k.avgPrepMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={sectionCard + " !p-3"}>
          <h3 className="mb-1.5 text-sm font-medium">Table turnover</h3>
          {metrics.tableTurnover.length === 0 ? (
            <EmptyState title="No closed dine-in orders" description="No closed dine-in orders in this range." />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-medium">Table</th>
                  <th className="py-1.5 font-medium">Floor</th>
                  <th className="py-1.5 font-medium">Orders</th>
                  <th className="py-1.5 font-medium text-right">Avg Duration (min)</th>
                </tr>
              </thead>
              <tbody>
                {metrics.tableTurnover.map((t) => (
                  <tr key={t.table} className="border-b last:border-0">
                    <td className="py-1.5">{t.table}</td>
                    <td className="py-1.5">{t.floor}</td>
                    <td className="py-1.5">{t.orders}</td>
                    <td className="py-1.5 text-right">{Math.round(t.avgDiningMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={sectionCard + " !p-3"}>
          <h3 className="mb-1.5 text-sm font-medium">Voids &amp; discounts by staff</h3>
          {metrics.voidsAndDiscounts.length === 0 ? (
            <EmptyState title="No staff data" description="No staff data in this outlet." />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-medium">Staff</th>
                  <th className="py-1.5 font-medium">Cancelled Items</th>
                  <th className="py-1.5 font-medium text-right">Discount Value</th>
                </tr>
              </thead>
              <tbody>
                {metrics.voidsAndDiscounts.map((v) => (
                  <tr key={v.staff} className="border-b last:border-0">
                    <td className="py-1.5">{v.staff}</td>
                    <td className="py-1.5">{v.cancelledItems}</td>
                    <td className="py-1.5 text-right">{formatCurrency(v.discountValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
