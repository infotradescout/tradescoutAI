export type KnowledgeMode = "kb_only" | "kb_then_site" | "kb_site_then_web";

const ONBOARDING_IDENTITY_PATTERNS: RegExp[] = [
  /\bwhat\s+is\s+tradescout\b/i,
  /\bexplain\s+tradescout\b/i,
  /\btradescout\s+for\s+dummies\b/i,
  /\bhelp\s+me\s+get\s+started\b/i,
  /\bstart\s+onboarding\b/i,
  /\bonboard\s+me\b/i,
  /\bwhat\s+should\s+i\s+do\s+first\b/i,
  /\bwhat\s+can\s+scout\s+do\b/i,
  /\bhow\s+does\s+this\s+work\b/i,
];

const BRAND_HIJACK_PATTERNS: RegExp[] = [
  /\bCME\b/i,
  /\bCME\s+Group\b/i,
  /\bfutures?\s+trading\b/i,
  /\bflight\s+simulator\s+for\s+financial\s+markets\b/i,
  /\bTrade\s*Scout\s+by\s+CME\s*Group\b/i,
  /\bTrade\s*Scout\s+by\s+.*\b/i,
  /\bscout\.com\b/i,
  /\b247sports\b/i,
  /\bcollege\s+athletic\s+recruiting\b/i,
  /\bathletic\s+recruiting\b/i,
  /\bformerly\s+known\s+as\s+scout\.com\b/i,
  /\bassuming\s+this\s+context\b/i,
];

const EXTERNAL_SCOUT_REFERENCE_PATTERNS: RegExp[] = [
  /\bscout\.com\b/i,
  /\b247sports\b/i,
  /\bcollege\s+athletic\s+recruiting\b/i,
  /\bathletic\s+recruiting\b/i,
  /\bsports\s+recruiting\b/i,
];

const FORBIDDEN_SELF_REFERENCE_PATTERNS: RegExp[] = [
  /\bas\s+an\s+ai\b/i,
  /\bi\s+was\s+trained\s+on\b/i,
  /\bmy\s+model\b/i,
  /\b(open\s+web|from\s+the\s+open\s+web)\b/i,
  /\bi\s+am\s+designed\s+to\b/i,
  /\bi['’]m\s+designed\s+to\b/i,
];

export function isOnboardingOrIdentityQuery(userText: string): boolean {
  const t = (userText || "").trim();
  if (!t) return false;
  return ONBOARDING_IDENTITY_PATTERNS.some((re) => re.test(t));
}

export function chooseKnowledgeMode(userText: string): KnowledgeMode {
  // Identity/onboarding is ALWAYS internal. No web.
  if (isOnboardingOrIdentityQuery(userText)) return "kb_then_site";
  return "kb_site_then_web";
}

export function isBrandHijackResponse(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  return BRAND_HIJACK_PATTERNS.some((re) => re.test(t));
}

export function violatesSelfReferenceRules(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  return FORBIDDEN_SELF_REFERENCE_PATTERNS.some((re) => re.test(t));
}

export function shouldOverrideResponse(text: string): boolean {
  return isBrandHijackResponse(text) || violatesSelfReferenceRules(text);
}

export function hasExplicitExternalScoutReference(userText: string): boolean {
  const t = (userText || "").trim();
  if (!t) return false;
  return EXTERNAL_SCOUT_REFERENCE_PATTERNS.some((re) => re.test(t));
}

export const TRADE_SCOUT_IDENTITY_FALLBACK_MESSAGE =
  "I'm Scout. Tell me what you need done, and I'll route the next step.";

export function enforceTradeScoutIdentityBoundary(
  userText: string,
  candidateText: string,
  fallbackMessage = TRADE_SCOUT_IDENTITY_FALLBACK_MESSAGE
): { text: string; overridden: boolean } {
  const response = (candidateText || "").trim();
  if (!response) return { text: fallbackMessage, overridden: true };

  // If user explicitly asked about an external product, do not overwrite.
  if (hasExplicitExternalScoutReference(userText)) {
    return { text: response, overridden: false };
  }

  if (shouldOverrideResponse(response) || BRAND_HIJACK_PATTERNS.some((re) => re.test(response))) {
    return { text: fallbackMessage, overridden: true };
  }

  return { text: response, overridden: false };
}
