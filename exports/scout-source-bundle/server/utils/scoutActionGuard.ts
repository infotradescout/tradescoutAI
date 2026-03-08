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
  getRecoveryStrategy,
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

export type GuardedActionResult =
  | ScoutActionResult
  | ScoutActionFailure
  | {
      ok: true;
      data?: unknown;
      message?: string;
      nextAction?: string;
    };

// ============================================================================
// RETRY LOGIC
// ============================================================================

const MAX_RETRIES = 1;
const BACKOFF_MS = 500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryOnce<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  try {
    return await fn();
  } catch (firstError) {
    console.log(
      `[Scout Guard] First attempt failed for ${label}, retrying once...`
    );
    await sleep(BACKOFF_MS);

    try {
      return await fn();
    } catch (secondError) {
      console.error(`[Scout Guard] Retry also failed for ${label}`, {
        firstError: firstError instanceof Error ? firstError.message : String(firstError),
        secondError: secondError instanceof Error ? secondError.message : String(secondError),
      });
      throw secondError;
    }
  }
}

// ============================================================================
// CORE GUARD FUNCTION
// ============================================================================

/**
 * runScoutAction
 *
 * Executes a Scout action through the guard.
 *
 * Flow:
 * 1. Validate action is allowed in context
 * 2. Execute action with retry logic
 * 3. On success: return result + optional next action
 * 4. On error: classify + determine if recoverable
 * 5. If recoverable: return recovery suggestion (never throw)
 * 6. If not: return safe error message with guidance
 *
 * Users never see stack traces or raw errors.
 */
export async function runScoutAction(
  action: ScoutAction,
  context: ScoutActionContext,
  executor: (action: ScoutAction) => Promise<unknown>
): Promise<GuardedActionResult> {
  const { userId, userProfile, sessionId, requestId } = context;

  // ─────────────────────────────────────────────────────────────────────
  // STEP 1: VALIDATE (Pre-execution checks)
  // ─────────────────────────────────────────────────────────────────────

  const validationError = validateAction(action, context);
  if (validationError) {
    console.warn(`[Scout Guard] Action validation failed`, {
      action: action.type,
      userId,
      error: validationError.message,
    });

    return {
      ok: false,
      error: validationError,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // STEP 2: EXECUTE (With retry for system errors)
  // ─────────────────────────────────────────────────────────────────────

  let result: unknown;
  let executionError: unknown | null = null;

  try {
    // Attempt execution (with one automatic retry for transient failures)
    result = await retryOnce(
      () => executor(action),
      `${action.type}:${action.target}`
    );
  } catch (err) {
    executionError = err;
  }

  // ─────────────────────────────────────────────────────────────────────
  // STEP 3: CLASSIFY ERROR (If it occurred)
  // ─────────────────────────────────────────────────────────────────────

  if (executionError) {
    const scoutError = classifyScoutError({
      error: executionError,
      action: action.type,
      context: action.payload,
      userId,
      userProfile,
    });

    // Log for diagnostics (sent to backend monitoring, never to user)
    console.error(`[Scout Guard] Action failed: ${action.type}`, {
      userId,
      sessionId,
      requestId,
      error: scoutError.message,
      internalMessage: executionError instanceof Error ? executionError.message : String(executionError),
      recoverable: scoutError.recoverable,
      context: scoutError.context,
    });

    // ─────────────────────────────────────────────────────────────────
    // STEP 4: HANDLE RECOVERY
    // ─────────────────────────────────────────────────────────────────

    if (scoutError.recoverable) {
      const recovery = getRecoveryStrategy(scoutError);

      // If automatic, attempt recovery silently
      if (recovery.isAutomatic) {
        console.info(
          `[Scout Guard] Attempting automatic recovery: ${recovery.action}`,
          { action: action.type, userId }
        );

        // Return a success with recovery action
        // Frontend will handle "nextAction" to retry or guide user
        return {
          ok: true,
          message: scoutError.userMessage,
          nextAction: recovery.action,
          data: recovery.params,
        };
      }

      // If user-interactive, return failure with guidance
      return {
        ok: false,
        error: {
          ...scoutError,
          suggestedAction: recovery.action,
        },
      };
    }

    // Not recoverable: return safe error message
    return {
      ok: false,
      error: {
        ...scoutError,
        userMessage:
          "Something unexpected happened. Let's try a different approach.",
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // STEP 5: SUCCESS
  // ─────────────────────────────────────────────────────────────────────

  return {
    ok: true,
    data: result,
  };
}

// ============================================================================
// VALIDATION (Pre-execution guards)
// ============================================================================

function validateAction(
  action: ScoutAction,
  context: ScoutActionContext
): ScoutError | null {
  const { type, target } = action;
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
 * Simpler wrapper for fire-and-forget actions.
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
