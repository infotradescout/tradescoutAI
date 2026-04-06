import { COMMUNITY_TONE } from "../../shared/communityLanguage";

export type ToneScenario =
  | "default"
  | "technical_fallback"
  | "confidence_low"
  | "blocked_action"
  | "next_step_prompt";

export interface ToneBuildInput {
  scenario: ToneScenario;
  message: string;
  countyLabel?: string;
  roleLabel?: string;
  confidenceBand?: "low" | "medium" | "high";
  includeNextStep?: boolean;
  nextStepLabel?: string;
  nextStepRoute?: string;
}

export interface ToneBuildResult {
  message: string;
  scenario: ToneScenario;
  guardrailFlags: string[];
  toneScore: number;
  metadata: {
    localityPhrase: string;
    accountabilityPhrase: string;
    transparencyPhrase: string;
    includesNextStep: boolean;
  };
}

const ROBOTIC_PHRASES = [
  /i can help with that/gi,
  /as an ai/gi,
  /unable to process your request/gi,
  /an error occurred/gi,
  /system failure/gi,
  /unknown exception/gi,
];

const OVERCLAIM_PATTERNS = [
  /everyone agrees/gi,
  /guaranteed result/gi,
  /this is definitely correct/gi,
  /the community approves/gi,
  /best in the county/gi,
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function sentenceCase(input: string): string {
  if (!input) return "";
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function hasQuestion(text: string): boolean {
  return /\?/.test(text);
}

/**
 * Tone-aware builder for Scout responses and fallbacks.
 */
export class ScoutToneAwareBuilder {
  /**
   * Build a brand-safe, local-feel message for the given scenario.
   */
  static build(input: ToneBuildInput): ToneBuildResult {
    const localityPhrase = input.countyLabel
      ? `${COMMUNITY_TONE.locality} in ${input.countyLabel}`
      : COMMUNITY_TONE.locality;

    const wrapped = this.wrapByScenario(input);
    const withTone = this.injectCommunityTone({
      base: wrapped,
      localityPhrase,
      includeNextStep: input.includeNextStep,
      nextStepLabel: input.nextStepLabel,
      nextStepRoute: input.nextStepRoute,
      confidenceBand: input.confidenceBand,
    });

    const guarded = this.applyGuardrails(withTone);
    const cleaned = this.ensureHumanFeel(guarded.message, input.scenario);
    const finalMessage = this.ensureQuestionPrompt(cleaned, input.scenario);

    return {
      message: finalMessage,
      scenario: input.scenario,
      guardrailFlags: guarded.flags,
      toneScore: this.evaluateToneConsistency(finalMessage),
      metadata: {
        localityPhrase,
        accountabilityPhrase: COMMUNITY_TONE.accountability,
        transparencyPhrase: COMMUNITY_TONE.transparency,
        includesNextStep: Boolean(input.includeNextStep || input.nextStepLabel),
      },
    };
  }

  /**
   * Convert technical fallback messages into local-action tone.
   */
  static wrapTechnicalFallback(message: string, countyLabel?: string): string {
    const base = normalizeWhitespace(message || "Scout hit a routing issue.");
    const locality = countyLabel ? `in ${countyLabel}` : "around here";

    return normalizeWhitespace(
      `Quick reset: ${base.replace(/[.!]+$/g, "")}. ` +
        `Let's keep this ${COMMUNITY_TONE.transparency} with ${COMMUNITY_TONE.accountability} signals ${locality}. ` +
        `Routing one concrete next step now.`
    );
  }

  /**
   * Evaluate tone consistency score (0-100).
   */
  static evaluateToneConsistency(message: string): number {
    const text = String(message || "").toLowerCase();
    let score = 70;

    if (text.includes(COMMUNITY_TONE.accountability.toLowerCase())) score += 10;
    if (text.includes(COMMUNITY_TONE.locality.toLowerCase())) score += 8;
    if (text.includes(COMMUNITY_TONE.transparency.toLowerCase())) score += 8;
    if (hasQuestion(text)) score += 4;

    for (const pattern of ROBOTIC_PHRASES) {
      if (pattern.test(text)) score -= 18;
    }
    for (const pattern of OVERCLAIM_PATTERNS) {
      if (pattern.test(text)) score -= 22;
    }

    if (text.length < 30) score -= 8;
    return clamp(Math.round(score), 0, 100);
  }

  /**
   * Ensure fallback templates remain concise and local.
   */
  static templateForScenario(scenario: ToneScenario): string {
    if (scenario === "technical_fallback") {
      return "Scout hit a temporary routing issue. We'll keep moving with one local next step.";
    }
    if (scenario === "confidence_low") {
      return "Signal confidence is still forming. Let's verify local proof before action.";
    }
    if (scenario === "blocked_action") {
      return "That action is gated right now. We can take a safer local path and continue.";
    }
    if (scenario === "next_step_prompt") {
      return "Here is the clearest next step to move this forward today.";
    }
    return "Let's move this forward with a clear local next step.";
  }

  private static wrapByScenario(input: ToneBuildInput): string {
    const incoming = normalizeWhitespace(input.message || "");
    const fallback = this.templateForScenario(input.scenario);

    if (input.scenario === "technical_fallback") {
      return this.wrapTechnicalFallback(incoming || fallback, input.countyLabel);
    }

    if (input.scenario === "confidence_low") {
      return normalizeWhitespace(
        `${incoming || fallback} We should verify signals locally before exposing contact options.`
      );
    }

    if (input.scenario === "blocked_action") {
      return normalizeWhitespace(
        `${incoming || fallback} I can route to the nearest allowed path.`
      );
    }

    if (input.scenario === "next_step_prompt") {
      return normalizeWhitespace(`${incoming || fallback} ${this.buildNextStepSuffix(input)}`);
    }

    return incoming || fallback;
  }

  private static buildNextStepSuffix(input: ToneBuildInput): string {
    if (!input.nextStepLabel) return "Pick one next step and I'll keep the path tight.";
    if (input.nextStepRoute) return `Next step: ${input.nextStepLabel} (${input.nextStepRoute}).`;
    return `Next step: ${input.nextStepLabel}.`;
  }

  private static injectCommunityTone(params: {
    base: string;
    localityPhrase: string;
    includeNextStep?: boolean;
    nextStepLabel?: string;
    nextStepRoute?: string;
    confidenceBand?: "low" | "medium" | "high";
  }): string {
    const confidenceHint =
      params.confidenceBand === "low"
        ? "Confidence is still low"
        : params.confidenceBand === "high"
          ? "Confidence is strong"
          : "Confidence is moderate";

    const nextStep =
      params.includeNextStep || params.nextStepLabel
        ? this.buildNextStepSuffix({
            scenario: "next_step_prompt",
            message: "",
            nextStepLabel: params.nextStepLabel,
            nextStepRoute: params.nextStepRoute,
          })
        : "";

    return normalizeWhitespace(
      `${params.base} ${confidenceHint}. Keep this ${COMMUNITY_TONE.accountability} and ${COMMUNITY_TONE.transparency} with ${params.localityPhrase}. ${nextStep}`
    );
  }

  private static applyGuardrails(message: string): { message: string; flags: string[] } {
    let next = message;
    const flags: string[] = [];

    for (const pattern of ROBOTIC_PHRASES) {
      if (pattern.test(next)) {
        next = next.replace(pattern, "");
        flags.push("robotic_phrase_removed");
      }
    }

    for (const pattern of OVERCLAIM_PATTERNS) {
      if (pattern.test(next)) {
        next = next.replace(pattern, "local people may see different outcomes");
        flags.push("overclaim_rewritten");
      }
    }

    next = next
      .replace(/\s{2,}/g, " ")
      .replace(/\.{2,}/g, ".")
      .replace(/\s+([,.!?])/g, "$1")
      .trim();

    if (!next) {
      next = "Let's take one local next step and keep moving.";
      flags.push("empty_replaced");
    }

    return { message: sentenceCase(next), flags };
  }

  private static ensureHumanFeel(message: string, scenario: ToneScenario): string {
    let next = normalizeWhitespace(message);
    if (!hasQuestion(next) && scenario !== "blocked_action") {
      next = `${next} Next step is ready now.`;
    }

    if (next.length > 360) {
      next = `${next.slice(0, 355).trim()}...`;
    }

    return sentenceCase(next);
  }

  private static ensureQuestionPrompt(message: string, scenario: ToneScenario): string {
    if (scenario === "blocked_action") return message;
    const candidate = hasQuestion(message) ? message : `${message} Ready to continue?`;
    if (candidate.length <= 360) return candidate;
    return `${candidate.slice(0, 357).trim()}...`;
  }
}

export default ScoutToneAwareBuilder;
