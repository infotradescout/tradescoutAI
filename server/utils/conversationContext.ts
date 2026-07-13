import { getExchangeCategorySlugFromMarketplaceCategoryName } from "../../shared/exchangeListingRules";

export type ConversationContextKind =
  | "general"
  | "direct_connect"
  | "marketplace"
  | "platform_support"
  | "procurement";

export type ConversationContext = {
  kind: ConversationContextKind;
  label: string;
  title: string;
  summary?: string;
  href?: string;
  entityId?: string;
};

function participantName(participant: any): string {
  const name = [participant?.firstName, participant?.lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
  return name || "TradeScout member";
}

export function buildMarketplaceConversationPresentation(conversation: any, viewerUserId: string) {
  const otherParticipant =
    String(conversation?.buyerId) === String(viewerUserId)
      ? conversation?.seller
      : conversation?.buyer;
  const participant = otherParticipant
    ? {
        id: String(otherParticipant.id || ""),
        name: participantName(otherParticipant),
        profileImageUrl: otherParticipant.profileImageUrl || null,
      }
    : undefined;

  if (conversation?.decisionScope === "platform_support_inbox") {
    return {
      subject: "TradeScout Support",
      kind: "platform_support" as const,
      context: {
        kind: "platform_support" as const,
        label: "TradeScout Support",
        title: "TradeScout Support",
        summary: "Help, safety, and platform updates",
      },
      participant,
    };
  }

  if (String(conversation?.listingId || "").startsWith("messaging:")) {
    const title = participant?.name || "Conversation";
    return {
      subject: title,
      kind: "general" as const,
      context: {
        kind: "general" as const,
        label: "Community",
        title,
      },
      participant,
    };
  }

  const listingId = String(conversation?.listing?.id || conversation?.listingId || "").trim();
  const listingTitle = String(conversation?.listing?.title || "Exchange listing").trim();
  const categorySlug = getExchangeCategorySlugFromMarketplaceCategoryName(
    conversation?.listing?.categoryName
  );
  const href = listingId && categorySlug ? `/exchange/${categorySlug}/${listingId}` : undefined;

  return {
    subject: listingTitle,
    kind: "marketplace" as const,
    context: {
      kind: "marketplace" as const,
      label: "Exchange",
      title: listingTitle,
      summary: participant ? `Conversation with ${participant.name}` : undefined,
      href,
      entityId: listingId || undefined,
    },
    participant,
  };
}
