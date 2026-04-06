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
import { sanitizeScoutUserFacingText } from "../scout/userFacingSanitizer";

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
  /"intent"\s*:/i,
  /"thought_flow"\s*:/i,
  /"reasoning"\s*:/i,
  /"analysis"\s*:/i,
  /"decision"\s*:/i,
  /step\s*\d+:/i,
  /^analysis:/im,
  /^reasoning:/im,
  /^decision:/im,
  /^thought process:/im,
];

const FALLBACK_MESSAGE = "Let's keep this simple and local. The next step is ready right now.";

/**
 * Extract user-facing message from raw model output.
 *
 * Handles:
 * - Plain strings
 * - JSON objects with message/final_answer/response fields
 * - Reasoning leakage (scrubbed)
 * - Length enforcement (700 char cap)
 *
 * Returns fallback if extraction fails.
 */
export function extractUserMessage(
  raw: RawScoutOutput,
  fallback = FALLBACK_MESSAGE
): ExtractedMessage {
  const leakageFields: string[] = [];

  // Case 1: Plain string input
  if (typeof raw === "string") {
    const sanitized = sanitizeString(raw, leakageFields, fallback);
    return {
      message: sanitized,
      isClean: leakageFields.length === 0,
      hadLeakage: leakageFields.length > 0,
      leakageFields: leakageFields.length > 0 ? leakageFields : undefined,
    };
  }

  // Case 2: Object input (expected to be JSON from model)
  if (typeof raw === "object" && raw !== null) {
    // Mark reasoning fields for telemetry, but continue if safe message is present.
    const reasoningKeys = ["intent", "thought_flow", "reasoning", "decision", "analysis"];
    const foundReasoningFields = reasoningKeys.filter(
      (key) => key in raw && raw[key as keyof typeof raw] !== undefined
    );

    if (foundReasoningFields.length > 0) leakageFields.push(...foundReasoningFields);

    // Try to extract message from known safe fields (priority order)
    const candidate =
      (typeof raw.message === "string" && raw.message) ||
      (typeof raw.final_answer === "string" && raw.final_answer) ||
      (typeof raw.response === "string" && raw.response) ||
      (typeof raw.answer === "string" && raw.answer) ||
      "";

    if (candidate.trim()) {
      const sanitized = sanitizeString(candidate, leakageFields, fallback);
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
 * - Internal doc/source leakage and markdown artifacts
 */
function sanitizeString(
  text: string,
  leakageFields: string[] = [],
  fallback = FALLBACK_MESSAGE
): string {
  const trimmed = text.trim();
  if (!trimmed) {
    leakageFields.push("empty");
    return fallback;
  }

  // If the model emitted JSON as text, recover from known response fields.
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const candidate =
        (typeof parsed.message === "string" && parsed.message) ||
        (typeof parsed.final_answer === "string" && parsed.final_answer) ||
        (typeof parsed.response === "string" && parsed.response) ||
        (typeof parsed.answer === "string" && parsed.answer) ||
        "";
      if (candidate.trim()) {
        leakageFields.push("json_wrapped_message");
        return sanitizeString(candidate, leakageFields, fallback);
      }
    } catch {
      leakageFields.push("json_parse_failed");
      return fallback;
    }
  }

  // Check for leakage patterns that indicate hidden internals surfaced to user.
  for (const pattern of LEAKAGE_PATTERNS) {
    if (pattern.test(trimmed)) {
      leakageFields.push(pattern.source);
      return fallback;
    }
  }

  const scrubbed = sanitizeScoutUserFacingText(trimmed, {
    fallback,
    maxChars: MAX_CHARS,
  });
  leakageFields.push(...scrubbed.flags);
  return scrubbed.text;
}

/**
 * Extract metadata for backend use (logging, analytics, tooling).
 * Never rendered to user.
 */
export function extractMetadata(raw: RawScoutOutput) {
  if (typeof raw === "object" && raw !== null) {
    return {
      intent: typeof raw.intent === "string" ? raw.intent : undefined,
      confidence: typeof raw.confidence === "number" ? raw.confidence : undefined,
      resolvedContext: raw.resolvedContext,
    };
  }
  return {};
}
