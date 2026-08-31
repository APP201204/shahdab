import type { ReactNode } from "react";
import { PermissionGuard } from "@/components/PermissionGuard";

interface PermissionRouteProps {
  permission: string | string[];
  children: ReactNode;
}

export function PermissionRoute({ permission, children }: PermissionRouteProps) {
  return <PermissionGuard permission={permission}>{children}</PermissionGuard>;
}
