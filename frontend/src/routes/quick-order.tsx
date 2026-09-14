import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Settings, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAppState } from "@/lib/app-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, MENU_ITEMS, SECTIONS, type OrderLine } from "@/data/seed";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/quick-order")({
  head: () => ({
    meta: [
      { title: "Quick Order · SHADAB RestaurantOS" },
      {
        name: "description",
        content:
          "Takeaway counter ordering with multiple held drafts for Shadab's parcel and cafe counters.",
      },
      { property: "og:title", content: "Quick Order · SHADAB RestaurantOS" },
      {
        property: "og:description",
        content: "Counter and takeaway ordering with draft holds.",
      },
    ],
  }),
  component: QuickOrder,
});

type Draft = {
  id: string;
  label: string;
  customer: string;
  phone: string;
  lines: OrderLine[];
  sent: boolean;
};

function QuickOrder() {
  const { stockOut, notify } = useAppState();
  const [section, setSection] = useState("ac-takeaway");
  const [category, setCategory] = useState("favorites");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeDraft, setActiveDraft] = useState<string | null>(null);

  const draft = drafts.find((d) => d.id === activeDraft) ?? null;
  const items = MENU_ITEMS.filter((i) => i.status === "available" && !stockOut[i.id]).filter((i) =>
    category === "favorites" ? i.favorite : i.categoryId === category,
  );

  const newDraft = () => {
    const d: Draft = {
      id: `d${Date.now()}`,
      label: `Order ${drafts.length + 1}`,
      customer: "",
      phone: "",
      lines: [],
      sent: false,
    };
    setDrafts((prev) => [...prev, d]);
    setActiveDraft(d.id);
  };

  const addItem = (itemId: string) => {
    if (!draft) return;
    const item = MENU_ITEMS.find((i) => i.id === itemId)!;
    const variant = item.variants[0];
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== draft.id) return d;
        const key = `${item.id}-${variant?.name ?? ""}`;
        const existing = d.lines.find((l) => `${l.itemId}-${l.variant ?? ""}` === key);
        const line: OrderLine = {
          id: `${key}-${Date.now()}`,
          itemId: item.id,
          name: item.name,
          qty: 1,
          unitPrice: variant ? variant.price : item.price,
          status: "on-table",
          ...(variant ? { variant: variant.name } : {}),
        };
        return {
          ...d,
          lines: existing
            ? d.lines.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l))
            : [...d.lines, line],
        };
      }),
    );
  };

  const total = draft?.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) ?? 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] gap-3 p-3">
      <Card className="flex w-[200px] shrink-0 flex-col gap-2 overflow-hidden p-3 shadow-card">
        <Select value={section} onValueChange={setSection}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTIONS.filter((s) => s.type === "takeaway").map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ScrollArea className="flex-1">
          <div className="space-y-1 pr-2">
            {[{ id: "favorites", name: "Favorites" }, ...CATEGORIES].map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "w-full rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                  category === c.id ? "bg-primary-soft text-primary" : "hover:bg-accent",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <div className="flex flex-1 flex-col gap-3 overflow-hidden">
        <Card className="gap-2 p-3 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Active Orders</h2>
            <div className="flex gap-1">
              <Button size="sm" onClick={newDraft}>
                <Plus className="size-4" /> New
              </Button>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Settings">
                <Settings className="size-4" />
              </Button>
            </div>
          </div>
          {drafts.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">No active orders</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {drafts.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setActiveDraft(d.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    d.id === activeDraft
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-accent",
                  )}
                >
                  {d.customer || d.label} · {d.lines.length}
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-1 flex-col gap-2 overflow-hidden p-3 shadow-card">
          <h2 className="text-sm font-semibold capitalize">
            {category === "favorites"
              ? "Favorites"
              : CATEGORIES.find((c) => c.id === category)?.name}
          </h2>
          <ScrollArea className="flex-1">
            <div className="grid gap-2 pr-2 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {item.name}
                      {item.spicy && <span className="ml-1 text-xs">🌶️</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {inr(item.variants[0]?.price ?? item.price, false)}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    className="size-8 bg-success text-success-foreground hover:bg-success/90"
                    disabled={!draft}
                    onClick={() => addItem(item.id)}
                    aria-label={`Add ${item.name}`}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>

      <Card className="flex w-[300px] shrink-0 flex-col gap-3 overflow-hidden p-3 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Order Panel</h2>
          <button className="text-xs font-medium text-primary">Recent Bills</button>
        </div>
        {!draft ? (
          <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-muted-foreground">
            No draft selected — create or select a draft to start adding items.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Customer name"
                value={draft.customer}
                disabled={draft.sent}
                onChange={(e) =>
                  setDrafts((prev) =>
                    prev.map((d) => (d.id === draft.id ? { ...d, customer: e.target.value } : d)),
                  )
                }
                className="h-8 text-xs"
              />
              <Input
                placeholder="Phone"
                value={draft.phone}
                disabled={draft.sent}
                onChange={(e) =>
                  setDrafts((prev) =>
                    prev.map((d) => (d.id === draft.id ? { ...d, phone: e.target.value } : d)),
                  )
                }
                className="h-8 text-xs"
              />
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-2">
                {draft.lines.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded-lg border border-border p-2 text-sm"
                  >
                    <div>
                      <p className="font-medium leading-tight">{l.name}</p>
                      {l.variant && (
                        <p className="text-[11px] text-muted-foreground">{l.variant}</p>
                      )}
                    </div>
                    <span className="tabular-nums">
                      {l.qty} × {inr(l.unitPrice, false)}
                    </span>
                  </div>
                ))}
                {draft.lines.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Add items from the grid.
                  </p>
                )}
              </div>
            </ScrollArea>
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (pre-tax)</span>
                <span className="font-bold tabular-nums">{inr(total)}</span>
              </div>
              {!draft.sent ? (
                <Button
                  className="w-full"
                  disabled={draft.lines.length === 0}
                  onClick={() => {
                    if (!draft.customer.trim() || !draft.phone.trim()) {
                      toast.error("Enter customer name and phone for the takeaway order");
                      return;
                    }
                    setDrafts((prev) =>
                      prev.map((d) => (d.id === draft.id ? { ...d, sent: true } : d)),
                    );
                    notify(`Takeaway order sent to kitchen — ${draft.customer} (${draft.phone})`);
                    toast.success(`Sent to kitchen — ticket queued for ${draft.customer}`);
                  }}
                >
                  Send to Kitchen
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
                    setActiveDraft(null);
                    notify(`Takeaway order picked up — ${draft.customer}`);
                    toast.success(`Picked up — hand bill to cashier counter`);
                  }}
                >
                  Mark Picked Up
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full text-destructive"
                onClick={() => {
                  setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
                  setActiveDraft(null);
                }}
              >
                <Trash2 className="size-4" /> Discard draft
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
