import { useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { db, dataService, permissionsMatrix } from "@/mocks/db";
import { cn } from "@/lib/utils";
import { inputClass, selectClass, pageWrapper, tabList, tabButton, tabButtonActive, tabButtonInactive, messageBanner } from "@/lib/styles";
import { getFirstError, staffSchema } from "@/lib/validation";
import { Plus, Trash2 } from "lucide-react";

const now = new Date().toISOString();

export function StaffPage() {
  const { staff, can } = useAuth();
  const [activeTab, setActiveTab] = useState<"staff" | "permissions">("staff");

  if (!staff) return null;

  return (
    <div className={pageWrapper}>
      <h1 className="text-2xl font-bold">Staff &amp; Roles</h1>
      <div className={tabList}>
        <button
          onClick={() => setActiveTab("staff")}
          className={cn(
            tabButton,
            activeTab === "staff" ? tabButtonActive : tabButtonInactive
          )}
        >
          Staff
        </button>
        <button
          onClick={() => setActiveTab("permissions")}
          disabled={!can("organization.update")}
          className={cn(
            tabButton,
            activeTab === "permissions" ? tabButtonActive : tabButtonInactive,
            "disabled:opacity-40"
          )}
        >
          Permissions
        </button>
      </div>

      {activeTab === "staff" ? (
        <StaffSection orgId={staff.organization_id} />
      ) : (
        <PermissionsSection />
      )}
    </div>
  );
}

function StaffSection({ orgId }: { orgId: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [outletId, setOutletId] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [floorIds, setFloorIds] = useState<string[]>([]);
  const [tableIds, setTableIds] = useState<string[]>([]);
  const [kitchenIds, setKitchenIds] = useState<string[]>([]);
  const [staffList, setStaffList] = useState(() => [...db.staff]);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const outlets = db.outlets.filter((o) => o.organization_id === orgId);
  const roles = db.roles.filter((r) => r.is_system_role);
  const floors = db.floors.filter((f) => f.organization_id === orgId);
  const tables = db.tables.filter((t) => t.organization_id === orgId);
  const kitchens = db.kitchens.filter((k) => k.organization_id === orgId);

  const toggleInList = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const defaultOutlet =
      outletId || db.outlets.find((o) => o.organization_id === orgId)?.id;
    if (!defaultOutlet) {
      setMessage({ type: "error", text: "No outlet available" });
      return;
    }
    const parsed = staffSchema.safeParse({
      name,
      phone,
      email: email.trim() || null,
      password,
      outlet_id: outletId,
    });
    if (!parsed.success) {
      setMessage({ type: "error", text: getFirstError(parsed) });
      return;
    }
    const record = dataService("staff").create({
      organization_id: orgId,
      outlet_id: outletId || null,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      password_hash: password,
      status: "active",
      created_at: now,
    });
    for (const roleId of roleIds) {
      const role = db.roles.find((r) => r.id === roleId);
      if (role) {
        db.staffRoles.push({
          staff_id: record.id,
          role_id: role.id,
          outlet_id: defaultOutlet,
        });
      }
    }
    for (const floorId of floorIds) {
      db.staffFloorAssignments.push({ staff_id: record.id, floor_id: floorId });
    }
    for (const tableId of tableIds) {
      db.staffTableAssignments.push({
        staff_id: record.id,
        table_id: tableId,
        assigned_at: now,
      });
    }
    for (const kitchenId of kitchenIds) {
      db.staffKitchenAssignments.push({
        staff_id: record.id,
        kitchen_id: kitchenId,
      });
    }
    setStaffList([...db.staff]);
    setName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setOutletId("");
    setRoleIds([]);
    setFloorIds([]);
    setTableIds([]);
    setKitchenIds([]);
    setMessage({ type: "success", text: "Staff created" });
  };

  return (
    <section className="space-y-4">
      {message && (
        <div
          className={cn(
            messageBanner,
            message.type === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-green-100 text-green-800"
          )}
        >
          {message.text}
        </div>
      )}
      <form onSubmit={add} className="space-y-4 rounded-md border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={inputClass}
            placeholder="Full name"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
          />
          <input
            className={inputClass}
            placeholder="Phone"
            value={phone}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setPhone(e.target.value)
            }
          />
          <input
            className={inputClass}
            placeholder="Email"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
          />
          <input
            className={inputClass}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setPassword(e.target.value)
            }
          />
          <select
            className={selectClass}
            value={outletId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setOutletId(e.target.value)
            }
          >
            <option value="">Global (admin)</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium">Roles</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            {roles.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={roleIds.includes(r.id)}
                  onChange={() => setRoleIds((prev) => toggleInList(prev, r.id))}
                  className="h-4 w-4"
                />
                {r.name}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <h4 className="mb-2 text-sm font-medium">Floors</h4>
            <div className="space-y-1">
              {floors.map((f) => (
                <label
                  key={f.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={floorIds.includes(f.id)}
                    onChange={() =>
                      setFloorIds((prev) => toggleInList(prev, f.id))
                    }
                    className="h-4 w-4"
                  />
                  {f.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium">Tables</h4>
            <div className="space-y-1">
              {tables.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={tableIds.includes(t.id)}
                    onChange={() =>
                      setTableIds((prev) => toggleInList(prev, t.id))
                    }
                    className="h-4 w-4"
                  />
                  Table {t.table_number}
                </label>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium">Kitchens</h4>
            <div className="space-y-1">
              {kitchens.map((k) => (
                <label
                  key={k.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={kitchenIds.includes(k.id)}
                    onChange={() =>
                      setKitchenIds((prev) => toggleInList(prev, k.id))
                    }
                    className="h-4 w-4"
                  />
                  {k.name}
                </label>
              ))}
            </div>
          </div>
        </div>

        <Button type="submit">
          <Plus className="mr-2 h-4 w-4" /> Add Staff
        </Button>
      </form>

      <ul className="divide-y rounded-md border">
        {staffList.map((s) => {
          const sr = db.staffRoles
            .filter((r) => r.staff_id === s.id)
            .map((r) => db.roles.find((role) => role.id === r.role_id)?.name)
            .filter(Boolean)
            .join(", ");
          return (
            <li
              key={s.id}
              className="flex items-center justify-between px-3 py-2"
            >
              <span className="text-sm">
                {s.name} ({s.phone}) — {sr || "no roles"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  dataService("staff").remove(s.id);
                  setStaffList([...db.staff]);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PermissionsSection() {
  const [matrix, setMatrix] = useState<Record<string, string[]>>(() => {
    const copy: Record<string, string[]> = {};
    for (const [role, perms] of Object.entries(permissionsMatrix)) {
      copy[role] = [...perms];
    }
    return copy;
  });
  const [notice, setNotice] = useState<string | null>(null);

  const toggle = (roleName: string, code: string) => {
    const list = matrix[roleName] ?? [];
    const checked = list.includes(code);
    const nextList = checked
      ? list.filter((c) => c !== code)
      : [...list, code];
    const next = { ...matrix, [roleName]: nextList };
    setMatrix(next);
    permissionsMatrix[roleName] = nextList;

    const role = db.roles.find((r) => r.name === roleName);
    const perm = db.permissions.find((p) => p.code === code);
    if (role && perm) {
      if (!checked) {
        db.rolePermissions.push({
          role_id: role.id,
          permission_id: perm.id,
        });
      } else {
        const i = db.rolePermissions.findIndex(
          (rp) => rp.role_id === role.id && rp.permission_id === perm.id
        );
        if (i !== -1) db.rolePermissions.splice(i, 1);
      }
    }
    setNotice(`${roleName}: ${code} ${!checked ? "granted" : "revoked"}`);
  };

  return (
    <section className="space-y-4">
      {notice && (
        <div className="rounded-md bg-green-100 p-3 text-sm text-green-800">
          {notice}
        </div>
      )}
      <div className="space-y-6">
        {db.roles
          .filter((r) => r.is_system_role)
          .map((role) => (
            <div
              key={role.id}
              className="rounded-md border p-4"
            >
              <h3 className="mb-3 text-base font-semibold capitalize">
                {role.name}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {db.permissions.map((perm) => (
                  <label
                    key={perm.id}
                    className="flex items-start gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={matrix[role.name]?.includes(perm.code) || false}
                      onChange={() => toggle(role.name, perm.code)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span className="text-muted-foreground">
                      {perm.description}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
