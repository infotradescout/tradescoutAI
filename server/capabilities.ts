import type { Request } from "express";
import { collectAuthorityRoles, isAdminTierRole } from "./utils/authorityPolicy";

export type CapabilityStatus = "ok" | "unavailable" | "degraded";

export interface CapabilitySnapshot {
  accounting: CapabilityStatus;
  admin: CapabilityStatus;
}

export function resolveCapabilities(req?: Request): CapabilitySnapshot {
  const isProd = process.env.NODE_ENV === "production";

  const hasDb = Boolean(process.env.DATABASE_URL);

  const user = (req as any)?.user;
  const isAdmin = Boolean(
    user &&
    (user.isAdmin === true ||
      user.isSuperAdmin === true ||
      collectAuthorityRoles(user).some((role) => isAdminTierRole(role)))
  );

  return {
    accounting: hasDb ? "ok" : isProd ? "degraded" : "unavailable",
    admin: isAdmin ? "ok" : "unavailable",
  };
}
