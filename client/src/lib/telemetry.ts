import { getDeviceType } from "@/lib/analytics";

export const DIRECT_CONNECT_FRICTION_EVENTS = [
  "direct_connect_client_runtime_error",
  "direct_connect_api_request_failed",
  "direct_connect_auth_handoff_stalled",
  "direct_connect_draft_restore_failed",
  "direct_connect_form_validation_blocked",
  "direct_connect_repeated_submit_attempt",
  "direct_connect_repeated_cta_click",
  "direct_connect_empty_state_seen",
  "direct_connect_permission_or_role_blocked",
] as const;

export type DirectConnectFrictionEvent = (typeof DIRECT_CONNECT_FRICTION_EVENTS)[number];

const SENSITIVE_KEY_PATTERN =
  /(card|token|payment|secret|password|message|note|description|body|requesttext|email|phone|address|privatenotes|uploadedcontent)/i;

const MAX_SAFE_STRING_LENGTH = 240;
const repeatedWindows = new Map<string, { count: number; firstAt: number; emitted: boolean }>();
const onceKeys = new Set<string>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function truncateSafeString(value: string): string {
  return value.length > MAX_SAFE_STRING_LENGTH
    ? `${value.slice(0, MAX_SAFE_STRING_LENGTH)}...`
    : value;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return truncateSafeString(value);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 12).map(sanitizeValue);
  if (!isPlainObject(value)) return String(value).slice(0, MAX_SAFE_STRING_LENGTH);
  return sanitizeFrictionPayload(value);
}

export function sanitizeFrictionPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    safe[key] = sanitizeValue(value);
  }
  return safe;
}

function resolveRoute(): string {
  if (typeof window === "undefined") return "server";
  return `${window.location.pathname}${window.location.search || ""}`;
}

export function isDirectConnectRoute(path = resolveRoute()): boolean {
  return /^\/direct-connect(?:\/|$|\?)/.test(path);
}

export function trackFrictionEvent(
  type: DirectConnectFrictionEvent,
  payload: Record<string, unknown> = {}
): void {
  const event = sanitizeFrictionPayload({
    ...payload,
    type,
    surface: "direct_connect",
    viewport: getDeviceType(),
    source: typeof payload.source === "string" ? payload.source : resolveRoute(),
    ts: new Date().toISOString(),
  });

  try {
    void fetch("/api/analytics/shell", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).catch(() => {
      // Passive friction telemetry must never affect user flow.
    });
  } catch {
    // Passive friction telemetry must never affect user flow.
  }
}

export function trackRepeatedFrictionSignal({
  key,
  type,
  threshold,
  windowMs,
  payload,
}: {
  key: string;
  type: DirectConnectFrictionEvent;
  threshold: number;
  windowMs: number;
  payload?: Record<string, unknown>;
}): void {
  const now = Date.now();
  const current = repeatedWindows.get(key);
  const next =
    current && now - current.firstAt <= windowMs
      ? { ...current, count: current.count + 1 }
      : { count: 1, firstAt: now, emitted: false };

  if (next.count > threshold && !next.emitted) {
    next.emitted = true;
    trackFrictionEvent(type, {
      ...payload,
      reason: key,
      dispatchCount: next.count,
    });
  }
  repeatedWindows.set(key, next);
}

export function trackOncePerSession(
  key: string,
  type: DirectConnectFrictionEvent,
  payload?: Record<string, unknown>
): void {
  if (onceKeys.has(key)) return;
  onceKeys.add(key);
  trackFrictionEvent(type, payload);
}

export function resetFrictionTelemetryForTests(): void {
  repeatedWindows.clear();
  onceKeys.clear();
  cooldowns.clear();
}

// --- Direct Connect conversion-integrity lane ---------------------------
// A narrower, stricter sibling of the friction pipeline above: funnel
// stalls, blocked actions, and repeated-action friction that feed the
// conversion-integrity dashboard. Server-derived signals (like funnel
// stalls) are computed entirely server-side from the persisted event
// stream -- this module only ever reports what happened in the browser,
// never a timer-based guess at what didn't.

export const DIRECT_CONNECT_INTEGRITY_EVENTS = [
  "direct_connect_integrity_blocked_action",
  "direct_connect_integrity_repeated_click",
  "direct_connect_integrity_repeated_submit",
  "direct_connect_integrity_request_failed",
] as const;

export type DirectConnectIntegrityEvent = (typeof DIRECT_CONNECT_INTEGRITY_EVENTS)[number];

// One safe code per class of failure. Never a raw exception message, stack
// trace, query string, or response body.
export const SAFE_ERROR_CODES = [
  "network_error",
  "timeout",
  "server_error",
  "validation_failed",
  "auth_required",
  "rate_limited",
  "unknown_error",
] as const;

export type SafeErrorCode = (typeof SAFE_ERROR_CODES)[number];

const INTEGRITY_SCHEMA_VERSION = 1;
const INTEGRITY_LANE = "direct_connect_conversion_integrity";
const cooldowns = new Map<string, number>();

function resolvePathname(): string {
  if (typeof window === "undefined") return "/direct-connect";
  return window.location.pathname || "/direct-connect";
}

function getClientBuild(): string {
  try {
    return typeof __APP_BUILD_ID__ === "string" ? __APP_BUILD_ID__ : String(__APP_BUILD_ID__);
  } catch {
    return "unknown";
  }
}

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_ID_SEGMENT = /^[A-Za-z0-9_-]{16,}$/;
const NUMERIC_SEGMENT = /^\d+$/;

/**
 * Collapses a real Direct Connect URL into a parameterized route template
 * (e.g. "/direct-connect/inbox?requestId=abc123" -> "/direct-connect/inbox")
 * so telemetry never carries a specific request/user identifier in the path.
 * Known section names pass through as-is; anything ID-shaped is replaced.
 */
export function toDirectConnectRouteTemplate(pathname: string): string {
  const pathOnly = String(pathname || "").split(/[?#]/)[0];
  const segments = pathOnly.split("/").filter(Boolean);
  const templated = segments.map((segment) => {
    if (UUID_SEGMENT.test(segment) || NUMERIC_SEGMENT.test(segment)) return ":id";
    if (LONG_ID_SEGMENT.test(segment) && !/^direct-connect$/i.test(segment)) return ":id";
    return segment;
  });
  return `/${templated.join("/")}` || "/direct-connect";
}

type ConversionIntegrityPayload = {
  funnelStep?: string;
  safeErrorCode?: SafeErrorCode;
  statusCode?: number;
  blocked?: boolean;
  retryCount?: number;
  clickCount?: number;
  routeTemplate?: string;
};

/**
 * Fire-and-forget dispatch for the conversion-integrity lane. The payload is
 * built exclusively from named fields (never a caller-supplied spread), so
 * the allowlist is enforced structurally, not just by server-side filtering.
 * Never throws, never retries, and never emits a second telemetry event if
 * this one fails -- a broken telemetry endpoint must not create a loop.
 */
export function trackConversionIntegrityEvent(
  eventName: DirectConnectIntegrityEvent,
  payload: ConversionIntegrityPayload = {}
): void {
  const event = {
    lane: INTEGRITY_LANE,
    eventName,
    severity: "high" as const,
    schema_version: INTEGRITY_SCHEMA_VERSION,
    client_build: getClientBuild(),
    routeTemplate: payload.routeTemplate ?? toDirectConnectRouteTemplate(resolvePathname()),
    funnelStep: payload.funnelStep,
    safeErrorCode: payload.safeErrorCode,
    statusCode: typeof payload.statusCode === "number" ? payload.statusCode : undefined,
    blocked: typeof payload.blocked === "boolean" ? payload.blocked : undefined,
    retryCount: typeof payload.retryCount === "number" ? payload.retryCount : undefined,
    clickCount: typeof payload.clickCount === "number" ? payload.clickCount : undefined,
    ts: new Date().toISOString(),
  };

  try {
    void fetch("/api/analytics/shell", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).catch(() => {
      // A failed telemetry beacon is not itself a telemetry event.
    });
  } catch {
    // Same guarantee synchronously (e.g. fetch unavailable).
  }
}

/**
 * Repeated-click/submit friction with a real cooldown, not just a rolling
 * window: minCount within windowMs to fire, then a mandatory cooldownMs
 * before the same (surface + route) key can fire again at all.
 */
export function trackConversionIntegrityRepeatedSignal({
  surface,
  eventName,
  minCount,
  windowMs,
  cooldownMs,
  payload,
}: {
  surface: string;
  eventName: DirectConnectIntegrityEvent;
  minCount: number;
  windowMs: number;
  cooldownMs: number;
  payload?: ConversionIntegrityPayload;
}): void {
  const routeTemplate = payload?.routeTemplate ?? toDirectConnectRouteTemplate(resolvePathname());
  const key = `${surface}::${routeTemplate}`;
  const now = Date.now();

  const cooldownUntil = cooldowns.get(key);
  if (cooldownUntil && now < cooldownUntil) return;

  const current = repeatedWindows.get(key);
  const next =
    current && now - current.firstAt <= windowMs
      ? { ...current, count: current.count + 1 }
      : { count: 1, firstAt: now, emitted: false };

  if (next.count >= minCount && !next.emitted) {
    next.emitted = true;
    cooldowns.set(key, now + cooldownMs);
    trackConversionIntegrityEvent(eventName, {
      ...payload,
      routeTemplate,
      clickCount: next.count,
    });
  }
  repeatedWindows.set(key, next);
}
