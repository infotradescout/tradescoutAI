/**
 * ScoutActionGuard.ts
 *
 * Wraps every Scout action execution with intelligent error handling.
 * Classifies errors, determines recoverability, and returns safe outcomes.
 *
 * Users never see raw errors. They see: "I need X" or "Here's what I did next."
 */

import {
  classifyScoutError,
  type ScoutError,
  type ScoutActionResult,
  type ScoutActionFailure,
} from "./scoutErrorMapping";

// ============================================================================
// GUARD TYPES
// ============================================================================

export interface ScoutActionContext {
  userId?: string;
  userProfile?: {
    businessName?: string;
    location?: string;
    roles?: string[];
    county?: string;
    state?: string;
  };
  sessionId?: string;
  requestId?: string;
}

export interface ScoutAction {
  type: string;
  target?: string;
  payload?: Record<string, unknown>;
}

export type GuardedActionResult = ScoutActionResult | ScoutActionFailure;

/** A thrown error cannot establish whether an external write already committed. */
function unconfirmedExecution(action: ScoutAction, errorType: ScoutError["type"]): ScoutActionFailure {
  return {
    ok: false,
    error: {
      type: errorType,
      category: "GENERAL",
      message: "Scout action execution was not confirmed",
      userMessage:
        "Scout could not confirm this action. Check its current status before trying again.",
      recoverable: true,
      // Do not return raw errors, profile data, or a runnable retry instruction.
      context: { action: action.type, executionState: "unconfirmed", attempts: 1 },
    },
  };
}

function isNegativeAcknowledgement(result: unknown): boolean {
  if (!result || typeof result !== "object" || Array.isArray(result)) return false;
  const value = result as Record<string, unknown>;
  return value.ok === false || value.success === false;
}

// ============================================================================
// CORE GUARD FUNCTION
// ============================================================================

/**
 * Validate prerequisites, invoke the executor once, and report its actual outcome.
 *
 * A recovery suggestion is not successful execution. This guard cannot know
 * whether a failed write committed, so it never retries an arbitrary executor.
 * Keyed profile actions also use a durable, authenticated-owner-scoped receipt.
 */
export async function runScoutAction(
  action: ScoutAction,
  context: ScoutActionContext,
  executor: (action: ScoutAction) => Promise<unknown>
): Promise<GuardedActionResult> {
  const { userId, userProfile, sessionId, requestId } = context;
  const validationError = validateAction(action, context);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  try {
    // Existing pre-receipt clients retain their one-attempt contract. New v1
    // actions carry a server-issued identity in their persisted payload. Invalid
    // supplied keys fail closed; they must never fall back to unkeyed execution.
    const hasExecutionIdentity = action.type === "SAVE_PROFILE" &&
      Object.prototype.hasOwnProperty.call(action.payload || {}, "executionId");
    const result = hasExecutionIdentity
      ? await (await import("./scoutExecutionReceipts")).executeScoutProfileOnce(action, context, executor)
      : await executor(action);
    if (isNegativeAcknowledgement(result)) {
      return unconfirmedExecution(action, "INVALID_STATE");
    }
    return { ok: true, data: result };
  } catch (error) {
    // Handle every rejection, including throw null/undefined/false/0/"".
    let errorType: ScoutError["type"] = "SYSTEM_ERROR";
    try {
      errorType = classifyScoutError({
        error,
        action: action.type,
        context: action.payload,
        userId,
        userProfile,
      }).type;
    } catch {
      // Even an unprintable rejection value must remain a safe failed outcome.
    }
    // The route forwards error.context to the browser. Keep diagnostics out of
    // the returned object and avoid logging raw payloads or exception contents.
    console.error(`[Scout Guard] Action not confirmed: ${action.type}`, {
      userId,
      sessionId,
      requestId,
      errorType,
      attempts: 1,
    });
    return unconfirmedExecution(action, errorType);
  }
}

// ============================================================================
// VALIDATION (Pre-execution guards)
// ============================================================================

function validateAction(
  action: ScoutAction,
  context: ScoutActionContext
): ScoutError | null {
  if (!action || typeof action.type !== "string" || !action.type.trim()) {
    return {
      type: "INVALID_STATE",
      category: "GENERAL",
      message: "Missing Scout action type",
      userMessage: "Choose an action before continuing.",
      recoverable: true,
    };
  }
  const { type } = action;
  const { userId, userProfile } = context;

  // ─────────────────────────────────────────────────────────────────────
  // Check: Authentication-required actions
  // ─────────────────────────────────────────────────────────────────────

  const authRequired = [
    "SEND_INVOICE",
    "CREATE_CLIENT",
    "SAVE_PROFILE",
    "SEND_MESSAGE",
    "CREATE_HOA",
  ];

  if (authRequired.includes(type) && !userId) {
    return {
      type: "CAPABILITY_MISMATCH",
      category: "GENERAL",
      message: `Action ${type} requires authentication`,
      userMessage:
        "You'd want to sign in first so I can remember your work.",
      recoverable: true,
      suggestedAction: "PROMPT_AUTH",
      context: { action: type },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Check: Profile completeness for certain actions
  // ─────────────────────────────────────────────────────────────────────

  const needsLocation = ["SEARCH_CONTRACTORS", "FIND_COMMUNITY", "GET_RECOMMENDATIONS"];

  if (needsLocation.includes(type) && !userProfile?.location) {
    return {
      type: "MISSING_CONTEXT",
      category: "MATCHING",
      message: `Action ${type} requires location`,
      userMessage:
        "I just need your area so I can find local options for you.",
      recoverable: true,
      suggestedAction: "PROMPT_LOCATION",
      context: { action: type },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Check: Business-specific actions
  // ─────────────────────────────────────────────────────────────────────

  const needsBusinessInfo = ["SEND_INVOICE", "CREATE_ESTIMATE"];

  if (needsBusinessInfo.includes(type) && !userProfile?.businessName) {
    return {
      type: "MISSING_DATA",
      category: "INVOICE",
      message: `Action ${type} requires business info`,
      userMessage:
        "I can do that — I just need your business name first.",
      recoverable: true,
      suggestedAction: "PROMPT_BUSINESS_NAME",
      context: { action: type },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // All checks passed
  // ─────────────────────────────────────────────────────────────────────

  return null;
}

// ============================================================================
// HELPER: Safe action wrapper for common patterns
// ============================================================================

/**
 * safeExecute
 *
 * Awaited wrapper that preserves the guard's success/failure result.
 * Returns a clean result or user-facing message.
 */
export async function safeExecute(
  action: ScoutAction,
  context: ScoutActionContext,
  executor: (action: ScoutAction) => Promise<unknown>
): Promise<{
  success: boolean;
  message: string;
  data?: unknown;
  nextAction?: string;
}> {
  const result = await runScoutAction(action, context, executor);

  if (result.ok) {
    return {
      success: true,
      message: result.message || "Done.",
      data: result.data,
    };
  }

  return {
    success: false,
    message: result.error.userMessage,
    nextAction: result.error.suggestedAction,
  };
}
