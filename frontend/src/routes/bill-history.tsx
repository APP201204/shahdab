import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { History, Printer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SECTIONS, TAXES } from "@/data/seed";
import { inr, timeOf } from "@/lib/format";
import { useBills } from "@/hooks/useBills";
import type { Bill } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/bill-history")({
  head: () => ({
    meta: [
      { title: "Bill History · SHADAB RestaurantOS" },
      {
        name: "description",
        content: "Closed bills with reprint for Shadab Restaurant.",
      },
      { property: "og:title", content: "Bill History · SHADAB RestaurantOS" },
    ],
  }),
  component: BillHistory,
});

const METHOD_LABEL = { cash: "Cash", card: "Card", upi: "UPI", wallet: "Wallet" } as const;

function BillHistory() {
  const { data, isLoading } = useBills();
  const bills = data?.bills ?? [];
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Bill | null>(null);

  if (isLoading) {
    return <div className="p-5 text-muted-foreground">Loading bills…</div>;
  }

  const filtered = bills.filter((b) => {
    const q = query.toLowerCase();
    return (
      !q ||
      b.number.toLowerCase().includes(q) ||
      b.unitName.toLowerCase().includes(q) ||
      b.cashier.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 p-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <History className="size-5 text-brand-alt" /> Bill History
        </h1>
        <p className="text-sm text-muted-foreground">
          Closed bills for this session — open any bill to reprint.
        </p>
      </div>

      <Input
        placeholder="Search bill no, table, cashier..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-9 w-[280px]"
      />

      <Card className="shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill No</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Table / Counter</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead>Closed At</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.number}</TableCell>
                <TableCell className="capitalize">{b.orderType}</TableCell>
                <TableCell>{b.unitName}</TableCell>
                <TableCell>
                  {SECTIONS.find((s) => s.id === b.sectionId)?.name ?? b.sectionId}
                </TableCell>
                <TableCell>{b.cashier}</TableCell>
                <TableCell>{b.closedAt ? timeOf(b.closedAt) : "—"}</TableCell>
                <TableCell className="text-xs">
                  {b.payments.map((p) => METHOD_LABEL[p.method]).join(" + ")}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {inr(b.total)}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setOpen(b)}>
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  No bills match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {open?.number} — {open?.unitName}
            </DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                {open.items.map((i) => (
                  <div key={i.id} className="flex justify-between">
                    <span>
                      {i.name}
                      {i.variant ? ` (${i.variant})` : ""} × {i.qty}
                    </span>
                    <span className="tabular-nums">{inr(i.qty * i.unitPrice)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 border-t border-border pt-2 text-xs tabular-nums">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{inr(open.subtotal)}</span>
                </div>
                {open.discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Discount</span>
                    <span>−{inr(open.discount)}</span>
                  </div>
                )}
                {TAXES.map((t) => (
                  <div key={t.id} className="flex justify-between text-muted-foreground">
                    <span>
                      {t.name} @ {t.rate}%
                    </span>
                    <span>{inr(Math.round(((open.subtotal - open.discount) * t.rate) / 100))}</span>
                  </div>
                ))}
                {open.serviceCharge > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service Charge</span>
                    <span>{inr(open.serviceCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1 text-sm font-bold">
                  <span>Total</span>
                  <span>{inr(open.total)}</span>
                </div>
                {open.payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-muted-foreground">
                    <span>{METHOD_LABEL[p.method]}</span>
                    <span>{inr(p.amount)}</span>
                  </div>
                ))}
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => toast.success(`Bill ${open.number} sent to printer`)}
              >
                <Printer className="size-4" /> Reprint Bill
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
