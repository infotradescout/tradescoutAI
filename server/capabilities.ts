import type { Request } from "express";

export type CapabilityStatus = "ok" | "unavailable" | "degraded";

export interface CapabilitySnapshot {
  accounting: CapabilityStatus;
  mealscout: CapabilityStatus;
  admin: CapabilityStatus;
}

export function resolveCapabilities(req?: Request): CapabilitySnapshot {
  const isProd = process.env.NODE_ENV === "production";

  const hasDb = Boolean(process.env.DATABASE_URL);

  const hasMealscoutSecret = Boolean(
    process.env.TRADESCOUT_JWT_SECRET || process.env.MEALSCOUT_SHARED_SECRET,
  );

  const hasMealscoutBase = Boolean(
    process.env.MEALSCOUT_SSO_URL || process.env.MEALSCOUT_BASE_URL,
  );

  const isAdmin = Boolean((req as any)?.user && (req as any).user.role && (req as any).user.role.toString().includes("admin"));

  return {
    accounting: hasDb ? "ok" : isProd ? "degraded" : "unavailable",
    mealscout: hasMealscoutSecret && hasMealscoutBase ? "ok" : "unavailable",
    admin: isAdmin ? "ok" : "unavailable",
  };
}
