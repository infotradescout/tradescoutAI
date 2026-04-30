import { CURRENT_PROFILE_VERSION } from "./profile";

export type LiveReadinessState =
  | "needs_local_setup"
  | "needs_profile_basics"
  | "needs_intent_confirmation"
  | "needs_verification"
  | "ready_to_go_live"
  | "ready_to_create_direct_connect_request"
  | "has_direct_connect_request_waiting"
  | "has_direct_connect_reply_to_review"
  | "has_direct_connect_response_to_accept_or_decline"
  | "in_active_coordination";

export type LiveReadinessActionId =
  | "complete_local_setup"
  | "complete_profile_basics"
  | "confirm_intent"
  | "complete_verification"
  | "review_live_readiness"
  | "create_direct_connect_request"
  | "track_direct_connect_request"
  | "review_direct_connect_replies"
  | "respond_to_direct_connect_request"
  | "continue_direct_connect_coordination";

export type DirectConnectUserSide = "requester" | "responder";

export type DirectConnectReadinessItem = {
  side: DirectConnectUserSide;
  status?: string | null;
  assignmentStatus?: string | null;
  hasConversation?: boolean | null;
  hasAcceptedAssignment?: boolean | null;
  hasReplies?: boolean | null;
};

export type DirectConnectRequesterSnapshot = {
  status?: string | null;
  dcSuggestedCount?: number | string | null;
  dcAcceptedAssignmentId?: string | null;
  dcConversationThreadId?: string | null;
};

export type DirectConnectResponderSnapshot = {
  status?: string | null;
  assignment?: {
    status?: string | null;
  } | null;
  conversationThreadId?: string | null;
};

export type LiveReadinessUser = {
  firstName?: string | null;
  lastName?: string | null;
  stateCode?: string | null;
  countyFips?: string | null;
  locationCommitted?: boolean | null;
  onboardingCompleted?: boolean | null;
  profileVersion?: number | null;
  emailVerified?: boolean | null;
  addressVerified?: boolean | null;
  verifiedBadge?: boolean | null;
  verificationStatus?: string | null;
  userIntent?: "person" | "business" | string | null;
  businessType?: string | null;
};

export type LiveReadinessInput = {
  user?: LiveReadinessUser | null;
  directConnectItems?: DirectConnectReadinessItem[] | null;
};

export type LiveReadinessResult = {
  state: LiveReadinessState;
  action: {
    id: LiveReadinessActionId;
    label: string;
    href: string;
  };
  gates: {
    hasLocalSetup: boolean;
    hasProfileBasics: boolean;
    hasIntentConfirmation: boolean;
    hasVerificationForLiveState: boolean;
    hasDirectConnectAuthority: boolean;
    contactUnlocked: boolean;
  };
  psychologicalIntent: {
    targetBelief: string;
    targetBehavior: string;
    principles: string[];
    riskPrevented: string;
  };
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasText(value: unknown): boolean {
  return cleanString(value).length > 0;
}

function isValidStateCode(value: unknown): boolean {
  return /^[A-Za-z]{2}$/.test(cleanString(value));
}

function isValidCountyFips(value: unknown): boolean {
  return /^\d{5}$/.test(cleanString(value));
}

function hasProfileBasics(user: LiveReadinessUser | null | undefined): boolean {
  if (!user) return false;
  return (
    cleanString(user.firstName).length > 0 &&
    cleanString(user.lastName).length > 0 &&
    isValidStateCode(user.stateCode) &&
    isValidCountyFips(user.countyFips)
  );
}

function hasLocalSetup(user: LiveReadinessUser | null | undefined): boolean {
  if (!user) return false;
  return (
    user.locationCommitted === true ||
    (isValidStateCode(user.stateCode) && isValidCountyFips(user.countyFips))
  );
}

function hasIntentConfirmation(user: LiveReadinessUser | null | undefined): boolean {
  if (!user) return false;
  if (user.onboardingCompleted !== true) return false;
  const profileVersion = typeof user.profileVersion === "number" ? user.profileVersion : 0;
  return profileVersion >= CURRENT_PROFILE_VERSION;
}

function hasVerificationForLiveState(user: LiveReadinessUser | null | undefined): boolean {
  if (!user) return false;
  if (user.verifiedBadge === true) return true;
  if (user.verificationStatus === "approved" || user.verificationStatus === "verified") return true;
  if (user.userIntent === "business" || Boolean(user.businessType)) return false;
  return user.emailVerified === true && user.addressVerified === true;
}

function hasActiveConversation(items: DirectConnectReadinessItem[]): boolean {
  return items.some((item) => {
    const requestStatus = cleanString(item.status).toLowerCase();
    const assignmentStatus = cleanString(item.assignmentStatus).toLowerCase();
    return (
      item.hasConversation === true ||
      item.hasAcceptedAssignment === true ||
      requestStatus === "in_progress" ||
      assignmentStatus === "accepted"
    );
  });
}

function hasResponderDecision(items: DirectConnectReadinessItem[]): boolean {
  return items.some((item) => {
    if (item.side !== "responder") return false;
    const assignmentStatus = cleanString(item.assignmentStatus || item.status).toLowerCase();
    return assignmentStatus === "suggested" || assignmentStatus === "invited";
  });
}

function hasRequesterReplies(items: DirectConnectReadinessItem[]): boolean {
  return items.some((item) => {
    if (item.side !== "requester") return false;
    const requestStatus = cleanString(item.status).toLowerCase();
    return (
      item.hasReplies === true ||
      item.hasAcceptedAssignment === true ||
      requestStatus === "in_progress"
    );
  });
}

function hasWaitingRequest(items: DirectConnectReadinessItem[]): boolean {
  return items.some((item) => {
    if (item.side !== "requester") return false;
    const requestStatus = cleanString(item.status).toLowerCase();
    return requestStatus === "open" || requestStatus === "routed";
  });
}

export function projectRequesterDirectConnectReadiness(
  request: DirectConnectRequesterSnapshot
): DirectConnectReadinessItem {
  return {
    side: "requester",
    status: request.status ?? null,
    hasReplies: hasText(request.dcAcceptedAssignmentId) || hasText(request.dcConversationThreadId),
    hasAcceptedAssignment: hasText(request.dcAcceptedAssignmentId),
    hasConversation: hasText(request.dcConversationThreadId),
  };
}

export function projectResponderDirectConnectReadiness(
  item: DirectConnectResponderSnapshot
): DirectConnectReadinessItem {
  return {
    side: "responder",
    status: item.status ?? null,
    assignmentStatus: item.assignment?.status ?? null,
    hasConversation: hasText(item.conversationThreadId),
    hasAcceptedAssignment: cleanString(item.assignment?.status).toLowerCase() === "accepted",
  };
}

function isBusinessLiveProfile(user: LiveReadinessUser | null | undefined): boolean {
  if (!user) return false;
  return user.userIntent === "business" || Boolean(user.businessType);
}

function result(
  state: LiveReadinessState,
  action: LiveReadinessResult["action"],
  gates: LiveReadinessResult["gates"]
): LiveReadinessResult {
  return {
    state,
    action,
    gates,
    psychologicalIntent: {
      targetBelief: "TradeScout knows my current state and will show the next trustworthy step.",
      targetBehavior:
        "Complete the minimum valid action needed to become live or continue coordination.",
      principles: ["progressive disclosure", "certainty reduction", "trust-preserving friction"],
      riskPrevented:
        "Avoids pushing users into contact or visibility before profile, verification, and Direct Connect authority gates are satisfied.",
    },
  };
}

export function resolveLiveReadiness(input: LiveReadinessInput): LiveReadinessResult {
  const user = input.user ?? null;
  const items = input.directConnectItems ?? [];
  const gates: LiveReadinessResult["gates"] = {
    hasLocalSetup: hasLocalSetup(user),
    hasProfileBasics: hasProfileBasics(user),
    hasIntentConfirmation: hasIntentConfirmation(user),
    hasVerificationForLiveState: hasVerificationForLiveState(user),
    hasDirectConnectAuthority: false,
    contactUnlocked: false,
  };

  const directConnectAuthority = gates.hasProfileBasics && gates.hasIntentConfirmation;
  gates.hasDirectConnectAuthority = directConnectAuthority;
  gates.contactUnlocked = directConnectAuthority && hasActiveConversation(items);

  if (!gates.hasLocalSetup) {
    return result(
      "needs_local_setup",
      { id: "complete_local_setup", label: "Finish local setup", href: "/onboarding/profile" },
      gates
    );
  }

  if (!gates.hasProfileBasics) {
    return result(
      "needs_profile_basics",
      {
        id: "complete_profile_basics",
        label: "Complete profile basics",
        href: "/onboarding/profile",
      },
      gates
    );
  }

  if (!gates.hasIntentConfirmation) {
    return result(
      "needs_intent_confirmation",
      { id: "confirm_intent", label: "Confirm your focus", href: "/onboarding/intent" },
      gates
    );
  }

  if (!gates.hasVerificationForLiveState) {
    return result(
      "needs_verification",
      { id: "complete_verification", label: "Complete verification", href: "/profile-settings" },
      gates
    );
  }

  if (hasActiveConversation(items)) {
    return result(
      "in_active_coordination",
      {
        id: "continue_direct_connect_coordination",
        label: "Continue coordination",
        href: "/direct-connect/inbox",
      },
      gates
    );
  }

  if (hasResponderDecision(items)) {
    return result(
      "has_direct_connect_response_to_accept_or_decline",
      {
        id: "respond_to_direct_connect_request",
        label: "Respond to request",
        href: "/direct-connect/inbox",
      },
      gates
    );
  }

  if (hasRequesterReplies(items)) {
    return result(
      "has_direct_connect_reply_to_review",
      {
        id: "review_direct_connect_replies",
        label: "Review replies",
        href: "/direct-connect/inbox",
      },
      gates
    );
  }

  if (hasWaitingRequest(items)) {
    return result(
      "has_direct_connect_request_waiting",
      {
        id: "track_direct_connect_request",
        label: "Track request",
        href: "/direct-connect/engagements",
      },
      gates
    );
  }

  if (isBusinessLiveProfile(user)) {
    return result(
      "ready_to_go_live",
      { id: "review_live_readiness", label: "Review live readiness", href: "/profile-settings" },
      gates
    );
  }

  if (gates.hasVerificationForLiveState) {
    return result(
      "ready_to_create_direct_connect_request",
      {
        id: "create_direct_connect_request",
        label: "Create Direct Connect request",
        href: "/direct-connect",
      },
      gates
    );
  }

  return result(
    "needs_verification",
    { id: "complete_verification", label: "Complete verification", href: "/profile-settings" },
    gates
  );
}
