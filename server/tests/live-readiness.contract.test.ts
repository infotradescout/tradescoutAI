import { describe, expect, it } from "vitest";
import {
  projectRequesterDirectConnectReadiness,
  projectResponderDirectConnectReadiness,
  resolveLiveReadiness,
  type LiveReadinessUser,
} from "@shared/liveReadiness";

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

describe("resolveLiveReadiness", () => {
  it("keeps users in local setup until county and state are present", () => {
    const readiness = resolveLiveReadiness({
      user: {
        firstName: "Taylor",
        lastName: "Morgan",
        onboardingCompleted: true,
        profileVersion: 1,
      },
    });

    expect(readiness.state).toBe("needs_local_setup");
    expect(readiness.action.href).toBe("/onboarding/profile");
    expect(readiness.gates.hasDirectConnectAuthority).toBe(false);
    expect(readiness.gates.contactUnlocked).toBe(false);
  });

  it("requires profile basics before intent or Direct Connect authority", () => {
    const readiness = resolveLiveReadiness({
      user: {
        stateCode: "FL",
        countyFips: "12033",
        onboardingCompleted: true,
        profileVersion: 1,
      },
    });

    expect(readiness.state).toBe("needs_profile_basics");
    expect(readiness.gates.hasLocalSetup).toBe(true);
    expect(readiness.gates.hasProfileBasics).toBe(false);
    expect(readiness.gates.hasDirectConnectAuthority).toBe(false);
  });

  it("requires intent confirmation on the current profile version", () => {
    const readiness = resolveLiveReadiness({
      user: {
        firstName: "Taylor",
        lastName: "Morgan",
        stateCode: "FL",
        countyFips: "12033",
        onboardingCompleted: false,
        profileVersion: 0,
      },
    });

    expect(readiness.state).toBe("needs_intent_confirmation");
    expect(readiness.action.href).toBe("/onboarding/intent");
    expect(readiness.gates.hasDirectConnectAuthority).toBe(false);
  });

  it("does not mark business users live without business verification", () => {
    const readiness = resolveLiveReadiness({
      user: {
        ...readyPerson,
        userIntent: "business",
        businessType: "service_provider",
        verifiedBadge: false,
        verificationStatus: "pending",
      },
    });

    expect(readiness.state).toBe("needs_verification");
    expect(readiness.gates.hasVerificationForLiveState).toBe(false);
    expect(readiness.gates.contactUnlocked).toBe(false);
  });

  it("routes verified users with no coordination to request creation", () => {
    const readiness = resolveLiveReadiness({ user: readyPerson });

    expect(readiness.state).toBe("ready_to_create_direct_connect_request");
    expect(readiness.action.href).toBe("/direct-connect");
    expect(readiness.gates.hasDirectConnectAuthority).toBe(true);
    expect(readiness.gates.contactUnlocked).toBe(false);
  });

  it("marks verified business profiles ready to review live readiness", () => {
    const readiness = resolveLiveReadiness({
      user: {
        ...readyPerson,
        userIntent: "business",
        businessType: "service_provider",
        verifiedBadge: true,
        verificationStatus: "approved",
      },
    });

    expect(readiness.state).toBe("ready_to_go_live");
    expect(readiness.action.href).toBe("/profile-settings");
    expect(readiness.gates.hasVerificationForLiveState).toBe(true);
    expect(readiness.gates.contactUnlocked).toBe(false);
  });

  it("keeps routed requester work in waiting state without unlocking contact", () => {
    const readiness = resolveLiveReadiness({
      user: readyPerson,
      directConnectItems: [{ side: "requester", status: "routed" }],
    });

    expect(readiness.state).toBe("has_direct_connect_request_waiting");
    expect(readiness.action.href).toBe("/direct-connect/engagements");
    expect(readiness.gates.contactUnlocked).toBe(false);
  });

  it("prioritizes responder accept or decline decisions before passive tracking", () => {
    const readiness = resolveLiveReadiness({
      user: readyPerson,
      directConnectItems: [
        { side: "requester", status: "routed" },
        { side: "responder", assignmentStatus: "invited" },
      ],
    });

    expect(readiness.state).toBe("has_direct_connect_response_to_accept_or_decline");
    expect(readiness.action.id).toBe("respond_to_direct_connect_request");
    expect(readiness.gates.contactUnlocked).toBe(false);
  });

  it("unlocks contact only after accepted Direct Connect coordination exists", () => {
    const readiness = resolveLiveReadiness({
      user: readyPerson,
      directConnectItems: [
        { side: "requester", status: "in_progress", hasAcceptedAssignment: true },
      ],
    });

    expect(readiness.state).toBe("in_active_coordination");
    expect(readiness.action.href).toBe("/direct-connect/inbox");
    expect(readiness.gates.contactUnlocked).toBe(true);
  });

  it("projects routed requester rows as waiting without exposing contact before acceptance", () => {
    const projected = projectRequesterDirectConnectReadiness({
      status: "routed",
      dcSuggestedCount: 2,
      dcAcceptedAssignmentId: null,
      dcConversationThreadId: null,
    });
    const readiness = resolveLiveReadiness({ user: readyPerson, directConnectItems: [projected] });

    expect(projected).toMatchObject({
      side: "requester",
      status: "routed",
      hasReplies: false,
      hasAcceptedAssignment: false,
      hasConversation: false,
    });
    expect(readiness.state).toBe("has_direct_connect_request_waiting");
    expect(readiness.gates.contactUnlocked).toBe(false);
  });

  it("projects accepted requester rows as replies to review before conversation opens", () => {
    const projected = projectRequesterDirectConnectReadiness({
      status: "routed",
      dcSuggestedCount: 2,
      dcAcceptedAssignmentId: "assignment_123",
      dcConversationThreadId: null,
    });
    const readiness = resolveLiveReadiness({ user: readyPerson, directConnectItems: [projected] });

    expect(projected.hasReplies).toBe(true);
    expect(readiness.state).toBe("in_active_coordination");
    expect(readiness.gates.contactUnlocked).toBe(true);
  });

  it("projects accepted requester coordination as contact-unlocked active coordination", () => {
    const projected = projectRequesterDirectConnectReadiness({
      status: "in_progress",
      dcSuggestedCount: 3,
      dcAcceptedAssignmentId: "assignment_123",
      dcConversationThreadId: "thread_123",
    });
    const readiness = resolveLiveReadiness({ user: readyPerson, directConnectItems: [projected] });

    expect(readiness.state).toBe("in_active_coordination");
    expect(readiness.gates.contactUnlocked).toBe(true);
  });

  it("projects responder assignments into accept-or-decline next action", () => {
    const projected = projectResponderDirectConnectReadiness({
      status: "routed",
      assignment: { status: "suggested" },
      conversationThreadId: null,
    });
    const readiness = resolveLiveReadiness({ user: readyPerson, directConnectItems: [projected] });

    expect(projected).toMatchObject({
      side: "responder",
      assignmentStatus: "suggested",
      hasAcceptedAssignment: false,
      hasConversation: false,
    });
    expect(readiness.state).toBe("has_direct_connect_response_to_accept_or_decline");
    expect(readiness.gates.contactUnlocked).toBe(false);
  });
});
