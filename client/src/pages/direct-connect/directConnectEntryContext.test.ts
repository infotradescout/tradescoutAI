import { describe, expect, it } from "vitest";
import {
  getDirectConnectContextLabel,
  getDirectConnectIntent,
  parseDirectConnectEntryContext,
} from "./directConnectEntryContext";

describe("directConnectEntryContext", () => {
  it("normalizes every intent emitted by current TradeScout entry surfaces", () => {
    expect(getDirectConnectIntent("/direct-connect?intent=hire")).toBe("fix_improve");
    expect(getDirectConnectIntent("/direct-connect?intent=support")).toBe("support");
    expect(getDirectConnectIntent("/direct-connect?intent=provider_demand")).toBe("offer_services");
    expect(getDirectConnectIntent("/direct-connect?intent=follow_up")).toBe("coordinate");
    expect(getDirectConnectIntent("/direct-connect?intent=introduction")).toBe("coordinate");
    expect(getDirectConnectIntent("/direct-connect?intent=collaborate")).toBe("coordinate");
    expect(getDirectConnectIntent("/direct-connect?intent=employment")).toBe("employment");
  });

  it("preserves employment opportunity context", () => {
    expect(
      parseDirectConnectEntryContext(
        "/direct-connect?intent=employment&employmentPostId=job-7&title=Electrician"
      )
    ).toMatchObject({
      contextType: "employment_post",
      contextId: "job-7",
      title: "Electrician",
    });
  });

  it("preserves a selected provider and business-profile context", () => {
    expect(
      parseDirectConnectEntryContext(
        "/direct-connect?intent=hire&contractorId=provider-7&targetName=Acme%20Electric"
      )
    ).toMatchObject({
      targetProviderId: "provider-7",
      targetName: "Acme Electric",
      source: "provider_profile",
      contextType: "provider",
    });

    expect(
      parseDirectConnectEntryContext(
        "/direct-connect?prefill_businessName=Stone%20Works&prefill_businessSlug=stone-works&prefill_countyFips=12033"
      )
    ).toMatchObject({
      countyFips: "12033",
      targetName: "Stone Works",
      targetSelector: "stone-works",
      source: "business_profile",
      contextType: "business",
    });
  });

  it("converts home quick-action category into routing trade context", () => {
    expect(
      parseDirectConnectEntryContext("/direct-connect?source=home_action_surface&category=plumbing")
    ).toMatchObject({ source: "home_action_surface", tradeId: "plumbing" });
  });

  it("preserves the legacy HomeID query handoff without accepting invalid state", () => {
    expect(
      parseDirectConnectEntryContext(
        "/direct-connect?homeId=home-17&homeContextIntent=update_from_request&homePacketId=packet-8&homePacketReadinessState=ready_for_handoff"
      )
    ).toMatchObject({
      homeId: "home-17",
      homeContextIntent: "update_from_request",
      homePacketId: "packet-8",
      homePacketReadinessState: "ready_for_handoff",
    });
    expect(
      parseDirectConnectEntryContext(
        "/direct-connect?homeContextIntent=remove&homePacketReadinessState=needs_info"
      )
    ).toMatchObject({
      homeContextIntent: undefined,
      homePacketReadinessState: undefined,
    });
  });

  it("preserves community, deal, profile, client, and shared-request references", () => {
    expect(parseDirectConnectEntryContext("/direct-connect?postId=post-1")).toMatchObject({
      contextType: "community_post",
      contextId: "post-1",
    });
    expect(parseDirectConnectEntryContext("/direct-connect?dealId=deal-1")).toMatchObject({
      contextType: "trade_deal",
      contextId: "deal-1",
    });
    expect(parseDirectConnectEntryContext("/direct-connect?profile=jane-doe")).toMatchObject({
      contextType: "profile",
      targetSelector: "jane-doe",
    });
    expect(parseDirectConnectEntryContext("/direct-connect?clientId=client-1")).toMatchObject({
      contextType: "client",
      contextId: "client-1",
    });
    expect(parseDirectConnectEntryContext("/direct-connect?shared=share-1")).toMatchObject({
      contextType: "shared_request",
      contextId: "share-1",
    });
  });

  it("carries an explicit public-profile product into Direct Connect", () => {
    expect(
      parseDirectConnectEntryContext(
        "/direct-connect?from=public_profile&profile=jw-stone&profileName=JW%20Stone%20LLC&item=Honey%20Onyx&subject=product"
      )
    ).toMatchObject({
      contextType: "profile",
      contextId: "jw-stone",
      targetSelector: "jw-stone",
      targetName: "Honey Onyx",
      source: "public_profile",
      subjectType: "product",
    });
  });

  it("carries deliberate project location and timing into the request composer", () => {
    expect(
      parseDirectConnectEntryContext(
        "/direct-connect?subject=product&location=Natalbany%2C%20LA%2070451&county=22105&state=la&when=Within%206%20months"
      )
    ).toMatchObject({
      subjectType: "product",
      location: "Natalbany, LA 70451",
      countyFips: "22105",
      stateCode: "LA",
      timing: "Within 6 months",
    });
  });

  it("creates a readable fallback label without inventing identity", () => {
    const context = parseDirectConnectEntryContext("/direct-connect?profile=jane-doe");
    expect(getDirectConnectContextLabel(context)).toBe("jane doe");
  });
});
