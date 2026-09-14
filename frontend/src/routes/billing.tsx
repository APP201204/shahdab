import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  CornerUpLeft,
  CreditCard,
  Divide,
  IndianRupee,
  Layers,
  Receipt,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SECTIONS, TAXES, type Payment, type PaymentMethod } from "@/data/seed";
import { inr, timeOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBillingQueue, useCloseBill } from "@/hooks/useBilling";
import { useStaff } from "@/hooks/useStaff";
import { OrderLine } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Cashier · SHADAB RestaurantOS" },
      {
        name: "description",
        content: "Bill requests, discounts, splits and payments at the Shadab billing station.",
      },
      { property: "og:title", content: "Cashier · SHADAB RestaurantOS" },
    ],
  }),
  component: Billing,
});

const METHODS: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "wallet", label: "Wallet", icon: Wallet },
];

type Discount = { kind: "flat" | "percent"; value: number };

type SubBill = {
  name: string;
  items: OrderLine[];
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  total: number;
  mrpTotal: number;
  rounding: number;
  payments: Payment[];
};

type QueueUnit = {
  id: string;
  name: string;
  sectionId: string;
  sectionName: string;
  requested: boolean;
  waiter?: string | undefined;
  guests: number;
  startedAt?: string | null | undefined;
  order?: { id: string; status: string } | null;
  items: OrderLine[];
};

function computeTotals(
  items: OrderLine[],
  discount: Discount,
  serviceChargeRate: number,
): Omit<SubBill, "name" | "items" | "payments"> {
  const active = items.filter((i) => i.status !== "cancelled");
  const standard = active.filter((i) => !i.mrp);
  const mrpItems = active.filter((i) => i.mrp);
  const standardSubtotal = standard.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const mrpSubtotal = mrpItems.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const subtotal = standardSubtotal + mrpSubtotal;
  const discountAmt =
    discount.kind === "flat"
      ? Math.min(discount.value, standardSubtotal)
      : Math.round((standardSubtotal * discount.value) / 100);
  const taxable = standardSubtotal - discountAmt;
  const tax = Math.round((taxable * TAXES.reduce((s, t) => s + t.rate, 0)) / 100);
  const serviceCharge = Math.round((taxable * serviceChargeRate) / 100);
  const preRound = taxable + tax + serviceCharge + mrpSubtotal;
  const rounded = Math.round(preRound);
  const rounding = Number((rounded - preRound).toFixed(2));
  return {
    subtotal,
    discount: discountAmt,
    tax,
    serviceCharge,
    mrpTotal: mrpSubtotal,
    rounding,
    total: rounded,
  };
}

function Billing() {
  const { data: queueData } = useBillingQueue();
  const { data: staffData } = useStaff("SHADAB");
  const closeBillApi = useCloseBill();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discount, setDiscount] = useState<Discount>({ kind: "flat", value: 0 });
  const [splitMode, setSplitMode] = useState<"none" | "equal" | "item">("none");
  const [splitCount, setSplitCount] = useState(2);
  const [splitNames, setSplitNames] = useState<string[]>(["Split 1", "Split 2"]);
  const [itemAllocations, setItemAllocations] = useState<Record<string, number[]>>({});
  const [splitOpen, setSplitOpen] = useState(false);
  const [payments, setPayments] = useState<Record<number, Payment[]>>({});
  const [payDraft, setPayDraft] = useState<
    Record<number, { method: PaymentMethod; amount: string }>
  >({});
  const [detailsOpen, setDetailsOpen] = useState(false);

  const queue = useMemo<QueueUnit[]>(() => {
    return (queueData?.queue ?? []).map((u) => ({
      id: u.unitId,
      name: u.unitName,
      sectionId: u.sectionId,
      sectionName: SECTIONS.find((s) => s.id === u.sectionId)?.name ?? u.sectionId,
      requested: u.requested,
      waiter: u.waiter,
      guests: u.guests,
      startedAt: u.startedAt,
      order: u.order,
      items: (u.items ?? []).filter((l) => l.status !== "cancelled"),
    }));
  }, [queueData]);

  const selected = queue.find((u) => u.id === selectedId) ?? queue[0] ?? null;

  const selectUnit = (id: string) => {
    setSelectedId(id);
    setDiscount({ kind: "flat", value: 0 });
    setSplitMode("none");
    setSplitCount(2);
    setSplitNames(["Split 1", "Split 2"]);
    setItemAllocations({});
    setSplitOpen(false);
    setDetailsOpen(false);
    setPayments({});
    setPayDraft({});
  };

  const serviceChargeRate = selected
    ? (SECTIONS.find((s) => s.id === selected.sectionId)?.serviceCharge ?? 0)
    : 0;

  const subBills = useMemo<SubBill[]>(() => {
    if (!selected) return [];
    const active = selected.items.filter((i) => i.status !== "cancelled");
    if (splitMode === "equal" && splitCount > 1) {
      const base = computeTotals(active, discount, serviceChargeRate);
      const per = Math.round(base.total / splitCount);
      return Array.from({ length: splitCount }, (_, i) => ({
        name: splitNames[i] || `Split ${i + 1}`,
        items: active,
        subtotal: base.subtotal,
        discount: base.discount,
        tax: base.tax,
        serviceCharge: base.serviceCharge,
        mrpTotal: base.mrpTotal,
        rounding: base.rounding,
        total: i === splitCount - 1 ? base.total - per * (splitCount - 1) : per,
        payments: payments[i] ?? [],
      }));
    }
    if (splitMode === "item" && splitCount > 1) {
      return Array.from({ length: splitCount }, (_, i) => {
        const lines = active
          .map((item) => ({ ...item, qty: itemAllocations[item.id]?.[i] ?? 0 }))
          .filter((item) => item.qty > 0);
        return {
          name: splitNames[i] || `Split ${i + 1}`,
          items: lines,
          ...computeTotals(lines, discount, serviceChargeRate),
          payments: payments[i] ?? [],
        };
      });
    }
    return [
      {
        name: "Bill",
        items: active,
        ...computeTotals(active, discount, serviceChargeRate),
        payments: payments[0] ?? [],
      },
    ];
  }, [
    selected,
    splitMode,
    splitCount,
    splitNames,
    itemAllocations,
    discount,
    serviceChargeRate,
    payments,
  ]);

  const mainBill = subBills[0];

  const addPayment = (idx: number, due: number) => {
    const draft = payDraft[idx] ?? { method: "cash" as PaymentMethod, amount: "" };
    const amount = Math.round(Number(draft.amount) || due - paidFor(idx));
    if (amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const paid = paidFor(idx);
    if (paid + amount > due) {
      toast.error(`Amount exceeds balance due (${inr(due - paid)})`);
      return;
    }
    setPayments((prev) => ({
      ...prev,
      [idx]: [...(prev[idx] ?? []), { id: `p${Date.now()}`, method: draft.method, amount }],
    }));
  };

  const paidFor = (idx: number) => (payments[idx] ?? []).reduce((s, p) => s + p.amount, 0);

  const allSettled = subBills.every((b, i) => paidFor(i) >= b.total && b.total > 0);

  const closeBill = () => {
    if (!selected) return;
    if (!allSettled) {
      toast.error("Collect full payment on every sub-bill before closing");
      return;
    }
    if (!selected.order) {
      toast.error("No order found for this unit");
      return;
    }
    const cashierId = staffData?.staff[0]?.id;
    if (!cashierId) {
      toast.error("No staff available to record the bill");
      return;
    }
    const allPayments = Object.values(payments).flat();
    closeBillApi.mutate(
      {
        orderId: selected.order.id,
        payments: allPayments,
        cashierId,
        customer: selected.name,
        discount,
      },
      {
        onSuccess: (bill) => {
          toast.success(`Bill ${bill.number} closed — ${selected.name} marked Paid`);
          setSelectedId(null);
          setPayments({});
          setPayDraft({});
          setSplitMode("none");
          setSplitCount(2);
          setSplitNames(["Split 1", "Split 2"]);
          setItemAllocations({});
        },
        onError: (err: any) => toast.error(err?.message ?? "Could not close bill"),
      }
    );
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Receipt className="size-5 text-brand-alt" /> Cashier — Billing Station
          </h1>
          <p className="text-sm text-muted-foreground">
            Bill requests queue, discounts, splits and payments.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/bill-history">Bill History</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="gap-2 self-start p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bill Requests &amp; Open Orders
          </p>
          {queue.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No tables awaiting billing.
            </p>
          )}
          <ScrollArea className="max-h-[560px]">
            <div className="space-y-2">
              {queue.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUnit(u.id)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    selected?.id === u.id
                      ? "border-primary bg-primary-soft"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{u.name}</span>
                    {u.requested && (
                      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-warning-foreground">
                        Bill Requested
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {u.sectionName}
                    {u.waiter ? ` · ${u.waiter}` : ""} · {u.items.length} items ·{" "}
                    {inr(
                      u.items.reduce((s, i) => s + i.qty * i.unitPrice, 0),
                      false,
                    )}
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {selected ? (
          <Card className="gap-4 p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {selected.sectionName}
                  {selected.waiter ? ` · Waiter: ${selected.waiter}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {splitMode !== "none" && (
                  <span className="text-xs text-muted-foreground">
                    {splitCount} {splitMode === "equal" ? "equal" : "item"} splits
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={() => setSplitOpen(true)}>
                  {splitMode === "none" ? "Split bill" : "Edit split"}
                </Button>
                {splitMode !== "none" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSplitMode("none");
                      setSplitCount(2);
                      setSplitNames(["Split 1", "Split 2"]);
                      setItemAllocations({});
                      setPayments({});
                      setPayDraft({});
                    }}
                  >
                    Clear
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setDetailsOpen(true)}>
                  View details
                </Button>
              </div>
            </div>

            {selected && (
              <SplitBillDialog
                open={splitOpen}
                onOpenChange={setSplitOpen}
                items={selected.items}
                mode={splitMode}
                count={splitCount}
                names={splitNames}
                allocations={itemAllocations}
                onApply={(draft) => {
                  setSplitMode(draft.mode);
                  setSplitCount(draft.count);
                  setSplitNames(draft.names);
                  setItemAllocations(draft.mode === "item" ? draft.allocations : {});
                  setPayments({});
                  setPayDraft({});
                }}
              />
            )}

            {selected && mainBill && (
              <BillingDetailsDialog
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                selected={selected}
                bill={mainBill}
                payments={payments[0] ?? []}
                paymentDraft={payDraft[0] ?? { method: "cash" as PaymentMethod, amount: "" }}
                onPaymentDraftChange={(method, amount) =>
                  setPayDraft((prev) => ({
                    ...prev,
                    [0]: { method: method as PaymentMethod, amount },
                  }))
                }
                onAddPayment={() => addPayment(0, mainBill.total)}
                onCloseBill={closeBill}
                canClose={allSettled}
                splitMode={splitMode}
              />
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Items
                </p>
                <div className="space-y-1.5">
                  {selected.items.map((l) => (
                    <div
                      key={l.id}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm",
                        l.status === "cancelled" && "opacity-50 line-through",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate">
                          {l.name}
                          {l.variant ? ` (${l.variant})` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {inr(l.unitPrice, false)} × {l.qty}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums">
                        {inr(l.qty * l.unitPrice, false)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Discount</Label>
                    <Select
                      value={discount.kind}
                      onValueChange={(v) =>
                        setDiscount((d) => ({ ...d, kind: v as Discount["kind"] }))
                      }
                    >
                      <SelectTrigger className="h-8 w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat ₹</SelectItem>
                        <SelectItem value="percent">Percent %</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={discount.value}
                    onChange={(e) =>
                      setDiscount((d) => ({
                        ...d,
                        value: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-8 w-24"
                  />
                  <p className="pb-1.5 text-xs text-muted-foreground">applied by Shabbir</p>
                </div>
              </div>

              <div className="space-y-3">
                {subBills.map((b, i) => {
                  const paid = paidFor(i);
                  const due = b.total - paid;
                  return (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{b.name}</p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            due <= 0
                              ? "bg-success-soft text-success"
                              : "bg-warning-soft text-warning-foreground",
                          )}
                        >
                          {due <= 0 ? "Settled" : `${inr(due)} due`}
                        </span>
                      </div>
                      <div className="mt-2 space-y-0.5 text-xs tabular-nums">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Subtotal</span>
                          <span>{inr(b.subtotal)}</span>
                        </div>
                        {b.discount > 0 && (
                          <div className="flex justify-between text-success">
                            <span>Discount</span>
                            <span>−{inr(b.discount)}</span>
                          </div>
                        )}
                        {TAXES.map((t) => (
                          <div key={t.id} className="flex justify-between text-muted-foreground">
                            <span>
                              {t.name} @ {t.rate}%
                            </span>
                            <span>
                              {inr(Math.round(((b.subtotal - b.discount) * t.rate) / 100))}
                            </span>
                          </div>
                        ))}
                        {b.serviceCharge > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Service Charge @ {serviceChargeRate}%</span>
                            <span>{inr(b.serviceCharge)}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-border pt-1 text-sm font-bold">
                          <span>Total</span>
                          <span>{inr(b.total)}</span>
                        </div>
                      </div>

                      <div className="mt-2 space-y-1">
                        {b.payments.map((p) => {
                          const m = METHODS.find((x) => x.id === p.method)!;
                          return (
                            <div key={p.id} className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <m.icon className="size-3.5" /> {m.label}
                              </span>
                              <span className="tabular-nums">{inr(p.amount)}</span>
                            </div>
                          );
                        })}
                        {due > 0 && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <Select
                              value={(payDraft[i]?.method ?? "cash") as string}
                              onValueChange={(v) =>
                                setPayDraft((prev) => ({
                                  ...prev,
                                  [i]: {
                                    method: v as PaymentMethod,
                                    amount: prev[i]?.amount ?? "",
                                  },
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 w-[100px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {METHODS.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min={0}
                              placeholder={String(due)}
                              value={payDraft[i]?.amount ?? ""}
                              onChange={(e) =>
                                setPayDraft((prev) => ({
                                  ...prev,
                                  [i]: {
                                    method: prev[i]?.method ?? "cash",
                                    amount: e.target.value,
                                  },
                                }))
                              }
                              className="h-8 w-28"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addPayment(i, b.total)}
                            >
                              Add
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                Taxes &amp; service charge applied on discounted subtotal ·{" "}
                {timeOf(new Date().toISOString())}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => toast.success("Bill sent to printer")}>
                  Print
                </Button>
                <Button onClick={closeBill} disabled={!allSettled}>
                  <IndianRupee className="size-4" /> Close Bill
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="flex min-h-[300px] items-center justify-center p-4 shadow-card">
            <p className="text-sm text-muted-foreground">
              Select a table from the queue to generate its bill.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function SplitBillDialog({
  open,
  onOpenChange,
  items,
  mode,
  count,
  names,
  allocations,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: OrderLine[];
  mode: "none" | "equal" | "item";
  count: number;
  names: string[];
  allocations: Record<string, number[]>;
  onApply: (draft: {
    mode: "equal" | "item";
    count: number;
    names: string[];
    allocations: Record<string, number[]>;
  }) => void;
}) {
  const [draftMode, setDraftMode] = useState<"equal" | "item">(mode === "none" ? "equal" : mode);
  const [draftCount, setDraftCount] = useState(count);
  const [draftNames, setDraftNames] = useState<string[]>([]);
  const [draftAllocations, setDraftAllocations] = useState<Record<string, number[]>>({});

  const billable = useMemo(() => items.filter((i) => i.status !== "cancelled"), [items]);

  useEffect(() => {
    if (!open) return;
    setDraftMode(mode === "none" ? "equal" : mode);
    setDraftCount(count);
    const nextNames = Array.from({ length: count }, (_, i) => names[i] || `Split ${i + 1}`);
    setDraftNames(nextNames);
    const next: Record<string, number[]> = {};
    billable.forEach((item) => {
      next[item.id] = Array.from({ length: count }, (_, i) => allocations[item.id]?.[i] ?? 0);
    });
    setDraftAllocations(next);
  }, [open, billable, mode, count, names, allocations]);

  const handleCountChange = (c: number) => {
    const clamped = Math.max(2, Math.min(6, c));
    setDraftCount(clamped);
    setDraftNames((prev) => {
      const next = prev.slice(0, clamped);
      while (next.length < clamped) next.push(`Split ${next.length + 1}`);
      return next;
    });
    setDraftAllocations((prev) => {
      const next: Record<string, number[]> = {};
      billable.forEach((item) => {
        const arr = Array.from({ length: clamped }, (_, i) => prev[item.id]?.[i] ?? 0);
        const sum = arr.reduce((a, b) => a + b, 0);
        if (sum > item.qty) {
          let running = 0;
          for (let i = 0; i < arr.length; i++) {
            const v = arr[i] ?? 0;
            arr[i] = Math.min(Math.max(0, v), item.qty - running);
            running += arr[i] ?? 0;
          }
        }
        next[item.id] = arr;
      });
      return next;
    });
  };

  const updateAllocation = (itemId: string, idx: number, raw: string) => {
    const val = Math.max(0, Math.round(Number(raw) || 0));
    setDraftAllocations((prev) => {
      const current = prev[itemId] ? [...prev[itemId]] : new Array(draftCount).fill(0);
      const other = current.reduce((s, v, i) => (i === idx ? s : s + v), 0);
      const item = billable.find((i) => i.id === itemId);
      const max = (item?.qty ?? 0) - other;
      current[idx] = Math.min(val, Math.max(0, max));
      return { ...prev, [itemId]: current };
    });
  };

  const allocateEveryItem = () => {
    setDraftAllocations(() => {
      const next: Record<string, number[]> = {};
      billable.forEach((item) => {
        const arr = new Array(draftCount).fill(0);
        const base = Math.floor(item.qty / draftCount);
        const rem = item.qty % draftCount;
        for (let i = 0; i < draftCount; i++) {
          arr[i] = base + (i < rem ? 1 : 0);
        }
        next[item.id] = arr;
      });
      return next;
    });
  };

  const allAllocated = useMemo(
    () =>
      billable.every(
        (item) => (draftAllocations[item.id] || []).reduce((a, b) => a + b, 0) === item.qty,
      ),
    [billable, draftAllocations],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Split Bill
          </DialogTitle>
          <DialogDescription>Choose how to divide the bill.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setDraftMode("equal")}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              draftMode === "equal"
                ? "border-primary bg-primary-soft"
                : "border-border hover:bg-accent",
            )}
          >
            <div className="rounded-md bg-background p-2">
              <Divide className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Equal split</p>
              <p className="text-xs text-muted-foreground">Divide bill total evenly</p>
            </div>
            {draftMode === "equal" && <CheckCircle2 className="ml-auto h-5 w-5 text-primary" />}
          </button>
          <button
            type="button"
            onClick={() => setDraftMode("item")}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              draftMode === "item"
                ? "border-primary bg-primary-soft"
                : "border-border hover:bg-accent",
            )}
          >
            <div className="rounded-md bg-background p-2">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">By item</p>
              <p className="text-xs text-muted-foreground">Assign items to each payer</p>
            </div>
            {draftMode === "item" && <CheckCircle2 className="ml-auto h-5 w-5 text-primary" />}
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step 2 Payers
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Ways</span>
              <Select
                value={String(draftCount)}
                onValueChange={(v) => handleCountChange(Number(v))}
              >
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => i + 2).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} ways
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: draftCount }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                <Input
                  value={draftNames[i] || ""}
                  onChange={(e) =>
                    setDraftNames((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))
                  }
                  placeholder={`Split ${i + 1}`}
                  className="h-8"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Names are optional — they&apos;ll appear on each split&apos;s receipt.
          </p>
        </div>

        {draftMode === "item" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Step 3 Item allocation
              </p>
              <Button variant="outline" size="sm" onClick={allocateEveryItem}>
                Allocate every item
              </Button>
            </div>
            <div className="max-h-[320px] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Item</th>
                    <th className="w-14 px-2 py-2 text-center font-medium text-muted-foreground">
                      Qty
                    </th>
                    {Array.from({ length: draftCount }, (_, i) => (
                      <th
                        key={i}
                        className="w-20 px-2 py-2 text-center font-medium text-muted-foreground"
                      >
                        {draftNames[i] || `Split ${i + 1}`}
                      </th>
                    ))}
                    <th className="w-14 px-2 py-2 text-center font-medium text-muted-foreground">
                      Left
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {billable.map((item) => {
                    const allocated = draftAllocations[item.id] || new Array(draftCount).fill(0);
                    const left = item.qty - allocated.reduce((a, b) => a + b, 0);
                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <p className="font-medium">
                            {item.name}
                            {item.variant ? ` (${item.variant})` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {inr(item.unitPrice, false)} ea
                          </p>
                        </td>
                        <td className="px-2 py-2 text-center">{item.qty}</td>
                        {Array.from({ length: draftCount }, (_, i) => (
                          <td key={i} className="px-2 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={allocated[i]}
                              onChange={(e) => updateAllocation(item.id, i, e.target.value)}
                              className="h-8 w-full text-center"
                            />
                          </td>
                        ))}
                        <td
                          className={cn(
                            "px-2 py-2 text-center font-medium",
                            left === 0 ? "text-muted-foreground" : "text-warning-foreground",
                          )}
                        >
                          {left}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!allAllocated && (
              <p className="text-xs text-warning-foreground">
                Every item must be fully allocated before creating splits.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={draftMode === "item" && !allAllocated}
            onClick={() => {
              onApply({
                mode: draftMode,
                count: draftCount,
                names: draftNames.map((n) => n.trim() || ""),
                allocations: draftMode === "item" ? draftAllocations : {},
              });
              onOpenChange(false);
            }}
          >
            Create {draftCount} {draftMode === "item" ? "splits by item" : "equal splits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillingDetailsDialog({
  open,
  onOpenChange,
  selected,
  bill,
  payments,
  paymentDraft,
  onPaymentDraftChange,
  onAddPayment,
  onCloseBill,
  canClose,
  splitMode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: QueueUnit;
  bill: SubBill;
  payments: Payment[];
  paymentDraft: { method: PaymentMethod; amount: string };
  onPaymentDraftChange: (method: string, amount: string) => void;
  onAddPayment: () => void;
  onCloseBill: () => void;
  canClose: boolean;
  splitMode: "none" | "equal" | "item";
}) {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const due = bill.total - paid;
  const taxable = Math.max(0, bill.subtotal - bill.discount - bill.mrpTotal);
  const mrpItems = selected.items.filter((i) => i.status !== "cancelled" && i.mrp);
  const started = selected.startedAt
    ? new Date(selected.startedAt).toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
      })
    : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Receipt className="size-5" /> Billing Details - {selected.name}
          </DialogTitle>
          {splitMode !== "none" && (
            <p className="text-xs text-muted-foreground">Viewing the first split</p>
          )}
        </DialogHeader>
        <ScrollArea className="h-[calc(90vh-8rem)] p-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              <Card className="gap-2 p-4 shadow-card">
                <h3 className="font-semibold">Session Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Table:</span>
                    <span className="font-medium">{selected.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Section:</span>
                    <span className="font-medium">{selected.sectionName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guests:</span>
                    <span className="font-medium">{selected.guests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Waiter:</span>
                    <span className="font-medium">{selected.waiter || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Started:</span>
                    <span className="font-medium">{started}</span>
                  </div>
                </div>
              </Card>

              <Card className="gap-2 p-4 shadow-card">
                <h3 className="font-semibold">Order Items</h3>
                <div className="space-y-2">
                  {selected.items
                    .filter((i) => i.status !== "cancelled")
                    .map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-muted/50 p-2 text-sm"
                      >
                        <div>
                          <span className="font-medium">
                            {l.qty}x {l.name}
                          </span>
                          {l.variant && (
                            <span className="text-muted-foreground"> ({l.variant})</span>
                          )}
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {inr(l.unitPrice, false)} each
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold tabular-nums">
                            {inr(l.qty * l.unitPrice)}
                          </span>
                          <CornerUpLeft className="size-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="gap-3 p-4 shadow-card">
                <h3 className="font-semibold">Bill Breakdown</h3>
                <div className="space-y-1.5 text-sm tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">{inr(bill.subtotal)}</span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Tax Breakdown (Applied to standard items only):
                  </p>
                  {TAXES.map((t) => (
                    <div key={t.id} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t.name} ({t.rate}%)
                      </span>
                      <span>{inr(Math.round((taxable * t.rate) / 100))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-b border-border pb-1.5">
                    <span className="text-muted-foreground">Total Tax:</span>
                    <span className="font-medium">{inr(bill.tax)}</span>
                  </div>

                  {mrpItems.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground">MRP Items (Tax Inclusive):</p>
                      {mrpItems.map((i) => (
                        <div key={i.id} className="flex justify-between">
                          <span className="text-muted-foreground">
                            {i.qty}x {i.name} - MRP
                          </span>
                          <span>{inr(i.qty * i.unitPrice)}</span>
                        </div>
                      ))}
                    </>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rounding:</span>
                    <span>{inr(bill.rounding)}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-md bg-green-50 p-3 text-base font-bold text-success">
                    <span>Final Total:</span>
                    <span>{inr(bill.total)}</span>
                  </div>
                </div>
              </Card>

              <Card className="gap-3 p-4 shadow-card">
                <h3 className="font-semibold">Payment Processing</h3>
                <div className="space-y-2">
                  <Label className="text-xs">Payment Method</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={paymentDraft.method}
                      onValueChange={(v) =>
                        onPaymentDraftChange(v, paymentDraft.amount)
                      }
                    >
                      <SelectTrigger className="h-9 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METHODS.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      placeholder={String(due)}
                      value={paymentDraft.amount}
                      onChange={(e) =>
                        onPaymentDraftChange(paymentDraft.method, e.target.value)
                      }
                      className="h-9 w-28"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onAddPayment}
                      disabled={due <= 0}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {payments.length > 0 && (
                  <div className="space-y-1">
                    {payments.map((p) => {
                      const m = METHODS.find((x) => x.id === p.method)!;
                      return (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <m.icon className="size-3.5" /> {m.label}
                          </span>
                          <span className="tabular-nums">{inr(p.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {due <= 0 && payments.length > 0 && (
                  <p className="text-xs font-medium text-success">Fully paid</p>
                )}

                <Button
                  className="w-full"
                  onClick={onCloseBill}
                  disabled={!canClose}
                >
                  <IndianRupee className="size-4" /> Close Bill
                </Button>
              </Card>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
