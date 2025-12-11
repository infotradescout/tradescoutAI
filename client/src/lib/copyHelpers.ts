import type { User } from "@/hooks/useAuth";
import { getUserTypeMetadata } from "@shared/userTypes";

export function getUserLocationLabel(user: User | null | undefined): string {
  if (!user) return "your area";

  if (user.city && user.state) return `${user.city}, ${user.state}`;
  if (user.city) return user.city;

  if ((user as any).location) return String((user as any).location);

  if (user.county && user.state) return `${user.county}, ${user.state}`;
  if (user.county) return String(user.county);

  if (user.state) return String(user.state);
  return "your area";
}

export function getUserAudienceLabel(user: User | null | undefined): string | null {
  if (!user) return null;
  const roles = (user.roles && user.roles.length > 0)
    ? user.roles
    : user.role
    ? [user.role]
    : [];

  if (roles.length === 0) return null;

  const baseRoles = Array.from(new Set(roles.map((r) => r.split(":")[0])));

  if (baseRoles.includes("homeowner")) return "homeowners";
  if (baseRoles.includes("contractor") || baseRoles.includes("pro")) return "contractors";
  if (baseRoles.includes("service_provider")) return "service providers";
  if (baseRoles.includes("realtor")) return "real estate professionals";
  if (baseRoles.includes("restaurant_owner")) return "local business owners";
  if (baseRoles.includes("community_builder")) return "community builders";

  const meta = getUserTypeMetadata(baseRoles[0]);
  if (meta?.label) {
    return meta.label.toLowerCase() + "s";
  }

  return null;
}
