import { useAuth } from "@/hooks/useAuth";
import { getRolePermissions, hasExplicitRoleGrant } from "@shared/roles";
import type { UserRole } from "@shared/roles";
import { ReactNode } from "react";

interface RoleProtectedRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallback?: ReactNode;
}

export function RoleProtectedRoute({
  children,
  allowedRoles,
  fallback = <div className="text-center py-8 text-muted-foreground">Access denied</div>,
}: RoleProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return fallback;
  }

  const userRole = user.role as UserRole;
  const hasPermission = hasExplicitRoleGrant(userRole, allowedRoles);

  if (!hasPermission) {
    return fallback;
  }

  return <>{children}</>;
}

interface PermissionProtectedProps {
  children: ReactNode;
  permission: keyof ReturnType<typeof getRolePermissions>;
  fallback?: ReactNode;
}

export function PermissionProtected({
  children,
  permission,
  fallback = null,
}: PermissionProtectedProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return fallback;
  }

  const userRole = user.role as UserRole;
  const permissions = getRolePermissions(userRole);

  if (!permissions[permission]) {
    return fallback;
  }

  return <>{children}</>;
}
