import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/lib/styles";
import { useAuth } from "@/contexts/AuthContext";
import { dataService, db } from "@/mocks/db";

export function Login() {
  const { login, staff, roles, assignments } = useAuth();
  const navigate = useNavigate();
  const organizations = useMemo(() => db.organizations, []);
  const staffList = useMemo(() => dataService("staff").findAll(), []);
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [staffId, setStaffId] = useState("");
  const [outletId, setOutletId] = useState("");

  useEffect(() => {
    if (!staff) return;
    const firstKitchen = assignments.kitchens[0];
    if (roles.includes("admin") || roles.includes("outlet_manager")) {
      navigate("/setup", { replace: true });
    } else if (roles.includes("captain")) {
      navigate("/tables", { replace: true });
    } else if (roles.includes("cashier")) {
      navigate("/billing", { replace: true });
    } else if (roles.includes("kitchen_manager") && firstKitchen) {
      navigate(`/kitchen/${firstKitchen}`, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [staff, roles, assignments, navigate]);

  const selectedStaff = useMemo(
    () => staffList.find((s) => s.id === staffId),
    [staffList, staffId]
  );

  const availableOutlets = useMemo(() => {
    if (!selectedStaff) return [];
    const staffRoleOutlets = db.staffRoles
      .filter((sr) => sr.staff_id === selectedStaff.id)
      .map((sr) => sr.outlet_id);
    return db.outlets.filter((o) => staffRoleOutlets.includes(o.id));
  }, [selectedStaff]);

  const handleLogin = useCallback(() => {
    if (!staffId) return;
    login(staffId, outletId || null);
  }, [staffId, outletId, login]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-card-foreground">Shahdab</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to your outlet</p>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="org">
              Organization
            </label>
            <select
              id="org"
              className={inputClass}
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="staff">
              Staff
            </label>
            <select
              id="staff"
              className={inputClass}
              value={staffId}
              onChange={(e) => {
                setStaffId(e.target.value);
                setOutletId("");
              }}
            >
              <option value="">Select staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.phone})
                </option>
              ))}
            </select>
          </div>

          {selectedStaff && (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="outlet">
                Outlet
              </label>
              <select
                id="outlet"
                className={inputClass}
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
              >
                <option value="">Default outlet</option>
                {availableOutlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button onClick={handleLogin} disabled={!staffId} className="w-full" type="button">
            Sign in
          </Button>
        </div>
      </div>
    </main>
  );
}
