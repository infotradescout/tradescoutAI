import {
  projectRequesterDirectConnectReadiness,
  projectResponderDirectConnectReadiness,
  resolveLiveReadiness,
  type LiveReadinessUser,
} from "@shared/liveReadiness";

export type DirectConnectReadinessRequest = {
  status?: string | null;
  dcSuggestedCount?: number | string | null;
  dcAcceptedAssignmentId?: string | null;
  dcConversationThreadId?: string | null;
};

export type DirectConnectNextStepCopy = {
  label: string;
  summary: string;
  actionHint: string;
  contactUnlocked: boolean;
};

export type DirectConnectInboxReadinessItem = {
  assignmentStatus?: string | null;
  requestStatus?: string | null;
  conversationThreadId?: string | null;
  actionableAssignment?: boolean;
  isStructuredReplyOpen?: boolean;
};

const DIRECT_CONNECT_READY_USER: LiveReadinessUser = {
  firstName: "Direct",
  lastName: "Connect",
  stateCode: "FL",
  countyFips: "12033",
  onboardingCompleted: true,
  profileVersion: 1,
  emailVerified: true,
  addressVerified: true,
  userIntent: "person",
};

export function getDirectConnectNextStepCopy(
  request: DirectConnectReadinessRequest
): DirectConnectNextStepCopy {
  const status = String(request.status || "open").toLowerCase();
  const projected = projectRequesterDirectConnectReadiness(request);
  const readiness = resolveLiveReadiness({
    user: DIRECT_CONNECT_READY_USER,
    directConnectItems: [projected],
  });

  if (status === "cancelled") {
    return {
      label: "Request paused",
      summary:
        "This request is not active right now. Reopen it when you're ready to send it again.",
      actionHint: "Reopen request",
      contactUnlocked: false,
    };
  }

  if (status === "completed") {
    return {
      label: "Coordination resolved",
      summary: "This request is closed because the work was marked resolved.",
      actionHint: "Review details",
      contactUnlocked: false,
    };
  }

  if (status === "pending_outcome") {
    return {
      label: "Confirm outcome",
      summary: "The next step is confirming what happened so this request stays accurate.",
      actionHint: "Confirm outcome",
      contactUnlocked: readiness.gates.contactUnlocked,
    };
  }

  if (status === "open" || status === "draft") {
    return {
      label: "Send this request",
      summary: "Choose who receives this request or continue without a selection.",
      actionHint: "Send to more pros",
      contactUnlocked: false,
    };
  }

  if (readiness.state === "in_active_coordination") {
    return {
      label: "Continue coordination",
      summary:
        "An accepted Direct Connect path exists. Keep the conversation tied to this request.",
      actionHint: "Open conversation",
      contactUnlocked: readiness.gates.contactUnlocked,
    };
  }

  if (readiness.state === "has_direct_connect_reply_to_review") {
    return {
      label: "Review replies",
      summary: "Review the response in Direct Connect. The requester contact was sent with the request; conversation opens after acceptance.",
      actionHint: "Review replies",
      contactUnlocked: false,
    };
  }

  return {
    label: "Waiting for responses",
    summary: "This request is live and waiting for eligible responders.",
    actionHint: "Review replies",
    contactUnlocked: false,
  };
}

export function getDirectConnectInboxNextStepCopy(
  item: DirectConnectInboxReadinessItem
): DirectConnectNextStepCopy {
  const assignmentStatus = String(item.assignmentStatus || "suggested").toLowerCase();
  const projected = projectResponderDirectConnectReadiness({
    status: item.requestStatus ?? null,
    assignment: { status: item.assignmentStatus ?? null },
    conversationThreadId: item.conversationThreadId ?? null,
  });
  const readiness = resolveLiveReadiness({
    user: DIRECT_CONNECT_READY_USER,
    directConnectItems: [projected],
  });
  const contactUnlocked = readiness.gates.contactUnlocked;

  if (
    item.actionableAssignment &&
    (assignmentStatus === "suggested" || assignmentStatus === "invited")
  ) {
    return {
      label: "Respond to request",
      summary:
        "Accept with your scope and availability, or archive it. The requester’s name and phone arrived with the request; acceptance opens conversation.",
      actionHint: item.isStructuredReplyOpen ? "Accept and open conversation" : "Prepare response",
      contactUnlocked: false,
    };
  }

  if (assignmentStatus === "accepted" || contactUnlocked) {
    return {
      label: "Coordination active",
      summary: "This accepted request is ready for its Messages conversation.",
      actionHint: "Open conversation",
      contactUnlocked,
    };
  }

  if (assignmentStatus === "declined") {
    return {
      label: "Response archived",
      summary: "You declined or archived this request, so no contact path is open.",
      actionHint: "Review details",
      contactUnlocked: false,
    };
  }

  return {
    label: "Saved request",
    summary:
      "Review the request details. Message threads open only after an accepted Direct Connect path.",
    actionHint: contactUnlocked ? "Open conversation" : "Open Messages",
    contactUnlocked,
  };
}
