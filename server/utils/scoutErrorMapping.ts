/**
 * ScoutErrorMapping.ts
 *
 * Authoritative taxonomy of real TradeScout errors and Scout's intelligent recovery.
 * Users never see these errors—they see helpful prompts that move progress forward.
 *
 * Core principle: Never block, never expose system fragility, always guide.
 */

// ============================================================================
// ERROR TYPE DEFINITIONS
// ============================================================================

export type ScoutErrorType =
  | "MISSING_DATA"
  | "MISSING_CONTEXT"
  | "CAPABILITY_MISMATCH"
  | "EMPTY_RESULT"
  | "COLD_START"
  | "SYSTEM_ERROR"
  | "INVALID_STATE";

export type ScoutErrorCategory =
  | "INVOICE"
  | "HOA"
  | "COMMUNITY"
  | "MATCHING"
  | "GENERAL"
  | "SYSTEM";

export interface ScoutError {
  type: ScoutErrorType;
  category: ScoutErrorCategory;
  message: string; // Internal: what went wrong
  userMessage: string; // What Scout says to user
  recoverable: boolean;
  suggestedAction?: string; // What Scout should do next
  context?: Record<string, unknown>; // Diagnostic info
}

export interface ScoutActionResult {
  ok: true;
  data?: unknown;
  message?: string;
}

export interface ScoutActionFailure {
  ok: false;
  error: ScoutError;
}

// ============================================================================
// ERROR CATALOG: INVOICE FLOW
// ============================================================================

export const INVOICE_ERRORS = {
  MISSING_BUSINESS_NAME: {
    type: "MISSING_DATA" as ScoutErrorType,
    category: "INVOICE" as ScoutErrorCategory,
    message: "User wants to invoice but business name is missing from profile",
    userMessage:
      "I can send that invoice — I just need your business name first. What's your company called?",
    recoverable: true,
    suggestedAction: "PROMPT_BUSINESS_NAME",
  },

  MISSING_CLIENT_INFO: {
    type: "MISSING_DATA" as ScoutErrorType,
    category: "INVOICE" as ScoutErrorCategory,
    message: "User said 'invoice the client' but no client exists yet",
    userMessage:
      "Who should I send this to? You can just give me a name and email.",
    recoverable: true,
    suggestedAction: "INLINE_CLIENT_CREATION",
  },

  MISSING_AMOUNT: {
    type: "MISSING_DATA" as ScoutErrorType,
    category: "INVOICE" as ScoutErrorCategory,
    message: "Invoice requested without dollar amount",
    userMessage: "What's the amount you want to invoice for?",
    recoverable: true,
    suggestedAction: "PROMPT_AMOUNT",
  },

  MISSING_DESCRIPTION: {
    type: "MISSING_DATA" as ScoutErrorType,
    category: "INVOICE" as ScoutErrorCategory,
    message: "Invoice missing scope or description of work",
    userMessage:
      "What was the work for? Just a quick summary—I'll use it in the invoice.",
    recoverable: true,
    suggestedAction: "PROMPT_SCOPE",
  },

  CLIENT_NOT_FOUND: {
    type: "MISSING_CONTEXT" as ScoutErrorType,
    category: "INVOICE" as ScoutErrorCategory,
    message: "Referenced client does not exist in system",
    userMessage:
      "I don't have that client on record yet. Want me to add them quickly?",
    recoverable: true,
    suggestedAction: "CREATE_CLIENT",
  },
} as const;

// ============================================================================
// ERROR CATALOG: HOA FLOW
// ============================================================================

export const HOA_ERRORS = {
  NOT_HOA_MEMBER: {
    type: "CAPABILITY_MISMATCH" as ScoutErrorType,
    category: "HOA" as ScoutErrorCategory,
    message:
      "User requested HOA-level action but not marked as board member or resident",
    userMessage:
      "If you're on the HOA board, I can help with that. Want me to open the board tools?",
    recoverable: true,
    suggestedAction: "OFFER_HOA_SETUP",
  },

  HOA_ENTITY_NOT_EXISTS: {
    type: "MISSING_CONTEXT" as ScoutErrorType,
    category: "HOA" as ScoutErrorCategory,
    message: "HOA does not exist in system yet (cold start)",
    userMessage:
      "I don't see an HOA set up yet. Want to create one so you can manage board stuff?",
    recoverable: true,
    suggestedAction: "CREATE_HOA_ENTITY",
  },

  INSUFFICIENT_PERMISSIONS: {
    type: "CAPABILITY_MISMATCH" as ScoutErrorType,
    category: "HOA" as ScoutErrorCategory,
    message: "User has HOA role but lacks specific permission (e.g., voting)",
    userMessage:
      "You can view that, but only board officers can make this change. Want me to show you how to request it?",
    recoverable: true,
    suggestedAction: "SHOW_PERMISSION_REQUEST_FLOW",
  },

  NO_ACTIVE_BOARD: {
    type: "MISSING_CONTEXT" as ScoutErrorType,
    category: "HOA" as ScoutErrorCategory,
    message: "HOA exists but no current board is registered",
    userMessage:
      "This HOA doesn't have an active board set up yet. Want to establish one?",
    recoverable: true,
    suggestedAction: "SETUP_BOARD",
  },
} as const;

// ============================================================================
// ERROR CATALOG: COMMUNITY POSTING
// ============================================================================

export const COMMUNITY_ERRORS = {
  NO_PROFILE: {
    type: "MISSING_CONTEXT" as ScoutErrorType,
    category: "COMMUNITY" as ScoutErrorCategory,
    message: "User (guest or cold start) tries to post without profile",
    userMessage:
      "I can post this for you. Want to add a name so people know who it's from?",
    recoverable: true,
    suggestedAction: "OFFER_INLINE_PROFILE",
  },

  MISSING_LOCATION: {
    type: "MISSING_CONTEXT" as ScoutErrorType,
    category: "COMMUNITY" as ScoutErrorCategory,
    message: "Post missing county/location required for community routing",
    userMessage:
      "Which area should this go to? Just the county is fine—I'll use that.",
    recoverable: true,
    suggestedAction: "PROMPT_LOCATION",
  },

  POST_VISIBILITY_RESTRICTED: {
    type: "MISSING_DATA" as ScoutErrorType,
    category: "COMMUNITY" as ScoutErrorCategory,
    message: "User opts not to be visible in community or disabled posting",
    userMessage:
      "You've opted out of community visibility. Want to post anyway or skip this?",
    recoverable: true,
    suggestedAction: "CONFIRM_VISIBILITY_OVERRIDE",
  },

  COMMUNITY_NOT_ACTIVE: {
    type: "MISSING_CONTEXT" as ScoutErrorType,
    category: "COMMUNITY" as ScoutErrorCategory,
    message: "User's area has no active community feed yet",
    userMessage:
      "That area doesn't have an active community yet, but I can start one. Sound good?",
    recoverable: true,
    suggestedAction: "CREATE_COMMUNITY",
  },

  CONTENT_MODERATION_FLAG: {
    type: "INVALID_STATE" as ScoutErrorType,
    category: "COMMUNITY" as ScoutErrorCategory,
    message: "Post content flagged by moderation rules (spam, hate, etc.)",
    userMessage:
      "That post didn't make it through our safety filter. Want to revise it or try something else?",
    recoverable: true,
    suggestedAction: "SUGGEST_REVISION",
  },
} as const;

// ============================================================================
// ERROR CATALOG: CONTRACTOR MATCHING
// ============================================================================

export const MATCHING_ERRORS = {
  NO_CONTRACTORS_FOUND: {
    type: "EMPTY_RESULT" as ScoutErrorType,
    category: "MATCHING" as ScoutErrorCategory,
    message:
      "Search returned no contractors (empty market, new county, too specific)",
    userMessage:
      "I didn't find an exact match nearby, but here are the closest options.",
    recoverable: true,
    suggestedAction: "SUGGEST_BROADER_SEARCH",
  },

  USER_NO_LOCATION: {
    type: "MISSING_CONTEXT" as ScoutErrorType,
    category: "MATCHING" as ScoutErrorCategory,
    message: "User trying to match contractors but no location on profile",
    userMessage:
      "I just need your area so I can find local pros who match what you need.",
    recoverable: true,
    suggestedAction: "PROMPT_LOCATION",
  },

  INSUFFICIENT_TRADE_DATA: {
    type: "MISSING_CONTEXT" as ScoutErrorType,
    category: "MATCHING" as ScoutErrorCategory,
    message: "User asking for contractors but no trade/skill specified",
    userMessage: "What trade are you looking for? Plumbing, roofing, electric?",
    recoverable: true,
    suggestedAction: "PROMPT_TRADE",
  },

  CONTRACTOR_PROFILE_INCOMPLETE: {
    type: "INVALID_STATE" as ScoutErrorType,
    category: "MATCHING" as ScoutErrorCategory,
    message: "Contractors exist but profiles too sparse to rank meaningfully",
    userMessage:
      "I found some people, but their profiles are incomplete. Want me to help them finish first?",
    recoverable: true,
    suggestedAction: "OFFER_CONTRACTOR_OUTREACH",
  },

  NO_RATINGS_YET: {
    type: "MISSING_CONTEXT" as ScoutErrorType,
    category: "MATCHING" as ScoutErrorCategory,
    message: "Contractors exist but have no reviews or rating history",
    userMessage:
      "These are new to the platform, so no reviews yet. Want to see their profiles anyway?",
    recoverable: true,
    suggestedAction: "SHOW_UNRATED_PROFILES",
  },
} as const;

// ============================================================================
// ERROR CATALOG: COLD START (NO PROFILE)
// ============================================================================

export const COLD_START_ERRORS = {
  ZERO_PROFILE: {
    type: "COLD_START" as ScoutErrorType,
    category: "GENERAL" as ScoutErrorCategory,
    message: "User has no profile data (role, location, history)",
    userMessage:
      "I can help with local projects, recommendations, or business tools. What are you trying to do today?",
    recoverable: true,
    suggestedAction: "OFFER_EXPLORATION_OPTIONS",
  },

  POWER_USER_NO_SETUP: {
    type: "COLD_START" as ScoutErrorType,
    category: "GENERAL" as ScoutErrorCategory,
    message: "User requests advanced action immediately without profile",
    userMessage:
      "I can do that — I'll just grab a couple details as we go. What's first?",
    recoverable: true,
    suggestedAction: "COLLECT_OPPORTUNISTICALLY",
  },

  GUEST_ADVANCED_ACTION: {
    type: "CAPABILITY_MISMATCH" as ScoutErrorType,
    category: "GENERAL" as ScoutErrorCategory,
    message: "Guest (not logged in) tries to perform authenticated action",
    userMessage:
      "I can help with that, but you'd want to sign in first so I remember your work.",
    recoverable: true,
    suggestedAction: "PROMPT_AUTH_OPTIONAL",
  },
} as const;

// ============================================================================
// SYSTEM ERRORS (Low frequency, but graceful)
// ============================================================================

export const SYSTEM_ERRORS = {
  API_TIMEOUT: {
    type: "SYSTEM_ERROR" as ScoutErrorType,
    category: "SYSTEM" as ScoutErrorCategory,
    message: "Backend API call timed out",
    userMessage: "That's taking longer than usual. Want me to try again?",
    recoverable: true,
    suggestedAction: "RETRY_ONCE",
  },

  DATABASE_ERROR: {
    type: "SYSTEM_ERROR" as ScoutErrorType,
    category: "SYSTEM" as ScoutErrorCategory,
    message: "Database write or query failed",
    userMessage:
      "Something didn't go through, but your info is safe. Want me to try again or save it for later?",
    recoverable: true,
    suggestedAction: "OFFER_RETRY_OR_SAVE",
  },

  THIRD_PARTY_FAILURE: {
    type: "SYSTEM_ERROR" as ScoutErrorType,
    category: "SYSTEM" as ScoutErrorCategory,
    message: "Third-party service (Stripe, geo, etc.) unavailable",
    userMessage:
      "I'm having trouble reaching that service right now. Let's try again in a moment.",
    recoverable: true,
    suggestedAction: "RETRY_WITH_BACKOFF",
  },

  INVALID_STATE: {
    type: "INVALID_STATE" as ScoutErrorType,
    category: "SYSTEM" as ScoutErrorCategory,
    message: "Logic error: conflicting state or capability mismatch",
    userMessage:
      "Something changed since we started—I've updated what I can do. Want to continue?",
    recoverable: true,
    suggestedAction: "REFRESH_AND_SUGGEST",
  },
} as const;

// ============================================================================
// CLASSIFICATION FUNCTION
// ============================================================================

/**
 * classifyScoutError
 *
 * Given a raw error, context, and intended action, classify it into
 * a known ScoutError with user-facing recovery message.
 *
 * This is the bridge between "what went wrong" and "what Scout says next."
 */
export function classifyScoutError(params: {
  error: unknown;
  action?: string;
  context?: Record<string, unknown>;
  userId?: string;
  userProfile?: {
    businessName?: string;
    location?: string;
    roles?: string[];
  };
}): ScoutError {
  const { error, action, context, userProfile } = params;

  // Introspect the error
  const errorMessage =
    error instanceof Error ? error.message : String(error || "unknown error");
  const errorLower = errorMessage.toLowerCase();

  // ─────────────────────────────────────────────────────────────────────
  // MATCH: Invoice Errors
  // ─────────────────────────────────────────────────────────────────────

  if (action?.includes("invoice")) {
    if (!userProfile?.businessName) {
      return {
        ...INVOICE_ERRORS.MISSING_BUSINESS_NAME,
        context: { action, userProfile },
      };
    }

    if (
      errorLower.includes("client") ||
      errorLower.includes("recipient") ||
      errorLower.includes("email")
    ) {
      return {
        ...INVOICE_ERRORS.MISSING_CLIENT_INFO,
        context: { action, error: errorMessage },
      };
    }

    if (
      errorLower.includes("amount") ||
      errorLower.includes("price") ||
      errorLower.includes("total")
    ) {
      return {
        ...INVOICE_ERRORS.MISSING_AMOUNT,
        context: { action },
      };
    }

    if (
      errorLower.includes("description") ||
      errorLower.includes("scope") ||
      errorLower.includes("detail")
    ) {
      return {
        ...INVOICE_ERRORS.MISSING_DESCRIPTION,
        context: { action },
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // MATCH: HOA Errors
  // ─────────────────────────────────────────────────────────────────────

  if (action?.includes("hoa") || action?.includes("board")) {
    if (!userProfile?.roles?.includes("hoa_board")) {
      return {
        ...HOA_ERRORS.NOT_HOA_MEMBER,
        context: { action, userProfile },
      };
    }

    if (
      errorLower.includes("hoa") &&
      errorLower.includes("not found") &&
      !context?.hoaId
    ) {
      return {
        ...HOA_ERRORS.HOA_ENTITY_NOT_EXISTS,
        context: { action },
      };
    }

    if (
      errorLower.includes("permission") ||
      errorLower.includes("unauthorized")
    ) {
      return {
        ...HOA_ERRORS.INSUFFICIENT_PERMISSIONS,
        context: { action, error: errorMessage },
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // MATCH: Community Errors
  // ─────────────────────────────────────────────────────────────────────

  if (action?.includes("community") || action?.includes("post")) {
    if (!userProfile || Object.keys(userProfile).length === 0) {
      return {
        ...COMMUNITY_ERRORS.NO_PROFILE,
        context: { action },
      };
    }

    if (!userProfile.location) {
      return {
        ...COMMUNITY_ERRORS.MISSING_LOCATION,
        context: { action },
      };
    }

    if (
      errorLower.includes("visibility") ||
      errorLower.includes("visibility")
    ) {
      return {
        ...COMMUNITY_ERRORS.POST_VISIBILITY_RESTRICTED,
        context: { action },
      };
    }

    if (
      errorLower.includes("moderation") ||
      errorLower.includes("flagged") ||
      errorLower.includes("spam")
    ) {
      return {
        ...COMMUNITY_ERRORS.CONTENT_MODERATION_FLAG,
        context: { action, error: errorMessage },
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // MATCH: Contractor Matching Errors
  // ─────────────────────────────────────────────────────────────────────

  if (
    action?.includes("contractor") ||
    action?.includes("match") ||
    action?.includes("pro")
  ) {
    if (!userProfile?.location) {
      return {
        ...MATCHING_ERRORS.USER_NO_LOCATION,
        context: { action },
      };
    }

    if (
      errorLower.includes("not found") ||
      errorLower.includes("empty") ||
      errorLower.includes("no results")
    ) {
      return {
        ...MATCHING_ERRORS.NO_CONTRACTORS_FOUND,
        context: { action, error: errorMessage },
      };
    }

    if (errorLower.includes("trade") || errorLower.includes("specialty")) {
      return {
        ...MATCHING_ERRORS.INSUFFICIENT_TRADE_DATA,
        context: { action },
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // MATCH: Cold Start Errors
  // ─────────────────────────────────────────────────────────────────────

  if (!userProfile || Object.keys(userProfile).length === 0) {
    return {
      ...COLD_START_ERRORS.ZERO_PROFILE,
      context: { action },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // MATCH: System Errors (catch-all with retry logic)
  // ─────────────────────────────────────────────────────────────────────

  if (errorLower.includes("timeout") || errorLower.includes("econnrefused")) {
    return {
      ...SYSTEM_ERRORS.API_TIMEOUT,
      context: { action, error: errorMessage },
    };
  }

  if (
    errorLower.includes("database") ||
    errorLower.includes("query") ||
    errorLower.includes("transaction")
  ) {
    return {
      ...SYSTEM_ERRORS.DATABASE_ERROR,
      context: { action, error: errorMessage },
    };
  }

  if (
    errorLower.includes("stripe") ||
    errorLower.includes("payment") ||
    errorLower.includes("geo")
  ) {
    return {
      ...SYSTEM_ERRORS.THIRD_PARTY_FAILURE,
      context: { action, error: errorMessage },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // DEFAULT: Unknown error → Generic recovery
  // ─────────────────────────────────────────────────────────────────────

  return {
    type: "SYSTEM_ERROR",
    category: "SYSTEM",
    message: `Unclassified error in ${action || "Scout action"}: ${errorMessage}`,
    userMessage:
      "Something unexpected happened, but let's try a different approach.",
    recoverable: true,
    suggestedAction: "GUIDE_ALTERNATIVE",
    context: { action, error: errorMessage },
  };
}

// ============================================================================
// RECOVERY STRATEGIES (Companion to classification)
// ============================================================================

/**
 * getRecoveryStrategy
 *
 * Given a ScoutError, return the action Scout should take next.
 * This bridges error classification to actual recovery behavior.
 */
export function getRecoveryStrategy(
  error: ScoutError
): {
  action: string;
  params?: Record<string, unknown>;
  isAutomatic: boolean;
} {
  const { suggestedAction } = error;

  // Automatic (no user input needed)
  if (suggestedAction === "RETRY_ONCE") {
    return { action: "RETRY", isAutomatic: true };
  }

  if (suggestedAction === "RETRY_WITH_BACKOFF") {
    return { action: "RETRY_BACKOFF", isAutomatic: true };
  }

  // User-interactive
  if (suggestedAction === "PROMPT_BUSINESS_NAME") {
    return {
      action: "PROMPT",
      params: {
        field: "businessName",
        question: error.userMessage,
      },
      isAutomatic: false,
    };
  }

  if (suggestedAction === "PROMPT_LOCATION") {
    return {
      action: "PROMPT",
      params: {
        field: "location",
        question: error.userMessage,
      },
      isAutomatic: false,
    };
  }

  if (suggestedAction === "INLINE_CLIENT_CREATION") {
    return {
      action: "OPEN_INLINE_FORM",
      params: {
        formType: "CLIENT_CREATE",
        context: "INVOICE",
      },
      isAutomatic: false,
    };
  }

  if (suggestedAction === "CREATE_HOA_ENTITY") {
    return {
      action: "OPEN_MODAL",
      params: {
        modalType: "HOA_SETUP",
      },
      isAutomatic: false,
    };
  }

  if (suggestedAction === "OFFER_EXPLORATION_OPTIONS") {
    return {
      action: "SHOW_OPTIONS",
      params: {
        options: [
          "Browse local contractors",
          "See community activity",
          "Explore business tools",
        ],
      },
      isAutomatic: false,
    };
  }

  // Default: ask what to do next
  return {
    action: "GUIDE_NEXT_STEP",
    params: {
      message: error.userMessage,
    },
    isAutomatic: false,
  };
}

/**
 * Export all error catalogs as a single namespace for easy reference
 */
export const SCOUT_ERRORS = {
  invoice: INVOICE_ERRORS,
  hoa: HOA_ERRORS,
  community: COMMUNITY_ERRORS,
  matching: MATCHING_ERRORS,
  coldStart: COLD_START_ERRORS,
  system: SYSTEM_ERRORS,
};
