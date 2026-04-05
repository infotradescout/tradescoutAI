type CommunityBehaviorAction = {
  type: string;
  label: string;
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

export function applyCommunityBehaviorOwnership(
  input: ApplyCommunityBehaviorInput
): ApplyCommunityBehaviorResult {
  const lower = input.message.toLowerCase();
  let nextMessage = input.responseMessage;
  const nextActions = Array.isArray(input.actions) ? input.actions.slice() : [];

  if (input.userId && input.canPostInCommunity) {
    const safePrefill = encodeURIComponent(input.communityPrefill);
    const alreadyHasCommunityNav = nextActions.some(
      (a) => a.type === "NAVIGATE" && typeof a.to === "string" && a.to.startsWith("/community")
    );

    if (detectCommunityQuestionIntent(lower)) {
      let communityLine = "";
      if (input.communityPostCount > 0) {
        communityLine = "I am seeing a few recent posts from neighbors in your county about this.";
      } else if (input.communityPostCount === 0) {
        communityLine = "I do not see anyone discussing this yet in your area.";
      }

      const bridgeLines = [
        "I can give you practical guidance now and pair it with local input from your area.",
        communityLine,
        "Want to read them directly or add your own question in your county feed?",
      ]
        .filter(Boolean)
        .join("\n\n");

      nextMessage = `${nextMessage}\n\n${bridgeLines}`;

      if (!alreadyHasCommunityNav) {
        nextActions.push(
          {
            type: "NAVIGATE",
            label: "View community discussion",
            to: "/community?tab=for-you",
          },
          {
            type: "NAVIGATE",
            label: "Ask neighbors in your county feed",
            to: `/community?compose=1&prefill=${safePrefill}`,
          }
        );
      }
    } else if (input.lowConfidenceForLocal && !alreadyHasCommunityNav) {
      const bridgeLines = [
        "Local requirements can shift by inspector and permit office, so the best move is to verify the final requirement directly.",
        "I can still move this forward now by drafting the exact permit question and opening local deck pros in parallel.",
      ].join("\n\n");

      nextMessage = `${nextMessage}\n\n${bridgeLines}`;

      nextActions.push(
        {
          type: "NAVIGATE",
          label: "Open local deck pros",
          to: "/direct-connect/pros",
        },
        {
          type: "NAVIGATE",
          label: "Ask the community in my county feed",
          to: `/community?compose=1&prefill=${safePrefill}`,
        }
      );
    }
  }

  if (input.userId && input.wantsWelcomeDraft && input.welcomeDraft) {
    const safeDraft = encodeURIComponent(input.welcomeDraft);
    const alreadyHasWelcomeNav = nextActions.some(
      (a) =>
        a.type === "NAVIGATE" &&
        typeof a.to === "string" &&
        a.to.startsWith("/community") &&
        a.to.includes("compose=1")
    );

    if (!alreadyHasWelcomeNav) {
      nextActions.push({
        type: "NAVIGATE",
        label: "Post this welcome in my community feed",
        to: `/community?compose=1&prefill=${safeDraft}`,
      });
    }
  }

  return {
    message: nextMessage,
    actions: nextActions,
  };
}
