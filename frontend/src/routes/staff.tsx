import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SECTIONS, STAFF, type StaffMember, type StaffRole } from "@/data/seed";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Staff & Roles · SHADAB RestaurantOS" },
      {
        name: "description",
        content: "Staff accounts, roles and floor/table/kitchen assignments for Shadab.",
      },
      { property: "og:title", content: "Staff & Roles · SHADAB RestaurantOS" },
    ],
  }),
  component: Staff,
});

const ROLES: { id: StaffRole; label: string }[] = [
  { id: "captain", label: "Captain" },
  { id: "waiter", label: "Waiter" },
  { id: "kitchen-manager", label: "Kitchen Manager" },
  { id: "cashier", label: "Cashier" },
  { id: "outlet-manager", label: "Outlet Manager" },
  { id: "admin", label: "Admin" },
];

const roleLabel = (r: StaffRole) => ROLES.find((x) => x.id === r)?.label ?? r;

const ASSIGNMENTS = [
  "Main Counter",
  "Parcel Counter",
  "Main Kitchen",
  ...SECTIONS.map((s) => s.name),
  "Dine In · T1–T4",
  "Dine In · T11–T12",
  "Mezzanine · T5–T7",
  "Aiwan-e-Khas · T8–T10",
];

function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>(STAFF);
  const [draft, setDraft] = useState<StaffMember | null>(null);
  const [isNew, setIsNew] = useState(false);

  const openNew = () => {
    setIsNew(true);
    setDraft({ id: `st${Date.now()}`, name: "", phone: "", roles: [], active: true });
  };

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    if (draft.roles.length === 0) {
      toast.error("Assign at least one role");
      return;
    }
    setStaff((prev) =>
      isNew ? [...prev, draft] : prev.map((s) => (s.id === draft.id ? draft : s)),
    );
    toast.success(isNew ? "Staff member added" : "Staff member updated");
    setDraft(null);
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <UsersRound className="size-5 text-brand-alt" /> Staff &amp; Roles
          </h1>
          <p className="text-sm text-muted-foreground">
            Staff accounts with outlet-scoped roles and assignments.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" /> Add Staff
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {staff.map((s) => (
          <Card key={s.id} className="gap-3 p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                  {s.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h2 className="text-sm font-semibold">{s.name}</h2>
                  <p className="text-xs text-muted-foreground">{s.phone}</p>
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  s.active ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
                )}
              >
                {s.active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {s.roles.map((r) => (
                <span
                  key={r}
                  className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary"
                >
                  {roleLabel(r)}
                </span>
              ))}
            </div>
            {s.assignment && (
              <p className="text-xs text-muted-foreground">Assigned: {s.assignment}</p>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setIsNew(false);
                  setDraft(s);
                }}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
              <Switch
                checked={s.active}
                onCheckedChange={(on) =>
                  setStaff((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: on } : x)))
                }
                aria-label={`Toggle ${s.name} active`}
              />
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? "Add Staff Member" : "Edit Staff Member"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sname">Name</Label>
                  <Input
                    id="sname"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sphone">Phone</Label>
                  <Input
                    id="sphone"
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Roles (outlet-scoped)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => {
                    const checked = draft.roles.includes(r.id);
                    return (
                      <label key={r.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setDraft({
                              ...draft,
                              roles: v
                                ? [...draft.roles, r.id]
                                : draft.roles.filter((x) => x !== r.id),
                            })
                          }
                        />
                        {r.label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Assignment</Label>
                <Select
                  value={draft.assignment ?? ""}
                  onValueChange={(v) => setDraft({ ...draft, assignment: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select floor / station / kitchen" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNMENTS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save}>{isNew ? "Add Staff" : "Update"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
