import type { ScoutAction, ScoutMessage } from "./state";

type MessageMeta = {
  contextRoles?: string[];
};

type ExplicitNavPayload = {
  to: string;
  label: string;
};

export function buildExplicitNavigationMessage(
  payload: ExplicitNavPayload,
  meta?: MessageMeta
): ScoutMessage {
  return {
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    role: "assistant",
    content: `Got it - opening ${payload.label}.`,
    timestamp: new Date().toISOString(),
    clusters: [
      {
        id: "auto-route-explicit",
        title: `Open ${payload.label}`,
        kind: "generic",
        primaryAction: {
          type: "NAVIGATE",
          label: "Open",
          to: payload.to,
        },
      },
    ],
    navTarget: payload.to,
    memoryDelta: { lastIntent: "explicit_navigation" },
    contextRoles: meta?.contextRoles,
  };
}

type ConnectionFallbackPayload = {
  contractorsRoute: string;
  communityRoute: string;
  exchangeRoute?: string;
};

export function buildConnectionFallback(
  payload: ConnectionFallbackPayload,
  userMessage?: string,
  meta?: MessageMeta
): { message: ScoutMessage; actions: ScoutAction[] } {
  const routingHelpPath = "/help/how-tradescout-works#direct-connect-workflow";
  const lower = String(userMessage || "").toLowerCase();
  const wantsRoutingWorkflowHelp =
    /not\s+routed\s+yet/i.test(lower) ||
    (lower.includes("why") && lower.includes("routed")) ||
    (lower.includes("routing") && lower.includes("why"));
  const tokens = lower.split(/\s+/).filter(Boolean);
  const hasStrongIntentVerb =
    /\b(open|show|find|hire|buy|sell|post|route|connect|message|need|want|looking)\b/.test(lower);

  const prosSignals =
    /\b(contractor|contractors|pro|pros|provider|providers|plumber|electrician|roofer|roofing|roof|roof repair|hvac)\b/.test(
      lower
    );
  const marketplaceSignals =
    /\b(exchange|market|marketplace|buy|sell|listing|listings|for sale|materials?)\b/.test(lower);
  const communitySignals = /\b(community|neighbors|neighbour|feed|post|posts|group|event)\b/.test(
    lower
  );
  const homeProjectSignals =
    /\b(build|repair|replace|install|remodel|renovate|quote|estimate|project|addition|patio|porch|deck|decking|fence|roof|roofing|siding|concrete|driveway|kitchen|bathroom|plumbing|electrical|hvac|landscap(?:e|ing)|pool)\b/.test(
      lower
    );
  const deckSignals = /\b(deck|decking|porch|patio)\b/.test(lower);

  const signalCount = [prosSignals, marketplaceSignals, communitySignals].filter(Boolean).length;
  const keywordOnlyWithoutContext = signalCount > 0 && tokens.length <= 3 && !hasStrongIntentVerb;
  const lowConfidenceWithContext =
    signalCount > 0 && (signalCount > 1 || !hasStrongIntentVerb || homeProjectSignals);

  const roofDomainAmbiguous =
    /\b(roof|roofing|roofer|roof repair|leak|leaky|shingle|gutters?)\b/.test(lower);
  const wantsPros = prosSignals;
  const wantsCommunity = communitySignals;
  const wantsMarketplace = marketplaceSignals;
  const prioritizePros = wantsPros || wantsMarketplace;
  const useAmbiguityBundle =
    roofDomainAmbiguous ||
    deckSignals ||
    homeProjectSignals ||
    keywordOnlyWithoutContext ||
    lowConfidenceWithContext;

  const stayInScoutPrompt = useAmbiguityBundle
    ? roofDomainAmbiguous
      ? "Keep me in Scout and help me choose: should I hire a roofer, browse recent roofing materials, or check nearby posts first?"
      : deckSignals
        ? "Keep me in Scout and help me choose: should I plan the deck, look for deck builders, or check rental equipment first?"
        : "Keep me in Scout and help me choose: should I start with trusted local help, recent listings, or nearby posts first?"
    : "Keep me in Scout and walk me through the best next action step-by-step without leaving this page.";

  const candidateActions: ScoutAction[] = [];

  candidateActions.push({
    type: "ASK_SCOUT",
    label: "Keep this in Scout",
    prompt: stayInScoutPrompt,
  });
  if (wantsRoutingWorkflowHelp) {
    candidateActions.push({
      type: "NAVIGATE",
      label: "See how requests are shared",
      to: routingHelpPath,
    });
  }

  if (useAmbiguityBundle) {
    candidateActions.push(
      {
        type: "NAVIGATE",
        label: deckSignals ? "Plan this project" : "Plan this project",
        to: "/project-tracker",
      },
      {
        type: "NAVIGATE",
        label: roofDomainAmbiguous
          ? "Find trusted roofing pros"
          : deckSignals
            ? "Find deck builders"
            : "Find trusted local help",
        to: "/direct-connect/pros",
      },
      {
        type: "NAVIGATE",
        label: roofDomainAmbiguous
          ? "Browse recent roofing materials"
          : deckSignals
            ? "Browse rental equipment"
            : "Browse recent Exchange listings",
        to: deckSignals ? "/exchange/rental-equipment" : payload.exchangeRoute || "/exchange",
      },
      {
        type: "NAVIGATE",
        label: roofDomainAmbiguous
          ? "Check recent roofing posts"
          : deckSignals
            ? "Check local deck posts"
            : "Check nearby posts",
        to: payload.communityRoute,
      }
    );
  }

  if (prioritizePros) {
    candidateActions.push({
      type: "NAVIGATE",
      label: "Browse local help",
      to: "/direct-connect/pros",
    });
  }

  if (wantsMarketplace) {
    candidateActions.push({
      type: "NAVIGATE",
      label: "Open Exchange",
      to: payload.exchangeRoute || "/exchange",
    });
  }

  if (wantsCommunity) {
    candidateActions.push({
      type: "NAVIGATE",
      label: "Open community",
      to: payload.communityRoute,
    });
  }

  candidateActions.push(
    { type: "NAVIGATE", label: "Open saved requests", to: "/direct-connect" },
    { type: "NAVIGATE", label: "Browse local help", to: payload.contractorsRoute },
    { type: "NAVIGATE", label: "Open community", to: payload.communityRoute }
  );

  const seen = new Set<string>();
  let hasAskScout = false;
  const actions: ScoutAction[] = [];
  const maxActions = useAmbiguityBundle ? 5 : 4;
  for (const action of candidateActions) {
    if (action.type === "NAVIGATE") {
      if (typeof action.to !== "string") continue;
      if (seen.has(action.to)) continue;
      seen.add(action.to);
      actions.push(action);
      if (actions.length >= maxActions) break;
      continue;
    }

    if (action.type === "ASK_SCOUT") {
      if (hasAskScout) continue;
      hasAskScout = true;
      actions.push(action);
      if (actions.length >= maxActions) break;
    }
  }

  const message: ScoutMessage = {
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    role: "assistant",
    content: deckSignals
      ? "Got it. For a deck project, start by planning the scope, budget, and timing. Then compare local builders or check rental equipment and nearby posts. Which result should we open first?"
      : homeProjectSignals
        ? "Got it. Start by planning the scope, budget, and timing. Then compare trusted local help and nearby options. Which result should we open first?"
        : "Scout had a connection issue. You can still keep moving. Pick one of these results or try the search again.",
    timestamp: new Date().toISOString(),
    clusters: [
      {
        id: `scout-fallback-${Date.now()}`,
        title: "Continue now",
        kind: "generic",
        body: deckSignals
          ? "Start with project planning, deck builders, rental equipment, or nearby posts."
          : homeProjectSignals
            ? "Start with project planning, local help, Exchange, or nearby posts."
            : "Pick a result below. Scout can open it or keep searching.",
        actions,
      },
    ],
    suggestedActions: ["Retry my question", ...actions.map((a) => a.label || "Open")].slice(0, 4),
    contextRoles: meta?.contextRoles,
  };

  return { message, actions };
}
