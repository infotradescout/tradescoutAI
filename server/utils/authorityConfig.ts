export interface AuthorityConfig {
  loadedAt: Date;
  fingerprint: string;
  adminTierRoles: string[];
  verificationBypassRoles: string[];
  // Legacy response key retained for compatibility. These configured addresses
  // are reserved recovery candidates only and must never confer authority.
  privilegedAliasEmails: string[];
  directConnectUnverifiedBypassEnabled: boolean;
  env: {
    masterAdminEmail: string | null;
    superAdminAliasesRaw: string | null;
    privilegedAliasesRaw: string | null;
    privilegedBypassRolesRaw: string | null;
    directConnectAllowUnverifiedRaw: string | null;
    directConnectDemoModeRaw: string | null;
    tradeScoutDemoModeRaw: string | null;
  };
}

const DEFAULT_ADMIN_TIER_ROLES = ["moderator", "ops_admin", "super_admin"];
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
const AUTHORITY_ENV_KEYS = [
  "MASTER_ADMIN_EMAIL",
  "SUPER_ADMIN_EMAIL_ALIASES",
  "PRIVILEGED_ALIAS_EMAILS",
  "PRIVILEGED_VERIFICATION_BYPASS_ROLES",
  "DIRECT_CONNECT_ALLOW_UNVERIFIED",
  "DIRECT_CONNECT_DEMO_MODE",
  "TRADE_SCOUT_DEMO_MODE",
] as const;

let cachedConfig: AuthorityConfig | null = null;
let cachedFingerprint = "";

function normalizeValue(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function parseCsvList(raw: unknown): string[] {
  return uniqueSorted(
    normalizeValue(raw)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

export function parseTruthyToggle(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return ["1", "true", "yes", "on", "enabled"].includes(normalizeValue(value));
}

function computeEnvFingerprint(): string {
  return AUTHORITY_ENV_KEYS.map((key) => `${key}=${normalizeValue(process.env[key])}`).join("|");
}

function buildAuthorityConfigFromEnv(): AuthorityConfig {
  const fingerprint = computeEnvFingerprint();

  const masterAdminEmail = normalizeValue(process.env.MASTER_ADMIN_EMAIL);
  const configuredSuperAdminAliases = parseCsvList(process.env.SUPER_ADMIN_EMAIL_ALIASES);
  const configuredPrivilegedAliases = parseCsvList(process.env.PRIVILEGED_ALIAS_EMAILS);
  const configuredBypassRoles = parseCsvList(process.env.PRIVILEGED_VERIFICATION_BYPASS_ROLES);

  const privilegedAliasEmails = uniqueSorted([
    ...(masterAdminEmail ? [masterAdminEmail] : []),
    ...configuredSuperAdminAliases,
    ...configuredPrivilegedAliases,
  ]);

  const verificationBypassRoles =
    configuredBypassRoles.length > 0
      ? uniqueSorted(configuredBypassRoles)
      : uniqueSorted(DEFAULT_VERIFICATION_BYPASS_ROLES);

  const directConnectUnverifiedBypassEnabled =
    parseTruthyToggle(process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED) ||
    parseTruthyToggle(process.env.DIRECT_CONNECT_DEMO_MODE) ||
    parseTruthyToggle(process.env.TRADE_SCOUT_DEMO_MODE);

  return {
    loadedAt: new Date(),
    fingerprint,
    adminTierRoles: uniqueSorted(DEFAULT_ADMIN_TIER_ROLES),
    verificationBypassRoles,
    privilegedAliasEmails,
    directConnectUnverifiedBypassEnabled,
    env: {
      masterAdminEmail: masterAdminEmail || null,
      superAdminAliasesRaw: process.env.SUPER_ADMIN_EMAIL_ALIASES || null,
      privilegedAliasesRaw: process.env.PRIVILEGED_ALIAS_EMAILS || null,
      privilegedBypassRolesRaw: process.env.PRIVILEGED_VERIFICATION_BYPASS_ROLES || null,
      directConnectAllowUnverifiedRaw: process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED || null,
      directConnectDemoModeRaw: process.env.DIRECT_CONNECT_DEMO_MODE || null,
      tradeScoutDemoModeRaw: process.env.TRADE_SCOUT_DEMO_MODE || null,
    },
  };
}

function cloneConfig(config: AuthorityConfig): AuthorityConfig {
  return {
    ...config,
    loadedAt: new Date(config.loadedAt.getTime()),
    adminTierRoles: [...config.adminTierRoles],
    verificationBypassRoles: [...config.verificationBypassRoles],
    privilegedAliasEmails: [...config.privilegedAliasEmails],
    env: { ...config.env },
  };
}

function ensureFreshConfig(): AuthorityConfig {
  const fingerprint = computeEnvFingerprint();
  if (!cachedConfig || cachedFingerprint !== fingerprint) {
    cachedConfig = buildAuthorityConfigFromEnv();
    cachedFingerprint = cachedConfig.fingerprint;
  }
  return cachedConfig;
}

export function getAuthorityConfig(): AuthorityConfig {
  return cloneConfig(ensureFreshConfig());
}

export function reloadAuthorityConfig(): AuthorityConfig {
  cachedConfig = buildAuthorityConfigFromEnv();
  cachedFingerprint = cachedConfig.fingerprint;
  return cloneConfig(cachedConfig);
}

export function getAuthorityConfigAuditSnapshot() {
  const config = ensureFreshConfig();
  return {
    loadedAt: config.loadedAt.toISOString(),
    fingerprint: config.fingerprint,
    adminTierRoles: [...config.adminTierRoles],
    verificationBypassRoles: [...config.verificationBypassRoles],
    privilegedAliasEmails: [...config.privilegedAliasEmails],
    directConnectUnverifiedBypassEnabled: config.directConnectUnverifiedBypassEnabled,
    env: { ...config.env },
  };
}
