import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_TOTALS as T,
  DISH_PERFORMANCE,
  HOURLY_REVENUE,
  SECTIONS,
  SECTION_REVENUE,
  WORST_DISHES,
} from "@/data/seed";
import { inr, num, pct } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · SHADAB RestaurantOS" },
      {
        name: "description",
        content:
          "Live revenue, payment mix, session counts and section performance for Shadab Restaurant.",
      },
      { property: "og:title", content: "Dashboard · SHADAB RestaurantOS" },
      {
        property: "og:description",
        content: "Live revenue, payment mix and section performance for Shadab Restaurant.",
      },
    ],
  }),
  component: Dashboard,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-success" : "text-destructive"}`}
    >
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {pct(value)}
    </span>
  );
}

function Dashboard() {
  const [dishView, setDishView] = useState<"best" | "worst">("best");
  const dishes = dishView === "best" ? DISH_PERFORMANCE : WORST_DISHES;
  const totalSectionRevenue = SECTION_REVENUE.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hi, Shabbir!</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="today">
            <SelectTrigger className="h-9 w-[140px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="h-9 w-[160px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {SECTIONS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-2 p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total Revenue
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold tabular-nums">{inr(T.revenue)}</p>
            <Delta value={T.revenueChange} />
          </div>
          <p className="text-xs text-muted-foreground">
            Taxes: {inr(T.taxes, false)} · Service: {inr(T.service, false)} · Rounded:{" "}
            {inr(T.rounded, false)}
          </p>
          <p className="text-xs font-medium">
            Net Revenue{" "}
            <span className="text-muted-foreground">
              (− {inr(T.creditNotes, false)} credit notes)
            </span>{" "}
            {inr(T.revenue - T.creditNotes)}
          </p>
        </Card>

        <Card className="gap-2 p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Payment Methods
          </p>
          {[
            ["Cash", T.cash, T.cashChange],
            ["Card", T.card, T.cardChange],
            ["UPI", T.upi, T.upiChange],
          ].map(([label, value, change]) => (
            <div key={label as string} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{label as string}</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">{inr(value as number, false)}</span>
                <Delta value={change as number} />
              </span>
            </div>
          ))}
        </Card>

        <Card className="gap-2 p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Financial Adjustments
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Discounts</span>
            <span className="font-semibold tabular-nums">{inr(T.discounts, false)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Credit Notes
              <span className="ml-1 text-xs">(Owed {inr(T.creditNotesOwed, false)})</span>
            </span>
            <span className="font-semibold tabular-nums">{inr(T.creditNotes, false)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Expenses</span>
            <span className="font-semibold tabular-nums">{inr(T.expenses, false)}</span>
          </div>
        </Card>

        <Card className="gap-2 p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total Sessions
          </p>
          <p className="text-2xl font-bold tabular-nums">{num(T.sessions)}</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
              {T.completed} completed
            </span>
            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-destructive">
              {T.cancelled} cancelled
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {num(T.items)} items
            </span>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="gap-3 p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Revenue breakdown</h2>
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              Hourly
            </span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={HOURLY_REVENUE}>
                <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={34}
                />
                <Tooltip formatter={(v) => inr(Number(v), false)} />
                <Bar dataKey="revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="gap-3 p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Dish Performance</h2>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={dishView === "best" ? "default" : "outline"}
                onClick={() => setDishView("best")}
                className="h-7 px-2 text-xs"
              >
                Best 5
              </Button>
              <Button
                size="sm"
                variant={dishView === "worst" ? "default" : "outline"}
                onClick={() => setDishView("worst")}
                className="h-7 px-2 text-xs"
              >
                Worst 5
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-44 w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dishes} dataKey="value" innerRadius={40} outerRadius={68} paddingAngle={2}>
                    {dishes.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => inr(Number(v), false)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-1/2 space-y-1.5 text-xs">
              {dishes.map((d, i) => (
                <li key={d.name} className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="tabular-nums text-muted-foreground">{inr(d.value, false)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="gap-3 p-4 shadow-card">
          <h2 className="text-sm font-semibold">Section Revenue</h2>
          <div className="space-y-3">
            {SECTION_REVENUE.map((row) => {
              const section = SECTIONS.find((s) => s.id === row.sectionId)!;
              const share = (row.amount / totalSectionRevenue) * 100;
              return (
                <div key={row.sectionId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{section.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {inr(row.amount, false)} · {row.bills} bills · {share.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${share}%`, background: section.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
