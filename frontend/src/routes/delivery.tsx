import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery · SHADAB RestaurantOS" },
      {
        name: "description",
        content: "Track Shadab delivery orders from packing to dispatch and completion.",
      },
      { property: "og:title", content: "Delivery · SHADAB RestaurantOS" },
      { property: "og:description", content: "Delivery order queue for Shadab Restaurant." },
    ],
  }),
  component: Delivery,
});

type Status = "packing" | "dispatched" | "delivered";

type Order = {
  id: string;
  bill: string;
  customer: string;
  area: string;
  rider: string;
  items: number;
  total: number;
  status: Status;
  placed: string;
};

const INITIAL: Order[] = [
  { id: "o1", bill: "SH-D-441", customer: "Ayesha Khan", area: "Charminar", rider: "Salim", items: 4, total: 1420, status: "packing", placed: "19:42" },
  { id: "o2", bill: "SH-D-442", customer: "Ravi Teja", area: "Malakpet", rider: "Anwar", items: 2, total: 860, status: "dispatched", placed: "19:31" },
  { id: "o3", bill: "SH-D-443", customer: "Zoya Fatima", area: "Nampally", rider: "Salim", items: 6, total: 2380, status: "delivered", placed: "18:58" },
];

const styles: Record<Status, string> = {
  packing: "bg-warning-soft text-warning-foreground",
  dispatched: "bg-primary-soft text-primary",
  delivered: "bg-success-soft text-success",
};

function Delivery() {
  const [orders, setOrders] = useState<Order[]>(INITIAL);

  const advance = (id: string) =>
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, status: o.status === "packing" ? "dispatched" : "delivered" }
          : o,
      ),
    );

  return (
    <div className="space-y-5 p-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Delivery</h1>
        <p className="text-sm text-muted-foreground">
          Orders going out for delivery — packing, dispatch and completion.
        </p>
      </div>

      <Card className="p-4 shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill No.</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Rider</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium text-primary">{o.bill}</TableCell>
                <TableCell>{o.customer}</TableCell>
                <TableCell>{o.area}</TableCell>
                <TableCell>{o.rider}</TableCell>
                <TableCell>{o.items}</TableCell>
                <TableCell className="tabular-nums">{inr(o.total, false)}</TableCell>
                <TableCell>{o.placed}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                      styles[o.status],
                    )}
                  >
                    {o.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={o.status === "delivered"}
                    onClick={() => advance(o.id)}
                  >
                    {o.status === "packing" ? "Dispatch" : "Mark delivered"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
