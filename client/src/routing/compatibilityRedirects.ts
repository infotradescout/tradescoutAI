export type CompatibilityRedirectAccess = "public" | "protected" | "admin";

export type CompatibilityRedirectSlot =
  | "before-dashboard"
  | "before-contractor-slug"
  | "before-admin-wildcard"
  | "standard";

export type CompatibilityRedirect = {
  from: string;
  to: string;
  access: CompatibilityRedirectAccess;
  slot: CompatibilityRedirectSlot;
};

export const COMPATIBILITY_REDIRECTS = [
  { from: "/dashboard/messages", to: "/messages", access: "protected", slot: "before-dashboard" },

  {
    from: "/contractors/dashboard",
    to: "/business-dashboard",
    access: "protected",
    slot: "before-contractor-slug",
  },
  {
    from: "/contractors/apply",
    to: "/claim-my-business?source=contractors_apply_legacy",
    access: "public",
    slot: "before-contractor-slug",
  },

  {
    from: "/admin/dashboard",
    to: "/admin",
    access: "admin",
    slot: "before-admin-wildcard",
  },
  {
    from: "/admin/contractors",
    to: "/admin/business-provider-settings",
    access: "admin",
    slot: "before-admin-wildcard",
  },
  {
    from: "/admin/contractor-settings",
    to: "/admin/business-provider-settings",
    access: "admin",
    slot: "before-admin-wildcard",
  },
  {
    from: "/admin/partner-operations",
    to: "/admin/tradepartners",
    access: "admin",
    slot: "before-admin-wildcard",
  },

  { from: "/conversations", to: "/messages", access: "protected", slot: "standard" },
  { from: "/marketplace", to: "/exchange", access: "public", slot: "standard" },
  { from: "/exchange/list", to: "/exchange", access: "public", slot: "standard" },
  {
    from: "/business-owner-dashboard",
    to: "/business-dashboard",
    access: "public",
    slot: "standard",
  },
  {
    from: "/contractor-dashboard",
    to: "/business-dashboard",
    access: "public",
    slot: "standard",
  },
  {
    from: "/contractor/dashboard",
    to: "/business-dashboard",
    access: "public",
    slot: "standard",
  },
  {
    from: "/contractor-leads",
    to: "/direct-connect/inbox",
    access: "public",
    slot: "standard",
  },
  {
    from: "/contractor/leads",
    to: "/direct-connect/inbox",
    access: "public",
    slot: "standard",
  },
  {
    from: "/contractor-apply",
    to: "/claim-my-business?source=contractor_apply_legacy",
    access: "public",
    slot: "standard",
  },
  {
    from: "/admin-observability",
    to: "/admin/live-stream",
    access: "admin",
    slot: "standard",
  },
  {
    from: "/staff/hardrock-directory",
    to: "/admin/commercial-directory",
    access: "admin",
    slot: "standard",
  },
  { from: "/staff/share-links", to: "/admin/share-links", access: "admin", slot: "standard" },
  {
    from: "/staff/inspection-intelligence",
    to: "/admin/inspection-intelligence",
    access: "admin",
    slot: "standard",
  },
  {
    from: "/contractor-verification",
    to: "/admin/professional-verification",
    access: "admin",
    slot: "standard",
  },
  { from: "/content-moderation", to: "/admin/moderation", access: "admin", slot: "standard" },
  { from: "/system-settings", to: "/admin/site-settings", access: "admin", slot: "standard" },
  { from: "/support-tickets", to: "/admin/errors", access: "admin", slot: "standard" },
  {
    from: "/platform-analytics",
    to: "/admin/platform-analytics",
    access: "admin",
    slot: "standard",
  },
  { from: "/manage-users", to: "/admin/users", access: "admin", slot: "standard" },
  {
    from: "/payment-processing",
    to: "/admin/payment-model",
    access: "admin",
    slot: "standard",
  },
  { from: "/file-management", to: "/admin/attachments", access: "admin", slot: "standard" },
  { from: "/admin-dashboard", to: "/admin", access: "admin", slot: "standard" },
  { from: "/admin-users", to: "/admin/users", access: "admin", slot: "standard" },
  { from: "/admin-panel", to: "/admin/panel", access: "admin", slot: "standard" },

  { from: "/settings/profile", to: "/profile-settings", access: "public", slot: "standard" },
  {
    from: "/settings/location",
    to: "/settings?tab=profile",
    access: "public",
    slot: "standard",
  },
  { from: "/contractor-profile", to: "/contractors", access: "public", slot: "standard" },
  { from: "/payments/history", to: "/payment-history", access: "public", slot: "standard" },
  { from: "/saved", to: "/saved-ads", access: "protected", slot: "standard" },
  {
    from: "/community-builder",
    to: "/community-builder/dashboard",
    access: "public",
    slot: "standard",
  },
  { from: "/county/transparency", to: "/county-hub", access: "public", slot: "standard" },
  {
    from: "/contractors/signup",
    to: "/claim-my-business?source=contractors_signup_legacy",
    access: "public",
    slot: "before-contractor-slug",
  },
  {
    from: "/contractors/accelerator",
    to: "/claim-my-business?source=contractors_accelerator_legacy",
    access: "public",
    slot: "before-contractor-slug",
  },
  {
    from: "/contractor-join",
    to: "/claim-my-business?source=contractor_join_legacy",
    access: "public",
    slot: "standard",
  },
  { from: "/payroll-helper", to: "/finances/payroll", access: "public", slot: "standard" },
  { from: "/cookie-preferences", to: "/privacy", access: "public", slot: "standard" },
  {
    from: "/tools/estimate-calculator",
    to: "/quote-calculator",
    access: "public",
    slot: "standard",
  },
  {
    from: "/tools/invoice-calculator",
    to: "/finances/invoices",
    access: "public",
    slot: "standard",
  },
  {
    from: "/tools/expense-helper",
    to: "/finances/expenses",
    access: "public",
    slot: "standard",
  },
  { from: "/legal/privacy-policy", to: "/privacy", access: "public", slot: "standard" },
  { from: "/legal/giveaway-rules", to: "/giveaway-rules", access: "public", slot: "standard" },
  { from: "/legal/cookie-policy", to: "/privacy", access: "public", slot: "standard" },
  { from: "/legal/compliance", to: "/compliance", access: "public", slot: "standard" },
  { from: "/legal/accessibility", to: "/compliance", access: "public", slot: "standard" },
  { from: "/legal/seller-agreement", to: "/terms", access: "public", slot: "standard" },
  { from: "/legal/community-guidelines", to: "/terms", access: "public", slot: "standard" },
  { from: "/legal/dispute-resolution", to: "/terms", access: "public", slot: "standard" },
] as const satisfies readonly CompatibilityRedirect[];

export const COMPATIBILITY_REDIRECT_ALIASES = Object.fromEntries(
  COMPATIBILITY_REDIRECTS.map(({ from, to }) => [from, to])
) as Readonly<Record<string, string>>;

export function getCompatibilityRedirectsForSlot(slot: CompatibilityRedirectSlot) {
  return COMPATIBILITY_REDIRECTS.filter((redirect) => redirect.slot === slot);
}

function splitLocation(value: string) {
  const hashIndex = value.indexOf("#");
  const beforeHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const hash = hashIndex >= 0 ? value.slice(hashIndex + 1) : "";
  const queryIndex = beforeHash.indexOf("?");
  return {
    path: queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash,
    query: queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "",
    hash,
  };
}

export function mergeCompatibilityRedirectTarget(target: string, sourceLocation: string): string {
  const targetParts = splitLocation(target);
  const sourceParts = splitLocation(sourceLocation);
  const targetParams = new URLSearchParams(targetParts.query);
  const sourceParams = new URLSearchParams(sourceParts.query);

  sourceParams.forEach((value, key) => {
    if (!targetParams.has(key)) targetParams.set(key, value);
  });

  const query = targetParams.toString();
  const hash = targetParts.hash || sourceParts.hash;
  return `${targetParts.path}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}
