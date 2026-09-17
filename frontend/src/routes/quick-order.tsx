import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Settings, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr } from "@/lib/format";
import { useMenu } from "@/hooks/useMenu";
import { useSections } from "@/hooks/useSections";
import {
  useOrders,
  useCreateTakeawayOrder,
  usePickupOrder,
} from "@/hooks/useOrders";
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

type DraftLine = {
  key: string;
  menuItemId: string;
  variantId?: string;
  name: string;
  variant?: string;
  qty: number;
  unitPrice: number;
};

type Draft = {
  id: string;
  label: string;
  customer: string;
  phone: string;
  lines: DraftLine[];
  sent: boolean;
  orderId?: string;
};

type LiveStatus = "in-kitchen" | "ready" | "completed";

const liveStatusMeta: Record<LiveStatus, { label: string; className: string }> = {
  "in-kitchen": {
    label: "In Kitchen",
    className: "bg-info-soft text-info",
  },
  ready: {
    label: "Ready for Pickup",
    className: "bg-success-soft text-success",
  },
  completed: {
    label: "Completed",
    className: "bg-muted text-muted-foreground",
  },
};

const OUTLET = "SHADAB";
const DRAFTS_KEY = "quick-order-drafts";

function loadDrafts(): Draft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? (JSON.parse(raw) as Draft[]) : [];
  } catch {
    return [];
  }
}

function QuickOrder() {
  const { data: menuData } = useMenu(OUTLET);
  const { data: sectionsData } = useSections(OUTLET);
  const { data: ordersData } = useOrders();
  const createTakeaway = useCreateTakeawayOrder();
  const pickupOrder = usePickupOrder();

  const [section, setSection] = useState("");
  const [category, setCategory] = useState("favorites");
  const [drafts, setDrafts] = useState<Draft[]>(loadDrafts);
  const [activeDraft, setActiveDraft] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  }, [drafts]);

  const takeawaySections =
    sectionsData?.sections.filter((s) => s.type === "takeaway") ?? [];
  const defaultSection = takeawaySections[0]?.id ?? "";

  useEffect(() => {
    if (!section && defaultSection) {
      setSection(defaultSection);
    }
  }, [section, defaultSection]);

  const unitsByOrderId = useMemo(
    () =>
      Object.fromEntries(
        (ordersData?.units ?? [])
          .filter((u) => u.orderId)
          .map((u) => [u.orderId!, u]),
      ),
    [ordersData],
  );

  const allItems = menuData?.categories.flatMap((c) => c.items) ?? [];
  const categories = [
    { id: "favorites", name: "Favorites" },
    ...(menuData?.categories ?? []),
  ];

  const draft = drafts.find((d) => d.id === activeDraft) ?? null;
  const items = allItems
    .filter((i) => i.status !== "disabled" && i.status !== "not-offered")
    .filter((i) =>
      category === "favorites" ? i.favorite : i.categoryId === category,
    );

  const liveUnit = draft?.orderId ? unitsByOrderId[draft.orderId] : undefined;
  const liveLines = (liveUnit?.lines ?? []).filter((l) => l.status !== "cancelled");
  const liveStatus: LiveStatus | null = !draft?.sent
    ? null
    : !liveUnit
      ? "completed"
      : liveLines.length > 0 &&
          liveLines.every((l) => l.kitchenStatus === "ready" || l.served)
        ? "ready"
        : "in-kitchen";

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
    if (!draft || draft.sent) return;
    const item = allItems.find((i) => i.id === itemId);
    if (!item || item.status === "unavailable" || item.outOfStock) return;
    const variant = item.variants?.find((v) => v.available) ?? item.variants?.[0];
    const key = `${item.id}-${variant?.id ?? ""}`;
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== draft.id) return d;
        const existing = d.lines.find((l) => l.key === key);
        const line: DraftLine = {
          key,
          menuItemId: item.id,
          ...(variant ? { variantId: variant.id, variant: variant.name } : {}),
          name: item.name,
          qty: 1,
          unitPrice: variant ? variant.price : item.basePrice,
        };
        return {
          ...d,
          lines: existing
            ? d.lines.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l))
            : [...d.lines, line],
        };
      }),
    );
  };

  const removeLine = (key: string) => {
    if (!draft || draft.sent) return;
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === draft.id
          ? { ...d, lines: d.lines.filter((l) => l.key !== key) }
          : d,
      ),
    );
  };

  const sendToKitchen = () => {
    if (!draft || draft.sent) return;
    if (!draft.customer.trim() || !draft.phone.trim()) {
      toast.error("Enter customer name and phone for the takeaway order");
      return;
    }
    if (!/^\d{10}$/.test(draft.phone)) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }
    if (!section) {
      toast.error("Select a counter section first");
      return;
    }
    createTakeaway.mutate(
      {
        sectionId: section,
        customerName: draft.customer.trim(),
        customerPhone: draft.phone.trim(),
        items: draft.lines.map((l) => ({
          menuItemId: l.menuItemId,
          ...(l.variantId ? { variantId: l.variantId } : {}),
          qty: l.qty,
        })),
      },
      {
        onSuccess: (res) => {
          setDrafts((prev) =>
            prev.map((d) =>
              d.id === draft.id ? { ...d, sent: true, orderId: res.order.id } : d,
            ),
          );
          toast.success(`Sent to kitchen — ticket queued for ${draft.customer}`);
        },
        onError: (err: any) =>
          toast.error(err?.message ?? "Could not send order to kitchen"),
      },
    );
  };

  const markPickedUp = () => {
    if (!draft?.orderId) return;
    pickupOrder.mutate(draft.orderId, {
      onSuccess: () => {
        setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
        setActiveDraft(null);
        toast.success("Picked up — hand bill to cashier counter");
      },
      onError: (err: any) =>
        toast.error(err?.message ?? "Could not mark picked up"),
    });
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
            {takeawaySections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ScrollArea className="flex-1">
          <div className="space-y-1 pr-2">
            {categories.map((c) => (
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
              {drafts.map((d) => {
                const dUnit = d.orderId ? unitsByOrderId[d.orderId] : undefined;
                const dLines = (dUnit?.lines ?? []).filter(
                  (l) => l.status !== "cancelled",
                );
                const dStatus: LiveStatus | null = !d.sent
                  ? null
                  : !dUnit
                    ? "completed"
                    : dLines.length > 0 &&
                        dLines.every(
                          (l) => l.kitchenStatus === "ready" || l.served,
                        )
                      ? "ready"
                      : "in-kitchen";
                return (
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
                    {dStatus && (
                      <span className="ml-1 opacity-80">
                        — {liveStatusMeta[dStatus].label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="flex flex-1 flex-col gap-2 overflow-hidden p-3 shadow-card">
          <h2 className="text-sm font-semibold capitalize">
            {category === "favorites"
              ? "Favorites"
              : categories.find((c) => c.id === category)?.name}
          </h2>
          <ScrollArea className="flex-1">
            <div className="grid gap-2 pr-2 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const out = item.status === "unavailable" || !!item.outOfStock;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border border-border p-3",
                      out && "opacity-60",
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {item.name}
                        {item.spicy && <span className="ml-1 text-xs">🌶️</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inr(item.variants?.[0]?.price ?? item.basePrice, false)}
                      </p>
                      {out && (
                        <p className="text-[10px] font-medium text-destructive">
                          Out of Stock
                        </p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      className="size-8 bg-success text-success-foreground hover:bg-success/90"
                      disabled={!draft || draft.sent || out}
                      onClick={() => addItem(item.id)}
                      aria-label={`Add ${item.name}`}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </Card>
      </div>

      <Card className="flex w-[300px] shrink-0 flex-col gap-3 overflow-hidden p-3 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Order Panel</h2>
          <div className="flex items-center gap-2">
            {liveStatus && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  liveStatusMeta[liveStatus].className,
                )}
              >
                {liveStatusMeta[liveStatus].label}
              </span>
            )}
            <button className="text-xs font-medium text-primary">Recent Bills</button>
          </div>
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
                inputMode="numeric"
                maxLength={10}
                onChange={(e) => {
                  const phone = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setDrafts((prev) =>
                    prev.map((d) => (d.id === draft.id ? { ...d, phone } : d)),
                  );
                }}
                className="h-8 text-xs"
              />
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-2">
                {draft.lines.map((l) => (
                  <div
                    key={l.key}
                    className="flex items-center justify-between rounded-lg border border-border p-2 text-sm"
                  >
                    <div>
                      <p className="font-medium leading-tight">{l.name}</p>
                      {l.variant && (
                        <p className="text-[11px] text-muted-foreground">{l.variant}</p>
                      )}
                    </div>
                    <span className="flex items-center gap-1">
                      <span className="tabular-nums">
                        {l.qty} × {inr(l.unitPrice, false)}
                      </span>
                      {!draft.sent && (
                        <button
                          onClick={() => removeLine(l.key)}
                          className="rounded-md p-0.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                          aria-label={`Remove ${l.name}`}
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
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
                  disabled={draft.lines.length === 0 || createTakeaway.isPending}
                  onClick={sendToKitchen}
                >
                  Send to Kitchen
                </Button>
              ) : liveStatus === "completed" ? (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
                    setActiveDraft(null);
                  }}
                >
                  Clear Completed
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={liveStatus !== "ready" || pickupOrder.isPending}
                  onClick={markPickedUp}
                >
                  {liveStatus === "ready" ? "Mark Picked Up" : "Waiting for kitchen…"}
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
