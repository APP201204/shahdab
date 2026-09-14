import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DASHBOARD_TOTALS as T, HOURLY_REVENUE, SECTIONS } from "@/data/seed";
import { inr, num } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Discounts · SHADAB RestaurantOS" },
      {
        name: "description",
        content:
          "Sales, session and cancellation analytics plus discount rules for Shadab Restaurant.",
      },
      { property: "og:title", content: "Reports & Discounts · SHADAB RestaurantOS" },
      {
        property: "og:description",
        content: "Business insights and discount management for Shadab Restaurant.",
      },
    ],
  }),
  component: Reports,
});

const SESSIONS = [
  { no: 1, section: "Dine In", type: "Dine-in", status: "Completed", table: "Table 1", bill: "SH-10241", captain: "Imran", cashier: "Shabbir", start: "12:40", end: "13:55", duration: "1h 15m", amount: 3480 },
  { no: 2, section: "Aiwan-e-Khas", type: "Dine-in", status: "Completed", table: "Table 8", bill: "SH-10242", captain: "Naveed", cashier: "Shabbir", start: "13:30", end: "15:10", duration: "1h 40m", amount: 9820 },
  { no: 3, section: "Mezzanine", type: "Dine-in", status: "Cancelled", table: "Table 6", bill: "SH-10243", captain: "Faheem", cashier: "Rizwan", start: "12:05", end: "12:22", duration: "17m", amount: 0 },
  { no: 4, section: "AC Takeaway", type: "Takeaway", status: "Completed", table: "—", bill: "SH-10244", captain: "Counter", cashier: "Rizwan", start: "14:02", end: "14:11", duration: "9m", amount: 1240 },
  { no: 5, section: "Cafe", type: "Takeaway", status: "Completed", table: "—", bill: "SH-10245", captain: "Counter", cashier: "Rizwan", start: "16:20", end: "16:26", duration: "6m", amount: 320 },
];

const CANCELLATIONS = [
  { no: 1, bill: "SH-10243", type: "Dine-in", section: "Mezzanine", item: "Mutton Biryani", variant: "Family Pack", qty: 1, price: 1150, at: "12:19", table: "Table 6", reason: "Wrong Order" },
  { no: 2, bill: "SH-10248", type: "Takeaway", section: "AK Takeaway", item: "Chicken 65", variant: "Full", qty: 2, price: 290, at: "18:44", table: "—", reason: "Guest Cancelled" },
  { no: 3, bill: "SH-10251", type: "Dine-in", section: "Dine In", item: "Prawn Tawa Kebab", variant: "—", qty: 1, price: 420, at: "20:12", table: "Table 3", reason: "Out of Stock" },
];

const CATEGORY_SALES = [
  { name: "Biryani", sessions: 268, items: 412, avg: 620, revenue: 341200, discount: 12400 },
  { name: "Non Veg Starters", sessions: 141, items: 198, avg: 310, revenue: 92400, discount: 3100 },
  { name: "Breads", sessions: 210, items: 640, avg: 42, revenue: 26900, discount: 400 },
  { name: "Beverages", sessions: 302, items: 720, avg: 38, revenue: 31600, discount: 520 },
];

type Discount = {
  id: string;
  code: string;
  description: string;
  type: "percentage" | "flat";
  value: number;
  minBill: number;
  uses: number;
  active: boolean;
};

const INITIAL_DISCOUNTS: Discount[] = [
  { id: "d1", code: "LUNCH15", description: "Weekday lunch offer", type: "percentage", value: 15, minBill: 400, uses: 214, active: true },
  { id: "d2", code: "FAMILY100", description: "Flat off on family packs", type: "flat", value: 100, minBill: 1200, uses: 68, active: true },
  { id: "d3", code: "RAMZAN20", description: "Seasonal iftar discount", type: "percentage", value: 20, minBill: 800, uses: 431, active: false },
];

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-1 p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function Reports() {
  const [discounts, setDiscounts] = useState(INITIAL_DISCOUNTS);
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports &amp; Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive business insights and performance metrics.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Showing all sections · Today</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select defaultValue="all">
            <SelectTrigger className="h-9 w-[150px] bg-card">
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
          <Select defaultValue="today">
            <SelectTrigger className="h-9 w-[130px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="whole">
            <SelectTrigger className="h-9 w-[170px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whole">Whole service day</SelectItem>
              <SelectItem value="lunch">Lunch hours</SelectItem>
              <SelectItem value="dinner">Dinner hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="flex-wrap">
          <TabsTrigger value="sales">Sales Reports</TabsTrigger>
          <TabsTrigger value="sessions">Session Reports</TabsTrigger>
          <TabsTrigger value="cancellations">Cancellation Reports</TabsTrigger>
          <TabsTrigger value="discounts">Discounts</TabsTrigger>
          <TabsTrigger value="more">Returns &amp; More</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Revenue"
              value={inr(T.revenue, false)}
              hint={`From ${T.completed} completed sessions`}
            />
            <StatCard
              label="Total Sessions"
              value={num(T.sessions)}
              hint={`${T.completed} completed · ${T.cancelled} voided`}
            />
            <StatCard
              label="Net Revenue"
              value={inr(T.revenue - T.discounts, false)}
              hint={`After discounts: ${inr(T.discounts, false)}`}
            />
            <StatCard
              label="Taxes & Charges"
              value={inr(T.taxes + T.service, false)}
              hint={`Tax ${inr(T.taxes, false)} · Service ${inr(T.service, false)} · Rounding ${inr(T.rounded, false)}`}
            />
          </div>

          <Card className="gap-3 p-4 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Sales Trend</h2>
              <Select defaultValue="daily">
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="h-60">
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
                  <Bar dataKey="revenue" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="gap-3 p-4 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Sales by Category</h2>
              <Button variant="outline" size="sm">
                <Download className="size-4" /> Export to Excel
              </Button>
            </div>
            <div className="space-y-2">
              {CATEGORY_SALES.map((c) => (
                <div key={c.name} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.sessions} sessions · {c.items} items · avg {inr(c.avg, false)}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <span>
                      Total <b className="tabular-nums">{inr(c.revenue, false)}</b>
                    </span>
                    <span>
                      Discount{" "}
                      <b className="tabular-nums text-destructive">{inr(c.discount, false)}</b>
                    </span>
                    <span>
                      Net{" "}
                      <b className="tabular-nums text-success">
                        {inr(c.revenue - c.discount, false)}
                      </b>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Completed Sessions" value={num(T.completed)} hint="318 dine-in · 144 takeaway" />
            <StatCard label="Cancelled Sessions" value={num(T.cancelled)} hint="3.5% of all sessions" />
            <StatCard label="Average Session Value" value={inr(T.revenue / T.completed, false)} />
            <StatCard label="Average Duration" value="42m" hint="Dine-in 58m · Takeaway 8m" />
          </div>

          <Card className="gap-3 p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Session Details</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input placeholder="Search waiter, bill, table..." className="h-9 w-[220px] pl-8" />
                </div>
                <Button variant="outline" size="sm">
                  <Download className="size-4" /> Export
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-muted px-2 py-1">
                Total {inr(SESSIONS.reduce((s, r) => s + r.amount, 0), false)}
              </span>
              <span className="rounded-full bg-success-soft px-2 py-1 text-success">Cash ₹8,240</span>
              <span className="rounded-full bg-primary-soft px-2 py-1 text-primary">Card ₹5,380</span>
              <span className="rounded-full bg-info-soft px-2 py-1 text-info">UPI ₹1,240</span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Bill No.</TableHead>
                    <TableHead>Captain</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SESSIONS.map((s) => (
                    <TableRow key={s.no}>
                      <TableCell>{s.no}</TableCell>
                      <TableCell>{s.section}</TableCell>
                      <TableCell>{s.type}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            s.status === "Completed"
                              ? "bg-success-soft text-success"
                              : "bg-danger-soft text-destructive",
                          )}
                        >
                          {s.status}
                        </span>
                      </TableCell>
                      <TableCell>{s.table}</TableCell>
                      <TableCell className="font-medium text-primary">{s.bill}</TableCell>
                      <TableCell>{s.captain}</TableCell>
                      <TableCell>{s.cashier}</TableCell>
                      <TableCell>{s.start}</TableCell>
                      <TableCell>{s.end}</TableCell>
                      <TableCell>{s.duration}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="cancellations" className="space-y-4 pt-4">
          <Card className="gap-3 p-4 shadow-card">
            <div>
              <h2 className="text-sm font-semibold">Cancellation Details</h2>
              <p className="text-xs text-muted-foreground">
                Detailed list of all cancelled items ({CANCELLATIONS.length} total)
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead>Bill No.</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Cancelled At</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CANCELLATIONS.map((c) => (
                    <TableRow key={c.no}>
                      <TableCell>{c.no}</TableCell>
                      <TableCell className="font-medium text-primary">{c.bill}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                          {c.type}
                        </span>
                      </TableCell>
                      <TableCell>{c.section}</TableCell>
                      <TableCell>{c.item}</TableCell>
                      <TableCell>{c.variant}</TableCell>
                      <TableCell>{c.qty}</TableCell>
                      <TableCell className="tabular-nums">{inr(c.price, false)}</TableCell>
                      <TableCell className="tabular-nums">{inr(c.price * c.qty, false)}</TableCell>
                      <TableCell>{c.at}</TableCell>
                      <TableCell>{c.table}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] text-warning-foreground">
                          {c.reason}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="discounts" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Discount Management</h2>
              <p className="text-xs text-muted-foreground">
                Create and manage discount rules for your restaurant.
              </p>
            </div>
            <Button size="sm">
              <Plus className="size-4" /> New Discount
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total" value={String(discounts.length)} />
            <StatCard label="Active" value={String(discounts.filter((d) => d.active).length)} />
            <StatCard label="Inactive" value={String(discounts.filter((d) => !d.active).length)} />
            <StatCard
              label="Total Uses"
              value={num(discounts.reduce((s, d) => s + d.uses, 0))}
            />
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search discounts..."
              className="h-9 bg-card pl-8"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {discounts
              .filter((d) => d.code.toLowerCase().includes(query.toLowerCase()))
              .map((d) => (
                <Card key={d.id} className="gap-3 p-4 shadow-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-bold">
                        {d.code}
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                          {d.type}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">{d.description}</p>
                      <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px]">
                        Min bill: {inr(d.minBill, false)}
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {d.type === "percentage" ? `${d.value}%` : inr(d.value, false)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={d.active}
                        onCheckedChange={(v) =>
                          setDiscounts((prev) =>
                            prev.map((x) => (x.id === d.id ? { ...x, active: v } : x)),
                          )
                        }
                      />
                      {d.active ? "Active" : "Inactive"}
                    </label>
                    <span className="text-xs text-muted-foreground">{d.uses} uses</span>
                  </div>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="more" className="pt-4">
          <Card className="p-10 text-center shadow-card">
            <p className="text-sm font-medium">Returns, Compare, Customer Reports & AI Insights</p>
            <p className="mt-1 text-xs text-muted-foreground">
              These reports are planned — the same filters and chrome will apply once wired up.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
