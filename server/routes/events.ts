import type { Express } from "express";
import type { IStorage } from "../storage/contracts";

export type EventRoutesStorage = Pick<IStorage, "logEvent">;

export interface EventRoutesDependencies {
  storage: EventRoutesStorage;
}

const MAX_EVENT_TYPE_LENGTH = 96;
const MAX_EVENT_BODY_BYTES = 8 * 1024;
const MAX_SAFE_STRING_LENGTH = 240;
const MAX_ATTRIBUTION_STRING_LENGTH = 120;
const MAX_ROUTE_LENGTH = 320;
const MAX_IDENTIFIER_LENGTH = 128;
const CORS_DENIAL_PREFIX = "CORS: Origin not allowed:";

const SAFE_EVENT_KEYS = new Set([
  "route",
  "path",
  "href",
  "target",
  "surface",
  "placement",
  "variant",
  "funnelStep",
  "stage",
  "requestId",
  "workRequestId",
  "sessionId",
  "anonymousSessionId",
  "statusCode",
  "errorCode",
  "blocked",
  "success",
  "verificationRequired",
  "hasPrompt",
  "retryCount",
  "attemptCount",
  "clickCount",
  "selectedItemCount",
  "position",
  "resultCount",
  "resultPosition",
  "filterCount",
  "durationMs",
  "source",
  "action",
  "cta",
  "category",
  "mode",
  "presenceType",
  "intent",
  "scope",
  "reason",
  "outcome",
  "searchMode",
  "segmentCategory",
  "segment_category",
  "segmentIntentLevel",
  "segment_intent_level",
  "stateCode",
  "countyFips",
  "county_fips",
  "profileSlug",
  "businessId",
  "businessSlug",
  "itemId",
  "itemSlug",
  "attribution",
]);

const IDENTIFIER_KEYS = new Set([
  "requestId",
  "workRequestId",
  "sessionId",
  "anonymousSessionId",
  "businessId",
  "itemId",
]);

const COUNT_KEYS = new Set([
  "retryCount",
  "attemptCount",
  "clickCount",
  "selectedItemCount",
  "position",
  "resultCount",
  "resultPosition",
  "filterCount",
  "durationMs",
]);

const BOOLEAN_KEYS = new Set([
  "blocked",
  "success",
  "verificationRequired",
  "hasPrompt",
]);

const TOKEN_KEYS = new Set([
  "surface",
  "placement",
  "variant",
  "funnelStep",
  "stage",
  "errorCode",
  "source",
  "action",
  "cta",
  "category",
  "mode",
  "presenceType",
  "intent",
  "scope",
  "reason",
  "outcome",
  "searchMode",
  "segmentCategory",
  "segmentIntentLevel",
  "profileSlug",
  "businessSlug",
  "itemSlug",
]);

const EVENT_TYPE_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;
const SAFE_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;
const SAFE_TOKEN_PATTERN = /^[a-z0-9][a-z0-9._:/ +~-]*$/i;

export type SanitizedDemandAttribution = {
  ref?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  variant?: string | null;
  campaignKey?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
};

export type SanitizedEventValue =
  | string
  | number
  | boolean
  | null
  | SanitizedDemandAttribution;

export type SanitizedEventData = Record<string, SanitizedEventValue>;

export function normalizeEventType(value: unknown): string {
  if (typeof value !== "string") return "event.unknown";
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_EVENT_TYPE_LENGTH ||
    !EVENT_TYPE_PATTERN.test(normalized)
  ) {
    return "event.unknown";
  }
  return normalized;
}

function serializedByteLength(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function sanitizeRoute(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const [route = ""] = value.trim().split(/[?#]/, 1);
  if (!route.startsWith("/") || route.length > MAX_ROUTE_LENGTH || /[\u0000-\u001f\u007f]/.test(route)) {
    return undefined;
  }
  return route;
}

function sanitizeIdentifier(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_IDENTIFIER_LENGTH ||
    !SAFE_IDENTIFIER_PATTERN.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function sanitizeToken(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_SAFE_STRING_LENGTH ||
    !SAFE_TOKEN_PATTERN.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function sanitizeAttributionString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (
    normalized.length > MAX_ATTRIBUTION_STRING_LENGTH ||
    !SAFE_TOKEN_PATTERN.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function sanitizeIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 40) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function sanitizeDemandAttribution(value: unknown): SanitizedDemandAttribution | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const output: SanitizedDemandAttribution = {};

  for (const key of [
    "ref",
    "utmSource",
    "utmMedium",
    "utmCampaign",
    "utmContent",
    "utmTerm",
    "variant",
    "campaignKey",
  ] as const) {
    const sanitized = sanitizeAttributionString(input[key]);
    if (sanitized === undefined) continue;
    if (key === "campaignKey") {
      if (sanitized !== null) output.campaignKey = sanitized;
    } else {
      output[key] = sanitized;
    }
  }

  for (const key of ["firstSeenAt", "lastSeenAt"] as const) {
    const timestamp = sanitizeIsoTimestamp(input[key]);
    if (timestamp) output[key] = timestamp;
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

function sanitizeCount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.min(Math.trunc(value), 1_000_000_000);
}

function sanitizeStatusCode(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 100 || value > 599) {
    return undefined;
  }
  return value;
}

export function sanitizeEventData(value: unknown): SanitizedEventData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const input = value as Record<string, unknown>;
  const output: SanitizedEventData = {};

  for (const key of SAFE_EVENT_KEYS) {
    const rawValue = input[key];
    if (rawValue === undefined) continue;

    if (key === "route" || key === "path" || key === "href" || key === "target") {
      const route = sanitizeRoute(rawValue);
      if (route !== undefined) {
        output[key === "path" ? "route" : key] = route;
      }
      continue;
    }

    if (key === "statusCode") {
      const statusCode = sanitizeStatusCode(rawValue);
      if (statusCode !== undefined) output[key] = statusCode;
      continue;
    }

    if (key === "stateCode") {
      if (typeof rawValue === "string" && /^[a-z]{2}$/i.test(rawValue.trim())) {
        output[key] = rawValue.trim().toUpperCase();
      }
      continue;
    }

    if (key === "countyFips" || key === "county_fips") {
      if (typeof rawValue === "string" && /^\d{5}$/.test(rawValue.trim())) {
        output.countyFips = rawValue.trim();
      }
      continue;
    }

    if (key === "segment_category" || key === "segment_intent_level") {
      const canonicalKey = key === "segment_category" ? "segmentCategory" : "segmentIntentLevel";
      if (output[canonicalKey] !== undefined) continue;
      const token = sanitizeToken(rawValue);
      if (token !== undefined) output[canonicalKey] = token;
      continue;
    }

    if (key === "attribution") {
      const attribution = sanitizeDemandAttribution(rawValue);
      if (attribution) output.attribution = attribution;
      continue;
    }

    if (IDENTIFIER_KEYS.has(key)) {
      const identifier = sanitizeIdentifier(rawValue);
      if (identifier !== undefined) output[key] = identifier;
      continue;
    }

    if (COUNT_KEYS.has(key)) {
      const count = sanitizeCount(rawValue);
      if (count !== undefined) output[key] = count;
      continue;
    }

    if (BOOLEAN_KEYS.has(key)) {
      if (typeof rawValue === "boolean") output[key] = rawValue;
      continue;
    }

    if (TOKEN_KEYS.has(key)) {
      const token = sanitizeToken(rawValue);
      if (token !== undefined) output[key] = token;
    }
  }

  return output;
}

function inferDeviceClass(userAgent: unknown): "mobile" | "desktop" | undefined {
  if (typeof userAgent !== "string" || userAgent.length === 0) return undefined;
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent) ? "mobile" : "desktop";
}

export function isCorsOriginDeniedError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith(CORS_DENIAL_PREFIX);
}

export function isUnsupportedCmsProbeRequest(req: {
  path?: string;
  query?: Record<string, unknown>;
}): boolean {
  const requestPath = String(req.path || "").trim().toLowerCase();
  if (
    requestPath === "/wp-json" ||
    requestPath.startsWith("/wp-json/") ||
    requestPath === "/wordpress/wp-json" ||
    requestPath.startsWith("/wordpress/wp-json/") ||
    requestPath === "/blog/wp-json" ||
    requestPath.startsWith("/blog/wp-json/")
  ) {
    return true;
  }

  if (requestPath !== "/" && requestPath !== "/index.php") return false;
  const restRouteValue = req.query?.rest_route;
  const restRoute = Array.isArray(restRouteValue) ? restRouteValue[0] : restRouteValue;
  return typeof restRoute === "string" && restRoute.trim().startsWith("/");
}

export function registerEventRoutes(app: Express, { storage }: EventRoutesDependencies) {
  // The CORS package reports a denied browser origin through next(error). A
  // rejected origin is a client authorization failure, not a server fault.
  // Keep the response generic so an attacker cannot use it to reflect headers.
  app.use((error: unknown, _req: any, res: any, next: (error?: unknown) => void) => {
    if (!isCorsOriginDeniedError(error)) return next(error);
    return res.status(403).json({ error: "Origin not allowed", code: "CORS_ORIGIN_DENIED" });
  });

  // TradeScout does not run WordPress. Reject common CMS discovery and batch
  // probes before the SPA/error fallback so hostile scans remain clean 404s.
  app.use((req: any, res: any, next: () => void) => {
    if (!isUnsupportedCmsProbeRequest(req)) return next();
    res.setHeader("Cache-Control", "no-store");
    return res.status(404).end();
  });

  app.post("/api/events", (req: any, res: any) => {
    const payload = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const eventType = normalizeEventType(payload.eventType);
    const bodyWithinLimit = serializedByteLength(payload) <= MAX_EVENT_BODY_BYTES;
    const data = bodyWithinLimit ? sanitizeEventData(payload.data) : {};
    const sessionUser = req.user ?? null;
    const deviceClass = inferDeviceClass(req.get("User-Agent"));

    const persistedData: SanitizedEventData = {
      ...data,
      userId: typeof sessionUser?.id === "string" ? sessionUser.id : null,
      contractorId: typeof sessionUser?.contractorId === "string" ? sessionUser.contractorId : null,
    };

    if (deviceClass) persistedData.deviceClass = deviceClass;

    res.status(204).end();

    if (!bodyWithinLimit) return;

    void Promise.resolve()
      .then(() => storage.logEvent(eventType, persistedData))
      .catch((error: unknown) => {
        console.error("Error persisting /api/events telemetry", error);
      });
  });
}
