import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { BillBuilder } from "@/components/BillBuilder";
import { db, dataService } from "@/mocks/db";
import { cn } from "@/lib/utils";
import {
  inputClass,
  pageWrapper,
  pageHeader,
  messageBanner,
  innerCard,
} from "@/lib/styles";
import { EmptyState } from "@/components/EmptyState";
import { getFirstError, paymentSchema } from "@/lib/validation";
import { logAudit } from "@/services/audit";
import { format, parseISO } from "date-fns";
import type {
  Bill,
  DiscountType,
  Order,
  OrderItem,
  PaymentMethod,
  Table,
} from "@/types";

function formatCurrency(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

export function BillingPage() {
  const { staff, outlet, organization } = useAuth();
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [stationId, setStationId] = useState<string>("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [discountReason, setDiscountReason] = useState<string>("");
  const [discountItemId, setDiscountItemId] = useState<string>("bill");

  const [splitType, setSplitType] = useState<"by_item" | "by_number">("by_number");
  const [splitCount, setSplitCount] = useState<string>("2");
  const [splitLabel, setSplitLabel] = useState<string>("");
  const [splitItemQty, setSplitItemQty] = useState<Record<string, number>>({});

  const [paymentSplitId, setPaymentSplitId] = useState<string>("bill");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentRef, setPaymentRef] = useState<string>("");

  if (!staff || !outlet || !organization) return null;

  const stations = useMemo(
    () =>
      db.billingStations
        .filter((s) => s.outlet_id === outlet.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [outlet.id]
  );

  useEffect(() => {
    if (stations.length > 0 && !stationId) {
      const assignedFloor = db.staffFloorAssignments.find(
        (a) => a.staff_id === staff.id
      )?.floor_id;
      const preferred =
        stations.find((s) => s.floor_id === assignedFloor)?.id ?? stations[0].id;
      setStationId(preferred);
    }
  }, [stations, stationId, staff.id]);

  const queueOrders = useMemo(() => {
    const station = stations.find((s) => s.id === stationId);
    const floorIds = station
      ? [station.floor_id]
      : db.floors.filter((f) => f.outlet_id === outlet.id).map((f) => f.id);

    const inQueue = (order: Order) => {
      if (order.status === "closed" || order.status === "billed") return false;
      if (order.order_type === "takeaway") return order.status === "fully_served";
      const table = order.table_id
        ? db.tables.find((t) => t.id === order.table_id)
        : null;
      return (
        order.status === "fully_served" || table?.status === "bill_requested"
      );
    };

    return db.orders
      .filter(
        (o) =>
          o.outlet_id === outlet.id &&
          floorIds.includes(o.floor_id) &&
          inQueue(o)
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }, [outlet.id, stationId, stations, version]);

  const selectedOrder = useMemo(
    () => (selectedOrderId ? db.orders.find((o) => o.id === selectedOrderId) ?? null : null),
    [selectedOrderId, version]
  );

  const selectedBill = useMemo(
    () => (selectedBillId ? db.bills.find((b) => b.id === selectedBillId) ?? null : null),
    [selectedBillId, version]
  );

  const billItems = useMemo(
    () =>
      selectedOrder
        ? db.orderItems.filter(
            (i) => i.order_id === selectedOrder.id && i.status !== "cancelled"
          )
        : [],
    [selectedOrder, version]
  );

  const discounts = useMemo(
    () => (selectedBill ? db.discounts.filter((d) => d.bill_id === selectedBill.id) : []),
    [selectedBill, version]
  );

  const splits = useMemo(
    () => (selectedBill ? db.billSplits.filter((s) => s.bill_id === selectedBill.id) : []),
    [selectedBill, version]
  );

  const payments = useMemo(
    () => (selectedBill ? db.payments.filter((p) => p.bill_id === selectedBill.id) : []),
    [selectedBill, version]
  );

  const totalPaid = useMemo(
    () => payments.reduce((sum, p) => sum + p.amount, 0),
    [payments]
  );

  const billTaxes = useMemo(
    () =>
      selectedBill
        ? db.billTaxes.filter((bt) => bt.bill_id === selectedBill.id)
        : [],
    [selectedBill, version]
  );

  const activeTaxes = useMemo(
    () =>
      db.taxes.filter(
        (t) =>
          t.outlet_id === outlet.id &&
          t.is_active &&
          t.applicable_on === "bill"
      ),
    [outlet.id]
  );

  useEffect(() => {
    if (selectedBill) {
      setSplitItemQty(Object.fromEntries(billItems.map((i) => [i.id, 0])));
    }
  }, [selectedBillId]);

  useEffect(() => {
    if (selectedBill) {
      const paid = db.payments
        .filter(
          (p) =>
            p.bill_id === selectedBill.id &&
            (paymentSplitId === "bill"
              ? p.bill_split_id === null
              : p.bill_split_id === paymentSplitId)
        )
        .reduce((sum, p) => sum + p.amount, 0);
      const split =
        paymentSplitId === "bill"
          ? null
          : db.billSplits.find((s) => s.id === paymentSplitId);
      const due =
        paymentSplitId === "bill"
          ? Number((selectedBill.total_amount - paid).toFixed(2))
          : Number(((split?.amount ?? 0) - paid).toFixed(2));
      setPaymentAmount(due > 0 ? due.toFixed(2) : "");
    }
  }, [paymentSplitId, selectedBillId]);

  function recalculateBill(bill: Bill) {
    const items = db.orderItems.filter(
      (i) => i.order_id === bill.order_id && i.status !== "cancelled"
    );
    const subtotal = items.reduce(
      (sum, i) => sum + i.unit_price * i.quantity,
      0
    );
    const currentDiscounts = db.discounts.filter((d) => d.bill_id === bill.id);
    const discountTotal = currentDiscounts.reduce(
      (sum, d) => sum + d.amount_deducted,
      0
    );
    const taxable = Math.max(0, subtotal - discountTotal);
    const taxAmount = activeTaxes.reduce(
      (sum, t) => sum + taxable * (t.percentage / 100),
      0
    );
    const total = taxable + taxAmount;
    dataService("bills").update(bill.id, {
      subtotal,
      discount_amount: discountTotal,
      tax_amount: taxAmount,
      total_amount: total,
    });

    const existing = db.billTaxes.filter((bt) => bt.bill_id === bill.id);
    for (const tax of activeTaxes) {
      const e = existing.find((bt) => bt.tax_id === tax.id);
      const amount = taxable * (tax.percentage / 100);
      if (e) {
        e.amount = amount;
      } else {
        db.billTaxes.push({ bill_id: bill.id, tax_id: tax.id, amount });
      }
    }
    db.billTaxes = db.billTaxes.filter(
      (bt) =>
        !(bt.bill_id === bill.id && !activeTaxes.some((t) => t.id === bt.tax_id))
    );
  }

  function generateBill(order: Order) {
    const items = db.orderItems.filter(
      (i) => i.order_id === order.id && i.status !== "cancelled"
    );
    const subtotal = items.reduce(
      (sum, i) => sum + i.unit_price * i.quantity,
      0
    );
    const taxAmount = activeTaxes.reduce(
      (sum, t) => sum + subtotal * (t.percentage / 100),
      0
    );
    const total = subtotal + taxAmount;
    const billNumber = `BILL-${String(db.bills.length + 1).padStart(4, "0")}`;
    const now = new Date().toISOString();

    const bill = dataService("bills").create({
      organization_id: organization!.id,
      outlet_id: outlet!.id,
      billing_station_id: stationId,
      order_id: order.id,
      bill_number: billNumber,
      subtotal,
      discount_amount: 0,
      tax_amount: taxAmount,
      total_amount: total,
      status: "open",
      created_by: staff!.id,
      created_at: now,
      closed_at: null,
    });

    for (const tax of activeTaxes) {
      db.billTaxes.push({
        bill_id: bill.id,
        tax_id: tax.id,
        amount: subtotal * (tax.percentage / 100),
      });
    }

    dataService("orders").update(order.id, { status: "billed" });
    setSelectedOrderId(order.id);
    setSelectedBillId(bill.id);
    setMessage({ type: "success", text: `Bill ${billNumber} generated` });
    setVersion((v) => v + 1);
  }

  function openBillForOrder(order: Order) {
    const bill = db.bills.find(
      (b) => b.order_id === order.id && b.status === "open"
    );
    if (bill) {
      setSelectedOrderId(order.id);
      setSelectedBillId(bill.id);
    }
  }

  function applyDiscount() {
    if (!selectedBill) return;
    const before = {
      subtotal: selectedBill.subtotal,
      discount_amount: selectedBill.discount_amount,
      total_amount: selectedBill.total_amount,
    };
    const value = Number(discountValue);
    if (!value || value <= 0) {
      setMessage({ type: "error", text: "Enter a discount value" });
      return;
    }

    let amount = 0;
    if (discountItemId !== "bill") {
      const item = billItems.find((i) => i.id === discountItemId);
      if (!item) return;
      const lineTotal = item.unit_price * item.quantity;
      amount =
        discountType === "percentage"
          ? lineTotal * (value / 100)
          : Math.min(value, lineTotal);
    } else {
      amount =
        discountType === "percentage"
          ? selectedBill.subtotal * (value / 100)
          : Math.min(value, selectedBill.subtotal);
    }

    dataService("discounts").create({
      bill_id: selectedBill.id,
      order_item_id: discountItemId === "bill" ? null : discountItemId,
      discount_type: discountType,
      value,
      amount_deducted: amount,
      applied_by: staff!.id,
      reason: discountReason.trim() || null,
      created_at: new Date().toISOString(),
    });

    recalculateBill(selectedBill);
    logAudit({
      organization_id: organization!.id,
      outlet_id: outlet!.id,
      staff_id: staff!.id,
      action: "bill.discount.apply",
      entity_type: "bill",
      entity_id: selectedBill.id,
      before_json: before,
      after_json: {
        subtotal: selectedBill.subtotal,
        discount_amount: selectedBill.discount_amount,
        total_amount: selectedBill.total_amount,
      },
    });
    setDiscountValue("");
    setDiscountReason("");
    setMessage({ type: "success", text: "Discount applied" });
    setVersion((v) => v + 1);
  }

  function createSplit() {
    if (!selectedBill) return;

    if (splitType === "by_number") {
      const count = Number(splitCount);
      if (!count || count < 2) {
        setMessage({ type: "error", text: "Split count must be at least 2" });
        return;
      }
      const total = selectedBill.total_amount;
      const base = Math.floor((total / count) * 100) / 100;
      for (let i = 1; i <= count; i += 1) {
        const isLast = i === count;
        const amount = isLast
          ? Number((total - base * (count - 1)).toFixed(2))
          : base;
        dataService("billSplits").create({
          bill_id: selectedBill.id,
          split_type: "by_number",
          split_label: splitLabel.trim()
            ? `${splitLabel.trim()} ${i}`
            : `Part ${i}`,
          amount,
        });
      }
    } else {
      const selected = Object.entries(splitItemQty).filter(([, qty]) => qty > 0);
      if (selected.length === 0) {
        setMessage({ type: "error", text: "Select at least one item" });
        return;
      }
      const amount = selected.reduce((sum, [id, qty]) => {
        const item = billItems.find((i) => i.id === id);
        return sum + (item ? item.unit_price * qty : 0);
      }, 0);
      const split = dataService("billSplits").create({
        bill_id: selectedBill.id,
        split_type: "by_item",
        split_label: splitLabel.trim() || "Split",
        amount,
      });
      for (const [id, qty] of selected) {
        const item = billItems.find((i) => i.id === id);
        if (!item) continue;
        db.billSplitItems.push({
          bill_split_id: split.id,
          order_item_id: id,
          quantity: qty,
          amount: item.unit_price * qty,
        });
      }
    }

    setSplitLabel("");
    setSplitItemQty(Object.fromEntries(billItems.map((i) => [i.id, 0])));
    setMessage({ type: "success", text: "Split created" });
    setVersion((v) => v + 1);
  }

  function recordPayment() {
    if (!selectedBill) return;
    const parsed = paymentSchema.safeParse({
      payment_method: paymentMethod,
      amount: paymentAmount,
      transaction_ref: paymentRef,
    });
    if (!parsed.success) {
      setMessage({ type: "error", text: getFirstError(parsed) });
      return;
    }
    const amount = parsed.data.amount;

    const paid = db.payments
      .filter(
        (p) =>
          p.bill_id === selectedBill.id &&
          (paymentSplitId === "bill"
            ? p.bill_split_id === null
            : p.bill_split_id === paymentSplitId)
      )
      .reduce((sum, p) => sum + p.amount, 0);
    const split =
      paymentSplitId === "bill"
        ? null
        : db.billSplits.find((s) => s.id === paymentSplitId);
    const due =
      paymentSplitId === "bill"
        ? selectedBill.total_amount - paid
        : (split?.amount ?? 0) - paid;

    if (amount > due + 0.01) {
      setMessage({ type: "error", text: "Amount exceeds amount due" });
      return;
    }

    dataService("payments").create({
      bill_id: selectedBill.id,
      bill_split_id: paymentSplitId === "bill" ? null : paymentSplitId,
      payment_method: paymentMethod,
      amount,
      transaction_ref: paymentRef.trim() || null,
      paid_at: new Date().toISOString(),
    });

    setPaymentRef("");
    setMessage({ type: "success", text: "Payment recorded" });
    setVersion((v) => v + 1);
  }

  function closeBill() {
    if (!selectedBill || !selectedOrder) return;
    const paid = db.payments
      .filter((p) => p.bill_id === selectedBill.id)
      .reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(paid - selectedBill.total_amount) > 0.01) {
      setMessage({
        type: "error",
        text: "Total payment does not match total due",
      });
      return;
    }

    const now = new Date().toISOString();
    dataService("bills").update(selectedBill.id, {
      status: "paid",
      closed_at: now,
    });
    dataService("orders").update(selectedOrder.id, {
      status: "closed",
      closed_at: now,
    });
    if (selectedOrder.table_id) {
      dataService("tables").update(selectedOrder.table_id, {
        status: "needs_cleaning",
      });
    }

    setMessage({ type: "success", text: "Bill closed" });
    setSelectedBillId(null);
    setSelectedOrderId(null);
    setVersion((v) => v + 1);
  }

  function orderTitle(order: Order) {
    if (order.order_type === "takeaway") {
      return `Takeaway — ${order.customer_name ?? "Guest"}`;
    }
    const table = order.table_id
      ? db.tables.find((t) => t.id === order.table_id)
      : null;
    return `Table ${table?.table_number ?? "-"}`;
  }

  function itemLineName(item: OrderItem) {
    const menuItem = db.menuItems.find((m) => m.id === item.menu_item_id);
    const variant = db.menuItemVariants.find(
      (v) => v.id === item.menu_item_variant_id
    );
    return `${menuItem?.name ?? "Unknown"}${
      variant ? ` (${variant.variant_name})` : ""
    }`;
  }

  function itemDisplayName(item: OrderItem) {
    const menuItem = db.menuItems.find((m) => m.id === item.menu_item_id);
    const variant = db.menuItemVariants.find(
      (v) => v.id === item.menu_item_variant_id
    );
    return (
      <span>
        {menuItem?.name}
        {variant && (
          <span className="text-muted-foreground"> ({variant.variant_name})</span>
        )}
      </span>
    );
  }

  function itemModifiers(item: OrderItem) {
    return db.orderItemModifiers
      .filter((m) => m.order_item_id === item.id)
      .map((m) => db.modifiers.find((mod) => mod.id === m.modifier_id)?.name)
      .filter(Boolean)
      .join(", ");
  }

  function tableForOrder(order: Order): Table | undefined {
    return order.table_id
      ? db.tables.find((t) => t.id === order.table_id)
      : undefined;
  }

  return (
    <div className={pageWrapper}>
      <div className={pageHeader}>
        <h1 className="text-2xl font-bold">Billing</h1>
        {stations.length > 1 && (
          <select
            className={inputClass}
            aria-label="Billing station"
            value={stationId}
            onChange={(e) => {
              setStationId(e.target.value);
              setSelectedOrderId(null);
              setSelectedBillId(null);
            }}
          >
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {message && (
        <div
          className={cn(
            messageBanner,
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-100 text-green-800"
          )}
          role="status"
        >
          {message.text}
        </div>
      )}

      {!selectedBill || !selectedOrder ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Bill Requests</h2>
          {queueOrders.length === 0 ? (
            <EmptyState
              title="No bill requests"
              description="There are no fully served or bill-requested orders for this station."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {queueOrders.map((order) => {
                const items = db.orderItems.filter(
                  (i) =>
                    i.order_id === order.id && i.status !== "cancelled"
                );
                const total = items.reduce(
                  (sum, i) => sum + i.unit_price * i.quantity,
                  0
                );
                const table = tableForOrder(order);
                const existingBill = db.bills.find(
                  (b) => b.order_id === order.id && b.status === "open"
                );
                return (
                  <div
                    key={order.id}
                    className="rounded-md border bg-card p-4 shadow-sm"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-semibold">{orderTitle(order)}</h3>
                        <p className="text-xs text-muted-foreground">
                          {order.order_type} •{" "}
                          <StatusBadge status={order.status} />
                        </p>
                        {table && (
                          <p className="text-xs text-muted-foreground">
                            Floor: {db.floors.find((f) => f.id === table.floor_id)?.name}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-semibold">
                        {formatCurrency(total)}
                      </span>
                    </div>
                    <ul className="mb-3 space-y-1 text-sm">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start justify-between"
                        >
                          <div>
                            <span>{itemDisplayName(item)}</span>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} × {formatCurrency(item.unit_price)}
                            </p>
                          </div>
                          <StatusBadge status={item.status} />
                        </li>
                      ))}
                    </ul>
                    {existingBill ? (
                      <Button
                        size="sm"
                        onClick={() => openBillForOrder(order)}
                      >
                        Open Bill
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => generateBill(order)}>
                        Generate Bill
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className={pageHeader}>
            <div>
              <h2 className="text-xl font-semibold">
                Bill {selectedBill.bill_number}
              </h2>
              <p className="text-sm text-muted-foreground">
                {orderTitle(selectedOrder)} • {selectedOrder.order_type} •{" "}
                {format(parseISO(selectedBill.created_at), "dd MMM yyyy, h:mm a")}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedBillId(null);
                setSelectedOrderId(null);
              }}
            >
              Back to Queue
            </Button>
          </div>

          <BillBuilder
            currency="₹"
            lines={billItems.map((item) => ({
              name: db.menuItems.find((m) => m.id === item.menu_item_id)?.name ?? "Unknown",
              variant: db.menuItemVariants.find(
                (v) => v.id === item.menu_item_variant_id
              )?.variant_name ?? null,
              modifiers: itemModifiers(item) || null,
              quantity: item.quantity,
              unitPrice: item.unit_price,
            }))}
            discounts={discounts.map((d) => {
              const item = d.order_item_id
                ? billItems.find((i) => i.id === d.order_item_id)
                : undefined;
              const menuItem = item
                ? db.menuItems.find((m) => m.id === item.menu_item_id)
                : undefined;
              const variant = item
                ? db.menuItemVariants.find(
                    (v) => v.id === item.menu_item_variant_id
                  )
                : undefined;
              return {
                type: d.discount_type as "flat" | "percentage",
                value: d.value,
                amount: d.amount_deducted,
                itemName: item
                  ? `${menuItem?.name ?? "Unknown"}${
                      variant ? ` (${variant.variant_name})` : ""
                    }`
                  : null,
                reason: d.reason,
              };
            })}
            taxes={billTaxes.map((bt) => {
              const tax = activeTaxes.find((t) => t.id === bt.tax_id);
              return { name: tax?.name ?? "Tax", amount: bt.amount };
            })}
            paid={totalPaid}
          >
            <div className={cn(innerCard, "bg-card")}>
              <h3 className="mb-2 text-sm font-semibold">Apply Discount</h3>
              <div className="grid gap-2">
                <select
                  className={inputClass}
                  value={discountItemId}
                  onChange={(e) => setDiscountItemId(e.target.value)}
                >
                  <option value="bill">Bill total</option>
                  {billItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {itemLineName(item)}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className={inputClass}
                    value={discountType}
                    onChange={(e) =>
                      setDiscountType(e.target.value as DiscountType)
                    }
                  >
                    <option value="percentage">%</option>
                    <option value="flat">Flat</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={inputClass}
                    placeholder="Value"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                  />
                </div>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Reason (optional)"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                />
                <Button onClick={applyDiscount} size="sm">
                  Apply Discount
                </Button>
              </div>
            </div>

            <div className={cn(innerCard, "bg-card")}>
              <h3 className="mb-2 text-sm font-semibold">Split Bill</h3>
              <div className="mb-3 grid gap-2 sm:grid-cols-4">
                <select
                  className={inputClass}
                  value={splitType}
                  onChange={(e) =>
                    setSplitType(e.target.value as "by_item" | "by_number")
                  }
                >
                  <option value="by_number">By number</option>
                  <option value="by_item">By item</option>
                </select>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Label (optional)"
                  value={splitLabel}
                  onChange={(e) => setSplitLabel(e.target.value)}
                />
                {splitType === "by_number" ? (
                  <input
                    type="number"
                    min="2"
                    className={inputClass}
                    placeholder="Parts"
                    value={splitCount}
                    onChange={(e) => setSplitCount(e.target.value)}
                  />
                ) : (
                  <div className="col-span-2 text-sm text-muted-foreground sm:col-span-1">
                    Select item quantities below
                  </div>
                )}
                <Button onClick={createSplit} size="sm">
                  Create Split
                </Button>
              </div>

              {splitType === "by_item" && (
                <div className="mb-3 grid gap-2">
                  {billItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-md border p-2 text-sm"
                    >
                      <span>{itemDisplayName(item)}</span>
                      <input
                        type="number"
                        min="0"
                        max={item.quantity}
                        className={cn(inputClass, "w-20")}
                        value={splitItemQty[item.id] ?? 0}
                        onChange={(e) =>
                          setSplitItemQty((prev) => ({
                            ...prev,
                            [item.id]: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              {splits.length > 0 && (
                <div className="space-y-2">
                  {splits.map((split) => {
                    const splitPaid = db.payments
                      .filter(
                        (p) =>
                          p.bill_id === selectedBill.id &&
                          p.bill_split_id === split.id
                      )
                      .reduce((sum, p) => sum + p.amount, 0);
                    return (
                      <div
                        key={split.id}
                        className="flex items-center justify-between rounded-md border p-2 text-sm"
                      >
                        <span>
                          {split.split_label || split.split_type} •{" "}
                          {formatCurrency(split.amount)}
                        </span>
                        <span className="text-muted-foreground">
                          Paid {formatCurrency(splitPaid)} / due{" "}
                          {formatCurrency(Math.max(0, split.amount - splitPaid))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={cn(innerCard, "bg-card")}>
              <h3 className="mb-2 text-sm font-semibold">Payment</h3>
              <div className="mb-3 grid gap-2 sm:grid-cols-5">
                <select
                  className={inputClass}
                  value={paymentSplitId}
                  onChange={(e) => setPaymentSplitId(e.target.value)}
                  aria-label="Payment split"
                >
                  <option value="bill">Full bill</option>
                  {splits.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.split_label || s.split_type}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClass}
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                  aria-label="Payment method"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="wallet">Wallet</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={inputClass}
                  placeholder="Amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Ref (optional)"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
                <Button onClick={recordPayment} size="sm">
                  Record Payment
                </Button>
              </div>

              {payments.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-md border p-2"
                    >
                      <span>
                        {p.payment_method}
                        {p.bill_split_id && (
                          <span className="text-muted-foreground">
                            {" "}(
                            {db.billSplits.find((s) => s.id === p.bill_split_id)
                              ?.split_label ?? "split"}
                            )
                          </span>
                        )}
                        {p.transaction_ref && ` • ${p.transaction_ref}`}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(p.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 space-y-2 border-t pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Total paid: {formatCurrency(totalPaid)}
                  </span>
                  <span className="text-lg font-bold">
                    Due:{" "}
                    {formatCurrency(
                      Math.max(0, selectedBill.total_amount - totalPaid)
                    )}
                  </span>
                </div>
                <Button
                  onClick={closeBill}
                  disabled={
                    Math.abs(totalPaid - selectedBill.total_amount) > 0.01
                  }
                  className="w-full"
                >
                  Close Bill
                </Button>
              </div>
            </div>
          </BillBuilder>
        </div>
      )}
    </div>
  );
}
