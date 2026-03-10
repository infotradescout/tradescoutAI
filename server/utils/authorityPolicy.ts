import type { Request } from "express";

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

const DEFAULT_VERIFICATION_BYPASS_ROLES = [
  "support_agent",
  "content_moderator",
  "territory_manager",
  "contractor_success",
  "content_seo",
  "analytics_specialist",
  "marketing_specialist",
  "moderator",
  "ops_admin",
  "super_admin",
];

const ADMIN_TIER_ROLES = new Set(["moderator", "ops_admin", "super_admin"]);

const DEFAULT_PRIVILEGED_ALIAS_EMAILS = ["info.tradescout@gmail.com", "contact@thetradescout.com"];

function parseCsvSet(raw: unknown): Set<string> {
  const value = typeof raw === "string" ? raw : "";
  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isTruthyToggle(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on", "enabled"].includes(value.trim().toLowerCase());
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
  const configured = parseCsvSet(process.env.PRIVILEGED_VERIFICATION_BYPASS_ROLES);
  if (configured.size > 0) return configured;
  return new Set(DEFAULT_VERIFICATION_BYPASS_ROLES);
}

export function isAdminTierRole(role: unknown): boolean {
  return ADMIN_TIER_ROLES.has(normalizeAuthorityRole(role));
}

export function getPrivilegedAliasEmails(): Set<string> {
  const aliases = new Set<string>();
  const configuredMasterAdmin = String(process.env.MASTER_ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();
  if (configuredMasterAdmin) aliases.add(configuredMasterAdmin);

  for (const alias of parseCsvSet(process.env.SUPER_ADMIN_EMAIL_ALIASES)) {
    aliases.add(alias);
  }
  for (const alias of parseCsvSet(process.env.PRIVILEGED_ALIAS_EMAILS)) {
    aliases.add(alias);
  }
  for (const alias of DEFAULT_PRIVILEGED_ALIAS_EMAILS) {
    aliases.add(alias);
  }
  return aliases;
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
  return (
    isTruthyToggle(process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED) ||
    isTruthyToggle(process.env.DIRECT_CONNECT_DEMO_MODE) ||
    isTruthyToggle(process.env.TRADE_SCOUT_DEMO_MODE)
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
