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
  const wantsPros =
    /\b(contractor|contractors|pro|pros|provider|providers|plumber|electrician|roof)\b/.test(lower);
  const wantsCommunity = /\b(community|neighbors|neighbour|feed|post|posts|group|event)\b/.test(
    lower
  );
  const wantsMarketplace =
    /\b(exchange|market|marketplace|buy|sell|listing|listings|for sale)\b/.test(lower);

  const candidateActions: ScoutAction[] = [];

  if (wantsPros) {
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
  const actions: ScoutAction[] = [];
  for (const action of candidateActions) {
    if (action.type !== "NAVIGATE" || typeof action.to !== "string") continue;
    if (seen.has(action.to)) continue;
    seen.add(action.to);
    actions.push(action);
    if (actions.length >= 4) break;
  }

  const message: ScoutMessage = {
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    role: "assistant",
    content: "Scout had a connection issue. You can keep moving with these next steps.",
    timestamp: new Date().toISOString(),
    clusters: [
      {
        id: `scout-fallback-${Date.now()}`,
        title: "Continue now",
        kind: "generic",
        body: "Open the best matching page below while Scout reconnects.",
        actions,
      },
    ],
    suggestedActions: ["Retry my question", ...actions.map((a) => a.label || "Open")].slice(0, 4),
    contextRoles: meta?.contextRoles,
  };

  return { message, actions };
}
