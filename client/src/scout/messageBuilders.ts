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
};

export function buildConnectionFallback(
  payload: ConnectionFallbackPayload,
  meta?: MessageMeta
): { message: ScoutMessage; actions: ScoutAction[] } {
  const actions: ScoutAction[] = [
    { type: "NAVIGATE", label: "Open Direct Connect", to: "/direct-connect" },
    { type: "NAVIGATE", label: "Browse local pros", to: payload.contractorsRoute },
    { type: "NAVIGATE", label: "Open community", to: payload.communityRoute },
  ];

  const message: ScoutMessage = {
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    role: "assistant",
    content:
      "Scout hit a connection issue, but you can still move forward right now with these routes.",
    timestamp: new Date().toISOString(),
    clusters: [
      {
        id: `scout-fallback-${Date.now()}`,
        title: "Continue without interruption",
        kind: "generic",
        body: "You can post a request, browse local professionals, or continue in community while Scout reconnects.",
        actions,
      },
    ],
    suggestedActions: ["Open Direct Connect", "Browse local pros", "Retry my question"],
    contextRoles: meta?.contextRoles,
  };

  return { message, actions };
}
