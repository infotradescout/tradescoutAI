import { describe, expect, it } from "vitest";
import { buildMarketplaceConversationPresentation } from "../utils/conversationContext";

describe("marketplace conversation presentation", () => {
  const participants = {
    buyerId: "buyer-1",
    sellerId: "seller-1",
    buyer: { id: "buyer-1", firstName: "Avery", lastName: "Buyer" },
    seller: { id: "seller-1", firstName: "Sam", lastName: "Seller" },
  };

  it("classifies synthetic approved-contact threads as general", () => {
    const result = buildMarketplaceConversationPresentation(
      { ...participants, listingId: "messaging:hire" },
      "buyer-1"
    );
    expect(result).toMatchObject({
      subject: "Sam Seller",
      kind: "general",
      context: { kind: "general", label: "Community" },
      participant: { id: "seller-1", name: "Sam Seller" },
    });
    expect(result.context.href).toBeUndefined();
  });

  it("keeps platform support separate from listing conversations", () => {
    expect(
      buildMarketplaceConversationPresentation(
        {
          ...participants,
          listingId: "support-listing",
          decisionScope: "platform_support_inbox",
        },
        "buyer-1"
      )
    ).toMatchObject({
      subject: "TradeScout Support",
      kind: "platform_support",
      context: { label: "TradeScout Support" },
    });
  });

  it("builds a canonical Exchange link only from an explicit listing category", () => {
    const result = buildMarketplaceConversationPresentation(
      {
        ...participants,
        listingId: "listing-1",
        listing: {
          id: "listing-1",
          title: "Cabinet saw",
          categoryName: "Tools & Hardware",
        },
      },
      "buyer-1"
    );
    expect(result).toMatchObject({
      kind: "marketplace",
      context: { href: "/exchange/tools/listing-1", entityId: "listing-1" },
    });

    const unknown = buildMarketplaceConversationPresentation(
      { ...participants, listingId: "listing-2", listing: { id: "listing-2", title: "Item" } },
      "buyer-1"
    );
    expect(unknown.context.href).toBeUndefined();
  });
});
