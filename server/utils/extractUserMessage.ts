/**
 * Canonical Scout response extractor
 * 
 * Enforces single, trusted choke point for converting raw model output
 * into safe, user-facing messages. Preserves intelligence while eliminating
 * leakage of reasoning, intent, or internal deliberation.
 * 
 * Philosophy:
 * - Model can reason freely internally
 * - Frontend sees only polished output
 * - Backend metadata preserved for logging/analytics
 * - Future-proof: prompt changes cannot break UI
 */

export type RawScoutOutput =
  | string
  | {
      message?: string;
      final_answer?: string;
      response?: string;
      answer?: string;
      intent?: string;
      thought_flow?: unknown;
      reasoning?: unknown;
      analysis?: unknown;
      decision?: unknown;
      confidence?: number;
      resolvedContext?: unknown;
      [key: string]: unknown;
    };

export interface ExtractedMessage {
  message: string;
  isClean: boolean;
  hadLeakage: boolean;
  leakageFields?: string[];
}

const MAX_CHARS = 700;

const LEAKAGE_PATTERNS = [
  /^\s*\{/, // Starts with JSON
  /"intent"\s*:/i, // JSON intent field
  /"thought_flow"\s*:/i, // JSON thought_flow field
  /"reasoning"\s*:/i, // JSON reasoning field
  /"analysis"\s*:/i, // JSON analysis field
  /"decision"\s*:/i, // JSON decision field
  /step\s*\d+:/i, // Step-by-step breakdown
  /^analysis:/im, // Analysis: prefix
  /^reasoning:/im, // Reasoning: prefix
  /^thought process:/im, // Internal deliberation
];

const FALLBACK_MESSAGE =
  "I can help with that. Here's how TradeScout can support you right now:";

/**
 * Extract user-facing message from raw model output.
 *
 * Handles:
 * - Plain strings
 * - JSON objects with message/final_answer/response fields
 * - Reasoning leakage (blocked)
 * - Length enforcement (700 char cap)
 *
 * Returns fallback if any leakage detected or extraction fails.
 */
export function extractUserMessage(
  raw: RawScoutOutput,
  fallback = FALLBACK_MESSAGE
): ExtractedMessage {
  const leakageFields: string[] = [];

  // Case 1: Plain string input
  if (typeof raw === "string") {
    const sanitized = sanitizeString(raw, leakageFields);
    return {
      message: sanitized,
      isClean: leakageFields.length === 0,
      hadLeakage: leakageFields.length > 0,
      leakageFields: leakageFields.length > 0 ? leakageFields : undefined,
    };
  }

  // Case 2: Object input (expected to be JSON from model)
  if (typeof raw === "object" && raw !== null) {
    // Check for reasoning fields that should never be rendered
    const reasoningKeys = ["intent", "thought_flow", "reasoning", "decision", "analysis"];
    const foundReasoningFields = reasoningKeys.filter((key) =>
      key in raw && raw[key as keyof typeof raw] !== undefined
    );

    if (foundReasoningFields.length > 0) {
      leakageFields.push(...foundReasoningFields);
      return {
        message: fallback,
        isClean: false,
        hadLeakage: true,
        leakageFields,
      };
    }

    // Try to extract message from known safe fields (priority order)
    const candidate =
      (typeof raw.message === "string" && raw.message) ||
      (typeof raw.final_answer === "string" && raw.final_answer) ||
      (typeof raw.response === "string" && raw.response) ||
      (typeof raw.answer === "string" && raw.answer) ||
      "";

    if (candidate.trim()) {
      const sanitized = sanitizeString(candidate, leakageFields);
      return {
        message: sanitized,
        isClean: leakageFields.length === 0,
        hadLeakage: leakageFields.length > 0,
        leakageFields: leakageFields.length > 0 ? leakageFields : undefined,
      };
    }
  }

  // Case 3: Fallback (invalid or empty input)
  return {
    message: fallback,
    isClean: false,
    hadLeakage: false,
  };
}

/**
 * Sanitize a string to remove reasoning leakage patterns.
 *
 * Checks for:
 * - JSON-like structures
 * - Reasoning keywords (step-by-step, analysis, etc.)
 * - Excessive length (cap at MAX_CHARS)
 */
function sanitizeString(
  text: string,
  leakageFields: string[] = []
): string {
  const trimmed = text.trim();

  // Check for leakage patterns
  for (const pattern of LEAKAGE_PATTERNS) {
    if (pattern.test(trimmed)) {
      leakageFields.push(pattern.source);
      return FALLBACK_MESSAGE;
    }
  }

  // Enforce length limit for UX
  if (trimmed.length > MAX_CHARS) {
    return trimmed.slice(0, MAX_CHARS).trimEnd() + "…";
  }

  return trimmed;
}

/**
 * Extract metadata for backend use (logging, analytics, tooling).
 * Never rendered to user.
 */
export function extractMetadata(raw: RawScoutOutput) {
  if (typeof raw === "object" && raw !== null) {
    return {
      intent: typeof raw.intent === "string" ? raw.intent : undefined,
      confidence:
        typeof raw.confidence === "number" ? raw.confidence : undefined,
      resolvedContext: raw.resolvedContext,
    };
  }
  return {};
}
