type PolishResult = {
  message: string;
  changed: boolean;
  reason?: string;
};

const GENERIC_LOCAL_HELP_RE =
  /\b(find|show|look for|need)\b[\s\S]{0,80}\b(local help|best options|who can help|contractor|pro|service)\b/i;

const TRADE_OR_PROJECT_RE =
  /\b(ac|hvac|plumb|electric|roof|deck|fence|concrete|driveway|remodel|repair|replace|install|build|project|contractor|pro|service|handyman)\b/i;

const OFF_INTENT_ASSISTANCE_RE =
  /\b(211\s+louisiana|tcap|housing assistance|utility assistance|emergency assistance|free referrals)\b/i;

const INTERNAL_OR_WEAK_RE =
  /\b(verified live results|i can(?:not|'t) browse|i do not have enough verified|i don't have enough verified|fallback|source layer|route this|routing)\b/i;

const UNSUPPORTED_ACTION_CLAIM_RE =
  /\b(i(?:['’]ve\s+|\s+have\s+|\s+)(?:booked|ordered|paid|messaged|contacted|published|posted|sent|invoiced|quoted)|scout(?:\s+has\s+|\s+)(?:booked|ordered|paid|messaged|contacted|published|posted|sent|invoiced|quoted))\b/i;

const FORM_TRAP_RE =
  /\b(?:must|need to|required to)\s+(?:complete|fill out|finish)\s+(?:the\s+)?(?:entire|full|whole)?\s*form\b[\s\S]{0,80}\b(?:before|first)\b/i;

const LEAD_SELLING_OR_PAID_RANK_RE =
  /\b(?:sell(?:ing)?\s+(?:your\s+)?lead|sold\s+(?:your\s+)?lead|lead\s+(?:sold|resold)|highest\s+bidder|paid\s+(?:placement|ranking|rank|exposure)|pay(?:s|ing)?\s+to\s+rank|sponsored\s+(?:pro|provider|contractor|placement|ranking)|premium\s+(?:pro|provider|contractor)\s+(?:rank|placement|slot))\b/i;

const APPROVAL_BOUNDARY =
  "You stay in control: nothing is booked, ordered, paid, messaged, posted, quoted, or invoiced unless you approve it first.";

function stripUnsupportedActionClaims(message: string): {
  sanitized: string;
  hadClaim: boolean;
} {
  if (!UNSUPPORTED_ACTION_CLAIM_RE.test(message)) {
    return { sanitized: message, hadClaim: false };
  }

  const sanitized = "I can help prepare that action.";

  return { sanitized, hadClaim: true };
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function trimAtBrokenTail(value: string): string {
  return value
    .replace(/\s+(?:from|with|at|on|in)\s+w\.\.\.$/i, "")
    .replace(/\.\.\.$/, ".")
    .trim();
}

function inferNeedLabel(request: string): string {
  const lower = request.toLowerCase();
  if (/\b(ac|hvac|air conditioning|heating)\b/.test(lower)) return "AC or heating";
  if (/\bplumb/.test(lower)) return "plumbing";
  if (/\belectric/.test(lower)) return "electrical";
  if (/\broof/.test(lower)) return "roofing";
  if (/\bdeck/.test(lower)) return "deck";
  if (/\bfence/.test(lower)) return "fencing";
  if (/\bconcrete|driveway\b/.test(lower)) return "concrete";
  if (/\bvehicle|car|truck|trailer\b/.test(lower)) return "vehicle";
  if (/\bmaterial|supplier|lumber|parts?\b/.test(lower)) return "materials";
  return "local help";
}

function buildPracticalLocalHelpMessage(request: string): string {
  const need = inferNeedLabel(request);
  return compact(
    `I’m treating this as a ${need} need. The best paths are to create a request, browse local help, or compare what to ask before contacting anyone. Nothing is sent, posted, or shared until you approve it.`
  );
}

function buildCompetitivePatternFallback(request: string): string {
  const need = inferNeedLabel(request);
  return compact(
    `I’m treating this as a ${need} need. You can keep going in chat or open a draft request, and I’ll only ask for the details needed for the next step. TradeScout does not sell leads or rank providers because they paid. Nothing is sent, booked, ordered, paid, posted, quoted, or invoiced unless you approve it first.`
  );
}

export function polishScoutLaunchResponse(
  requestMessage: string | null | undefined,
  raw: string
): PolishResult {
  const request = compact(String(requestMessage || ""));
  const message = trimAtBrokenTail(compact(raw));
  if (!message) return { message, changed: false };

  const wantsLocalHelp = GENERIC_LOCAL_HELP_RE.test(request) || TRADE_OR_PROJECT_RE.test(request);
  const offIntentAssistance =
    OFF_INTENT_ASSISTANCE_RE.test(message) &&
    !/\b(housing|utility|utilities|emergency|assistance|food|shelter|rent)\b/i.test(request);

  if (wantsLocalHelp && offIntentAssistance) {
    return {
      message: buildPracticalLocalHelpMessage(request),
      changed: true,
      reason: "off_intent_assistance_referral",
    };
  }

  if (wantsLocalHelp && INTERNAL_OR_WEAK_RE.test(message)) {
    return {
      message: buildPracticalLocalHelpMessage(request),
      changed: true,
      reason: "weak_or_internal_local_help_response",
    };
  }

  if (FORM_TRAP_RE.test(message) || LEAD_SELLING_OR_PAID_RANK_RE.test(message)) {
    return {
      message: buildCompetitivePatternFallback(request),
      changed: true,
      reason: "competitive_pattern_guard",
    };
  }

  const unsupportedAction = stripUnsupportedActionClaims(message);

  if (unsupportedAction.hadClaim) {
    const nextMessage = unsupportedAction.sanitized.includes(APPROVAL_BOUNDARY)
      ? unsupportedAction.sanitized
      : `${unsupportedAction.sanitized} ${APPROVAL_BOUNDARY}`;

    return {
      message: compact(nextMessage),
      changed: true,
      reason: "approval_boundary_added",
    };
  }

  if (message !== raw.trim()) {
    return { message, changed: true, reason: "trimmed_broken_tail" };
  }

  return { message, changed: false };
}
