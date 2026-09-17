/** TradeScout-controlled JW Stone add-ons. Never a switch for the paid base service. */
export const JW_STONE_FEATURE_KEY = "jw_stone_sales_enhancements";
export const JW_STONE_FEATURES_PATH = "/api/u/jw-stone/features";
export const JW_STONE_FEATURE_ADMIN_PATH = "/api/admin/jw-stone/features";
export const JW_STONE_ADD_ONS = [
  "builders",
  "bidrock",
  "member_pricing",
  "cart",
  "bundles",
  "offers",
  "inventory_tools",
  "sales_automation",
] as const;
export type JwStoneAddOn = (typeof JW_STONE_ADD_ONS)[number];
export const JW_STONE_BASE = Object.freeze({
  website: true,
  catalog: true,
  contact: true,
  directConnect: true,
  accounts: true,
  requestHistory: true,
});
export type JwStoneFeatureState = {
  profileSlug: "jw-stone";
  enabled: boolean;
  revision: number;
  configured: boolean;
};
export type JwStoneFeatureCommand = {
  enabled: boolean;
  expectedRevision: number;
  operationId: string;
  preserveBaseServices: true;
  note: string;
};
export class JwStoneFeatureError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}
export function parseJwStoneFeatureCommand(value: unknown): JwStoneFeatureCommand {
  const row =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const keys = ["enabled", "expectedRevision", "operationId", "preserveBaseServices", "note"];
  if (
    Object.keys(row).some((key) => !keys.includes(key)) ||
    typeof row.enabled !== "boolean" ||
    !Number.isSafeInteger(row.expectedRevision) ||
    Number(row.expectedRevision) < 0 ||
    typeof row.operationId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      row.operationId
    ) ||
    row.preserveBaseServices !== true ||
    typeof row.note !== "string" ||
    row.note.trim().length < 3 ||
    row.note.trim().length > 500
  ) {
    throw new JwStoneFeatureError(
      400,
      "INVALID_FEATURE_CHANGE",
      "Enter a valid change, revision, and private reason; base services must stay available."
    );
  }
  return {
    enabled: row.enabled,
    expectedRevision: Number(row.expectedRevision),
    operationId: row.operationId.toLowerCase(),
    preserveBaseServices: true,
    note: row.note.trim(),
  };
}
export function projectJwStoneFeatures(state: JwStoneFeatureState) {
  return {
    profileSlug: state.profileSlug,
    enabled: state.enabled,
    revision: state.revision,
    configured: state.configured,
    base: JW_STONE_BASE,
    features: Object.fromEntries(JW_STONE_ADD_ONS.map((key) => [key, state.enabled])) as Record<
      JwStoneAddOn,
      boolean
    >,
  };
}
export function unavailableJwStoneFeatures() {
  return projectJwStoneFeatures({
    profileSlug: "jw-stone",
    enabled: false,
    revision: 0,
    configured: false,
  });
}
/** A manifest grants feature availability only; authentication and membership still apply. */
export function parseJwStoneFeatureManifest(
  value: unknown
): ReturnType<typeof projectJwStoneFeatures> {
  const row = value as Record<string, unknown> | null;
  if (
    !row ||
    row.profileSlug !== "jw-stone" ||
    typeof row.enabled !== "boolean" ||
    typeof row.configured !== "boolean" ||
    !Number.isSafeInteger(row.revision) ||
    Number(row.revision) < 0
  ) {
    throw new Error("Invalid JW Stone feature state");
  }
  return projectJwStoneFeatures({
    profileSlug: "jw-stone",
    enabled: row.enabled,
    configured: row.configured,
    revision: Number(row.revision),
  });
}
export type FeatureRequest = {
  path: string;
  method: string;
  body?: unknown;
  bidRockProfileSlug?: string;
};
/** Classify known server surfaces, never a request's Host, Referer, role, or alleged tenant. */
export function classifyJwStoneFeatureRequest(request: FeatureRequest): JwStoneAddOn | null {
  // Express decodes named path parameters; compare that same identity so an encoded
  // profile slug cannot bypass the extra entitlement check on parameterized routes.
  const path = request.path
    .split("?")[0]
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment).trim().toLowerCase();
      } catch {
        return segment.toLowerCase();
      } // Malformed parameters are rejected by the router.
    })
    .join("/")
    .replace(/\/+$/, "");
  const method = request.method.toUpperCase();
  const read = method === "GET" || method === "HEAD";
  const body =
    request.body && typeof request.body === "object" && !Array.isArray(request.body)
      ? (request.body as Record<string, unknown>)
      : {};
  // Price-free owned recovery and release stay available while enhancements are paused.
  if (
    read &&
    /^\/api\/u\/jw-stone\/member-pricing\/holds\/(?:active|operations\/[^/]+)$/.test(path)
  )
    return null;
  if (method === "POST" && /^\/api\/u\/jw-stone\/member-pricing\/holds\/[^/]+\/release$/.test(path))
    return null;
  if (/^\/api\/u\/jw-stone\/member-pricing(?:\/|$)/.test(path)) return "member_pricing";
  if (path === "/api/tradepartner-profiles/jw-stone/express-request") {
    return body.requestType === "make_offer" ||
      Object.prototype.hasOwnProperty.call(body, "stoneOffer")
      ? "offers"
      : null;
  }
  // Original request history remains readable. A handoff can enable future commercial work,
  // so unlike history it must remain unavailable while the suite is paused.
  if (/^\/api\/jw-stone\/offers\/[^/]+\/commercial$/.test(path)) return read ? null : "offers";
  if (/^\/api\/jw-stone\/offers(?:\/|$)/.test(path)) return "offers";
  if (/^\/api\/(?:u\/)?jw-stone\/(?:cart|holds|reservations)(?:\/|$)/.test(path)) {
    // Releasing an existing hold is cleanup, not a new allocation. Normal owner guards remain.
    if (method === "POST" && /\/(?:holds|reservations)\/[^/]+\/release$/.test(path)) return null;
    return "cart";
  }
  if (/^\/api\/u\/jw-stone\/stone-inventory(?:\/|$)/.test(path)) {
    return read ? null : "inventory_tools";
  }
  if (/^\/api\/(?:u\/)?jw-stone\/(?:builders?|designers?|studio|visualizer)(?:\/|$)/.test(path))
    return "builders";
  // The registered email route uses /api/jw-stone, not the profile /api/u prefix.
  // Retain both spellings so a future profile alias cannot bypass the same control.
  if (/^\/api\/(?:u\/)?jw-stone\/saved-stones\/email$/.test(path)) return "sales_automation";
  if (
    request.bidRockProfileSlug === "jw-stone" &&
    /^\/api\/(?:admin\/)?bidrock(?:\/|$)/.test(path)
  ) {
    // Keep already-created order/offer records and cancellation accessible to their existing
    // authorized owners. Never block settlement webhooks or scheduled expiry via this policy.
    if (read && /^\/api\/bidrock\/(?:orders|offers)(?:\/|$)/.test(path)) return null;
    if (method === "POST" && /^\/api\/bidrock\/orders\/[^/]+\/(?:cancel|handoffs)$/.test(path))
      return null;
    if (
      method === "POST" &&
      /^\/api\/admin\/bidrock\/orders\/[^/]+\/(?:payment-settled|complete)$/.test(path)
    )
      return null;
    if (method === "PATCH" && /^\/api\/admin\/bidrock\/orders\/[^/]+\/system-links$/.test(path))
      return null;
    return "bidrock";
  }
  return null;
}
