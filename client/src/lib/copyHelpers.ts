import type { User } from "@/hooks/useAuth";
import { getUserTypeMetadata } from "@shared/userTypes";

export function sanitizeAreaLabel(input: string): string {
  // Display-only normalization for location labels.
  // (Do not rewrite semantics like removing "County"; some forms/pages need it.)
  return String(input)
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

export function getUserLocationLabel(user: User | null | undefined): string {
  if (!user) return "Your area";

  const u: any = user;
  const canonicalCountyName = u.countyName;
  const canonicalStateCode = u.stateCode;

  // If the user has committed a canonical county, always prefer that label.
  if (u.locationCommitted && canonicalCountyName && canonicalStateCode) {
    return `${sanitizeAreaLabel(String(canonicalCountyName))}, ${canonicalStateCode}`;
  }

  // Even if not fully committed, prefer canonical county/state when available.
  if (canonicalCountyName && canonicalStateCode) {
    return `${sanitizeAreaLabel(String(canonicalCountyName))}, ${canonicalStateCode}`;
  }

  const zip = u.zipCode || u.zipcode || u.postalCode;

  if (u.city && u.state && zip) return `${u.city}, ${u.state} ${zip}`;
  if (u.city && u.state) return `${u.city}, ${u.state}`;
  if (u.city) return u.city;

  if (u.location) return String(u.location);

  if (u.county && u.state && zip)
    return `${sanitizeAreaLabel(String(u.county))}, ${u.state} ${zip}`;
  if (u.county && u.state)
    return `${sanitizeAreaLabel(String(u.county))}, ${u.state}`;
  if (u.county) return sanitizeAreaLabel(String(u.county));

  if (u.stateCode) return String(u.stateCode);
  if (u.state) return String(u.state);
  return "Your area";
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
