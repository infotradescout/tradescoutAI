import type { Express } from "express";
import type { IStorage } from "../storage/contracts";

export type EventRoutesStorage = Pick<IStorage, "logEvent">;

export interface EventRoutesDependencies {
  storage: EventRoutesStorage;
}

const MAX_EVENT_TYPE_LENGTH = 96;
const MAX_EVENT_BODY_BYTES = 8 * 1024;
const MAX_SAFE_STRING_LENGTH = 240;
const MAX_ROUTE_LENGTH = 320;
const MAX_IDENTIFIER_LENGTH = 128;

const SAFE_EVENT_KEYS = new Set([
  "route",
  "surface",
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
  "category",
  "mode",
  "scope",
  "reason",
  "outcome",
  "searchMode",
  "stateCode",
  "countyFips",
  "profileSlug",
  "businessId",
  "businessSlug",
  "itemId",
  "itemSlug",
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

const TOKEN_KEYS = new Set([
  "surface",
  "funnelStep",
  "stage",
  "errorCode",
  "source",
  "action",
  "category",
  "mode",
  "scope",
  "reason",
  "outcome",
  "searchMode",
  "profileSlug",
  "businessSlug",
  "itemSlug",
]);

const EVENT_TYPE_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;
const SAFE_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;
const SAFE_TOKEN_PATTERN = /^[a-z0-9][a-z0-9._:/ -]*$/i;

export type SanitizedEventData = Record<string, string | number | boolean | null>;

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
  const route = value.trim().split(/[?#]/, 1)[0];
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

    if (key === "route") {
      const route = sanitizeRoute(rawValue);
      if (route !== undefined) output[key] = route;
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

    if (key === "countyFips") {
      if (typeof rawValue === "string" && /^\d{5}$/.test(rawValue.trim())) {
        output[key] = rawValue.trim();
      }
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

    if (key === "blocked" || key === "success") {
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

export function registerEventRoutes(app: Express, { storage }: EventRoutesDependencies) {
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
