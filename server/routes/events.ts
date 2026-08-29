import type { Express, NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { IStorage } from "../storage/contracts";

export type EventRoutesStorage = Pick<IStorage, "logEvent">;

export interface EventRoutesDependencies {
  storage: EventRoutesStorage;
}

const MAX_EVENT_BODY_BYTES = 8 * 1024;
const MAX_SAFE_STRING_LENGTH = 120;
const MAX_ROUTE_LENGTH = 320;

export const PUBLIC_DEMAND_EVENT_TYPES = new Set([
  "demand.landing_view",
  "demand.cta_click",
  "demand.auth_view",
  "demand.signin_success",
  "demand.create_success",
  "demand.setup_complete",
  "demand.intent_submitted",
]);

const SAFE_STRING_KEYS = [
  "surface",
  "placement",
  "variant",
  "mode",
  "presenceType",
  "intent",
  "source",
  "cta",
] as const;
const SAFE_BOOLEAN_KEYS = ["verificationRequired", "hasPrompt"] as const;
const SAFE_TOKEN_PATTERN = /^[a-z0-9][a-z0-9._:/ +~-]*$/i;

export type SanitizedDemandAttribution = {
  ref?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  variant?: string | null;
  campaignKey?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
};

export type SanitizedEventValue =
  | string
  | boolean
  | null
  | SanitizedDemandAttribution;

export type SanitizedEventData = Record<string, SanitizedEventValue>;

export function normalizeEventType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return PUBLIC_DEMAND_EVENT_TYPES.has(normalized) ? normalized : null;
}

function serializedByteLength(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function containsObviousPrivateData(value: string): boolean {
  if (/@|%40/i.test(value)) return true;
  const digits = value.match(/\d/g)?.length ?? 0;
  if (digits >= 10 && /[+(). -]/.test(value)) return true;
  return false;
}

function sanitizeRoute(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const [route = ""] = value.trim().split(/[?#]/, 1);
  if (
    !route.startsWith("/") ||
    route.length > MAX_ROUTE_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(route) ||
    containsObviousPrivateData(route)
  ) {
    return undefined;
  }
  return route;
}

function sanitizeToken(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (
    normalized.length > MAX_SAFE_STRING_LENGTH ||
    !SAFE_TOKEN_PATTERN.test(normalized) ||
    containsObviousPrivateData(normalized)
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
    "variant",
    "campaignKey",
  ] as const) {
    const sanitized = sanitizeToken(input[key]);
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

export function sanitizeEventData(value: unknown): SanitizedEventData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const output: SanitizedEventData = {};

  const route = sanitizeRoute(input.route ?? input.path);
  if (route) output.route = route;

  for (const key of ["href", "target"] as const) {
    const safeRoute = sanitizeRoute(input[key]);
    if (safeRoute) output[key] = safeRoute;
  }

  for (const key of SAFE_STRING_KEYS) {
    const token = sanitizeToken(input[key]);
    if (token !== undefined && token !== null) output[key] = token;
  }

  for (const key of SAFE_BOOLEAN_KEYS) {
    if (typeof input[key] === "boolean") output[key] = input[key] as boolean;
  }

  const stateCode = typeof input.stateCode === "string" ? input.stateCode.trim() : "";
  if (/^[a-z]{2}$/i.test(stateCode)) output.stateCode = stateCode.toUpperCase();

  const countyFipsValue = input.countyFips ?? input.county_fips;
  if (typeof countyFipsValue === "string" && /^\d{5}$/.test(countyFipsValue.trim())) {
    output.countyFips = countyFipsValue.trim();
  }

  const segmentCategory = sanitizeToken(input.segmentCategory ?? input.segment_category);
  if (segmentCategory !== undefined && segmentCategory !== null) {
    output.segmentCategory = segmentCategory;
  }

  const segmentIntentLevel = sanitizeToken(
    input.segmentIntentLevel ?? input.segment_intent_level
  );
  if (segmentIntentLevel !== undefined && segmentIntentLevel !== null) {
    output.segmentIntentLevel = segmentIntentLevel;
  }

  const attribution = sanitizeDemandAttribution(input.attribution);
  if (attribution) output.attribution = attribution;

  return output;
}

function inferDeviceClass(userAgent: unknown): "mobile" | "desktop" | undefined {
  if (typeof userAgent !== "string" || userAgent.length === 0) return undefined;
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent) ? "mobile" : "desktop";
}

function readPublicEventLimit(): number {
  const parsed = Number(process.env.PUBLIC_EVENT_LIMIT_1M || 120);
  if (!Number.isFinite(parsed) || parsed < 1) return 120;
  return Math.min(10_000, Math.trunc(parsed));
}

const noopRateLimiter = (_req: Request, _res: Response, next: NextFunction) => next();
const publicEventLimiter =
  process.env.NODE_ENV === "production"
    ? rateLimit({
        windowMs: 60 * 1000,
        max: readPublicEventLimit(),
        standardHeaders: false,
        legacyHeaders: false,
        handler: (_req: Request, res: Response) => res.status(204).end(),
      })
    : noopRateLimiter;

export function registerEventRoutes(app: Express, { storage }: EventRoutesDependencies) {
  app.post("/api/events", publicEventLimiter, (req: any, res: Response) => {
    const payload =
      req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
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

    if (!eventType || !bodyWithinLimit) return;

    void Promise.resolve()
      .then(() => storage.logEvent(eventType, persistedData))
      .catch((error: unknown) => {
        console.error("Error persisting /api/events telemetry", error);
      });
  });
}
