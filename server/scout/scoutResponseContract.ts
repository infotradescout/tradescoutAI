import type { ScoutActionContract, ScoutResponseContract } from "../../shared/types/scout";
import { enforceTradeScoutIdentityBoundary } from "./brandGuard";
import { polishScoutLaunchResponse } from "./scoutLaunchResponsePolish";

type FinalizeOptions = {
  requestId?: string | null;
  fallbackMessage?: string;
  requestMessage?: string | null;
};

const DEFAULT_FALLBACK_MESSAGE = "I can still help you move forward. Your next best step is ready.";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isScoutLikePayload(payload: unknown): payload is Record<string, unknown> {
  if (!isObject(payload)) return false;
  if (typeof payload.message === "string") return true;
  if (Array.isArray(payload.actions)) return true;
  if (Array.isArray(payload.suggestedActions)) return true;
  if (typeof payload.llmProvider === "string") return true;
  return false;
}

function sanitizeSuggestedActions(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const sanitized = raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 6);
  return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeAction(raw: unknown): ScoutActionContract | null {
  if (!isObject(raw)) return null;

  const type = typeof raw.type === "string" ? raw.type.trim() : "";
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (!type || !label) return null;

  const out: ScoutActionContract = {
    type,
    label,
  };

  if (typeof raw.to === "string" && raw.to.trim()) out.to = raw.to.trim();
  if (typeof raw.path === "string" && raw.path.trim()) out.path = raw.path.trim();
  if (typeof raw.prompt === "string" && raw.prompt.trim()) out.prompt = raw.prompt.trim();
  if (typeof raw.subtitle === "string" && raw.subtitle.trim()) out.subtitle = raw.subtitle.trim();
  if (typeof raw.why === "string" && raw.why.trim()) out.why = raw.why.trim();
  if (typeof raw.primary === "boolean") out.primary = raw.primary;

  if (isObject(raw.payload)) {
    out.payload = raw.payload as Record<string, unknown>;
  }

  return out;
}

function sanitizeActions(raw: unknown): ScoutActionContract[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const sanitized = raw
    .map(sanitizeAction)
    .filter((action): action is ScoutActionContract => !!action);
  return sanitized.length > 0 ? sanitized.slice(0, 10) : undefined;
}

export function finalizeScoutResponse(payload: unknown, options: FinalizeOptions = {}): unknown {
  if (!isScoutLikePayload(payload)) return payload;

  const source = payload as Record<string, unknown>;
  const message = typeof source.message === "string" ? source.message.trim() : "";
  const fallbackMessage = options.fallbackMessage || DEFAULT_FALLBACK_MESSAGE;
  const safeMessage = message.length > 0 ? message : fallbackMessage;
  const identityBoundary = enforceTradeScoutIdentityBoundary(
    String(options.requestMessage || ""),
    safeMessage
  );
  const polished = polishScoutLaunchResponse(options.requestMessage, identityBoundary.text);

  const actions = sanitizeActions(source.actions);
  const suggestedActions = sanitizeSuggestedActions(source.suggestedActions);

  const metadata = isObject(source.metadata)
    ? { ...source.metadata }
    : ({} as Record<string, unknown>);

  if (!message) {
    metadata.contractFallback = true;
    metadata.contractViolation = "missing_message";
  }

  if (identityBoundary.overridden) {
    metadata.contractFallback = true;
    metadata.contractViolation = "identity_boundary_override";
  }

  if (polished.changed) {
    metadata.launchPolished = true;
    if (polished.reason) metadata.launchPolishReason = polished.reason;
  }

  if (options.requestId && !metadata.requestId) {
    metadata.requestId = options.requestId;
  }

  const normalized: ScoutResponseContract = {
    ...(source as ScoutResponseContract),
    message: polished.message,
    ...(suggestedActions ? { suggestedActions } : {}),
    ...(actions ? { actions } : {}),
    metadata,
  };

  return normalized;
}
