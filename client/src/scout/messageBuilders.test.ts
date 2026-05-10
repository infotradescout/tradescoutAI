import { describe, it, expect } from "vitest";
import { buildConnectionFallback, buildExplicitNavigationMessage } from "./messageBuilders";

describe("messageBuilders", () => {
  it("builds explicit navigation messages with nav target", () => {
    const msg = buildExplicitNavigationMessage({ to: "/direct-connect", label: "Direct Connect" });
    expect(msg.role).toBe("assistant");
    expect(msg.navTarget).toBe("/direct-connect");
    expect(msg.content.toLowerCase()).toContain("opening direct connect");
    expect(msg.clusters?.[0]?.primaryAction?.to).toBe("/direct-connect");
  });

  it("builds fallback payload with deterministic actions", () => {
    const { message, actions } = buildConnectionFallback({
      contractorsRoute: "/contractors",
      communityRoute: "/community",
    });

    expect(actions).toHaveLength(4);
    expect(actions[0].type).toBe("ASK_SCOUT");
    expect(actions[1].to).toBe("/direct-connect");
    expect(actions[2].to).toBe("/contractors");
    expect(actions[3].to).toBe("/community");
    expect(message.clusters?.[0]?.actions).toHaveLength(4);
  });

  it("provides no-dead-end guidance when Scout fallback triggers", () => {
    const { message, actions } = buildConnectionFallback(
      {
        contractorsRoute: "/contractors",
        communityRoute: "/community",
      },
      "help me find someone"
    );

    expect(message.role).toBe("assistant");
    expect(message.content.toLowerCase()).toContain("keep moving");
    expect(message.content.toLowerCase()).toContain("choose what fits");
    expect(message.clusters?.[0]?.title).toBe("Keep moving");
    expect(actions.length).toBeGreaterThan(0);
    expect(message.suggestedActions?.[0]).toBe("Retry my question");
    expect(actions.some((action) => action.type === "ASK_SCOUT")).toBe(true);
  });

  it("tailors fallback actions for pro-intent prompts", () => {
    const { actions } = buildConnectionFallback(
      {
        contractorsRoute: "/contractors",
        communityRoute: "/community",
      },
      "I need a plumber near me"
    );

    expect(actions[0].type).toBe("ASK_SCOUT");
    expect(actions.some((action) => action.to === "/direct-connect/pros")).toBe(true);
  });

  it("tailors fallback actions for marketplace-intent prompts", () => {
    const { actions } = buildConnectionFallback(
      {
        contractorsRoute: "/contractors",
        communityRoute: "/community",
        exchangeRoute: "/exchange",
      },
      "I want to buy tools on the marketplace"
    );

    expect(actions[0].type).toBe("ASK_SCOUT");
    expect(actions.some((action) => action.to === "/direct-connect/pros")).toBe(true);
    expect(actions.some((action) => action.to === "/exchange")).toBe(true);
  });

  it("prioritizes pros and still shows exchange for mixed roofing plus buy intent", () => {
    const { actions } = buildConnectionFallback(
      {
        contractorsRoute: "/contractors",
        communityRoute: "/community",
        exchangeRoute: "/exchange",
      },
      "I need roofing help and want to buy materials"
    );

    expect(actions[0].type).toBe("ASK_SCOUT");
    expect(actions.some((action) => action.to === "/direct-connect/pros")).toBe(true);
    expect(actions.some((action) => action.to === "/exchange")).toBe(true);
    expect(actions.some((action) => action.to === "/community")).toBe(true);
    expect(actions.some((action) => action.type === "ASK_SCOUT")).toBe(true);
    const stayInScout = actions.find((action) => action.type === "ASK_SCOUT");
    expect(stayInScout?.label).toBe("Stay here");
    expect(stayInScout?.prompt?.toLowerCase()).toContain("hire a roofer");
  });

  it("shows multi-path options for keyword-only prompts without context", () => {
    const { actions } = buildConnectionFallback(
      {
        contractorsRoute: "/contractors",
        communityRoute: "/community",
        exchangeRoute: "/exchange",
      },
      "roofing"
    );

    expect(actions.some((action) => action.to === "/direct-connect/pros")).toBe(true);
    expect(actions.some((action) => action.to === "/exchange")).toBe(true);
    expect(actions.some((action) => action.to === "/community")).toBe(true);
    expect(actions.some((action) => action.type === "ASK_SCOUT")).toBe(true);
  });

  it("shows multi-path options when context is mixed and intent confidence is low", () => {
    const { actions } = buildConnectionFallback(
      {
        contractorsRoute: "/contractors",
        communityRoute: "/community",
        exchangeRoute: "/exchange",
      },
      "Need roof help, maybe buy materials, maybe ask neighbors"
    );

    expect(actions.some((action) => action.to === "/direct-connect/pros")).toBe(true);
    expect(actions.some((action) => action.to === "/exchange")).toBe(true);
    expect(actions.some((action) => action.to === "/community")).toBe(true);
    expect(actions.some((action) => action.type === "ASK_SCOUT")).toBe(true);
  });

  it("prioritizes project planning for deck-project fallback prompts", () => {
    const { message, actions } = buildConnectionFallback(
      {
        contractorsRoute: "/contractors",
        communityRoute: "/community",
        exchangeRoute: "/exchange",
      },
      "I want to build a deck"
    );

    expect(message.content.toLowerCase()).toContain("scope");
    expect(actions.some((action) => action.to === "/project-tracker")).toBe(true);
    expect(actions.some((action) => action.to === "/direct-connect/pros")).toBe(true);
    expect(actions.some((action) => action.to === "/exchange/rental-equipment")).toBe(true);
  });

  it("includes routing workflow help when the prompt asks why routing is blocked", () => {
    const { actions } = buildConnectionFallback(
      {
        contractorsRoute: "/contractors",
        communityRoute: "/community",
      },
      "Why is this not routed yet?"
    );

    expect(
      actions.some(
        (action) =>
          action.type === "NAVIGATE" &&
          action.to === "/help/how-tradescout-works#direct-connect-workflow"
      )
    ).toBe(true);
  });
});
