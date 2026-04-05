export type DecisionPipelineBehaviorKey =
  | "provider_routing"
  | "community_routing"
  | "marketplace_routing"
  | "contractor_search_routing"
  | "support_routing";

type BuildDecisionPipelineBehaviorResponseInput = {
  behaviorKey: string;
  message: string;
  countyCode?: string;
  stateCode?: string;
};

type BehaviorResponse = {
  message: string;
  suggestedActions: string[];
  actions: Array<{
    type: "NAVIGATE";
    label: string;
    to: string;
    path: string;
    primary?: boolean;
    subtitle?: string;
    why?: string;
  }>;
  metadata: Record<string, unknown>;
};

function formatLocality(countyCode?: string, stateCode?: string): string {
  if (countyCode && stateCode) return `${countyCode}, ${stateCode}`;
  if (countyCode) return countyCode;
  if (stateCode) return stateCode;
  return "your area";
}

export function buildDecisionPipelineBehaviorResponse(
  input: BuildDecisionPipelineBehaviorResponseInput
): BehaviorResponse | null {
  const lower = input.message.toLowerCase();
  const locality = formatLocality(input.countyCode, input.stateCode);

  const baseMetadata = {
    behaviorKey: input.behaviorKey,
    sourceUsed: "decision_pipeline_behavior_handler",
  };

  if (input.behaviorKey === "provider_routing") {
    return {
      message: `I will route this through provider setup for ${locality} so eligibility and standing rules stay consistent.`,
      suggestedActions: ["Open provider setup", "Check provider standing"],
      actions: [
        {
          type: "NAVIGATE",
          label: "Open provider setup",
          to: "/offer-services",
          path: "/offer-services",
          primary: true,
          subtitle: "Provider authority path",
          why: "Keeps promotion and standing decisions on the canonical provider flow.",
        },
      ],
      metadata: baseMetadata,
    };
  }

  if (input.behaviorKey === "community_routing") {
    const defaultPath = /post|announce|share|compose/i.test(lower)
      ? "/community?compose=1"
      : "/community?tab=for-you";

    return {
      message: `I will route this through community tools for ${locality} so posting and visibility stay in the governed path.`,
      suggestedActions: ["Open community", "Draft community post"],
      actions: [
        {
          type: "NAVIGATE",
          label: defaultPath.includes("compose=1") ? "Open community composer" : "Open community",
          to: defaultPath,
          path: defaultPath,
          primary: true,
          subtitle: "Community authority path",
          why: "Uses county-scoped community flows instead of ad-hoc routing.",
        },
      ],
      metadata: baseMetadata,
    };
  }

  if (input.behaviorKey === "marketplace_routing") {
    const exchangePath = /sell|list|post|for sale/i.test(lower)
      ? "/exchange?tab=sell"
      : "/exchange";
    return {
      message:
        "I will route this through Exchange so listing/search behavior stays consistent with marketplace policy.",
      suggestedActions: ["Open Exchange", "Open sell flow"],
      actions: [
        {
          type: "NAVIGATE",
          label: exchangePath.includes("tab=sell") ? "Open Exchange sell flow" : "Open Exchange",
          to: exchangePath,
          path: exchangePath,
          primary: true,
          subtitle: "Marketplace authority path",
          why: "Maintains canonical listing/search workflow and moderation controls.",
        },
      ],
      metadata: baseMetadata,
    };
  }

  if (input.behaviorKey === "contractor_search_routing") {
    return {
      message:
        "I will route this through Direct Connect so contractor discovery and contact gating stay trusted.",
      suggestedActions: ["Open Direct Connect", "Start local request"],
      actions: [
        {
          type: "NAVIGATE",
          label: "Open Direct Connect",
          to: "/direct-connect",
          path: "/direct-connect",
          primary: true,
          subtitle: "Discovery to action path",
          why: "Preserves Scout-mediated discovery to contact governance.",
        },
      ],
      metadata: baseMetadata,
    };
  }

  if (input.behaviorKey === "support_routing") {
    return {
      message:
        "I will route this through Support Tickets so follow-up remains tracked and accountable.",
      suggestedActions: ["Open support tickets", "Open help center"],
      actions: [
        {
          type: "NAVIGATE",
          label: "Open support tickets",
          to: "/support-tickets",
          path: "/support-tickets",
          primary: true,
          subtitle: "Support authority path",
          why: "Keeps support handling auditable and avoids dead-end guidance.",
        },
      ],
      metadata: baseMetadata,
    };
  }

  return null;
}
