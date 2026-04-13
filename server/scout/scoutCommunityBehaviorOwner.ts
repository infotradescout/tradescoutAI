type CommunityBehaviorAction = {
  type: string;
  label: string;
  prompt?: string;
  to?: string;
  path?: string;
  subtitle?: string;
  why?: string;
  primary?: boolean;
  payload?: Record<string, unknown>;
};

type ApplyCommunityBehaviorInput = {
  userId?: string;
  message: string;
  responseMessage: string;
  actions: CommunityBehaviorAction[];
  canPostInCommunity: boolean;
  communityPostCount: number;
  lowConfidenceForLocal: boolean;
  communityPrefill: string;
  countyCode?: string;
  confidenceBand: "high" | "medium" | "low";
  wantsWelcomeDraft: boolean;
  welcomeDraft?: string;
};

type ApplyCommunityBehaviorResult = {
  message: string;
  actions: CommunityBehaviorAction[];
};

function detectCommunityQuestionIntent(lower: string): boolean {
  return (
    /who\s*(?:'s| is)\s*a?\s*good\s+contractor/.test(lower) ||
    lower.startsWith("has anyone dealt with") ||
    lower.includes("has anyone dealt with") ||
    lower.startsWith("what's going on with") ||
    lower.startsWith("whats going on with") ||
    lower.includes("what's going on with") ||
    lower.includes("whats going on with") ||
    lower.includes("is this normal in my area") ||
    (lower.includes("neighbors") &&
      (lower.includes("recommend") || lower.includes("used") || lower.includes("worked with")))
  );
}

function detectCommunityCategory(lower: string): "question" | "recommendation" | "alert" {
  if (/(warning|scam|urgent|alert|watch out|unsafe|fraud)/.test(lower)) return "alert";
  if (/(recommend|referral|who should i hire|any good|trusted)/.test(lower)) {
    return "recommendation";
  }
  return "question";
}

function buildCommunityDraftTitle(
  message: string,
  category: "question" | "recommendation" | "alert"
): string {
  const trimmed = message.replace(/\s+/g, " ").trim();
  const stripped = trimmed.replace(/[?.!]+$/, "");
  const base = stripped.length > 80 ? `${stripped.slice(0, 77)}...` : stripped;
  if (base.length > 0) {
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  if (category === "alert") return "Neighborhood alert";
  if (category === "recommendation") return "Looking for trusted local recommendations";
  return "Question for my county community";
}

function buildCommunityDraftBody(input: ApplyCommunityBehaviorInput): string {
  if (input.wantsWelcomeDraft && input.welcomeDraft) {
    return input.welcomeDraft.trim();
  }

  const preferred = input.communityPrefill?.trim();
  if (preferred) return preferred;

  const fallback = input.message.replace(/\s+/g, " ").trim();
  return fallback || "Sharing this with my county community for practical guidance.";
}

export function applyCommunityBehaviorOwnership(
  input: ApplyCommunityBehaviorInput
): ApplyCommunityBehaviorResult {
  const lower = input.message.toLowerCase();
  const nextMessage = input.responseMessage;
  const nextActions = Array.isArray(input.actions) ? input.actions.slice() : [];

  if (!input.userId || !input.canPostInCommunity) {
    return {
      message: nextMessage,
      actions: nextActions,
    };
  }

  const intentDetected =
    detectCommunityQuestionIntent(lower) ||
    input.wantsWelcomeDraft ||
    /community|neighbors?|county feed|local group|hoa|board/.test(lower);

  if (!intentDetected) {
    return {
      message: nextMessage,
      actions: nextActions,
    };
  }

  if (input.confidenceBand === "low") {
    const lowConfidenceCategory = detectCommunityCategory(lower);
    const lowConfidenceTitle = buildCommunityDraftTitle(input.message, lowConfidenceCategory);
    const lowConfidenceBody = buildCommunityDraftBody(input);
    return {
      message: nextMessage,
      actions: [
        {
          type: "ASK_SCOUT",
          label: "Clarify post intent first",
          prompt:
            "Do you want this as a question, recommendation request, or local alert? I will prefill the full county post immediately.",
          subtitle: "Need one quick intent clarification",
          why: "Low confidence community intent",
          primary: true,
          payload: {
            target: "community_post",
            route: "/community?compose=1",
            prefill: {
              title: lowConfidenceTitle,
              body: lowConfidenceBody,
              countyCode: input.countyCode ?? null,
              category: lowConfidenceCategory,
              visibility: "county_safe_default",
            },
            confirmRequiredFields: ["category", "visibility", "countyCode"],
            source: "community_outcome_engine",
            confidenceBand: "low",
          },
        },
        ...nextActions,
      ],
    };
  }

  const category = detectCommunityCategory(lower);
  const draftTitle = buildCommunityDraftTitle(input.message, category);
  const draftBody = buildCommunityDraftBody(input);
  const confirmRequiredFields =
    input.confidenceBand === "medium" ? ["category", "visibility", "countyCode"] : [];

  const primaryAction: CommunityBehaviorAction = {
    type: "PREFILL_INPUT",
    label: "Start county community post",
    to: "/community?compose=1",
    path: "/community?compose=1",
    subtitle:
      input.confidenceBand === "medium"
        ? "Draft ready; confirm category and visibility"
        : "Draft ready to post",
    why: "One tap to publish a structured local post",
    primary: true,
    payload: {
      target: "community_post",
      route: "/community?compose=1",
      prefill: {
        title: draftTitle,
        body: draftBody,
        countyCode: input.countyCode ?? null,
        category,
        visibility: "county_safe_default",
      },
      source: "community_outcome_engine",
      confidenceBand: input.confidenceBand,
      ...(confirmRequiredFields.length > 0 ? { confirmRequiredFields } : {}),
    },
  };

  const secondaryActions: CommunityBehaviorAction[] = [];
  if (input.communityPostCount > 0) {
    secondaryActions.push({
      type: "NAVIGATE",
      label: "Review county community discussion",
      to: "/community?tab=for-you",
      path: "/community?tab=for-you",
      subtitle: "Check existing context before posting",
      why: "Optional quality check",
      primary: false,
    });
  }

  return {
    message: nextMessage,
    actions: [primaryAction, ...secondaryActions.slice(0, 2), ...nextActions],
  };
}
