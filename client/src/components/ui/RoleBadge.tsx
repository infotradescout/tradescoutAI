import { Badge } from "@/components/ui/badge";
import { getRoleDisplayName, ROLE_HIERARCHY } from "@shared/roles";
import type { UserRole } from "@shared/roles";
import { Shield, Crown, Star, Users, Wrench, Home, Building } from "lucide-react";

interface RoleBadgeProps {
  role: UserRole;
  showIcon?: boolean;
  variant?: "default" | "secondary" | "error" | "outline";
  size?: "sm" | "md" | "lg";
}

function getRoleIcon(role: UserRole) {
  const level = ROLE_HIERARCHY[role];

  if (level >= 90) return <Crown className="h-3 w-3" />; // Super Admin
  if (level >= 50) return <Shield className="h-3 w-3" />; // Admin/Staff
  if (level >= 30) return <Star className="h-3 w-3" />; // Staff
  if (level >= 20) return <Users className="h-3 w-3" />; // Community
  if (level >= 10) return <Wrench className="h-3 w-3" />; // Service Provider
  return <Home className="h-3 w-3" />; // Customer
}

function getRoleVariant(role: UserRole): "default" | "secondary" | "error" | "outline" {
  const level = ROLE_HIERARCHY[role];

  if (level >= 90) return "error"; // Super Admin - Error (red)
  if (level >= 50) return "default"; // Admin/Staff - Primary
  if (level >= 30) return "secondary"; // Staff - Secondary
  if (level >= 20) return "outline"; // Community - Outline
  return "secondary"; // Others - Secondary
}

function getRoleColor(role: UserRole): string {
  const level = ROLE_HIERARCHY[role];

  if (level >= 100) return "bg-red-600 text-white"; // Super Admin
  if (level >= 90) return "bg-red-500 text-white"; // Legacy high admin
  if (level >= 70) return "bg-purple-600 text-white"; // Ops Admin
  if (level >= 50) return "bg-blue-600 text-white"; // Staff
  if (level >= 40) return "bg-green-600 text-white"; // Senior Staff
  if (level >= 30) return "bg-yellow-600 text-black"; // Staff
  if (level >= 25) return "bg-ts-orange-dark text-white"; // Community Leader
  if (level >= 20) return "bg-white/10 text-white"; // Community
  if (level >= 15) return "bg-indigo-600 text-white"; // top tier
  if (level >= 10) return "bg-teal-600 text-white"; // Service Provider
  return "bg-white/10 text-white"; // Customer
}

export function RoleBadge({ role, showIcon = true, variant, size = "md" }: RoleBadgeProps) {
  const displayName = getRoleDisplayName(role);
  const icon = showIcon ? getRoleIcon(role) : null;
  // Only allow Badge-supported variants
  const allowedVariants = ["default", "secondary", "error", "outline"];
  const computedVariant = getRoleVariant(role);
  const badgeVariant = allowedVariants.includes(variant as any) ? variant : computedVariant;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <Badge
      variant={badgeVariant}
      className={`${sizeClasses[size]} ${getRoleColor(role)} flex items-center gap-1 font-medium`}
    >
      {icon}
      {displayName}
    </Badge>
  );
}

// Role hierarchy indicator component
interface RoleHierarchyProps {
  role: UserRole;
  showLevel?: boolean;
}

export function RoleHierarchy({ role, showLevel = false }: RoleHierarchyProps) {
  const level = ROLE_HIERARCHY[role];
  const maxLevel = 5;
  const filledLevels = Math.min(Math.floor(level / 20), maxLevel);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxLevel }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < filledLevels
              ? level >= 90
                ? "bg-red-500"
                : level >= 50
                  ? "bg-blue-500"
                  : level >= 30
                    ? "bg-green-500"
                    : level >= 20
                      ? "bg-yellow-500"
                      : "bg-white/10"
              : "bg-white/10"
          }`}
        />
      ))}
      {showLevel && <span className="text-xs text-muted-foreground ml-1">Level {level}</span>}
    </div>
  );
}

// Permission indicator component
interface PermissionIndicatorProps {
  hasPermission: boolean;
  permissionName: string;
  size?: "sm" | "md";
}

export function PermissionIndicator({
  hasPermission,
  permissionName,
  size = "md",
}: PermissionIndicatorProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
  };

  return (
    <div className="flex items-center gap-1">
      <div
        className={`${sizeClasses[size]} rounded-full ${
          hasPermission ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <span className={`${size === "sm" ? "text-xs" : "text-sm"} text-muted-foreground`}>
        {permissionName}
      </span>
    </div>
  );
}
