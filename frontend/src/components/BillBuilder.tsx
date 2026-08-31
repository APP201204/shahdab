import { cn } from "@/lib/utils";
import { innerCard } from "@/lib/styles";
import type { ReactNode } from "react";

interface BillLine {
  name: string;
  variant?: string | null;
  modifiers?: string | null;
  quantity: number;
  unitPrice: number;
}

interface BillDiscount {
  type: "flat" | "percentage";
  value: number;
  amount: number;
  itemName?: string | null;
  reason?: string | null;
}

interface BillTax {
  name: string;
  amount: number;
}

interface BillBuilderProps {
  currency?: string;
  lines: BillLine[];
  discounts: BillDiscount[];
  taxes: BillTax[];
  paid?: number;
  children?: ReactNode;
}

export function BillBuilder({
  currency = "₹",
  lines,
  discounts,
  taxes,
  paid = 0,
  children,
}: BillBuilderProps) {
  const subtotal = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0
  );
  const discountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);
  const taxTotal = taxes.reduce((sum, t) => sum + t.amount, 0);
  const total = subtotal - discountTotal + taxTotal;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div className={cn(innerCard, "bg-card")}>
          <h3 className="mb-2 text-sm font-semibold">Items</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Price</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td className="py-2">
                    {line.name}
                    {line.variant && (
                      <span className="text-muted-foreground">
                        {" "}({line.variant})
                      </span>
                    )}
                    {line.modifiers && (
                      <p className="text-xs text-muted-foreground">
                        {line.modifiers}
                      </p>
                    )}
                  </td>
                  <td className="py-2">{line.quantity}</td>
                  <td className="py-2 text-right">
                    {currency}{line.unitPrice.toFixed(2)}
                  </td>
                  <td className="py-2 text-right">
                    {currency}{(line.unitPrice * line.quantity).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={cn(innerCard, "bg-card")}>
          <h3 className="mb-2 text-sm font-semibold">Discounts</h3>
          {discounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No discounts applied.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {discounts.map((d, idx) => (
                <li key={idx} className="flex items-center justify-between">
                  <span>
                    {d.type === "percentage"
                      ? `${d.value}%`
                      : `${currency}${d.value}`}
                    {d.itemName && ` on ${d.itemName}`}
                    {d.reason && ` • ${d.reason}`}
                  </span>
                  <span className="font-medium">
                    -{currency}{d.amount.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className={cn(innerCard, "bg-card")}>
          <h3 className="mb-2 text-sm font-semibold">Totals</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-right">
                {currency}{subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Discounts</span>
              <span className="text-right">
                -{currency}{discountTotal.toFixed(2)}
              </span>
            </div>
            {taxes.map((t, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{t.name}</span>
                <span className="text-right">
                  {currency}{t.amount.toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
              <span>Total</span>
              <span className="text-right">
                {currency}{total.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Paid</span>
              <span className="text-right">
                {currency}{paid.toFixed(2)}
              </span>
            </div>
            <div
              className={cn(
                "flex justify-between font-medium",
                total - paid <= 0.01 ? "text-green-700" : "text-amber-700"
              )}
            >
              <span>Due</span>
              <span className="text-right">
                {currency}{Math.max(0, total - paid).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
