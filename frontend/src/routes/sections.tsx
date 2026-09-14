import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SECTIONS, type Section } from "@/data/seed";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sections")({
  head: () => ({
    meta: [
      { title: "Sections · SHADAB RestaurantOS" },
      {
        name: "description",
        content:
          "Every room and counter Shadab serves from — service charge, branding and guest presentation.",
      },
      { property: "og:title", content: "Sections · SHADAB RestaurantOS" },
      {
        property: "og:description",
        content: "Manage Shadab's dine-in rooms and takeaway counters.",
      },
    ],
  }),
  component: SectionsPage,
});

function SectionsPage() {
  const [filter, setFilter] = useState<"all" | "dine-in" | "takeaway">("all");
  const [editing, setEditing] = useState<Section | null>(null);

  const visible = SECTIONS.filter((s) => filter === "all" || s.type === filter);
  const dineIn = SECTIONS.filter((s) => s.type === "dine-in").length;
  const takeaway = SECTIONS.length - dineIn;
  const branded = SECTIONS.filter((s) => s.ownBranding).length;

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Setup · Sections
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Sections</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Every room and counter you serve from — what each one is for, what it charges, and how
            it presents itself to guests.
          </p>
        </div>
        <div className="flex gap-1">
          {(["all", "dine-in", "takeaway"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                filter === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent",
              )}
            >
              {f === "all" ? "All" : f === "dine-in" ? "Dine In" : "Takeaway"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="gap-1 p-4 shadow-card">
          <p className="text-2xl font-bold tabular-nums">{SECTIONS.length}</p>
          <p className="text-xs font-medium">Sections</p>
          <p className="text-[11px] text-muted-foreground">
            {dineIn} dine in · {takeaway} takeaway
          </p>
        </Card>
        <Card className="gap-1 p-4 shadow-card">
          <p className="text-2xl font-bold tabular-nums">
            {SECTIONS.filter((s) => s.serviceCharge > 0).length === 0 ? "0%" : "Mixed"}
          </p>
          <p className="text-xs font-medium">Service Charge</p>
          <p className="text-[11px] text-muted-foreground">
            {SECTIONS.filter((s) => s.serviceCharge > 0).length === 0
              ? "same everywhere"
              : `${SECTIONS.filter((s) => s.serviceCharge > 0).length} section(s) charge service`}
          </p>
        </Card>
        <Card className="gap-1 p-4 shadow-card">
          <p className="text-2xl font-bold tabular-nums">
            {branded} of {SECTIONS.length}
          </p>
          <p className="text-xs font-medium">Own Branding</p>
          <p className="text-[11px] text-muted-foreground">rooms with their own look</p>
        </Card>
      </div>

      <Card className="divide-y divide-border p-0 shadow-card">
        {visible.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-4 p-4">
            <span
              className="flex size-11 items-center justify-center rounded-lg text-base font-bold text-primary-foreground"
              style={{ background: s.color }}
            >
              {s.name.charAt(0)}
            </span>
            <div className="min-w-[220px] flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {s.name}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                  {s.type === "dine-in" ? "Dine In" : "Takeaway"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{s.tagline}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-4 rounded-full" style={{ background: s.color }} />
              {s.ownBranding ? "Own colours · restaurant logo" : "Restaurant default · no section branding"}
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-wide">
              {s.serviceCharge}% service
            </span>
            <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
              Customize
            </Button>
          </div>
        ))}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize Section</DialogTitle>
            <DialogDescription>
              Set the logo and brand colours guests see for {editing?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm">
                  Upload Logo
                </Button>
                <span className="text-xs text-muted-foreground">Max 5MB</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primary">Primary Color</Label>
              <div className="flex items-center gap-2">
                <span className="size-8 rounded-md border border-border bg-brand" />
                <Input id="primary" defaultValue="#eed08b" className="w-[140px]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="secondary">Secondary Color</Label>
              <div className="flex items-center gap-2">
                <span className="size-8 rounded-md border border-border bg-brand-alt" />
                <Input id="secondary" defaultValue="#c24a26" className="w-[140px]" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => setEditing(null)}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
