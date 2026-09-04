import { describe, expect, it } from "vitest";
import {
  getDirectConnectInboxNextStepCopy,
  getDirectConnectNextStepCopy,
} from "./directConnectReadiness";

describe("getDirectConnectNextStepCopy", () => {
  it("shows send step for open requests", () => {
    const copy = getDirectConnectNextStepCopy({ status: "open", dcSuggestedCount: 0 });

    expect(copy).toMatchObject({
      label: "Send this request",
      actionHint: "Send to more pros",
      contactUnlocked: false,
    });
  });

  it("does not treat routed suggestions as replies", () => {
    const copy = getDirectConnectNextStepCopy({ status: "routed", dcSuggestedCount: 3 });

    expect(copy).toMatchObject({
      label: "Waiting for responses",
      actionHint: "Review replies",
      contactUnlocked: false,
    });
  });

  it("shows active coordination only after accepted path exists", () => {
    const copy = getDirectConnectNextStepCopy({
      status: "routed",
      dcSuggestedCount: 2,
      dcAcceptedAssignmentId: "assignment_123",
    });

    expect(copy).toMatchObject({
      label: "Continue coordination",
      actionHint: "Open conversation",
      contactUnlocked: true,
    });
  });

  it("keeps pending outcome as confirmation work", () => {
    const copy = getDirectConnectNextStepCopy({
      status: "pending_outcome",
      dcAcceptedAssignmentId: "assignment_123",
    });

    expect(copy.label).toBe("Confirm outcome");
    expect(copy.summary).toContain("confirming what happened");
  });
});

describe("getDirectConnectInboxNextStepCopy", () => {
  it("shows responder action without unlocking contact before acceptance", () => {
    const copy = getDirectConnectInboxNextStepCopy({
      assignmentStatus: "suggested",
      requestStatus: "routed",
      actionableAssignment: true,
    });

    expect(copy).toMatchObject({
      label: "Respond to request",
      actionHint: "Prepare response",
      contactUnlocked: false,
    });
    expect(copy.summary).toContain("The requester’s name and phone arrived with the request; acceptance opens conversation");
  });

  it("changes the primary action once the structured response form is open", () => {
    const copy = getDirectConnectInboxNextStepCopy({
      assignmentStatus: "invited",
      requestStatus: "routed",
      actionableAssignment: true,
      isStructuredReplyOpen: true,
    });

    expect(copy.actionHint).toBe("Accept and open conversation");
    expect(copy.contactUnlocked).toBe(false);
  });

  it("shows active coordination only after accepted responder status or conversation exists", () => {
    const copy = getDirectConnectInboxNextStepCopy({
      assignmentStatus: "accepted",
      requestStatus: "in_progress",
      conversationThreadId: "thread_123",
    });

    expect(copy).toMatchObject({
      label: "Coordination active",
      actionHint: "Open conversation",
      contactUnlocked: true,
    });
    expect(copy.summary).toContain("Messages conversation");
  });

  it("keeps declined responses archived and contact-gated", () => {
    const copy = getDirectConnectInboxNextStepCopy({
      assignmentStatus: "declined",
      requestStatus: "routed",
    });

    expect(copy).toMatchObject({
      label: "Response archived",
      actionHint: "Review details",
      contactUnlocked: false,
    });
  });

  it("keeps saved request follow-up pointed at Messages without unlocking contact", () => {
    const copy = getDirectConnectInboxNextStepCopy({
      assignmentStatus: "saved",
      requestStatus: "routed",
    });

    expect(copy).toMatchObject({
      label: "Saved request",
      actionHint: "Open Messages",
      contactUnlocked: false,
    });
    expect(copy.summary).toContain("Message threads open only after an accepted");
  });
});
