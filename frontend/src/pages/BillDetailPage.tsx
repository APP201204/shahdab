import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { db } from "@/mocks/db";
import { cn } from "@/lib/utils";
import { pageWrapper, pageHeader } from "@/lib/styles";
import { format, parseISO } from "date-fns";
import { NotFound } from "@/components/NotFound";
import { ArrowLeft, Printer } from "lucide-react";

function formatCurrency(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

export function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { outlet } = useAuth();

  if (!outlet) return null;

  const bill = useMemo(() => db.bills.find((b) => b.id === id), [id]);

  if (!bill) {
    return (
      <div className={cn(pageWrapper, "space-y-4")}>
        <h1 className="text-2xl font-bold">Bill</h1>
        <NotFound />
      </div>
    );
  }

  const order = db.orders.find((o) => o.id === bill.order_id);
  const table = order?.table_id
    ? db.tables.find((t) => t.id === order.table_id)
    : null;
  const station = db.billingStations.find(
    (s) => s.id === bill.billing_station_id
  );
  const floor = station ? db.floors.find((f) => f.id === station.floor_id) : null;
  const cashier = db.staff.find((s) => s.id === bill.created_by);
  const items = db.orderItems.filter(
    (i) => i.order_id === bill.order_id && i.status !== "cancelled"
  );
  const discounts = db.discounts.filter((d) => d.bill_id === bill.id);
  const taxes = db.billTaxes.filter((bt) => bt.bill_id === bill.id);
  const splits = db.billSplits.filter((s) => s.bill_id === bill.id);
  const payments = db.payments.filter((p) => p.bill_id === bill.id);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  function itemName(item: (typeof items)[number]) {
    const menuItem = db.menuItems.find((m) => m.id === item.menu_item_id);
    const variant = db.menuItemVariants.find(
      (v) => v.id === item.menu_item_variant_id
    );
    return `${menuItem?.name ?? "Unknown"}${
      variant ? ` (${variant.variant_name})` : ""
    }`;
  }

  function itemModifiers(item: (typeof items)[number]) {
    return db.orderItemModifiers
      .filter((m) => m.order_item_id === item.id)
      .map((m) => db.modifiers.find((mod) => mod.id === m.modifier_id)?.name)
      .filter(Boolean)
      .join(", ");
  }

  function print() {
    window.print();
  }

  return (
    <div className={cn(pageWrapper, "space-y-4")}>
      <div className={cn(pageHeader, "print:hidden", "gap-2 sm:gap-3")}>
        <h1 className="text-xl font-bold">Bill {bill.bill_number}</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/bills/history">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to History
            </Link>
          </Button>
          <Button
            size="icon"
            onClick={print}
            aria-label={`Print bill ${bill.bill_number}`}
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl rounded-lg border bg-card p-4 shadow-sm print:max-w-none print:border-0 print:bg-background print:shadow-none">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-bold">{outlet.name}</h2>
          <p className="text-sm text-muted-foreground">
            {station?.name} {floor && `• ${floor.name}`}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <span className="text-muted-foreground">Bill #</span>
          <span className="text-right font-medium">{bill.bill_number}</span>
          <span className="text-muted-foreground">Date</span>
          <span className="text-right">
            {format(parseISO(bill.created_at), "dd MMM yyyy, h:mm a")}
          </span>
          <span className="text-muted-foreground">Cashier</span>
          <span className="text-right">{cashier?.name ?? "-"}</span>
          {order && (
            <>
              <span className="text-muted-foreground">Order Type</span>
              <span className="text-right capitalize">{order.order_type}</span>
              {table && (
                <>
                  <span className="text-muted-foreground">Table</span>
                  <span className="text-right">{table.table_number}</span>
                </>
              )}
              {order.customer_name && (
                <>
                  <span className="text-muted-foreground">Customer</span>
                  <span className="text-right">{order.customer_name}</span>
                </>
              )}
            </>
          )}
          <span className="text-muted-foreground">Status</span>
          <span className="text-right">
            <StatusBadge status={bill.status} />
          </span>
        </div>

        <div className="mb-4 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">Item</th>
                <th className="px-2 py-1.5 text-right font-medium">Qty</th>
                <th className="px-2 py-1.5 text-right font-medium">Price</th>
                <th className="px-2 py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-2 py-1.5">
                    <p className="font-medium">{itemName(item)}</p>
                    {itemModifiers(item) && (
                      <p className="text-xs text-muted-foreground">
                        {itemModifiers(item)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </td>
                  <td className="px-2 py-1.5 text-right">{item.quantity}</td>
                  <td className="px-2 py-1.5 text-right">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium">
                    {formatCurrency(item.unit_price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="text-right">{formatCurrency(bill.subtotal)}</span>
          </div>
          {discounts.length > 0 && (
            <>
              {discounts.map((d) => (
                <div
                  key={d.id}
                  className="flex justify-between text-muted-foreground"
                >
                  <span>
                    Discount{d.reason && ` • ${d.reason}`}
                  </span>
                  <span className="text-right">
                    -{formatCurrency(d.amount_deducted)}
                  </span>
                </div>
              ))}
            </>
          )}
          {taxes.map((bt) => {
            const tax = db.taxes.find((t) => t.id === bt.tax_id);
            return (
              <div
                key={bt.tax_id}
                className="flex justify-between text-muted-foreground"
              >
                <span>{tax?.name ?? "Tax"}</span>
                <span className="text-right">
                  {formatCurrency(bt.amount)}
                </span>
              </div>
            );
          })}
          <div className="flex justify-between border-t pt-1.5 text-base font-bold print:text-lg">
            <span>Total</span>
            <span className="text-right">
              {formatCurrency(bill.total_amount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Paid</span>
            <span className="text-right">{formatCurrency(totalPaid)}</span>
          </div>
        </div>

        {(splits.length > 0 || payments.length > 0) && (
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {splits.length > 0 && (
              <div className="rounded-md border p-2">
                <p className="mb-1 text-sm font-semibold">Splits</p>
                {splits.map((s) => {
                  const splitPaid = payments
                    .filter((p) => p.bill_split_id === s.id)
                    .reduce((sum, p) => sum + p.amount, 0);
                  return (
                    <div
                      key={s.id}
                      className="flex justify-between text-xs text-muted-foreground"
                    >
                      <span>{s.split_label || s.split_type}</span>
                      <span className="text-right">
                        {formatCurrency(s.amount)} (paid {formatCurrency(splitPaid)})
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {payments.length > 0 && (
              <div className="rounded-md border p-2">
                <p className="mb-1 text-sm font-semibold">Payments</p>
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between text-xs text-muted-foreground"
                  >
                    <span>
                      {p.payment_method}
                      {p.transaction_ref && ` • ${p.transaction_ref}`}
                    </span>
                    <span className="text-right">
                      {formatCurrency(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground">
          <p>Thank you for visiting {outlet.name}.</p>
          {bill.closed_at && (
            <p>
              Closed on {format(parseISO(bill.closed_at), "dd MMM yyyy, h:mm a")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
