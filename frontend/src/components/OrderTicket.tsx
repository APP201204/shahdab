import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TicketItem {
  id: string;
  name: string;
  variant?: string | null;
  modifiers?: string | null;
  quantity: number;
  status: string;
  isRelevant: boolean;
  actionLabel?: string | null;
}

interface TicketBatch {
  id: string;
  batchNumber: number;
  items: TicketItem[];
}

interface OrderTicketProps {
  title: string;
  customerPhone?: string | null;
  orderType?: "dine_in" | "takeaway";
  batches: TicketBatch[];
  onAdvance?: (itemId: string) => void;
}

const statusClass: Record<string, string> = {
  placed: "bg-slate-100 text-slate-800",
  accepted: "bg-blue-100 text-blue-800",
  cooking: "bg-orange-100 text-orange-800",
  ready: "bg-yellow-100 text-yellow-800",
  served: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function OrderTicket({
  title,
  customerPhone,
  orderType = "dine_in",
  batches,
  onAdvance,
}: OrderTicketProps) {
  return (
    <div className="rounded-md border">
      <div className="border-b bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground">
            {orderType === "takeaway" ? "TA" : "Dine-in"}
          </span>
        </div>
        {customerPhone && (
          <p className="text-xs text-muted-foreground">{customerPhone}</p>
        )}
      </div>
      <div className="space-y-3 p-3">
        {batches.map((batch) => (
          <div key={batch.id}>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              KOT #{batch.batchNumber}
            </p>
            <ul className="space-y-2">
              {batch.items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-start justify-between rounded-md border p-2",
                    !item.isRelevant && "bg-muted/40 opacity-50"
                  )}
                >
                  <div className="text-sm">
                    <p className="font-medium">
                      {item.name}
                      {item.variant && (
                        <span className="text-muted-foreground">
                          {" "}({item.variant})
                        </span>
                      )}
                    </p>
                    {item.modifiers && (
                      <p className="text-xs text-muted-foreground">
                        {item.modifiers}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        statusClass[item.status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {item.status}
                    </span>
                    {item.isRelevant && item.actionLabel && onAdvance && (
                      <Button size="sm" onClick={() => onAdvance(item.id)}>
                        {item.actionLabel}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
