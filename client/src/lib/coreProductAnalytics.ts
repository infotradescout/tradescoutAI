import { getDeviceType, trackShellEvent } from "@/lib/analytics";
import { observeDirectConnectFunnelEvent } from "@/lib/telemetry";

export type CoreProductUserState = "anonymous" | "authenticated";

type CoreBaseArgs = {
  userState: CoreProductUserState;
};

type HomesArgs = CoreBaseArgs & {
  homeId?: string;
  requestId?: string;
  packetId?: string;
  componentType?: string;
  source?: string;
};

type DirectConnectArgs = CoreBaseArgs & {
  homeId?: string;
  requestId?: string;
  packetId?: string;
  componentType?: string;
  source?: string;
};

type ScoutArgs = CoreBaseArgs & {
  homeId?: string;
  actionCardType?: string;
  componentType?: string;
  requestId?: string;
  packetId?: string;
  source?: string;
};

const seenViewedEvents = new Set<string>();

function nowIso() {
  return new Date().toISOString();
}

function onceKey(type: string, userState: CoreProductUserState, homeId: string) {
  return `${type}|${userState}|${homeId}`;
}

function maybeOnce(type: string, userState: CoreProductUserState, homeId?: string): boolean {
  if (!homeId) return true;
  const key = onceKey(type, userState, homeId);
  if (seenViewedEvents.has(key)) return false;
  seenViewedEvents.add(key);
  return true;
}

// test hook only
export function __resetCoreProductAnalyticsSeenForTests() {
  seenViewedEvents.clear();
}

function trackHomesEvent(
  type:
    | "homeid_started"
    | "homeid_first_detail_added"
    | "homeid_component_added"
    | "homeid_evidence_added"
    | "homeid_request_packet_created"
    | "homeid_request_packet_ready"
    | "homeid_direct_connect_draft_created"
    | "homeid_direct_connect_request_submitted",
  args: HomesArgs
) {
  if (type === "homeid_direct_connect_request_submitted") {
    observeDirectConnectFunnelEvent({ type: "direct_connect_request_submitted" });
  }
  void trackShellEvent({
    type,
    surface: "homes",
    userState: args.userState,
    viewport: getDeviceType(),
    source: args.source || "homes_ui",
    homeId: args.homeId,
    requestId: args.requestId,
    packetId: args.packetId,
    componentType: args.componentType,
    ts: nowIso(),
  });
}

export function trackHomeIdStarted(args: HomesArgs) {
  trackHomesEvent("homeid_started", args);
}

type PropertyBuildArgs = CoreBaseArgs & {
  propertyProgramId?: string;
  role?: string;
  source?: string;
};

function trackPropertyBuildEvent(
  type: "property_build_started" | "property_participant_invited" | "property_milestone_added",
  args: PropertyBuildArgs
) {
  void trackShellEvent({
    type,
    surface: "property_build",
    userState: args.userState,
    viewport: getDeviceType(),
    source: args.source || "property_build_ui",
    propertyProgramId: args.propertyProgramId,
    role: args.role,
    ts: nowIso(),
  });
}

export function trackPropertyBuildStarted(args: PropertyBuildArgs) {
  trackPropertyBuildEvent("property_build_started", args);
}

export function trackPropertyParticipantInvited(args: PropertyBuildArgs) {
  trackPropertyBuildEvent("property_participant_invited", args);
}

export function trackPropertyMilestoneAdded(args: PropertyBuildArgs) {
  trackPropertyBuildEvent("property_milestone_added", args);
}

export function trackHomeIdFirstDetailAdded(args: HomesArgs) {
  trackHomesEvent("homeid_first_detail_added", args);
}

export function trackHomeIdComponentAdded(args: HomesArgs) {
  trackHomesEvent("homeid_component_added", args);
}

export function trackHomeIdEvidenceAdded(args: HomesArgs) {
  trackHomesEvent("homeid_evidence_added", args);
}

export function trackHomeIdRequestPacketCreated(args: HomesArgs) {
  trackHomesEvent("homeid_request_packet_created", args);
}

export function trackHomeIdRequestPacketReady(args: HomesArgs) {
  trackHomesEvent("homeid_request_packet_ready", args);
}

export function trackHomeIdDirectConnectDraftCreated(args: HomesArgs) {
  trackHomesEvent("homeid_direct_connect_draft_created", args);
}

export function trackHomeIdDirectConnectRequestSubmitted(args: HomesArgs) {
  trackHomesEvent("homeid_direct_connect_request_submitted", args);
}

export function trackDirectConnectHomeIdLinkSelected(args: DirectConnectArgs) {
  void trackShellEvent({
    type: "direct_connect_homeid_link_selected",
    surface: "direct_connect",
    userState: args.userState,
    viewport: getDeviceType(),
    source: args.source || "direct_connect_ui",
    homeId: args.homeId,
    requestId: args.requestId,
    packetId: args.packetId,
    componentType: args.componentType,
    ts: nowIso(),
  });
}

export function trackDirectConnectRequestStarted(args: DirectConnectArgs) {
  observeDirectConnectFunnelEvent({ type: "direct_connect_request_started" });
  void trackShellEvent({
    type: "direct_connect_request_started",
    surface: "direct_connect",
    userState: args.userState,
    viewport: getDeviceType(),
    source: args.source || "direct_connect_ui",
    homeId: args.homeId,
    requestId: args.requestId,
    packetId: args.packetId,
    componentType: args.componentType,
    ts: nowIso(),
  });
}

type DirectConnectHomeRecordEventType =
  | "direct_connect_home_record_prompt_viewed"
  | "direct_connect_home_record_link_selected"
  | "direct_connect_home_record_create_selected"
  | "direct_connect_home_record_skipped"
  | "direct_connect_request_submitted_after_home_record_skip";

function trackDirectConnectHomeRecordEvent(
  type: DirectConnectHomeRecordEventType,
  args: DirectConnectArgs
) {
  observeDirectConnectFunnelEvent({ type });
  void trackShellEvent({
    type,
    surface: "direct_connect",
    userState: args.userState,
    viewport: getDeviceType(),
    source: args.source || "direct_connect_ui",
    homeId: args.homeId,
    requestId: args.requestId,
    packetId: args.packetId,
    componentType: args.componentType,
    ts: nowIso(),
  });
}

export function trackDirectConnectHomeRecordPromptViewed(args: DirectConnectArgs) {
  trackDirectConnectHomeRecordEvent("direct_connect_home_record_prompt_viewed", args);
}

export function trackDirectConnectHomeRecordLinkSelected(args: DirectConnectArgs) {
  trackDirectConnectHomeRecordEvent("direct_connect_home_record_link_selected", args);
}

export function trackDirectConnectHomeRecordCreateSelected(args: DirectConnectArgs) {
  trackDirectConnectHomeRecordEvent("direct_connect_home_record_create_selected", args);
}

export function trackDirectConnectHomeRecordSkipped(args: DirectConnectArgs) {
  trackDirectConnectHomeRecordEvent("direct_connect_home_record_skipped", args);
}

export function trackDirectConnectRequestSubmittedAfterHomeRecordSkip(args: DirectConnectArgs) {
  trackDirectConnectHomeRecordEvent(
    "direct_connect_request_submitted_after_home_record_skip",
    args
  );
}

export function trackDirectConnectHomeIdCreatedFromRequest(args: DirectConnectArgs) {
  observeDirectConnectFunnelEvent({ type: "direct_connect_request_submitted" });
  void trackShellEvent({
    type: "direct_connect_homeid_created_from_request",
    surface: "direct_connect",
    userState: args.userState,
    viewport: getDeviceType(),
    source: args.source || "direct_connect_server",
    homeId: args.homeId,
    requestId: args.requestId,
    packetId: args.packetId,
    componentType: args.componentType,
    ts: nowIso(),
  });
}

export function trackDirectConnectHomeIdUpdatedFromRequest(args: DirectConnectArgs) {
  observeDirectConnectFunnelEvent({ type: "direct_connect_request_submitted" });
  void trackShellEvent({
    type: "direct_connect_homeid_updated_from_request",
    surface: "direct_connect",
    userState: args.userState,
    viewport: getDeviceType(),
    source: args.source || "direct_connect_server",
    homeId: args.homeId,
    requestId: args.requestId,
    packetId: args.packetId,
    componentType: args.componentType,
    ts: nowIso(),
  });
}

export function trackScoutHomeIdContextViewed(args: ScoutArgs) {
  if (!maybeOnce("scout_homeid_context_viewed", args.userState, args.homeId)) return;
  void trackShellEvent({
    type: "scout_homeid_context_viewed",
    surface: "scout",
    userState: args.userState,
    viewport: getDeviceType(),
    source: args.source || "scout_context_rail",
    homeId: args.homeId,
    actionCardType: args.actionCardType,
    componentType: args.componentType,
    requestId: args.requestId,
    packetId: args.packetId,
    ts: nowIso(),
  });
}

export function trackScoutHomeIdActionCardClicked(args: ScoutArgs) {
  void trackShellEvent({
    type: "scout_homeid_action_card_clicked",
    surface: "scout",
    userState: args.userState,
    viewport: getDeviceType(),
    source: args.source || "scout_action_card",
    homeId: args.homeId,
    actionCardType: args.actionCardType,
    componentType: args.componentType,
    requestId: args.requestId,
    packetId: args.packetId,
    ts: nowIso(),
  });
}
