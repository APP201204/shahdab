import { Button } from "@/components/ui/button";

interface CartLine {
  id: string;
  name: string;
  variant?: string | null;
  modifiers?: string | null;
  quantity: number;
  unitPrice: number;
}

interface CartSummaryProps {
  items: CartLine[];
  currency?: string;
  sendLabel?: string;
  emptyText?: string;
  onRemove?: (index: number) => void;
  onSend: () => void;
  disabled?: boolean;
}

export function CartSummary({
  items,
  currency = "₹",
  sendLabel = "Send to Kitchen",
  emptyText = "Cart is empty.",
  onRemove,
  onSend,
  disabled,
}: CartSummaryProps) {
  const total = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-md border bg-card shadow-sm">
      <h3 className="border-b p-3 font-semibold">Order Cart</h3>
      <div className="flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="flex items-start justify-between text-sm"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.variant}
                    {item.modifiers && ` • ${item.modifiers}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} × {currency}{item.unitPrice}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {currency}{(item.unitPrice * item.quantity).toFixed(2)}
                  </p>
                  {onRemove && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemove(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t p-3">
        <div className="mb-2 flex justify-between text-sm font-semibold">
          <span>Total</span>
          <span>
            {currency}{total.toFixed(2)}
          </span>
        </div>
        <Button
          className="w-full"
          onClick={onSend}
          disabled={disabled || items.length === 0}
        >
          {sendLabel}
        </Button>
      </div>
    </div>
  );
}
