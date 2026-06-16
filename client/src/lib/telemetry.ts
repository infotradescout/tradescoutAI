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
  "direct_connect_funnel_step_stalled",
] as const;

export type DirectConnectFrictionEvent = (typeof DIRECT_CONNECT_FRICTION_EVENTS)[number];

const SENSITIVE_KEY_PATTERN =
  /(card|token|payment|secret|password|message|note|description|body|requesttext|email|phone|address|privatenotes|uploadedcontent)/i;

const MAX_SAFE_STRING_LENGTH = 240;
const repeatedWindows = new Map<string, { count: number; firstAt: number; emitted: boolean }>();
const onceKeys = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

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

export function scheduleDirectConnectStallSignal({
  key,
  type,
  delayMs,
  shouldEmit,
  payload,
}: {
  key: string;
  type: DirectConnectFrictionEvent;
  delayMs: number;
  shouldEmit: () => boolean;
  payload?: Record<string, unknown>;
}): void {
  if (onceKeys.has(key) || timers.has(key)) return;
  const timer = setTimeout(() => {
    timers.delete(key);
    if (!shouldEmit() || onceKeys.has(key)) return;
    onceKeys.add(key);
    trackFrictionEvent(type, payload);
  }, delayMs);
  timers.set(key, timer);
}

export function resetFrictionTelemetryForTests(): void {
  repeatedWindows.clear();
  onceKeys.clear();
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}
