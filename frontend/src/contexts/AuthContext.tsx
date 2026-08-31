import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Notification, Organization, Outlet, Staff } from "@/types";
import { dataService, db, permissionsMatrix } from "@/mocks/db";

interface AuthSession {
  staff: Staff;
  organization: Organization;
  outlet: Outlet;
  outlets: Outlet[];
  roles: string[];
  assignments: {
    floors: string[];
    tables: string[];
    kitchens: string[];
  };
}

interface AuthContextValue {
  staff: Staff | null;
  organization: Organization | null;
  outlet: Outlet | null;
  outletId: string | null;
  outlets: Outlet[];
  roles: string[];
  assignments: { floors: string[]; tables: string[]; kitchens: string[] };
  notifications: Notification[];
  unreadCount: number;
  login: (staffId: string, outletId?: string | null) => void;
  logout: () => void;
  setActiveOutlet: (outletId: string) => void;
  can: (permission: string | string[]) => boolean;
  markNotificationRead: (id: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function buildSession(staff: Staff, preferredOutletId?: string | null): AuthSession | null {
  const organization = db.organizations.find((o) => o.id === staff.organization_id);
  if (!organization) return null;

  const staffRoleOutlets = db.staffRoles
    .filter((sr) => sr.staff_id === staff.id)
    .map((sr) => sr.outlet_id);
  const outletIds = Array.from(new Set(staffRoleOutlets));
  const activeOutletId =
    preferredOutletId && outletIds.includes(preferredOutletId)
      ? preferredOutletId
      : outletIds[0];

  if (!activeOutletId) return null;

  const activeRoleIds = db.staffRoles
    .filter((sr) => sr.staff_id === staff.id && sr.outlet_id === activeOutletId)
    .map((sr) => sr.role_id);
  const roles = db.roles
    .filter((r) => activeRoleIds.includes(r.id))
    .map((r) => r.name);

  const outlets = db.outlets.filter((o) => outletIds.includes(o.id));
  const outlet = outlets.find((o) => o.id === activeOutletId) as Outlet;

  const floors = db.staffFloorAssignments
    .filter((a) => a.staff_id === staff.id)
    .map((a) => a.floor_id);
  const tables = db.staffTableAssignments
    .filter((a) => a.staff_id === staff.id)
    .map((a) => a.table_id);
  const kitchens = db.staffKitchenAssignments
    .filter((a) => a.staff_id === staff.id)
    .map((a) => a.kitchen_id);

  return {
    staff,
    organization,
    outlet,
    outlets,
    roles,
    assignments: { floors, tables, kitchens },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [notificationVersion, setNotificationVersion] = useState(0);

  const notifications = useMemo(() => {
    if (!session) return [];
    return db.notifications
      .filter((n) => n.staff_id === session.staff.id)
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [session?.staff.id, notificationVersion]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const login = useCallback((staffId: string, preferredOutletId?: string | null) => {
    const staff = dataService("staff").findById(staffId);
    if (!staff) return;
    const nextSession = buildSession(staff, preferredOutletId);
    setSession(nextSession);
  }, []);

  const logout = useCallback(() => {
    setSession(null);
  }, []);

  const setActiveOutlet = useCallback(
    (nextOutletId: string) => {
      if (!session) return;
      const nextSession = buildSession(session.staff, nextOutletId);
      setSession(nextSession);
    },
    [session]
  );

  const can = useCallback(
    (permission: string | string[]) => {
      if (!session) return false;
      const permissions = Array.isArray(permission) ? permission : [permission];
      return permissions.some((p) => session.roles.some((role) => permissionsMatrix[role]?.includes(p)));
    },
    [session]
  );

  const markNotificationRead = useCallback((id: string) => {
    dataService("notifications").update(id, { is_read: true });
    setNotificationVersion((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({
      staff: session?.staff ?? null,
      organization: session?.organization ?? null,
      outlet: session?.outlet ?? null,
      outletId: session?.outlet.id ?? null,
      outlets: session?.outlets ?? [],
      roles: session?.roles ?? [],
      assignments: session?.assignments ?? { floors: [], tables: [], kitchens: [] },
      notifications,
      unreadCount,
      login,
      logout,
      setActiveOutlet,
      can,
      markNotificationRead,
    }),
    [session, notifications, unreadCount, login, logout, setActiveOutlet, can, markNotificationRead]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
