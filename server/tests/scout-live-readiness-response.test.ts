import { describe, expect, it } from "vitest";
import { resolveLiveReadiness, type LiveReadinessUser } from "@shared/liveReadiness";
import {
  buildScoutLiveReadinessResponse,
  isLiveReadinessQuestion,
} from "../scout/scoutLiveReadinessResponse";

const readyPerson: LiveReadinessUser = {
  firstName: "Taylor",
  lastName: "Morgan",
  stateCode: "FL",
  countyFips: "12033",
  onboardingCompleted: true,
  profileVersion: 1,
  emailVerified: true,
  addressVerified: true,
  userIntent: "person",
};

describe("Scout live readiness response", () => {
  it.each([
    "what should I do next",
    "am I ready to go live",
    "what's next for profile completion",
    "how do I respond to a request",
  ])("recognizes readiness question: %s", (message) => {
    expect(isLiveReadinessQuestion(message)).toBe(true);
  });

  it("does not treat general discovery as readiness", () => {
    expect(isLiveReadinessQuestion("show me roofers nearby")).toBe(false);
  });

  it("returns one primary governed next-step action", () => {
    const readiness = resolveLiveReadiness({ user: readyPerson });
    const response = buildScoutLiveReadinessResponse(readiness);

    expect(response.message).toContain("Direct Connect request");
    expect(response.actions).toHaveLength(1);
    expect(response.actions[0]).toMatchObject({
      type: "NAVIGATE",
      to: "/direct-connect",
      primary: true,
    });
    expect(response.metadata).toMatchObject({
      intent: "live_readiness_next_step",
      sourceUsed: "live_readiness_resolver",
      confidenceBand: "high",
      readinessState: "ready_to_create_direct_connect_request",
    });
  });

  it("keeps pre-acceptance replies contact-gated in Scout copy and metadata", () => {
    const readiness = resolveLiveReadiness({
      user: readyPerson,
      directConnectItems: [{ side: "requester", status: "routed", hasReplies: true }],
    });
    const response = buildScoutLiveReadinessResponse(readiness);

    expect(response.message).toContain("Direct Connect replies");
    expect(response.actions[0]).toMatchObject({ to: "/direct-connect/inbox" });
    expect((response.metadata.gates as any).contactUnlocked).toBe(false);
  });
});
