import type { Express, NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { IStorage } from "../storage/contracts";
import {
  handleCorsOriginDeniedError,
  rejectUnsupportedCmsProbe,
} from "../http/publicRequestGuards";
import { resolveAnonymousSessionId } from "../utils/anonymousSession";

export type EventRoutesStorage = Pick<IStorage, "logEvent">;

export interface EventRoutesDependencies {
  storage: EventRoutesStorage;
}

const MAX_EVENT_BODY_BYTES = 8 * 1024;
const MAX_SAFE_STRING_LENGTH = 120;
const MAX_SAFE_ID_LENGTH = 128;
const MAX_ROUTE_LENGTH = 320;
const MAX_SAFE_COUNT = 1_000_000;
const SERVER_DERIVED_FUNNEL_STALL_EVENT = "direct_connect_funnel_step_stalled";
const DIRECT_CONNECT_ISSUE_SCHEMA_VERSION = 1;

export const PUBLIC_DEMAND_EVENT_TYPES = new Set([
  "demand.landing_view",
  "demand.cta_click",
  "demand.auth_view",
  "demand.signin_success",
  "demand.create_success",
  "demand.setup_complete",
  "demand.intent_submitted",
]);

export const DIRECT_CONNECT_FRICTION_EVENT_TYPES = new Set([
  "direct_connect_client_runtime_error",
  "direct_connect_api_request_failed",
  "direct_connect_auth_handoff_stalled",
  "direct_connect_draft_restore_failed",
  "direct_connect_form_validation_blocked",
  "direct_connect_repeated_submit_attempt",
  "direct_connect_repeated_cta_click",
  "direct_connect_empty_state_seen",
  "direct_connect_permission_or_role_blocked",
  SERVER_DERIVED_FUNNEL_STALL_EVENT,
]);

export const DIRECT_CONNECT_KPI_EVENT_TYPES = new Set([
  "direct_connect_landed",
  "direct_connect_entry_resolved",
  "direct_connect_tab_selected",
  "direct_connect_request_started",
  "direct_connect_request_review_opened",
  "direct_connect_homeid_link_selected",
  "direct_connect_home_record_prompt_viewed",
  "direct_connect_home_record_link_selected",
  "direct_connect_home_record_create_selected",
  "direct_connect_home_record_skipped",
  "direct_connect_request_submitted_after_home_record_skip",
  "direct_connect_request_submitted",
  "direct_connect_visible_to_contractors",
  "direct_connect_request_visible_to_contractors",
  "direct_connect_contractor_action_started",
  "direct_connect_requester_reply_viewed",
  "direct_connect_homeid_created_from_request",
  "direct_connect_homeid_updated_from_request",
]);

const CLIENT_DIRECT_CONNECT_FRICTION_EVENT_TYPES = new Set(
  Array.from(DIRECT_CONNECT_FRICTION_EVENT_TYPES).filter(
    (eventType) => eventType !== SERVER_DERIVED_FUNNEL_STALL_EVENT
  )
);

const SAFE_DEMAND_STRING_KEYS = [
  "surface",
  "placement",
  "variant",
  "mode",
  "presenceType",
  "intent",
  "source",
  "cta",
] as const;
const SAFE_DEMAND_BOOLEAN_KEYS = ["verificationRequired", "hasPrompt"] as const;

const SAFE_DIRECT_CONNECT_STRING_KEYS = [
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
  "userState",
  "viewport",
  "deviceType",
  "category",
  "dispatchMode",
  "decision",
  "responderType",
  "homeContextIntent",
  "entry",
  "componentType",
] as const;
const SAFE_DIRECT_CONNECT_ID_KEYS = [
  "homeId",
  "requestId",
  "packetId",
  "assignmentId",
  "sessionId",
  "conversationId",
] as const;
const SAFE_DIRECT_CONNECT_BOOLEAN_KEYS = [
  "blocked",
  "success",
  "restored",
  "authenticated",
  "isAuthenticated",
  "hasDraft",
  "hasBudget",
  "hasCountyFips",
] as const;
const SAFE_DIRECT_CONNECT_NUMBER_KEYS = [
  "retryCount",
  "clickCount",
  "dispatchCount",
  "attemptCount",
  "validationCount",
  "unreadCount",
  "openRequestCount",
  "replyCount",
  "elapsedMs",
  "attachmentCount",
  "directTargets",
  "visibleContractorCount",
] as const;

const SAFE_TOKEN_PATTERN = /^[a-z0-9][a-z0-9._:/ +~-]*$/i;
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_ID_SEGMENT = /^[A-Za-z0-9_-]{16,}$/;
const NUMERIC_SEGMENT = /^\d+$/;

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
  | number
  | boolean
  | null
  | SanitizedDemandAttribution;

export type SanitizedEventData = Record<string, SanitizedEventValue>;

export function normalizeEventType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (PUBLIC_DEMAND_EVENT_TYPES.has(normalized)) return normalized;
  if (CLIENT_DIRECT_CONNECT_FRICTION_EVENT_TYPES.has(normalized)) return normalized;
  return null;
}

function normalizeDirectConnectShellType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (DIRECT_CONNECT_FRICTION_EVENT_TYPES.has(normalized)) return normalized;
  if (DIRECT_CONNECT_KPI_EVENT_TYPES.has(normalized)) return normalized;
  return null;
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
  return /(?:\d[+(). -]*){10,}/.test(value);
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

function sanitizeDirectConnectRouteTemplate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const [route = ""] = value.trim().split(/[?#]/, 1);
  if (
    !route.startsWith("/") ||
    route.length > MAX_ROUTE_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(route) ||
    !/^\/direct-connect(?:\/|$)/i.test(route)
  ) {
    return undefined;
  }

  const segments: string[] = [];
  for (const segment of route.split("/").filter(Boolean)) {
    if (UUID_SEGMENT.test(segment) || NUMERIC_SEGMENT.test(segment)) {
      segments.push(":id");
      continue;
    }
    if (LONG_ID_SEGMENT.test(segment) && !/^direct-connect$/i.test(segment)) {
      segments.push(":id");
      continue;
    }
    if (
      segment.length > 80 ||
      !SAFE_TOKEN_PATTERN.test(segment) ||
      containsObviousPrivateData(segment)
    ) {
      return undefined;
    }
    segments.push(segment);
  }

  return `/${segments.join("/")}`.slice(0, MAX_ROUTE_LENGTH) || "/direct-connect";
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

function sanitizeIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 40) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function resolveReleaseSha(): string {
  return (
    process.env.RENDER_GIT_COMMIT ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_REF ||
    "unknown"
  );
}

function issueMetadata(eventType: string): SanitizedEventData {
  const common: SanitizedEventData = {
    issuePacket: true,
    schemaVersion: DIRECT_CONNECT_ISSUE_SCHEMA_VERSION,
    releaseSha: resolveReleaseSha(),
  };

  switch (eventType) {
    case "direct_connect_client_runtime_error":
      return { ...common, severity: "high", inspectNext: "client_runtime_and_route_boundary" };
    case "direct_connect_api_request_failed":
      return { ...common, severity: "high", inspectNext: "failed_api_route_and_server_logs" };
    case "direct_connect_auth_handoff_stalled":
      return { ...common, severity: "high", inspectNext: "auth_return_and_draft_continuity" };
    case "direct_connect_draft_restore_failed":
      return { ...common, severity: "high", inspectNext: "draft_scope_parse_and_restore" };
    case "direct_connect_permission_or_role_blocked":
      return { ...common, severity: "high", inspectNext: "effective_role_and_request_authority" };
    case "direct_connect_form_validation_blocked":
      return { ...common, severity: "medium", inspectNext: "validation_field_and_review_transition" };
    case "direct_connect_repeated_submit_attempt":
      return { ...common, severity: "medium", inspectNext: "submit_state_and_response_confirmation" };
    case "direct_connect_repeated_cta_click":
      return { ...common, severity: "medium", inspectNext: "cta_handler_navigation_and_loading_state" };
    case "direct_connect_empty_state_seen":
      return { ...common, severity: "medium", inspectNext: "empty_state_data_source_and_next_action" };
    default:
      return {};
  }
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

  for (const key of SAFE_DEMAND_STRING_KEYS) {
    const token = sanitizeToken(input[key]);
    if (token !== undefined && token !== null) output[key] = token;
  }

  for (const key of SAFE_DEMAND_BOOLEAN_KEYS) {
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

export function sanitizeDirectConnectEventData(value: unknown): SanitizedEventData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { surface: "direct_connect", routeTemplate: "/direct-connect" };
  }

  const input = value as Record<string, unknown>;
  const output: SanitizedEventData = { surface: "direct_connect" };

  for (const key of SAFE_DIRECT_CONNECT_STRING_KEYS) {
    const rawValue = input[key];
    if (key === "source" && typeof rawValue === "string" && rawValue.trim().startsWith("/")) {
      continue;
    }
    const token = sanitizeToken(rawValue);
    if (token !== undefined && token !== null) output[key] = token;
  }

  for (const key of SAFE_DIRECT_CONNECT_ID_KEYS) {
    const id = sanitizeId(input[key]);
    if (id !== undefined) output[key] = id;
  }

  for (const key of SAFE_DIRECT_CONNECT_BOOLEAN_KEYS) {
    if (typeof input[key] === "boolean") output[key] = input[key] as boolean;
  }

  for (const key of SAFE_DIRECT_CONNECT_NUMBER_KEYS) {
    const count = sanitizeCount(input[key]);
    if (count !== undefined) output[key] = count;
  }

  const statusCode = sanitizeStatusCode(input.statusCode ?? input.status);
  if (statusCode !== undefined) output.statusCode = statusCode;

  const timestamp = sanitizeIsoTimestamp(input.ts);
  if (timestamp) output.ts = timestamp;

  const routeCandidate =
    input.routeTemplate ??
    input.route ??
    (typeof input.source === "string" && input.source.trim().startsWith("/")
      ? input.source
      : undefined);
  output.routeTemplate =
    sanitizeDirectConnectRouteTemplate(routeCandidate) ?? "/direct-connect";

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

function scheduleEventWrite(args: {
  storage: EventRoutesStorage;
  eventType: string;
  data: SanitizedEventData;
  req: Request & { user?: { id?: string; contractorId?: string } };
  res: Response;
  includeAnonymousSession?: boolean;
}) {
  const sessionUser = args.req.user ?? null;
  const deviceClass = inferDeviceClass(args.req.get("User-Agent"));
  const persistedData: SanitizedEventData = {
    ...args.data,
    userId: typeof sessionUser?.id === "string" ? sessionUser.id : null,
    contractorId:
      typeof sessionUser?.contractorId === "string" ? sessionUser.contractorId : null,
  };

  if (args.includeAnonymousSession && !persistedData.userId) {
    const anonymousSessionId = sanitizeId(resolveAnonymousSessionId(args.req));
    if (anonymousSessionId) persistedData.anonymousSessionId = anonymousSessionId;
  }
  if (deviceClass) persistedData.deviceClass = deviceClass;

  args.res.status(204).end();

  void Promise.resolve()
    .then(() => args.storage.logEvent(args.eventType, persistedData))
    .catch((error: unknown) => {
      console.error("Error persisting first-party telemetry", error);
    });
}

function startServerDerivedFunnelDetector(): void {
  if (process.env.NODE_ENV !== "production") return;
  void import("../services/directConnectFunnelIntegrity")
    .then(({ startDirectConnectFunnelStallDetector }) => {
      startDirectConnectFunnelStallDetector();
    })
    .catch((error) => {
      console.error("[direct-connect-friction] detector startup failed", error);
    });
}

export function registerEventRoutes(app: Express, { storage }: EventRoutesDependencies) {
  app.use(handleCorsOriginDeniedError);
  app.use(rejectUnsupportedCmsProbe);

  // Every recognized Direct Connect shell event is intercepted before broad
  // analytics can attach raw IP or full browser strings. Unknown Direct
  // Connect names fail closed until they receive an explicit schema.
  app.post("/api/analytics/shell", (req: Request, res: Response, next: NextFunction) => {
    const shellEvent =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const rawType = typeof shellEvent.type === "string" ? shellEvent.type.trim() : "";
    const eventType = normalizeDirectConnectShellType(rawType);
    if (!eventType) {
      return rawType.startsWith("direct_connect_") ? res.status(204).end() : next();
    }
    if (eventType === SERVER_DERIVED_FUNNEL_STALL_EVENT) return res.status(204).end();

    return publicEventLimiter(req, res, () => {
      if (serializedByteLength(shellEvent) > MAX_EVENT_BODY_BYTES) {
        return res.status(204).end();
      }
      const isFriction = CLIENT_DIRECT_CONNECT_FRICTION_EVENT_TYPES.has(eventType);
      scheduleEventWrite({
        storage,
        eventType,
        data: {
          ...sanitizeDirectConnectEventData(shellEvent),
          ...(isFriction ? issueMetadata(eventType) : {}),
        },
        req: req as Request & { user?: { id?: string; contractorId?: string } },
        res,
        includeAnonymousSession: true,
      });
    });
  });

  app.post("/api/events", publicEventLimiter, (req: Request, res: Response) => {
    const payload =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const eventType = normalizeEventType(payload.eventType);
    const bodyWithinLimit = serializedByteLength(payload) <= MAX_EVENT_BODY_BYTES;

    if (!eventType || !bodyWithinLimit) {
      return res.status(204).end();
    }

    const isFriction = CLIENT_DIRECT_CONNECT_FRICTION_EVENT_TYPES.has(eventType);
    const data = isFriction
      ? {
          ...sanitizeDirectConnectEventData(payload.data),
          ...issueMetadata(eventType),
        }
      : sanitizeEventData(payload.data);

    scheduleEventWrite({
      storage,
      eventType,
      data,
      req: req as Request & { user?: { id?: string; contractorId?: string } },
      res,
      includeAnonymousSession: isFriction,
    });
  });

  startServerDerivedFunnelDetector();
}
