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
  /\b(i\s+(?:booked|ordered|paid|messaged|contacted|published|posted|sent|invoiced|quoted)|scout\s+(?:booked|ordered|paid|messaged|contacted|published|posted|sent|invoiced|quoted))\b/i;

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

  if (UNSUPPORTED_ACTION_CLAIM_RE.test(message)) {
    return {
      message: `${message} You stay in control: nothing is booked, ordered, paid, messaged, posted, quoted, or invoiced unless you approve it first.`,
      changed: true,
      reason: "approval_boundary_added",
    };
  }

  if (message !== raw.trim()) {
    return { message, changed: true, reason: "trimmed_broken_tail" };
  }

  return { message, changed: false };
}
