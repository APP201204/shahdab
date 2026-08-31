import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Forbidden } from "./Forbidden";

interface PermissionGuardProps {
  permission: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({
  permission,
  children,
  fallback = <Forbidden />,
}: PermissionGuardProps) {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : <>{fallback}</>;
}
