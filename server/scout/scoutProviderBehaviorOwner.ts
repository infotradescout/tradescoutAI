type ProviderBehaviorAction = {
  type: string;
  path?: string;
  to?: string;
  prompt?: string;
  label: string;
  subtitle?: string;
  why?: string;
  primary?: boolean;
  payload?: Record<string, unknown>;
};

type ApplyProviderBehaviorInput = {
  actions: ProviderBehaviorAction[];
  intentCategory?: string;
  intentSlug?: string;
  message: string;
  countyCode?: string;
  stateCode?: string;
  confidenceBand: "high" | "medium" | "low";
};

type PrefilledDirectConnectRequest = {
  jobType: string;
  location: string;
  scope: string;
  urgency: "emergency" | "high" | "normal";
  sizeRange?: string;
  budgetTier?: "budget" | "standard" | "premium";
  intentTier?: "budget" | "standard" | "premium";
};

function detectJobType(message: string): string {
  const lower = message.toLowerCase();
  if (/(deck|patio|pergola)/.test(lower)) return "deck_build";
  if (/(plumb|pipe|drain|toilet|faucet|leak)/.test(lower)) return "plumbing";
  if (/(electri|panel|breaker|outlet|wiring|light)/.test(lower)) return "electrical";
  if (/(hvac|ac\b|air\s*condition|furnace|heat\b|vent)/.test(lower)) return "hvac";
  if (/(roof|shingle|gutter|flashing)/.test(lower)) return "roofing";
  if (/(paint|drywall|texture|interior|exterior\s+wall)/.test(lower)) return "painting";
  if (/(floor|tile|carpet|vinyl|laminate|hardwood)/.test(lower)) return "flooring";
  if (/(kitchen|bathroom|remodel|renovat)/.test(lower)) return "remodeling";
  return "general_home_service";
}

function detectSizeRange(message: string): string | undefined {
  const lower = message.toLowerCase();
  const dim = message.match(/\b\d{1,3}\s*(?:x|by)\s*\d{1,3}\b/i);
  if (dim?.[0]) return dim[0].replace(/\s+/g, " ");
  const sqft = message.match(/\b\d{2,5}\s*(?:sq\.?\s*ft|square\s*feet?)\b/i);
  if (sqft?.[0]) return sqft[0].replace(/\s+/g, " ");
  if (/small|compact/.test(lower)) return "small";
  if (/medium|mid[-\s]?size/.test(lower)) return "medium";
  if (/large|big|oversized/.test(lower)) return "large";
  return undefined;
}

function detectIntentTier(message: string): "budget" | "standard" | "premium" | undefined {
  const lower = message.toLowerCase();
  if (/budget|cheap|afford|lowest|economy/.test(lower)) return "budget";
  if (/premium|high[-\s]?end|luxury|custom/.test(lower)) return "premium";
  if (/standard|mid[-\s]?range|balanced/.test(lower)) return "standard";
  return undefined;
}

function detectBudgetTier(message: string): "budget" | "standard" | "premium" | undefined {
  const amountMatch = message.match(/\$\s?(\d{2,6})/);
  if (amountMatch?.[1]) {
    const amount = Number(amountMatch[1]);
    if (Number.isFinite(amount)) {
      if (amount < 3000) return "budget";
      if (amount >= 10000) return "premium";
      return "standard";
    }
  }
  return detectIntentTier(message);
}

function isBroadProjectIntent(message: string): boolean {
  const lower = message.toLowerCase();
  if (/(leak|broken|not working|sparking|flood|emergency|urgent|repair)/.test(lower)) {
    return false;
  }
  return /(build|install|replace|renovat|remodel|add|create|design|plan)/.test(lower);
}

function isRefusalToIntake(message: string): boolean {
  return /(just show|just browse|skip|not sure|don't know|dont know|no idea|whatever|you decide)/i.test(
    message
  );
}

function buildClarificationPrompt(input: ApplyProviderBehaviorInput, missing: string[]): string {
  const jobType = detectJobType(input.message);
  const lead = "Got it - let's narrow this down so I can guide you right.";
  const questions: string[] = [];

  if (jobType === "deck_build" && missing.includes("intentTier")) {
    questions.push("Is this a ground-level or raised deck?");
  }
  if (missing.includes("sizeRange")) {
    questions.push("Rough size (even a guess helps)?");
  }
  if (missing.includes("budgetTier") || missing.includes("intentTier")) {
    questions.push("What budget range or tier fits best: budget, standard, or premium?");
  }

  const progressive = questions.slice(0, 2);
  return progressive.length > 0 ? `${lead}\n\n${progressive.join("\n")}` : lead;
}

function detectUrgency(message: string): "emergency" | "high" | "normal" {
  const lower = message.toLowerCase();
  if (/(emergency|urgent|right now|immediately|flood|sparking|gas leak)/.test(lower)) {
    return "emergency";
  }
  if (/(today|asap|soon|this week)/.test(lower)) {
    return "high";
  }
  return "normal";
}

function buildScope(message: string): string {
  const collapsed = message.replace(/\s+/g, " ").trim();
  if (!collapsed) return "Need help with a home project";
  return collapsed.length > 180 ? `${collapsed.slice(0, 177)}...` : collapsed;
}

function buildLocation(countyCode?: string, stateCode?: string): string {
  const county = typeof countyCode === "string" && countyCode.trim() ? countyCode.trim() : "";
  const state = typeof stateCode === "string" && stateCode.trim() ? stateCode.trim() : "";
  if (county && state) return `${county}, ${state}`;
  if (state) return state;
  return "local area";
}

function buildPrefilledRequest(input: ApplyProviderBehaviorInput): PrefilledDirectConnectRequest {
  const sizeRange = detectSizeRange(input.message);
  const budgetTier = detectBudgetTier(input.message);
  const intentTier = detectIntentTier(input.message);

  return {
    jobType: detectJobType(input.message),
    location: buildLocation(input.countyCode, input.stateCode),
    scope: buildScope(input.message),
    urgency: detectUrgency(input.message),
    ...(sizeRange ? { sizeRange } : {}),
    ...(budgetTier ? { budgetTier } : {}),
    ...(intentTier ? { intentTier } : {}),
  };
}

export function applyProviderBehaviorOwnership(
  input: ApplyProviderBehaviorInput
): ProviderBehaviorAction[] {
  const nextActions = Array.isArray(input.actions) ? input.actions.slice() : [];

  const shouldPairHireDIY =
    input.intentCategory === "how_to" || input.intentCategory === "provider_search";

  if (!shouldPairHireDIY) {
    return nextActions;
  }

  const prefilledRequest = buildPrefilledRequest(input);
  const requiresClarification =
    isBroadProjectIntent(input.message) &&
    (!prefilledRequest.sizeRange || (!prefilledRequest.budgetTier && !prefilledRequest.intentTier));

  if (requiresClarification) {
    const missing = [
      !prefilledRequest.sizeRange ? "sizeRange" : null,
      !prefilledRequest.budgetTier ? "budgetTier" : null,
      !prefilledRequest.intentTier ? "intentTier" : null,
    ].filter(Boolean) as string[];

    if (isRefusalToIntake(input.message)) {
      const deckLabel = prefilledRequest.jobType === "deck_build";
      return [
        {
          type: "NAVIGATE",
          to: "/community-feed",
          path: "/community-feed",
          label: "Explore local examples",
          subtitle: "See nearby project conversations first",
          why: "Fallback after intake refusal",
          primary: true,
        },
        {
          type: "NAVIGATE",
          to: deckLabel ? "/exchange?tab=sell" : "/direct-connect/pros",
          path: deckLabel ? "/exchange?tab=sell" : "/direct-connect/pros",
          label: deckLabel ? "Browse deck builds nearby" : "Browse similar local builds",
          subtitle: "Review examples before continuing intake",
          why: "Fallback browsing path",
          primary: false,
        },
      ];
    }

    return [
      {
        type: "ASK_SCOUT",
        label: "Continue intake",
        prompt: buildClarificationPrompt(input, missing),
        subtitle: "Two quick details unlock your best path",
        why: "Clarification mode for broad request",
        primary: true,
        payload: {
          target: "direct_connect_request",
          clarificationMode: true,
          intakeRequiredFields: ["jobType", "sizeRange", "budgetTier_or_intentTier"],
          missingFields: missing,
          source: "provider_outcome_engine",
        },
      },
    ];
  }

  if (input.confidenceBand === "low") {
    return [
      {
        type: "ASK_SCOUT",
        label: "Clarify project details first",
        prompt:
          "Tell me the trade type, urgency, and scope details. I will prefill a Direct Connect request in one step.",
        subtitle: "Need one quick clarification",
        why: "Low confidence provider intent",
        primary: true,
        payload: {
          target: "direct_connect_request",
          route: "/direct-connect",
          prefill: prefilledRequest,
          confirmRequiredFields: ["jobType", "urgency", "location", "scope"],
          source: "provider_outcome_engine",
          confidenceBand: "low",
        },
      },
      ...nextActions,
    ];
  }
  const confirmRequiredFields =
    input.confidenceBand === "medium" ? ["jobType", "urgency", "location"] : [];

  const hireAction: ProviderBehaviorAction = {
    type: "PREFILL_INPUT",
    path: "/direct-connect",
    to: "/direct-connect",
    label: "Start Direct Connect request",
    subtitle: "Prefilled job type, scope, urgency, and location",
    why: "One tap to open a ready-to-submit request",
    primary: true,
    payload: {
      target: "direct_connect_request",
      route: "/direct-connect",
      prefill: {
        ...prefilledRequest,
        source: "provider_outcome_engine",
        intentCategory: input.intentCategory,
        intentSlug: input.intentSlug,
      },
      confidenceBand: input.confidenceBand,
      ...(confirmRequiredFields.length > 0 ? { confirmRequiredFields } : {}),
    },
  };

  const slug =
    typeof input.intentSlug === "string" && input.intentSlug.trim() ? input.intentSlug : "how-to";

  const diyAction: ProviderBehaviorAction = {
    type: "NAVIGATE",
    path: `/learn/${slug}`,
    to: `/learn/${slug}`,
    label: "Use DIY plan with this scope",
    subtitle: "DIY steps and safety tips",
    why: "Keeps the same project context if you choose self-service",
    primary: false,
    payload: {
      context: {
        source: "provider_outcome_engine",
        prefill: prefilledRequest,
      },
    },
  };

  return [hireAction, diyAction, ...nextActions];
}
