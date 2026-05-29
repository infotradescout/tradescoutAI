import { describe, expect, it } from "vitest";

type HomeAuthorityRole =
  | "listing_agent_delegate"
  | "property_manager_delegate"
  | "seller_collaborator"
  | "owner"
  | "buyer_pending_claimant";

type HomeAuthority = {
  authorityId: string;
  homeId: string;
  subjectId: string;
  role: HomeAuthorityRole;
  status: "active" | "closed";
  startedAt: string;
  endedAt?: string;
};

type HomeEvidence = {
  evidenceId: string;
  homeId: string;
  sourceType: "seller" | "agent" | "property_manager";
  visibility:
    | "private_seller_only"
    | "buyer_packet"
    | "transfers_with_home"
    | "shared_with_listing_team";
};

type BuyerPacket = {
  homeId: string;
  evidenceIds: string[];
};

type ListingFlowTrigger = {
  flow: "listing_created" | "offer_accepted" | "sale_closed";
  homeId: string;
  shouldPromptHandoff: boolean;
};

function canEnrichHomeId(role: HomeAuthorityRole) {
  return (
    role === "listing_agent_delegate" ||
    role === "property_manager_delegate" ||
    role === "seller_collaborator"
  );
}

function buildBuyerPacket(
  homeId: string,
  evidence: HomeEvidence[],
  sellerApprovedIds: string[]
): BuyerPacket {
  const approved = evidence.filter(
    (e) =>
      e.homeId === homeId &&
      sellerApprovedIds.includes(e.evidenceId) &&
      (e.visibility === "buyer_packet" || e.visibility === "transfers_with_home")
  );
  return { homeId, evidenceIds: approved.map((e) => e.evidenceId) };
}

function claimPropertyWithExistingHomeId(args: {
  homeId: string;
  claimantId: string;
  claimAt: string;
}) {
  const authority: HomeAuthority = {
    authorityId: "auth_claim_1",
    homeId: args.homeId,
    subjectId: args.claimantId,
    role: "buyer_pending_claimant",
    status: "active",
    startedAt: args.claimAt,
  };
  return authority;
}

function handoffAuthority(args: {
  homeId: string;
  closeAuthorities: HomeAuthority[];
  newOwnerId: string;
  handoffAt: string;
}) {
  const closed = args.closeAuthorities.map((a) => ({
    ...a,
    status: "closed" as const,
    endedAt: args.handoffAt,
  }));
  const owner: HomeAuthority = {
    authorityId: "auth_owner_1",
    homeId: args.homeId,
    subjectId: args.newOwnerId,
    role: "owner",
    status: "active",
    startedAt: args.handoffAt,
  };
  return { homeId: args.homeId, closed, owner };
}

function createListingFlowTrigger(
  flow: ListingFlowTrigger["flow"],
  homeId: string
): ListingFlowTrigger {
  return {
    flow,
    homeId,
    shouldPromptHandoff: flow === "offer_accepted" || flow === "sale_closed",
  };
}

describe("AssetID Phase 1C listing handoff contracts", () => {
  it("realtor can create/enrich HomeID for listed property with scoped authority", () => {
    expect(canEnrichHomeId("listing_agent_delegate")).toBe(true);
    expect(canEnrichHomeId("owner")).toBe(false);
  });

  it("property manager can create/enrich HomeID for managed property with scoped authority", () => {
    expect(canEnrichHomeId("property_manager_delegate")).toBe(true);
    expect(canEnrichHomeId("buyer_pending_claimant")).toBe(false);
  });

  it("seller can approve which HomeID evidence enters the buyer packet", () => {
    const evidence: HomeEvidence[] = [
      {
        evidenceId: "evi_1",
        homeId: "home_123",
        sourceType: "seller",
        visibility: "buyer_packet",
      },
      {
        evidenceId: "evi_2",
        homeId: "home_123",
        sourceType: "seller",
        visibility: "private_seller_only",
      },
      {
        evidenceId: "evi_3",
        homeId: "home_123",
        sourceType: "agent",
        visibility: "transfers_with_home",
      },
    ];
    const packet = buildBuyerPacket("home_123", evidence, ["evi_1", "evi_2", "evi_3"]);
    expect(packet.evidenceIds).toContain("evi_1");
    expect(packet.evidenceIds).toContain("evi_3");
    expect(packet.evidenceIds).not.toContain("evi_2");
  });

  it("buyer can claim a property with an existing HomeID", () => {
    const claimAuthority = claimPropertyWithExistingHomeId({
      homeId: "home_123",
      claimantId: "buyer_42",
      claimAt: "2026-05-28T00:00:00.000Z",
    });
    expect(claimAuthority.homeId).toBe("home_123");
    expect(claimAuthority.role).toBe("buyer_pending_claimant");
    expect(claimAuthority.status).toBe("active");
  });

  it("handoff closes seller/listing-side authority and opens buyer/homeowner authority", () => {
    const listingAuthorities: HomeAuthority[] = [
      {
        authorityId: "auth_agent_1",
        homeId: "home_123",
        subjectId: "agent_1",
        role: "listing_agent_delegate",
        status: "active",
        startedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        authorityId: "auth_seller_1",
        homeId: "home_123",
        subjectId: "seller_1",
        role: "seller_collaborator",
        status: "active",
        startedAt: "2026-04-01T00:00:00.000Z",
      },
    ];
    const transfer = handoffAuthority({
      homeId: "home_123",
      closeAuthorities: listingAuthorities,
      newOwnerId: "buyer_42",
      handoffAt: "2026-06-01T00:00:00.000Z",
    });
    expect(transfer.homeId).toBe("home_123");
    expect(transfer.closed.every((a) => a.status === "closed")).toBe(true);
    expect(transfer.owner.role).toBe("owner");
    expect(transfer.owner.subjectId).toBe("buyer_42");
  });

  it("private seller-only evidence does not transfer by default", () => {
    const evidence: HomeEvidence[] = [
      {
        evidenceId: "private_1",
        homeId: "home_123",
        sourceType: "seller",
        visibility: "private_seller_only",
      },
      {
        evidenceId: "transfer_1",
        homeId: "home_123",
        sourceType: "seller",
        visibility: "transfers_with_home",
      },
    ];
    const packet = buildBuyerPacket("home_123", evidence, ["private_1", "transfer_1"]);
    expect(packet.evidenceIds).toContain("transfer_1");
    expect(packet.evidenceIds).not.toContain("private_1");
  });

  it("HomeScout sale/listing flow can trigger HomeID handoff", () => {
    const listingCreated = createListingFlowTrigger("listing_created", "home_123");
    const offerAccepted = createListingFlowTrigger("offer_accepted", "home_123");
    const saleClosed = createListingFlowTrigger("sale_closed", "home_123");
    expect(listingCreated.shouldPromptHandoff).toBe(false);
    expect(offerAccepted.shouldPromptHandoff).toBe(true);
    expect(saleClosed.shouldPromptHandoff).toBe(true);
  });

  it("agent/property-manager attribution remains in history without permanent control", () => {
    const history: Array<{ subjectId: string; role: HomeAuthorityRole; action: string }> = [
      { subjectId: "agent_1", role: "listing_agent_delegate", action: "added_hvac_record" },
      { subjectId: "pm_1", role: "property_manager_delegate", action: "attached_inspection" },
    ];
    const transfer = handoffAuthority({
      homeId: "home_123",
      closeAuthorities: [
        {
          authorityId: "auth_agent_1",
          homeId: "home_123",
          subjectId: "agent_1",
          role: "listing_agent_delegate",
          status: "active",
          startedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      newOwnerId: "buyer_42",
      handoffAt: "2026-06-01T00:00:00.000Z",
    });
    expect(history[0].action).toBe("added_hvac_record");
    expect(history[1].action).toBe("attached_inspection");
    expect(transfer.closed[0].status).toBe("closed");
    expect(transfer.owner.role).toBe("owner");
  });
});
