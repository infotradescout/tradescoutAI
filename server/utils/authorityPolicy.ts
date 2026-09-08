import type { Request } from "express";
import { LEGACY_SUPPORT_EMAIL, PRIMARY_SUPPORT_EMAIL } from "@shared/supportInbox";
import { getAuthorityConfig, parseTruthyToggle } from "./authorityConfig";

export type PrivilegedBypassReason =
  | "none"
  | "role"
  | "admin_flag"
  | "direct_connect_demo_mode"
  | "manual_direct_connect_override";

export interface PrivilegedBypassResolution {
  active: boolean;
  reason: PrivilegedBypassReason;
  matchedRoles: string[];
  matchedEmail: string | null;
}

const EXPLICIT_PERSISTED_PRIVILEGED_ROLES = new Set([
  "admin",
  "moderator",
  "ops_admin",
  "super_admin",
  "support_agent",
  "content_moderator",
  "territory_manager",
  "contractor_success",
  "content_seo",
  "analytics_specialist",
  "marketing_specialist",
  "community_moderator",
  "community_leader",
  "hoa_board",
  "hoa_manager",
]);

export function isTruthyToggle(value: unknown): boolean {
  return parseTruthyToggle(value);
}

export function normalizeAuthorityRole(role: unknown): string {
  const raw = typeof role === "string" ? role.trim().toLowerCase() : "";
  if (!raw) return "";
  if (raw === "owner" || raw === "head_admin") return "super_admin";
  return raw;
}

export function collectAuthorityRoles(user: any): string[] {
  if (!user) return [];
  const primaryRole = normalizeAuthorityRole(user?.role);
  const activeRole = normalizeAuthorityRole(user?.activeRole);
  const roleList = Array.isArray(user?.roles) ? user.roles : [];
  const normalizedRoleList = roleList
    .map((role: unknown) => normalizeAuthorityRole(role))
    .filter((role: string) => role.length > 0);

  return Array.from(new Set([primaryRole, activeRole, ...normalizedRoleList].filter(Boolean)));
}

export function getVerificationBypassRoles(): Set<string> {
  const config = getAuthorityConfig();
  return new Set(config.verificationBypassRoles);
}

export function isAdminTierRole(role: unknown): boolean {
  const config = getAuthorityConfig();
  return new Set(config.adminTierRoles).has(normalizeAuthorityRole(role));
}

export function getReservedAuthorityEmails(): Set<string> {
  const config = getAuthorityConfig();
  return new Set(config.privilegedAliasEmails);
}

export function isReservedAuthorityEmail(email: unknown): boolean {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized) return false;
  return getReservedAuthorityEmails().has(normalized);
}

export function isReservedSignupIdentityEmail(email: unknown): boolean {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized) return false;
  return (
    normalized === PRIMARY_SUPPORT_EMAIL ||
    normalized === LEGACY_SUPPORT_EMAIL ||
    isReservedAuthorityEmail(normalized)
  );
}

export function isPrivilegedOrAdminRoleToken(role: unknown): boolean {
  const raw = typeof role === "string" ? role.trim().toLowerCase() : "";
  if (!raw) return false;
  const normalized = normalizeAuthorityRole(raw);
  return (
    raw.includes("admin") ||
    raw === "superadmin" ||
    EXPLICIT_PERSISTED_PRIVILEGED_ROLES.has(normalized) ||
    getVerificationBypassRoles().has(normalized)
  );
}

export function resolvePrivilegedVerificationBypass(user: any): PrivilegedBypassResolution {
  if (!user) {
    return {
      active: false,
      reason: "none",
      matchedRoles: [],
      matchedEmail: null,
    };
  }

  const roles = collectAuthorityRoles(user);
  const privilegedRoleSet = getVerificationBypassRoles();
  const matchedRoles = roles.filter((role) => privilegedRoleSet.has(role));
  if (matchedRoles.length > 0) {
    return {
      active: true,
      reason: "role",
      matchedRoles,
      matchedEmail: null,
    };
  }

  const explicitLegacyAdminRoles = roles.filter((role) => role === "admin");
  if (explicitLegacyAdminRoles.length > 0) {
    return {
      active: true,
      reason: "admin_flag",
      matchedRoles: explicitLegacyAdminRoles,
      matchedEmail: null,
    };
  }

  if (user?.isAdmin === true || user?.isSuperAdmin === true) {
    return {
      active: true,
      reason: "admin_flag",
      matchedRoles: roles,
      matchedEmail: null,
    };
  }

  return {
    active: false,
    reason: "none",
    matchedRoles: roles,
    matchedEmail: null,
  };
}

export function isDirectConnectUnverifiedBypassEnabled(): boolean {
  return getAuthorityConfig().directConnectUnverifiedBypassEnabled;
}

export function isDirectConnectBypassProductionLockEnabled(): boolean {
  const nodeEnv = typeof process.env.NODE_ENV === "string" ? process.env.NODE_ENV : "";
  return (
    nodeEnv.trim().toLowerCase() === "production" ||
    isTruthyToggle(process.env.REQUIRE_PROD_BYPASS_OFF)
  );
}

export function hasManualDirectConnectBypassRequest(req: Request): boolean {
  const body =
    req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const query =
    req.query && typeof req.query === "object" ? (req.query as Record<string, unknown>) : {};

  return (
    isTruthyToggle(body.allowUnverifiedDirectConnect) ||
    isTruthyToggle(body.demoBypassVerification) ||
    isTruthyToggle(query.allowUnverifiedDirectConnect) ||
    isTruthyToggle(query.demoBypassVerification) ||
    isTruthyToggle(req.headers["x-direct-connect-demo-bypass"])
  );
}
