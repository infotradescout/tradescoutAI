// client/src/lib/roleNav.ts
import { getUserTypeMetadata } from "@shared/userTypes";

export interface RoleNavItem {
  label: string;
  to: string;
  icon: string; // lucide icon name
  roleKey: string;
}

export function buildRoleNavFromRoles(rawRoles: string[]): RoleNavItem[] {
  const seen = new Set<string>();
  const items: RoleNavItem[] = [];

  for (const raw of rawRoles) {
    if (!raw) continue;

    // Normalize: strip any subrole (e.g. contractor:hvac -> contractor)
    const baseRole = raw.split(":")[0];
    if (seen.has(baseRole)) continue;
    seen.add(baseRole);

    const meta = getUserTypeMetadata(baseRole);

    const label = meta?.label ?? baseRole.replace(/_/g, " ");
    const icon =
      baseRole === "contractor"
        ? "Wrench"
        : baseRole === "realtor"
        ? "Home"
        : baseRole === "car_dealer"
        ? "Car"
        : baseRole === "restaurant_owner"
        ? "Soup"
        : "Layout"; // generic default

    // Every role gets a Role Hub page as a guaranteed landing surface.
    items.push({
      label: `${label} hub`,
      to: `/roles/${baseRole}`,
      icon,
      roleKey: baseRole,
    });
  }

  return items;
}
