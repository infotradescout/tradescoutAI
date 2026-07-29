import rateLimit from "express-rate-limit";
import type { Request, RequestHandler } from "express";
import { readPositiveIntegerEnv } from "../utils/rateLimitConfig";

export type ScoutRequestLimits = {
  windowMs: number;
  anonymousMax: number;
  authenticatedMax: number;
  maxMessageChars: number;
  maxHistoryMessages: number;
  maxHistoryMessageChars: number;
  maxHistoryTotalChars: number;
};

export type ScoutRequestRejection = {
  ok: false;
  status: 400 | 413;
  code:
    | "scout_message_required"
    | "scout_message_too_large"
    | "scout_history_invalid"
    | "scout_history_too_large";
  message: string;
  limit?: number;
  measured?: number;
};

export type ScoutRequestBoundsResult = { ok: true } | ScoutRequestRejection;

export function readScoutRequestLimits(): ScoutRequestLimits {
  return {
    windowMs: readPositiveIntegerEnv("SCOUT_RATE_LIMIT_WINDOW_MS", 5 * 60_000),
    anonymousMax: readPositiveIntegerEnv("SCOUT_ANONYMOUS_RATE_LIMIT_MAX", 12),
    authenticatedMax: readPositiveIntegerEnv("SCOUT_USER_RATE_LIMIT_MAX", 60),
    maxMessageChars: readPositiveIntegerEnv("SCOUT_MAX_MESSAGE_CHARS", 4_000),
    maxHistoryMessages: readPositiveIntegerEnv("SCOUT_MAX_HISTORY_MESSAGES", 24),
    maxHistoryMessageChars: readPositiveIntegerEnv(
      "SCOUT_MAX_HISTORY_MESSAGE_CHARS",
      2_000
    ),
    maxHistoryTotalChars: readPositiveIntegerEnv("SCOUT_MAX_HISTORY_TOTAL_CHARS", 12_000),
  };
}

function getAuthenticatedUserId(req: Request): string | null {
  const requestUser = (req as any)?.user;
  const candidate = requestUser?.id ?? requestUser?.claims?.sub;
  if (candidate === null || candidate === undefined) return null;
  const normalized = String(candidate).trim();
  return normalized || null;
}

function buildRateLimitPayload(scope: "anonymous_ip" | "authenticated_user") {
  return {
    error: {
      code: "scout_rate_limited",
      message: "Scout request limit reached. Wait for the limit window to reset, then try again.",
      retryable: true,
      scope,
    },
    message: "Scout did not run this request because the request limit was reached.",
    suggestedActions: [],
    actions: [],
    actionResults: [],
    publicEntities: [],
    evidence: [],
    metadata: {
      intent: "rate_limited",
      sourceUsed: "scout_request_limiter",
      fallbackUsed: false,
      degraded: true,
    },
  };
}

export function createScoutRequestLimiters(
  limits: ScoutRequestLimits = readScoutRequestLimits()
): RequestHandler[] {
  const anonymousLimiter = rateLimit({
    windowMs: limits.windowMs,
    limit: limits.anonymousMax,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => Boolean(getAuthenticatedUserId(req)),
    handler: (_req, res) => {
      res.status(429).json(buildRateLimitPayload("anonymous_ip"));
    },
  });

  const authenticatedLimiter = rateLimit({
    windowMs: limits.windowMs,
    limit: limits.authenticatedMax,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => !getAuthenticatedUserId(req),
    keyGenerator: (req) => `user:${getAuthenticatedUserId(req)}`,
    handler: (_req, res) => {
      res.status(429).json(buildRateLimitPayload("authenticated_user"));
    },
  });

  return [anonymousLimiter, authenticatedLimiter];
}

export function validateScoutRequestBounds(
  body: unknown,
  limits: ScoutRequestLimits = readScoutRequestLimits()
): ScoutRequestBoundsResult {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const message = typeof record.message === "string" ? record.message : "";

  if (!message.trim()) {
    return {
      ok: false,
      status: 400,
      code: "scout_message_required",
      message: "A non-empty Scout message is required.",
    };
  }

  if (message.length > limits.maxMessageChars) {
    return {
      ok: false,
      status: 413,
      code: "scout_message_too_large",
      message: "The Scout message exceeds the supported request size.",
      limit: limits.maxMessageChars,
      measured: message.length,
    };
  }

  const rawHistory = record.history;
  if (rawHistory !== undefined && !Array.isArray(rawHistory)) {
    return {
      ok: false,
      status: 400,
      code: "scout_history_invalid",
      message: "Scout conversation history must be an array of messages.",
    };
  }

  const history = Array.isArray(rawHistory) ? rawHistory : [];
  if (history.length > limits.maxHistoryMessages) {
    return {
      ok: false,
      status: 413,
      code: "scout_history_too_large",
      message: "Scout conversation history contains too many messages.",
      limit: limits.maxHistoryMessages,
      measured: history.length,
    };
  }

  let historyTotalChars = 0;
  for (const item of history) {
    if (!item || typeof item !== "object" || typeof (item as any).content !== "string") {
      return {
        ok: false,
        status: 400,
        code: "scout_history_invalid",
        message: "Each Scout history item must contain text content.",
      };
    }

    const contentLength = String((item as any).content).length;
    if (contentLength > limits.maxHistoryMessageChars) {
      return {
        ok: false,
        status: 413,
        code: "scout_history_too_large",
        message: "A Scout history message exceeds the supported size.",
        limit: limits.maxHistoryMessageChars,
        measured: contentLength,
      };
    }
    historyTotalChars += contentLength;
  }

  if (historyTotalChars > limits.maxHistoryTotalChars) {
    return {
      ok: false,
      status: 413,
      code: "scout_history_too_large",
      message: "Scout conversation history exceeds the supported total size.",
      limit: limits.maxHistoryTotalChars,
      measured: historyTotalChars,
    };
  }

  return { ok: true };
}

export function buildScoutRequestRejectionResponse(rejection: ScoutRequestRejection) {
  return {
    error: {
      code: rejection.code,
      message: rejection.message,
      retryable: false,
      ...(typeof rejection.limit === "number" ? { limit: rejection.limit } : {}),
      ...(typeof rejection.measured === "number" ? { measured: rejection.measured } : {}),
    },
    message: "Scout did not run this request because the request was outside supported bounds.",
    suggestedActions: [],
    actions: [],
    actionResults: [],
    publicEntities: [],
    evidence: [],
    metadata: {
      intent: "request_rejected",
      sourceUsed: "scout_request_bounds",
      fallbackUsed: false,
      degraded: true,
    },
  };
}

export function buildScoutUnavailableResponse(args: {
  promptVersion: string;
  requestId?: string | null;
}) {
  return {
    error: {
      code: "scout_temporarily_unavailable",
      message: "Scout could not complete this request.",
      retryable: true,
    },
    message:
      "Scout could not complete this request. Nothing was sent, changed, published, or marked complete.",
    suggestedActions: [],
    actions: [],
    actionResults: [],
    sponsored: null,
    publicEntities: [],
    evidence: [],
    ctaHints: [],
    metadata: {
      intent: "system_error",
      sourceUsed: "exception_handler",
      fallbackUsed: false,
      degraded: true,
      confidenceBand: "unknown",
      requestId: args.requestId ?? null,
    },
    guardContext: {
      canRetry: true,
      recoveryAvailable: false,
    },
    knowledge: {
      layer: 0,
      sources: [],
      confidence: "low",
    },
    llmProvider: "unavailable",
    promptVersion: args.promptVersion,
    timestamp: new Date().toISOString(),
  };
}

