type SupportBehaviorAction = {
  type: string;
  label: string;
  to?: string;
  payload?: Record<string, unknown>;
};

type ApplySupportBehaviorInput = {
  actions: SupportBehaviorAction[];
  lowerMessage: string;
  userId?: string;
  canCreateCommunityVault: boolean;
  activeProfileId?: string | null;
  extractProfileIdFromText: (text: string) => string | null;
  message: string;
  extractDollarAmount: (text: string) => number | null;
  formatUsd: (amount: number) => string;
};

export function applySupportBehaviorOwnership(
  input: ApplySupportBehaviorInput
): SupportBehaviorAction[] {
  const nextActions = Array.isArray(input.actions) ? input.actions.slice() : [];

  const isCommunityVaultTopic =
    input.lowerMessage.includes("community vault") ||
    (input.lowerMessage.includes("vault") && input.lowerMessage.includes("community")) ||
    input.lowerMessage.includes("platform support") ||
    (input.lowerMessage.includes("support") && input.lowerMessage.includes("platform")) ||
    input.lowerMessage.includes("cause") ||
    input.lowerMessage.includes("causes");

  if (!isCommunityVaultTopic || !input.canCreateCommunityVault) {
    return nextActions;
  }

  const profileId =
    input.activeProfileId ?? input.extractProfileIdFromText(input.message) ?? undefined;

  if (profileId) {
    const amountFromText = input.extractDollarAmount(input.message);
    const donationAmount = amountFromText ?? 25;
    const supportAmount = amountFromText ?? 10;

    nextActions.push(
      {
        type: "NAVIGATE",
        label: "Open Community Vault",
        to: `/profile/${profileId}/community`,
      },
      {
        type: "START_COMMUNITY_VAULT_DONATION",
        label: `Donate ${input.formatUsd(donationAmount)} to vault`,
        payload: { profileId, amount: donationAmount },
      },
      {
        type: "START_PLATFORM_SUPPORT",
        label: `Support platform ${input.formatUsd(supportAmount)} (one-time split)`,
        payload: {
          amount: supportAmount,
          mode: "one_time",
          originatingProfileId: profileId,
        },
      },
      {
        type: "START_PLATFORM_SUPPORT",
        label: `Support platform ${input.formatUsd(supportAmount)} (monthly split)`,
        payload: {
          amount: supportAmount,
          mode: "subscription",
          originatingProfileId: profileId,
        },
      }
    );
  } else if (input.userId) {
    nextActions.push({
      type: "NAVIGATE",
      label: "Open my dashboard",
      to: "/dashboard",
    });
  }

  return nextActions;
}
