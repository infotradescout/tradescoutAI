/**
 * Scout Claim Inference System
 * Phase 3d-A: Convert free-form userIntent into structured claim suggestions
 *
 * Contract:
 * - Takes provisional userIntent text + optional userTypes signals
 * - Returns 1-5 claim suggestions with confidence scores
 * - Conservative confidence: only >=0.80 when explicit
 * - Never infers admin/verification/licenses/badges
 * - Never includes userTypes in output (only claimTypes)
 */

import type { ClaimType, ClaimInferenceOutput } from "./claimTypes";
import type { ProfileDraft } from "@/types/profileDraft";

/**
 * System prompt for Scout inference
 * This is the authoritative prompt that LLM uses to parse userIntent
 */
const SCOUT_INFERENCE_SYSTEM_PROMPT = `You are TradeScout Scout Onboarding Inference.
Your job is to convert a user's free-form onboarding intent text into structured claim suggestions.

You MUST:
- Return ONLY valid JSON. No prose, no markdown, no code fences.
- Suggest 1–5 claims max.
- Each suggestion must include a confidence score 0.00–1.00 and a short evidence string quoting or paraphrasing the user's text.
- Prefer intent-level claims (what the user wants to do), not identity labels.
- If the text is vague or missing, return a single suggestion: exploring (confidence 0.60) with evidence "vague/unspecified".
- Never infer admin privileges, verification, licenses, or badges.
- Never include userTypes (homeowner/contractor/etc). Only claimTypes.
- If user indicates BOTH hiring and offering services, include both find_help and offer_services.
- Keep confidence conservative: only use >=0.80 when explicit.

Allowed claimTypes are:
CORE: exploring, find_help, offer_services, represent_business, buy_sell_locally, community_participation
WORK_CONTEXT: home_project, commercial_project, property_management, emergency_service, design_planning, inspection_evaluation, maintenance_recurring
VERTICAL: construction_trades, food_business, hospitality, real_estate, automotive, nonprofit, technology_startup
PARTICIPATION: wants_recommendations, gives_recommendations, posts_deals, organizes_events, builds_community
FUTURE_INTENT: seeking_leads, seeking_visibility, seeking_partnerships, seeking_tools

Return JSON with:
- suggestions: array of claim suggestions
- summary: one sentence (string) describing what the user likely wants
- followups: 0–2 short clarifying questions ONLY if confidence is low (<0.70) or ambiguous

Rules:
- Do not exceed 5 suggestions.
- If provisional userTypes imply a vertical, you may add a vertical claim with low confidence (0.55–0.65) unless the text confirms it.
- If the text includes "website", "my business", "customers", "leads", "marketing", "promote", bias toward represent_business + seeking_visibility.
- If the text includes "hire", "need someone", "looking for", bias toward find_help.
- If the text includes "I do", "I offer", "my services", bias toward offer_services.
- If the text includes "deals", "discounts", "specials", bias toward posts_deals or buy_sell_locally depending on phrasing.

Output JSON only.`;

/**
 * Build user prompt for inference
 */
function buildUserPrompt(
  userIntentText: string,
  provisionalUserTypes: string[] = [],
  countyName: string | null = null,
  profileDraft?: ProfileDraft
): string {
  const userTypesJson = JSON.stringify(provisionalUserTypes);
  const countyText = countyName || "null";
  const draftSummary = profileDraft
    ? JSON.stringify({
        presenceType: profileDraft.presenceType,
        countyName: profileDraft.countyName,
        countyFips: profileDraft.countyFips,
        stateCode: profileDraft.stateCode,
        businessName: profileDraft.businessName,
        businessCategory: profileDraft.businessCategory,
        serviceAreasCount: profileDraft.serviceAreas?.length || 0,
      })
    : "null";

  return `User intent text:
"${userIntentText}"

Optional signals from provisional userTypes (may be empty):
${userTypesJson}

User county context (may be null):
${countyText}

Structured setup from pre-Scout gate (may be null):
${draftSummary}`;
}

// ─── Timeout constant ────────────────────────────────────────────────────────
/** Maximum milliseconds to wait for the LLM inference API before falling back. */
const INFERENCE_TIMEOUT_MS = 5_000;

// ─── Deterministic keyword fallback ──────────────────────────────────────────
/**
 * Fast, zero-latency fallback that maps strong keyword signals in the user's
 * intent text to claim suggestions without hitting the LLM.
 *
 * This runs when the LLM times out, returns an error, or produces unparseable
 * output. It covers the most common intent patterns so the Scout onboarding
 * flow never stalls on third-party API latency.
 */
function keywordFallbackInference(
  text: string,
  provisionalUserTypes: string[] = []
): ClaimInferenceOutput {
  const lower = text.toLowerCase();
  const suggestions: ClaimInferenceOutput["suggestions"] = [];

  // Offer / provide services
  if (/\b(i (do|offer|provide|run|own)|my (service|business|company|shop|trade)|contractor|plumber|electrician|roofer|hvac|painter|landscap|handyman)\b/.test(lower)) {
    suggestions.push({ claimType: "offer_services" as ClaimType, confidence: 0.82, evidence: "keyword: service/trade provider signal" });
  }

  // Represent / promote business
  if (/\b(my business|promote|marketing|customers|leads|visibility|website|brand)\b/.test(lower)) {
    suggestions.push({ claimType: "represent_business" as ClaimType, confidence: 0.78, evidence: "keyword: business promotion signal" });
  }

  // Find / hire help
  if (/\b(need|hire|looking for|find|want someone|help with|fix|repair|install|replace)\b/.test(lower)) {
    suggestions.push({ claimType: "find_help" as ClaimType, confidence: 0.80, evidence: "keyword: seeking help signal" });
  }

  // Buy / sell locally
  if (/\b(buy|sell|deal|discount|specials|marketplace|listing|for sale|trade)\b/.test(lower)) {
    suggestions.push({ claimType: "buy_sell_locally" as ClaimType, confidence: 0.72, evidence: "keyword: buy/sell signal" });
  }

  // Community
  if (/\b(community|neighborhood|local|connect|network|events|meet|group)\b/.test(lower)) {
    suggestions.push({ claimType: "community_participation" as ClaimType, confidence: 0.70, evidence: "keyword: community signal" });
  }

  // Provisional userTypes can add a vertical hint
  if (provisionalUserTypes.includes("contractor") || provisionalUserTypes.includes("service_provider")) {
    if (!suggestions.some((s) => s.claimType === "offer_services")) {
      suggestions.push({ claimType: "offer_services" as ClaimType, confidence: 0.65, evidence: "provisional userType: contractor/service_provider" });
    }
  }

  // Default fallback when no keywords matched
  if (suggestions.length === 0) {
    suggestions.push({ claimType: "exploring" as ClaimType, confidence: 0.55, evidence: "no strong keyword signals detected" });
  }

  // Cap at 5, sort by confidence desc
  const sorted = suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);

  return {
    suggestions: sorted,
    summary: `Keyword-based inference (LLM unavailable): ${sorted[0].claimType.replace(/_/g, " ")}.`,
    followups: sorted[0].confidence < 0.70 ? ["What would you like to do on TradeScout?"] : [],
  };
}

/**
 * Call OpenAI to infer claims from userIntent.
 * Falls back to deterministic keyword matching if the LLM times out (5 s)
 * or returns an unusable response.
 */
export async function inferClaimsFromIntent(
  userIntentText: string,
  provisionalUserTypes: string[] = [],
  countyName: string | null = null,
  profileDraft?: ProfileDraft
): Promise<ClaimInferenceOutput> {
  // ── Abort controller for timeout ──────────────────────────────────────────
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS);

  try {
    const userPrompt = buildUserPrompt(
      userIntentText,
      provisionalUserTypes,
      countyName,
      profileDraft
    );

    const response = await fetch("/api/ai/inference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: controller.signal,
      body: JSON.stringify({
        systemPrompt: SCOUT_INFERENCE_SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.3, // Low temperature for consistent structured output
        maxTokens: 500,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Inference API failed: ${response.status}`);
    }

    const result = await response.json();

    // Parse JSON from LLM response
    let inference: ClaimInferenceOutput;
    try {
      inference = typeof result.content === "string" ? JSON.parse(result.content) : result.content;
    } catch (parseError) {
      console.warn("[CLAIM_INFERENCE] Failed to parse LLM output — using keyword fallback:", result.content);
      return keywordFallbackInference(userIntentText, provisionalUserTypes);
    }

    // Validate structure
    if (!inference.suggestions || !Array.isArray(inference.suggestions)) {
      console.warn("[CLAIM_INFERENCE] Invalid inference output — using keyword fallback");
      return keywordFallbackInference(userIntentText, provisionalUserTypes);
    }

    // Cap at 5 suggestions
    if (inference.suggestions.length > 5) {
      inference.suggestions = inference.suggestions.slice(0, 5);
    }

    // Ensure followups is array
    if (!inference.followups) {
      inference.followups = [];
    }

    return inference;
  } catch (error) {
    clearTimeout(timeoutId);

    const isTimeout =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("aborted"));

    if (isTimeout) {
      console.warn(`[CLAIM_INFERENCE] LLM timed out after ${INFERENCE_TIMEOUT_MS}ms — using keyword fallback`);
    } else {
      console.error("[CLAIM_INFERENCE] Error during inference — using keyword fallback:", error);
    }

    // Always use keyword fallback so the user is never blocked
    return keywordFallbackInference(userIntentText, provisionalUserTypes);
  }
}

/**
 * Convert ClaimInferenceOutput to ClaimConfirmationOptions for UI
 */
export function buildConfirmationOptions(inference: ClaimInferenceOutput): Array<{
  id: string;
  claimType: ClaimType;
  label: string;
  description?: string;
  confidence: number;
  defaultChecked: boolean;
}> {
  const options = inference.suggestions.map((suggestion, index) => {
    // Import CLAIM_LABELS dynamically to avoid circular dependency
    const label = getClaimLabel(suggestion.claimType);

    return {
      id: `opt_${suggestion.claimType}`,
      claimType: suggestion.claimType,
      label,
      description: suggestion.evidence,
      confidence: suggestion.confidence,
      // Auto-check top 1-2 high confidence options
      defaultChecked: index < 2 && suggestion.confidence >= 0.7,
    };
  });

  return options;
}

/**
 * Get user-facing label for claim type
 * Duplicated from claimTypes.ts to avoid circular import
 */
function getClaimLabel(claimType: ClaimType): string {
  const labels: Record<ClaimType, string> = {
    exploring: "Just exploring",
    find_help: "Find contractors or services",
    offer_services: "Offer my services",
    represent_business: "Promote my business",
    buy_sell_locally: "Buy or sell locally",
    community_participation: "Participate in community",
    home_project: "Working on a home project",
    commercial_project: "Working on a commercial project",
    property_management: "Managing properties",
    emergency_service: "Need emergency service",
    design_planning: "Design or planning work",
    inspection_evaluation: "Inspection or appraisal",
    maintenance_recurring: "Ongoing maintenance",
    construction_trades: "Construction trades",
    food_business: "Food or restaurant business",
    hospitality: "Hospitality or events",
    real_estate: "Real estate",
    automotive: "Automotive",
    nonprofit: "Non-profit organization",
    technology_startup: "Tech startup",
    wants_recommendations: "Looking for trusted signals",
    gives_recommendations: "Share trusted signals",
    posts_deals: "Post deals or promotions",
    organizes_events: "Organize events",
    builds_community: "Build community",
    seeking_leads: "Find new customers",
    seeking_visibility: "Increase visibility",
    seeking_partnerships: "Find partnerships",
    seeking_tools: "Access business tools",
  };

  return labels[claimType] || claimType;
}
