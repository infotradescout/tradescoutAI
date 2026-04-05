type ProviderBehaviorAction = {
  type: string;
  path?: string;
  to?: string;
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
};

type PrefilledDirectConnectRequest = {
  jobType: string;
  location: string;
  scope: string;
  urgency: "emergency" | "high" | "normal";
};

function detectJobType(message: string): string {
  const lower = message.toLowerCase();
  if (/(plumb|pipe|drain|toilet|faucet|leak)/.test(lower)) return "plumbing";
  if (/(electri|panel|breaker|outlet|wiring|light)/.test(lower)) return "electrical";
  if (/(hvac|ac\b|air\s*condition|furnace|heat\b|vent)/.test(lower)) return "hvac";
  if (/(roof|shingle|gutter|flashing)/.test(lower)) return "roofing";
  if (/(paint|drywall|texture|interior|exterior\s+wall)/.test(lower)) return "painting";
  if (/(floor|tile|carpet|vinyl|laminate|hardwood)/.test(lower)) return "flooring";
  if (/(kitchen|bathroom|remodel|renovat)/.test(lower)) return "remodeling";
  return "general_home_service";
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
  return {
    jobType: detectJobType(input.message),
    location: buildLocation(input.countyCode, input.stateCode),
    scope: buildScope(input.message),
    urgency: detectUrgency(input.message),
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
