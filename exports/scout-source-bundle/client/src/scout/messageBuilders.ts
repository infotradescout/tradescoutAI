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
  const lower = String(userMessage || "").toLowerCase();
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

  const signalCount = [prosSignals, marketplaceSignals, communitySignals].filter(Boolean).length;
  const keywordOnlyWithoutContext = signalCount > 0 && tokens.length <= 3 && !hasStrongIntentVerb;
  const lowConfidenceWithContext = signalCount > 0 && (signalCount > 1 || !hasStrongIntentVerb);

  const roofDomainAmbiguous =
    /\b(roof|roofing|roofer|roof repair|leak|leaky|shingle|gutters?)\b/.test(lower);
  const wantsPros = prosSignals;
  const wantsCommunity = communitySignals;
  const wantsMarketplace = marketplaceSignals;
  const prioritizePros = wantsPros || wantsMarketplace;
  const useAmbiguityBundle =
    roofDomainAmbiguous || keywordOnlyWithoutContext || lowConfidenceWithContext;

  const stayInScoutPrompt = useAmbiguityBundle
    ? roofDomainAmbiguous
      ? "Keep me in Scout and help me choose: should I hire a roofer, browse recent roofing materials, or check community signals first?"
      : "Keep me in Scout and help me choose: should I start with trusted local pros, recent marketplace listings, or community signals first?"
    : "Keep me in Scout and walk me through the best next action step-by-step without leaving this page.";

  const candidateActions: ScoutAction[] = [];

  candidateActions.push({
    type: "ASK_SCOUT",
    label: "Keep this in Scout",
    prompt: stayInScoutPrompt,
  });

  if (useAmbiguityBundle) {
    candidateActions.push(
      {
        type: "NAVIGATE",
        label: roofDomainAmbiguous ? "Find trusted roofing pros" : "Find trusted local pros",
        to: "/direct-connect/pros",
      },
      {
        type: "NAVIGATE",
        label: roofDomainAmbiguous
          ? "Browse recent roofing materials"
          : "Browse recent Exchange listings",
        to: payload.exchangeRoute || "/exchange",
      },
      {
        type: "NAVIGATE",
        label: roofDomainAmbiguous
          ? "Check recent community roofing signals"
          : "Check community signals",
        to: payload.communityRoute,
      }
    );
  }

  if (prioritizePros) {
    candidateActions.push({
      type: "NAVIGATE",
      label: "Browse local pros",
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
    { type: "NAVIGATE", label: "Open Direct Connect", to: "/direct-connect" },
    { type: "NAVIGATE", label: "Browse local pros", to: payload.contractorsRoute },
    { type: "NAVIGATE", label: "Open community", to: payload.communityRoute }
  );

  const seen = new Set<string>();
  let hasAskScout = false;
  const actions: ScoutAction[] = [];
  for (const action of candidateActions) {
    if (action.type === "NAVIGATE") {
      if (typeof action.to !== "string") continue;
      if (seen.has(action.to)) continue;
      seen.add(action.to);
      actions.push(action);
      if (actions.length >= 4) break;
      continue;
    }

    if (action.type === "ASK_SCOUT") {
      if (hasAskScout) continue;
      hasAskScout = true;
      actions.push(action);
      if (actions.length >= 4) break;
    }
  }

  const message: ScoutMessage = {
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    role: "assistant",
    content:
      "Scout had a connection issue. You can keep moving with trusted, recent options and take action now.",
    timestamp: new Date().toISOString(),
    clusters: [
      {
        id: `scout-fallback-${Date.now()}`,
        title: "Continue now",
        kind: "generic",
        body: "Pick a path below. Your next action helps Scout improve future routing for everyone.",
        actions,
      },
    ],
    suggestedActions: ["Retry my question", ...actions.map((a) => a.label || "Open")].slice(0, 4),
    contextRoles: meta?.contextRoles,
  };

  return { message, actions };
}
