import type { Request } from "express";
import { getAuthorityConfig, parseTruthyToggle } from "./authorityConfig";

export type PrivilegedBypassReason =
  | "none"
  | "role"
  | "email_alias"
  | "admin_flag"
  | "direct_connect_demo_mode"
  | "manual_direct_connect_override";

export interface PrivilegedBypassResolution {
  active: boolean;
  reason: PrivilegedBypassReason;
  matchedRoles: string[];
  matchedEmail: string | null;
}

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

export function getPrivilegedAliasEmails(): Set<string> {
  const config = getAuthorityConfig();
  return new Set(config.privilegedAliasEmails);
}

export function isPrivilegedAliasEmail(email: unknown): boolean {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized) return false;
  return getPrivilegedAliasEmails().has(normalized);
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

  const emailCandidates = [user?.email, user?.claims?.email];
  for (const email of emailCandidates) {
    if (isPrivilegedAliasEmail(email)) {
      return {
        active: true,
        reason: "email_alias",
        matchedRoles: roles,
        matchedEmail: String(email).trim().toLowerCase(),
      };
    }
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
