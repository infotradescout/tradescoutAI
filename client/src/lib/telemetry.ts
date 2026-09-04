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

const DIRECT_CONNECT_FRICTION_EVENT_SET = new Set<string>(DIRECT_CONNECT_FRICTION_EVENTS);
const MAX_SAFE_STRING_LENGTH = 120;
const MAX_SAFE_ID_LENGTH = 128;
const MAX_SAFE_COUNT = 1_000_000;
const SAFE_TOKEN_PATTERN = /^[a-z0-9][a-z0-9._:/ +~-]*$/i;
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_ID_SEGMENT = /^[A-Za-z0-9_-]{16,}$/;
const NUMERIC_SEGMENT = /^\d+$/;

const SAFE_STRING_FIELDS = [
  "source",
  "section",
  "reason",
  "field",
  "funnelStep",
  "permission",
  "role",
  "action",
  "mode",
  "emptyState",
  "resumeAction",
  "errorCode",
  "safeErrorCode",
  "authState",
  "requestState",
  "fromSection",
  "toSection",
] as const;
const SAFE_ID_FIELDS = [
  "requestId",
  "assignmentId",
  "sessionId",
  "conversationId",
] as const;
const SAFE_BOOLEAN_FIELDS = [
  "blocked",
  "success",
  "restored",
  "authenticated",
  "isAuthenticated",
  "hasDraft",
] as const;
const SAFE_NUMBER_FIELDS = [
  "status",
  "statusCode",
  "retryCount",
  "clickCount",
  "dispatchCount",
  "attemptCount",
  "validationCount",
  "unreadCount",
  "openRequestCount",
  "replyCount",
  "elapsedMs",
] as const;

const repeatedWindows = new Map<string, { count: number; firstAt: number; emitted: boolean }>();
const onceKeys = new Set<string>();
const cooldowns = new Map<string, number>();

function containsObviousPrivateData(value: string): boolean {
  if (/@|%40/i.test(value)) return true;
  return /(?:\d[+(). -]*){10,}/.test(value);
}

function sanitizeToken(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_SAFE_STRING_LENGTH ||
    !SAFE_TOKEN_PATTERN.test(normalized) ||
    containsObviousPrivateData(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function sanitizeId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_SAFE_ID_LENGTH ||
    !SAFE_ID_PATTERN.test(normalized)
  ) {
    return undefined;
  }
  if (/^\d{10,15}$/.test(normalized)) return undefined;
  if (!UUID_SEGMENT.test(normalized) && containsObviousPrivateData(normalized)) return undefined;
  return normalized;
}

function sanitizeCount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.min(MAX_SAFE_COUNT, Math.trunc(value));
}

function sanitizeStatusCode(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 100 || value > 599) {
    return undefined;
  }
  return value;
}

function resolvePathname(): string {
  if (typeof window === "undefined") return "/direct-connect";
  return window.location.pathname || "/direct-connect";
}

export function isDirectConnectRoute(path = resolvePathname()): boolean {
  return /^\/direct-connect(?:\/|$|\?)/.test(path);
}

/**
 * Converts a real Direct Connect path into a stable, non-identifying route.
 * Query strings and fragments are removed, and ID-shaped path segments are
 * replaced before the route is sent.
 */
export function toDirectConnectRouteTemplate(pathname: string): string {
  const pathOnly = String(pathname || "").trim().split(/[?#]/)[0];
  if (!/^\/direct-connect(?:\/|$)/i.test(pathOnly)) return "/direct-connect";

  const templated = pathOnly
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (UUID_SEGMENT.test(segment) || NUMERIC_SEGMENT.test(segment)) return ":id";
      if (LONG_ID_SEGMENT.test(segment) && !/^direct-connect$/i.test(segment)) return ":id";
      return segment.slice(0, 80);
    });

  return `/${templated.join("/")}`.slice(0, 320) || "/direct-connect";
}

/**
 * Direct Connect friction accepts a strict flat metadata contract. Unknown
 * fields, arrays, objects, request text, messages, contact details, notes,
 * uploads, exception text, stack traces, URLs, and browser fingerprints are
 * discarded before transport.
 */
export function sanitizeFrictionPayload(
  payload: Record<string, unknown>
): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {};

  for (const key of SAFE_STRING_FIELDS) {
    const value = sanitizeToken(payload[key]);
    if (value !== undefined) safe[key] = value;
  }

  for (const key of SAFE_ID_FIELDS) {
    const value = sanitizeId(payload[key]);
    if (value !== undefined) safe[key] = value;
  }

  for (const key of SAFE_BOOLEAN_FIELDS) {
    if (typeof payload[key] === "boolean") safe[key] = payload[key] as boolean;
  }

  for (const key of SAFE_NUMBER_FIELDS) {
    const rawValue = payload[key];
    const value = key === "status" || key === "statusCode"
      ? sanitizeStatusCode(rawValue)
      : sanitizeCount(rawValue);
    if (value !== undefined) safe[key] = value;
  }

  const routeSource =
    typeof payload.routeTemplate === "string"
      ? payload.routeTemplate
      : typeof payload.route === "string"
        ? payload.route
        : resolvePathname();
  safe.routeTemplate = toDirectConnectRouteTemplate(routeSource);

  return safe;
}

export function trackFrictionEvent(
  type: DirectConnectFrictionEvent,
  payload: Record<string, unknown> = {}
): void {
  if (!DIRECT_CONNECT_FRICTION_EVENT_SET.has(type)) return;

  const data = sanitizeFrictionPayload({ ...payload, surface: "direct_connect" });
  try {
    void fetch("/api/events", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: type, data }),
      keepalive: true,
    }).catch(() => {
      // Passive evidence must never affect the user's work.
    });
  } catch {
    // Same fail-soft guarantee when fetch itself is unavailable.
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
    const countMetadata =
      type === "direct_connect_repeated_cta_click"
        ? { clickCount: next.count }
        : type === "direct_connect_repeated_submit_attempt"
          ? { attemptCount: next.count }
          : { retryCount: next.count };
    trackFrictionEvent(type, {
      ...payload,
      reason: key,
      ...countMetadata,
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

let runtimeCaptureTarget: Window | null = null;
let runtimeErrorListener: ((event: ErrorEvent) => void) | null = null;
let runtimeRejectionListener: ((event: PromiseRejectionEvent) => void) | null = null;

function recordControlledRuntimeFailure(source: "error" | "unhandledrejection") {
  if (!isDirectConnectRoute()) return;
  const routeTemplate = toDirectConnectRouteTemplate(resolvePathname());
  trackOncePerSession(
    `direct-connect-runtime:${source}:${routeTemplate}`,
    "direct_connect_client_runtime_error",
    {
      source,
      reason: "client_runtime_error",
      errorCode: "client_runtime_error",
      blocked: true,
      routeTemplate,
    }
  );
}

/**
 * Raw messages, promise reasons, filenames, line numbers, and stack traces are
 * deliberately never read or sent.
 */
export function installDirectConnectRuntimeErrorCapture(
  target: Window | undefined = typeof window !== "undefined" ? window : undefined
): void {
  if (!target || runtimeCaptureTarget === target) return;
  removeDirectConnectRuntimeErrorCapture();

  runtimeErrorListener = () => recordControlledRuntimeFailure("error");
  runtimeRejectionListener = () => recordControlledRuntimeFailure("unhandledrejection");
  target.addEventListener("error", runtimeErrorListener);
  target.addEventListener("unhandledrejection", runtimeRejectionListener);
  runtimeCaptureTarget = target;
}

export function removeDirectConnectRuntimeErrorCapture(): void {
  if (runtimeCaptureTarget && runtimeErrorListener) {
    runtimeCaptureTarget.removeEventListener("error", runtimeErrorListener);
  }
  if (runtimeCaptureTarget && runtimeRejectionListener) {
    runtimeCaptureTarget.removeEventListener("unhandledrejection", runtimeRejectionListener);
  }
  runtimeCaptureTarget = null;
  runtimeErrorListener = null;
  runtimeRejectionListener = null;
}

export function resetFrictionTelemetryForTests(): void {
  repeatedWindows.clear();
  onceKeys.clear();
  cooldowns.clear();
  removeDirectConnectRuntimeErrorCapture();
}

// --- Direct Connect conversion-integrity lane ---------------------------
// Severe browser-observed issue packets retain the existing strict shell
// endpoint. Funnel stalls are deliberately absent: they are derived on the
// server from the persisted stage sequence.

export const DIRECT_CONNECT_INTEGRITY_EVENTS = [
  "direct_connect_integrity_blocked_action",
  "direct_connect_integrity_repeated_click",
  "direct_connect_integrity_repeated_submit",
  "direct_connect_integrity_request_failed",
] as const;

export type DirectConnectIntegrityEvent = (typeof DIRECT_CONNECT_INTEGRITY_EVENTS)[number];

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

function getClientBuild(): string {
  try {
    return typeof __APP_BUILD_ID__ === "string" ? __APP_BUILD_ID__ : String(__APP_BUILD_ID__);
  } catch {
    return "unknown";
  }
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
  };

  try {
    void fetch("/api/analytics/shell", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {
      // A broken evidence endpoint must never affect the user flow.
    });
  } catch {
    // Same fail-soft guarantee synchronously.
  }
}

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

installDirectConnectRuntimeErrorCapture();
