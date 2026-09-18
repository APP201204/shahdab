import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SECTIONS } from "@/data/seed";
import { toast } from "sonner";

export const Route = createFileRoute("/billing-stations")({
  head: () => ({
    meta: [
      { title: "Billing Stations · SHADAB RestaurantOS" },
      {
        name: "description",
        content: "Configure cashier counters and route billing per section at Shadab Restaurant.",
      },
      { property: "og:title", content: "Billing Stations · SHADAB RestaurantOS" },
      {
        property: "og:description",
        content: "Cashier counter setup and section routing for Shadab Restaurant.",
      },
    ],
  }),
  component: BillingStations,
});

type Station = {
  id: string;
  name: string;
  description: string;
  sectionIds: string[];
  active: boolean;
};

const INITIAL: Station[] = [
  {
    id: "s1",
    name: "Main Counter",
    description: "Ground floor cashier facing the entrance.",
    sectionIds: ["dine-in", "mezzanine"],
    active: true,
  },
  {
    id: "s2",
    name: "Banquet Desk",
    description: "Dedicated billing for Aiwan-e-Khas functions.",
    sectionIds: ["aiwan"],
    active: true,
  },
  {
    id: "s3",
    name: "Parcel Counter",
    description: "Takeaway and cafe billing.",
    sectionIds: ["ac-takeaway", "ak-takeaway", "cafe"],
    active: true,
  },
];

function BillingStations() {
  const navigate = useNavigate();
  const [stations, setStations] = useState<Station[]>(INITIAL);
  const [draft, setDraft] = useState<Station | null>(null);
  const [isNew, setIsNew] = useState(false);

  const openNew = () => {
    setIsNew(true);
    setDraft({ id: `s${Date.now()}`, name: "", description: "", sectionIds: [], active: true });
  };

  const save = () => {
    if (!draft) return;
    setStations((prev) =>
      isNew ? [...prev, draft] : prev.map((s) => (s.id === draft.id ? draft : s)),
    );
    toast.success(isNew ? "Station created" : "Station updated");
    setDraft(null);
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing Management</h1>
          <p className="text-sm text-muted-foreground">
            Configure billing stations for your restaurant.
          </p>
        </div>
        <Button
          onClick={() => {
            openNew();
          }}
        >
          <Plus className="size-4" /> Create Billing Station
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stations.map((station) => (
          <Card key={station.id} className="gap-3 p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold">{station.name}</h2>
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                {station.active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{station.description}</p>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Assigned Sections
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {station.sectionIds.map((id) => {
                  const section = SECTIONS.find((s) => s.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ background: section?.color }}
                      />
                      {section?.name}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="flex-1"
                size="sm"
                onClick={() => {
                  toast.success(`${station.name} opened`);
                  navigate({ to: "/billing" });
                }}
              >
                Open Station
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                aria-label="Edit station"
                onClick={() => {
                  setIsNew(false);
                  setDraft(station);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-9 text-destructive"
                aria-label="Delete station"
                onClick={() => setStations((prev) => prev.filter((s) => s.id !== station.id))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? "Create Billing Station" : "Edit Billing Station"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sname">Station Name</Label>
                <Input
                  id="sname"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sdesc">Description (optional)</Label>
                <Textarea
                  id="sdesc"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Assigned Sections</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SECTIONS.map((s) => {
                    const checked = draft.sectionIds.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            setDraft({
                              ...draft,
                              sectionIds: value
                                ? [...draft.sectionIds, s.id]
                                : draft.sectionIds.filter((id) => id !== s.id),
                            })
                          }
                        />
                        <span className="size-2 rounded-full" style={{ background: s.color }} />
                        {s.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save}>{isNew ? "Create Station" : "Update Station"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
