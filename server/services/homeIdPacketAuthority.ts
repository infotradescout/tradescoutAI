import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import {
  parseHomeIdPersistenceGraph,
  resolveReadyHomeIdPacketGraph,
  type HomeIdPersistenceGraph,
  type ReadyHomeIdPacketGraph,
} from "../../shared/homeIdPacketAuthority";
import {
  userHomeRecords,
  userHomes,
  workRequestAssignments,
  workRequestEvents,
  workRequests,
} from "../../shared/schema";
import { db } from "../db";

const HOMEID_PROPERTY_DETAILS_TITLE = "homeid:persistence:property_details";
const HOMEID_REQUEST_PACKETS_TITLE = "homeid:persistence:request_packets";
const HOMEID_COMPONENTS_TITLE = "homeid:persistence:components";
const HOMEID_EVIDENCE_TITLE = "homeid:persistence:evidence";
const HOMEID_SUBMITTED_TIMELINE_TITLE = "homeid:timeline:direct_connect_request_submitted";
const HOMEID_COMPONENT_TYPES = new Set([
  "roof",
  "hvac",
  "plumbing",
  "electrical",
  "foundation",
  "exterior",
  "interior",
  "appliance",
  "water_heater",
  "custom",
]);

type HomeIdComponentStatus = "known" | "needs_review" | "unknown";
type HomeIdComponentSource =
  | "user_added"
  | "direct_connect_request"
  | "direct_connect_completed_work"
  | "homeid_packet";
type HomeIdEvidenceSource =
  | "user_uploaded"
  | "direct_connect_request"
  | "direct_connect_completed_work"
  | "homeid_packet";
type HomeIdEvidenceType =
  | "photo"
  | "document"
  | "receipt"
  | "invoice"
  | "inspection_report"
  | "warranty"
  | "manual"
  | "model_plate"
  | "other";
type HomeIdEvidenceStatus = "pending" | "verified" | "needs_review";

type HomeIdComponentRecord = {
  id: string;
  homeId: string;
  type: string;
  label: string;
  status: HomeIdComponentStatus;
  source: HomeIdComponentSource;
  linkedDirectConnectRequestIds?: string[];
  linkedHomePacketIds?: string[];
  createdAt: string;
  updatedAt: string;
};

type HomeIdEvidenceRecord = {
  id: string;
  homeId: string;
  componentId?: string;
  directConnectRequestId?: string;
  homePacketId?: string;
  selectedDetailIds?: string[];
  evidenceType: HomeIdEvidenceType;
  title: string;
  description?: string;
  source: HomeIdEvidenceSource;
  status: HomeIdEvidenceStatus;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
};

export type OwnedHomeIdPacketAuthorityResult =
  | {
      ok: true;
      homeId: string;
      userId: string;
      graph: ReadyHomeIdPacketGraph;
    }
  | {
      ok: false;
      reason: "home_not_owned" | "ambiguous_persistence_records" | "invalid_packet_graph";
    };

function jsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function sameStringSet(left: unknown, right: readonly string[]): boolean {
  if (!Array.isArray(left)) return false;
  const normalized = left.map((value) => (typeof value === "string" ? value.trim() : ""));
  if (normalized.some((value) => !value) || new Set(normalized).size !== normalized.length) {
    return false;
  }
  const expected = new Set(right);
  return normalized.length === expected.size && normalized.every((value) => expected.has(value));
}

type HomeIdAuthorityExecutor = any;

type HomeIdDraftLifecycleEvent = {
  type: string;
  actorUserId?: string | null;
  metadata?: unknown;
};

type HomeIdDraftRequestLock = {
  id: string;
  createdByUserId: string;
  source: string;
  status: string;
  scope: string;
  visibility: string;
  shareToken: string | null;
};

export type HomeIdPacketDraftCreateInput = {
  userId: string;
  title: string;
  description: string;
  category?: string;
  countyFips?: string;
  stateCode?: string;
  budgetMin?: string;
  budgetMax?: string;
  attachments?: string[];
  tradeId?: string;
  homeId: string;
  packetId: string;
  claimedSelectedDetailIds: unknown;
  readinessState: unknown;
  homeContextIntent: unknown;
  autoRoute?: boolean;
  targetContractorIds?: string[];
  targetProviderIds?: string[];
  targetProfileSlug?: string;
  discoveryAttributionToken?: string;
  now?: Date;
};

export type HomeIdPacketDraftCreateAdapter = {
  resolveAuthority: (params: {
    userId: string;
    homeId: string;
    packetId: string;
    claimedSelectedDetailIds: unknown;
  }) => Promise<OwnedHomeIdPacketAuthorityResult>;
  insertRequest: (values: Record<string, unknown>) => Promise<any | null>;
  insertLifecycleEvent: (event: {
    workRequestId: string;
    type: "homeid_draft_created" | "homeid_draft_reviewed" | "homeid_draft_submitted";
    actorUserId: string;
    metadata: Record<string, unknown>;
  }) => Promise<void>;
};

export type HomeIdPacketDraftSubmitInput = {
  userId: string;
  requestId: string;
  claimedHomeId: string;
  claimedPacketId: string;
  claimedSelectedDetailIds: unknown;
  now?: Date;
};

export type HomeIdPacketDraftSubmitAdapter = {
  lockRequest: (requestId: string) => Promise<HomeIdDraftRequestLock | null>;
  hasAssignments: (requestId: string) => Promise<boolean>;
  listLifecycleEvents: (requestId: string) => Promise<HomeIdDraftLifecycleEvent[]>;
  resolveAuthority: HomeIdPacketDraftCreateAdapter["resolveAuthority"];
  insertLifecycleEvent: HomeIdPacketDraftCreateAdapter["insertLifecycleEvent"];
  countSubmissionTimelineRecords: (params: {
    requestId: string;
    userId: string;
    homeId: string;
  }) => Promise<number>;
  insertSubmissionTimelineRecord: (params: {
    requestId: string;
    userId: string;
    homeId: string;
    graph: ReadyHomeIdPacketGraph;
    now: Date;
  }) => Promise<void>;
  transitionDraftToOpen: (params: {
    requestId: string;
    userId: string;
    now: Date;
  }) => Promise<boolean>;
};

function metadataObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function createHomeIdPacketGraphFingerprint(graph: ReadyHomeIdPacketGraph): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        packet: graph.packet,
        selectedDetails: graph.selectedDetails,
      })
    )
    .digest("hex");
}

export function hasForbiddenHomeIdDraftRouting(input: {
  autoRoute?: boolean;
  targetContractorIds?: string[];
  targetProviderIds?: string[];
  targetProfileSlug?: string;
  discoveryAttributionToken?: string;
}): boolean {
  return Boolean(
    input.autoRoute === true ||
    input.targetContractorIds?.length ||
    input.targetProviderIds?.length ||
    String(input.targetProfileSlug || "").trim() ||
    String(input.discoveryAttributionToken || "").trim()
  );
}

function buildHomeIdDraftLifecycleMetadata(params: {
  requestId: string;
  userId: string;
  homeId: string;
  graph: ReadyHomeIdPacketGraph;
}) {
  return {
    source: "homeid_packet",
    directConnectRequestId: params.requestId,
    homeId: params.homeId,
    homePacketId: params.graph.packet.id,
    requestType: params.graph.packet.requestType,
    selectedDetailIds: [...params.graph.packet.selectedDetailIds],
    readinessState: "ready_for_handoff",
    graphFingerprint: createHomeIdPacketGraphFingerprint(params.graph),
  } as const;
}

function lifecycleEventMatches(params: {
  event: HomeIdDraftLifecycleEvent;
  userId: string;
  expected: ReturnType<typeof buildHomeIdDraftLifecycleMetadata>;
}): boolean {
  const metadata = metadataObject(params.event.metadata);
  return Boolean(
    String(params.event.actorUserId || "") === params.userId &&
    metadata?.source === "homeid_packet" &&
    String(metadata?.directConnectRequestId || "") === params.expected.directConnectRequestId &&
    String(metadata?.homeId || "") === params.expected.homeId &&
    String(metadata?.homePacketId || "") === params.expected.homePacketId &&
    String(metadata?.requestType || "") === params.expected.requestType &&
    metadata?.readinessState === "ready_for_handoff" &&
    String(metadata?.graphFingerprint || "") === params.expected.graphFingerprint &&
    sameStringSet(metadata?.selectedDetailIds, params.expected.selectedDetailIds)
  );
}

export async function createHomeIdPacketDraftWithTransaction(
  adapter: HomeIdPacketDraftCreateAdapter,
  input: HomeIdPacketDraftCreateInput
) {
  if (hasForbiddenHomeIdDraftRouting(input)) {
    return { ok: false as const, reason: "routing_targets_forbidden" as const };
  }
  if (
    input.readinessState !== "ready_for_handoff" ||
    (input.homeContextIntent !== "link_existing" &&
      input.homeContextIntent !== "update_from_request")
  ) {
    return { ok: false as const, reason: "invalid_packet_graph" as const };
  }

  const authority = await adapter.resolveAuthority({
    userId: input.userId,
    homeId: input.homeId,
    packetId: input.packetId,
    claimedSelectedDetailIds: input.claimedSelectedDetailIds,
  });
  if (!authority.ok) return { ok: false as const, reason: authority.reason };

  const now = input.now ?? new Date();
  const created = await adapter.insertRequest({
    createdByUserId: input.userId,
    title: input.title,
    description: input.description,
    category: input.category,
    countyFips: input.countyFips,
    stateCode: input.stateCode,
    scope: "personal",
    source: "direct_connect",
    sourceRefId: null,
    status: "draft",
    visibility: "private",
    exposureMode: "guided",
    competitionMode: "none",
    budgetMin: input.budgetMin,
    budgetMax: input.budgetMax,
    attachments: input.attachments || [],
    tradeId: input.tradeId,
    shareToken: null,
    createdAt: now,
    updatedAt: now,
  });
  const requestId = String(created?.id || "").trim();
  if (!requestId) throw new Error("HomeID draft request insert did not return an id");

  const metadata = buildHomeIdDraftLifecycleMetadata({
    requestId,
    userId: input.userId,
    homeId: authority.homeId,
    graph: authority.graph,
  });
  await adapter.insertLifecycleEvent({
    workRequestId: requestId,
    type: "homeid_draft_created",
    actorUserId: input.userId,
    metadata,
  });

  return {
    ok: true as const,
    request: created,
    draft: {
      requestId,
      homeId: authority.homeId,
      homePacketId: authority.graph.packet.id,
      selectedDetailIds: [...authority.graph.packet.selectedDetailIds],
      requestType: authority.graph.packet.requestType,
      description: input.description,
      readinessState: "ready_for_handoff" as const,
      status: "draft" as const,
      scope: "personal" as const,
      visibility: "private" as const,
      audience: "requester" as const,
    },
  };
}

export async function submitHomeIdPacketDraftWithTransaction(
  adapter: HomeIdPacketDraftSubmitAdapter,
  input: HomeIdPacketDraftSubmitInput
) {
  const now = input.now ?? new Date();
  const request = await adapter.lockRequest(input.requestId);
  if (!request) return { ok: false as const, reason: "request_not_found" as const };
  if (request.createdByUserId !== input.userId) {
    return { ok: false as const, reason: "request_not_owned" as const };
  }
  const pendingIsolationValid =
    request.status === "draft" &&
    request.scope === "personal" &&
    request.visibility === "private";
  const submittedIsolationValid =
    request.status === "open" &&
    request.scope === "community" &&
    request.visibility === "community";
  if (
    request.source !== "direct_connect" ||
    Boolean(String(request.shareToken || "").trim()) ||
    (!pendingIsolationValid && !submittedIsolationValid)
  ) {
    return { ok: false as const, reason: "draft_isolation_invalid" as const };
  }
  if (pendingIsolationValid && (await adapter.hasAssignments(input.requestId))) {
    return { ok: false as const, reason: "draft_isolation_invalid" as const };
  }

  const events = await adapter.listLifecycleEvents(input.requestId);
  const createdEvents = events.filter((event) => event.type === "homeid_draft_created");
  const reviewedEvents = events.filter((event) => event.type === "homeid_draft_reviewed");
  const submittedEvents = events.filter((event) => event.type === "homeid_draft_submitted");
  if (createdEvents.length !== 1 || reviewedEvents.length > 1 || submittedEvents.length > 1) {
    return { ok: false as const, reason: "lifecycle_provenance_invalid" as const };
  }

  const createdMetadata = metadataObject(createdEvents[0]?.metadata);
  const eventHomeId = String(createdMetadata?.homeId || "").trim();
  const eventPacketId = String(createdMetadata?.homePacketId || "").trim();
  if (
    eventHomeId !== String(input.claimedHomeId || "").trim() ||
    eventPacketId !== String(input.claimedPacketId || "").trim()
  ) {
    return { ok: false as const, reason: "lifecycle_provenance_invalid" as const };
  }

  const authority = await adapter.resolveAuthority({
    userId: input.userId,
    homeId: eventHomeId,
    packetId: eventPacketId,
    claimedSelectedDetailIds: createdMetadata?.selectedDetailIds,
  });
  if (!authority.ok) return { ok: false as const, reason: "packet_graph_changed" as const };
  if (!sameStringSet(input.claimedSelectedDetailIds, authority.graph.packet.selectedDetailIds)) {
    return { ok: false as const, reason: "lifecycle_provenance_invalid" as const };
  }

  const expected = buildHomeIdDraftLifecycleMetadata({
    requestId: input.requestId,
    userId: input.userId,
    homeId: authority.homeId,
    graph: authority.graph,
  });
  if (!lifecycleEventMatches({ event: createdEvents[0], userId: input.userId, expected })) {
    return { ok: false as const, reason: "packet_graph_changed" as const };
  }

  const timelineRecordCount = await adapter.countSubmissionTimelineRecords({
    requestId: input.requestId,
    userId: input.userId,
    homeId: authority.homeId,
  });

  const hasReviewed = reviewedEvents.length === 1;
  const hasSubmitted = submittedEvents.length === 1;
  if (hasReviewed !== hasSubmitted) {
    return { ok: false as const, reason: "lifecycle_provenance_invalid" as const };
  }
  if (hasReviewed && hasSubmitted) {
    if (
      !submittedIsolationValid ||
      timelineRecordCount !== 1 ||
      !lifecycleEventMatches({ event: reviewedEvents[0], userId: input.userId, expected }) ||
      !lifecycleEventMatches({ event: submittedEvents[0], userId: input.userId, expected })
    ) {
      return { ok: false as const, reason: "lifecycle_provenance_invalid" as const };
    }
    return {
      ok: true as const,
      requestId: input.requestId,
      status: "open" as const,
      submitted: true as const,
      idempotent: true as const,
      draft: expected,
    };
  }
  if (!pendingIsolationValid) {
    return { ok: false as const, reason: "request_not_draft" as const };
  }
  if (timelineRecordCount !== 0) {
    return { ok: false as const, reason: "lifecycle_provenance_invalid" as const };
  }

  await adapter.insertLifecycleEvent({
    workRequestId: input.requestId,
    type: "homeid_draft_reviewed",
    actorUserId: input.userId,
    metadata: expected,
  });
  await adapter.insertLifecycleEvent({
    workRequestId: input.requestId,
    type: "homeid_draft_submitted",
    actorUserId: input.userId,
    metadata: expected,
  });
  const transitioned = await adapter.transitionDraftToOpen({
    requestId: input.requestId,
    userId: input.userId,
    now,
  });
  if (!transitioned) throw new Error("HomeID draft live transition failed");
  await adapter.insertSubmissionTimelineRecord({
    requestId: input.requestId,
    userId: input.userId,
    homeId: authority.homeId,
    graph: authority.graph,
    now,
  });

  return {
    ok: true as const,
    requestId: input.requestId,
    status: "open" as const,
    submitted: true as const,
    idempotent: false as const,
    draft: expected,
  };
}

function normalizeHomeIdComponentType(input?: string | null) {
  const value = String(input || "")
    .trim()
    .toLowerCase();
  if (!value) return "";
  return HOMEID_COMPONENT_TYPES.has(value) ? value : "custom";
}

export async function upsertHomeIdComponentFromDirectConnect(params: {
  homeId: string;
  userId: string;
  requestId: string;
  homePacketId?: string | null;
  componentType?: string | null;
  componentLabel?: string | null;
  source: HomeIdComponentSource;
  status: HomeIdComponentStatus;
}) {
  const normalizedType = normalizeHomeIdComponentType(params.componentType);
  const normalizedLabel = String(params.componentLabel || "").trim();
  if (!normalizedType && !normalizedLabel) return null;

  const [existingRecord] = await db
    .select({ id: userHomeRecords.id, details: userHomeRecords.details })
    .from(userHomeRecords)
    .where(
      and(
        eq(userHomeRecords.homeId, params.homeId),
        eq(userHomeRecords.createdByUserId, params.userId),
        eq(userHomeRecords.title, HOMEID_COMPONENTS_TITLE)
      )
    )
    .limit(1);
  const payload = jsonObject(existingRecord?.details);
  const existingComponents = Array.isArray(payload?.components)
    ? (payload.components as HomeIdComponentRecord[])
    : [];
  const nowIso = new Date().toISOString();
  const componentIndex = existingComponents.findIndex((component) => {
    const typeMatch =
      normalizedType &&
      String(component.type || "")
        .trim()
        .toLowerCase() === normalizedType;
    const labelMatch =
      normalizedLabel &&
      String(component.label || "")
        .trim()
        .toLowerCase() === normalizedLabel.toLowerCase();
    return Boolean(typeMatch || labelMatch);
  });
  const existing = componentIndex >= 0 ? existingComponents[componentIndex] : null;
  const linkedRequestIds = new Set(existing?.linkedDirectConnectRequestIds || []);
  linkedRequestIds.add(params.requestId);
  const linkedPacketIds = new Set(existing?.linkedHomePacketIds || []);
  if (params.homePacketId) linkedPacketIds.add(params.homePacketId);
  const nextComponent: HomeIdComponentRecord = {
    id: existing?.id || `cmp_${randomBytes(8).toString("hex")}`,
    homeId: params.homeId,
    type:
      normalizedType ||
      String(existing?.type || "")
        .trim()
        .toLowerCase() ||
      "custom",
    label: normalizedLabel || String(existing?.label || "").trim() || "Custom component",
    status: params.status,
    source: params.source,
    linkedDirectConnectRequestIds: Array.from(linkedRequestIds).slice(0, 200),
    linkedHomePacketIds: Array.from(linkedPacketIds).slice(0, 200),
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };
  const components =
    componentIndex >= 0
      ? existingComponents.map((component, index) =>
          index === componentIndex ? nextComponent : component
        )
      : [...existingComponents, nextComponent];
  const details = JSON.stringify({ components, updatedAt: nowIso });
  if (existingRecord?.id) {
    await db
      .update(userHomeRecords)
      .set({ details, updatedAt: new Date() } as any)
      .where(eq(userHomeRecords.id, existingRecord.id));
  } else {
    await db.insert(userHomeRecords).values({
      homeId: params.homeId,
      createdByUserId: params.userId,
      recordType: "note",
      title: HOMEID_COMPONENTS_TITLE,
      details,
      tags: ["homeid", "persistence", "components"],
      updatedAt: new Date(),
    } as any);
  }
  return nextComponent;
}

export async function appendHomeIdRequestContextRecord(params: {
  homeId: string;
  userId: string;
  requestId: string;
  title: string;
  description: string;
  requestCategory: string;
  componentType?: string | null;
  componentId?: string | null;
  componentLabel?: string | null;
  homeContextIntent: string;
  homePacketId?: string | null;
  homePacketSelectedDetailIds?: string[] | null;
  homePacketReadinessState?: string | null;
}) {
  await db.insert(userHomeRecords).values({
    homeId: params.homeId,
    createdByUserId: params.userId,
    recordType: "note",
    title: "homeid:direct_connect_request_context",
    details: JSON.stringify({
      source: "direct_connect_request",
      requestId: params.requestId,
      requestCategory: params.requestCategory,
      requestTitle: params.title,
      requestDescription: params.description,
      componentType: params.componentType || null,
      componentId: params.componentId || null,
      componentLabel: params.componentLabel || null,
      status: "needs_review",
      homeContextIntent: params.homeContextIntent,
      homePacketId: params.homePacketId || null,
      homePacketSelectedDetailIds: params.homePacketSelectedDetailIds || [],
      homePacketReadinessState: params.homePacketReadinessState || null,
      capturedAt: new Date().toISOString(),
    }),
    tags: ["homeid", "direct_connect", "needs_review"],
    updatedAt: new Date(),
  } as any);
  await upsertHomeIdComponentFromDirectConnect({
    homeId: params.homeId,
    userId: params.userId,
    requestId: params.requestId,
    homePacketId: params.homePacketId,
    componentType: params.componentType,
    componentLabel: params.componentLabel,
    source:
      params.homeContextIntent === "link_existing" ? "homeid_packet" : "direct_connect_request",
    status: "needs_review",
  });
}

export async function upsertHomeIdEvidenceFromDirectConnect(params: {
  homeId: string;
  userId: string;
  requestId: string;
  homePacketId?: string | null;
  selectedDetailIds?: string[];
  componentId?: string | null;
  evidenceType: HomeIdEvidenceType;
  title: string;
  description?: string | null;
  source: HomeIdEvidenceSource;
  status: HomeIdEvidenceStatus;
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  const [existingRecord] = await db
    .select({ id: userHomeRecords.id, details: userHomeRecords.details })
    .from(userHomeRecords)
    .where(
      and(
        eq(userHomeRecords.homeId, params.homeId),
        eq(userHomeRecords.createdByUserId, params.userId),
        eq(userHomeRecords.title, HOMEID_EVIDENCE_TITLE)
      )
    )
    .limit(1);
  const payload = jsonObject(existingRecord?.details);
  const existingEvidence = Array.isArray(payload?.evidence)
    ? (payload.evidence as HomeIdEvidenceRecord[])
    : [];
  const nowIso = new Date().toISOString();
  const nextEvidence: HomeIdEvidenceRecord = {
    id: `evd_${randomBytes(8).toString("hex")}`,
    homeId: params.homeId,
    componentId: params.componentId || undefined,
    directConnectRequestId: params.requestId,
    homePacketId: params.homePacketId || undefined,
    selectedDetailIds: (params.selectedDetailIds || [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
      .slice(0, 200),
    evidenceType: params.evidenceType,
    title: params.title.trim().slice(0, 220),
    description: params.description?.trim().slice(0, 2000) || undefined,
    source: params.source,
    status: params.status,
    fileUrl: params.fileUrl?.trim().slice(0, 1000) || undefined,
    fileName: params.fileName?.trim().slice(0, 260) || undefined,
    mimeType: params.mimeType?.trim().slice(0, 120) || undefined,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const evidence = [...existingEvidence, nextEvidence].slice(-1200);
  const details = JSON.stringify({ evidence, updatedAt: nowIso });
  if (existingRecord?.id) {
    await db
      .update(userHomeRecords)
      .set({ details, updatedAt: new Date() } as any)
      .where(eq(userHomeRecords.id, existingRecord.id));
  } else {
    await db.insert(userHomeRecords).values({
      homeId: params.homeId,
      createdByUserId: params.userId,
      recordType: "note",
      title: HOMEID_EVIDENCE_TITLE,
      details,
      tags: ["homeid", "persistence", "evidence"],
      updatedAt: new Date(),
    } as any);
  }
}

export async function resolveOwnedHomeForDirectConnect(userId: string, homeId?: string | null) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedHomeId = String(homeId || "").trim();
  if (!normalizedUserId || !normalizedHomeId) return null;
  const [home] = await db
    .select()
    .from(userHomes)
    .where(and(eq(userHomes.id, normalizedHomeId), eq(userHomes.ownerUserId, normalizedUserId)))
    .limit(1);
  return home || null;
}

export async function createHomeIdShellFromRequest(params: {
  userId: string;
  title: string;
  requestCategory: string;
  stateCode?: string | null;
  countyFips?: string | null;
}) {
  const nickname = `From Direct Connect: ${params.title}`.slice(0, 120);
  const [createdHome] = await db
    .insert(userHomes)
    .values({
      ownerUserId: params.userId,
      nickname,
      propertyType: "other",
      stateCode: params.stateCode || null,
      countyFips: params.countyFips || null,
      updatedAt: new Date(),
    })
    .returning();
  if (!createdHome) return null;

  await db.insert(userHomeRecords).values([
    {
      homeId: createdHome.id,
      createdByUserId: params.userId,
      recordType: "note",
      title: "homeid:authority",
      details: JSON.stringify({
        subjectId: params.userId,
        role: "owner",
        status: "active",
        source: "direct_connect_request",
        createdAt: new Date().toISOString(),
      }),
      tags: ["homeid", "authority"],
      updatedAt: new Date(),
    },
    {
      homeId: createdHome.id,
      createdByUserId: params.userId,
      recordType: "note",
      title: "homeid:creation",
      details: JSON.stringify({
        source: "direct_connect_request",
        requestCategory: params.requestCategory,
        createdAt: new Date().toISOString(),
      }),
      tags: ["homeid", "creation"],
      updatedAt: new Date(),
    },
  ] as any);
  return createdHome;
}

/**
 * Resolves the owned, persisted HomeID packet graph. Request payload ids are
 * claims only; this function returns canonical saved packet/detail authority.
 */
async function resolveOwnedReadyHomeIdPacketGraphWithExecutor(
  executor: HomeIdAuthorityExecutor,
  params: {
    userId: string;
    homeId: string;
    packetId: string;
    claimedSelectedDetailIds: unknown;
  }
): Promise<OwnedHomeIdPacketAuthorityResult> {
  const userId = String(params.userId || "").trim();
  const homeId = String(params.homeId || "").trim();
  const packetId = String(params.packetId || "").trim();
  if (!userId || !homeId || !packetId) return { ok: false, reason: "invalid_packet_graph" };

  const [ownedHome] = await executor
    .select({ id: userHomes.id })
    .from(userHomes)
    .where(and(eq(userHomes.id, homeId), eq(userHomes.ownerUserId, userId)))
    .limit(1);
  if (!ownedHome?.id) return { ok: false, reason: "home_not_owned" };

  const records = await executor
    .select({ title: userHomeRecords.title, details: userHomeRecords.details })
    .from(userHomeRecords)
    .where(
      and(
        eq(userHomeRecords.homeId, homeId),
        eq(userHomeRecords.createdByUserId, userId),
        inArray(userHomeRecords.title, [
          HOMEID_PROPERTY_DETAILS_TITLE,
          HOMEID_REQUEST_PACKETS_TITLE,
        ])
      )
    );
  const detailRecords = records.filter((record) => record.title === HOMEID_PROPERTY_DETAILS_TITLE);
  const packetRecords = records.filter((record) => record.title === HOMEID_REQUEST_PACKETS_TITLE);
  if (detailRecords.length !== 1 || packetRecords.length !== 1) {
    return { ok: false, reason: "ambiguous_persistence_records" };
  }

  const detailPayload = jsonObject(detailRecords[0]?.details);
  const packetPayload = jsonObject(packetRecords[0]?.details);
  const resolved = resolveReadyHomeIdPacketGraph({
    persistence: {
      propertyDetails: detailPayload?.propertyDetails,
      requestPackets: packetPayload?.requestPackets,
    },
    packetId,
    claimedSelectedDetailIds: params.claimedSelectedDetailIds,
  });
  if (!resolved.ok) return { ok: false, reason: "invalid_packet_graph" };

  return { ok: true, homeId, userId, graph: resolved.graph };
}

export async function resolveOwnedReadyHomeIdPacketGraph(params: {
  userId: string;
  homeId: string;
  packetId: string;
  claimedSelectedDetailIds: unknown;
}): Promise<OwnedHomeIdPacketAuthorityResult> {
  return resolveOwnedReadyHomeIdPacketGraphWithExecutor(db, params);
}

export async function createHomeIdPacketDraft(params: HomeIdPacketDraftCreateInput) {
  return db.transaction(async (tx: any) =>
    createHomeIdPacketDraftWithTransaction(
      {
        resolveAuthority: (authorityParams) =>
          resolveOwnedReadyHomeIdPacketGraphWithExecutor(tx, authorityParams),
        insertRequest: async (values) => {
          const [created] = await tx
            .insert(workRequests)
            .values(values as any)
            .returning();
          return created || null;
        },
        insertLifecycleEvent: async (event) => {
          await tx.insert(workRequestEvents).values(event as any);
        },
      },
      params
    )
  );
}

export async function submitHomeIdPacketDraft(params: HomeIdPacketDraftSubmitInput) {
  return db.transaction(async (tx: any) =>
    submitHomeIdPacketDraftWithTransaction(
      {
        lockRequest: async (requestId) => {
          const result = await tx.execute(sql`
            SELECT id, created_by_user_id, source, status, scope, visibility, share_token
            FROM work_requests
            WHERE id = ${requestId}
            FOR UPDATE
          `);
          const row = (result.rows?.[0] as any) || null;
          if (!row) return null;
          return {
            id: String(row.id || ""),
            createdByUserId: String(row.createdByUserId ?? row.created_by_user_id ?? ""),
            source: String(row.source || ""),
            status: String(row.status || ""),
            scope: String(row.scope || ""),
            visibility: String(row.visibility || ""),
            shareToken: row.shareToken ?? row.share_token ?? null,
          };
        },
        listLifecycleEvents: async (requestId) =>
          tx
            .select({
              type: workRequestEvents.type,
              actorUserId: workRequestEvents.actorUserId,
              metadata: workRequestEvents.metadata,
            })
            .from(workRequestEvents)
            .where(eq(workRequestEvents.workRequestId, requestId)),
        hasAssignments: async (requestId) => {
          const assigned = await tx
            .select({ id: workRequestAssignments.id })
            .from(workRequestAssignments)
            .where(eq(workRequestAssignments.workRequestId, requestId))
            .limit(1);
          return assigned.length > 0;
        },
        resolveAuthority: (authorityParams) =>
          resolveOwnedReadyHomeIdPacketGraphWithExecutor(tx, authorityParams),
        insertLifecycleEvent: async (event) => {
          await tx.insert(workRequestEvents).values(event as any);
        },
        countSubmissionTimelineRecords: async ({ requestId, userId, homeId }) => {
          const records = await tx
            .select({ details: userHomeRecords.details })
            .from(userHomeRecords)
            .where(
              and(
                eq(userHomeRecords.homeId, homeId),
                eq(userHomeRecords.createdByUserId, userId),
                eq(userHomeRecords.title, HOMEID_SUBMITTED_TIMELINE_TITLE)
              )
            );
          return records.filter((record: { details: unknown }) => {
            const details = jsonObject(record.details);
            return String(details?.directConnectRequestId || "") === requestId;
          }).length;
        },
        insertSubmissionTimelineRecord: async ({ requestId, userId, homeId, graph, now }) => {
          const nowIso = now.toISOString();
          await tx.insert(userHomeRecords).values({
            homeId,
            createdByUserId: userId,
            recordType: "note",
            title: HOMEID_SUBMITTED_TIMELINE_TITLE,
            details: JSON.stringify({
              homeId,
              directConnectRequestId: requestId,
              homePacketId: graph.packet.id,
              selectedDetailIds: [...graph.packet.selectedDetailIds],
              componentType: null,
              componentLabel: null,
              eventType: "direct_connect_request_submitted",
              source: "direct_connect_jobflow",
              title: "Direct Connect request submitted",
              summary: "A HomeID-linked request was reviewed and submitted.",
              occurredAt: nowIso,
              createdAt: nowIso,
            }),
            tags: [
              "homeid",
              "timeline",
              "direct_connect_jobflow",
              "direct_connect_request_submitted",
            ],
            occurredAt: now,
            updatedAt: now,
          } as any);
        },
        transitionDraftToOpen: async ({ requestId, userId, now }) => {
          const transitioned = await tx
            .update(workRequests)
            .set({
              status: "open",
              scope: "community",
              visibility: "community",
              updatedAt: now,
            })
            .where(
              and(
                eq(workRequests.id, requestId),
                eq(workRequests.createdByUserId, userId),
                eq(workRequests.source, "direct_connect"),
                eq(workRequests.status, "draft"),
                eq(workRequests.scope, "personal"),
                eq(workRequests.visibility, "private"),
                isNull(workRequests.shareToken)
              )
            )
            .returning({ id: workRequests.id });
          return transitioned.length === 1;
        },
      },
      params
    )
  );
}

export type HomeIdFullGraphPersistenceInput = {
  userId: string;
  homeId: string;
  propertyDetails: unknown;
  requestPackets: unknown;
  now?: Date;
};

export type HomeIdFullGraphPersistenceAdapter = {
  lockOwnedHome: (params: { userId: string; homeId: string }) => Promise<boolean>;
  listGraphRecords: (params: {
    userId: string;
    homeId: string;
  }) => Promise<Array<{ id: string; title: string }>>;
  writeGraphRecord: (params: {
    existingId?: string;
    userId: string;
    homeId: string;
    title: string;
    payload: Record<string, unknown>;
    now: Date;
  }) => Promise<void>;
};

export async function persistHomeIdFullGraphWithTransaction(
  adapter: HomeIdFullGraphPersistenceAdapter,
  input: HomeIdFullGraphPersistenceInput
) {
  const graph = parseHomeIdPersistenceGraph({
    propertyDetails: input.propertyDetails,
    requestPackets: input.requestPackets,
  });
  if (!graph) return { ok: false as const, reason: "invalid_packet_graph" as const };

  const owned = await adapter.lockOwnedHome({ userId: input.userId, homeId: input.homeId });
  if (!owned) return { ok: false as const, reason: "home_not_owned" as const };
  const records = await adapter.listGraphRecords({
    userId: input.userId,
    homeId: input.homeId,
  });
  const detailRecords = records.filter((record) => record.title === HOMEID_PROPERTY_DETAILS_TITLE);
  const packetRecords = records.filter((record) => record.title === HOMEID_REQUEST_PACKETS_TITLE);
  if (detailRecords.length > 1 || packetRecords.length > 1) {
    return { ok: false as const, reason: "ambiguous_persistence_records" as const };
  }

  const now = input.now ?? new Date();
  const updatedAt = now.toISOString();
  await adapter.writeGraphRecord({
    existingId: detailRecords[0]?.id,
    userId: input.userId,
    homeId: input.homeId,
    title: HOMEID_PROPERTY_DETAILS_TITLE,
    payload: { propertyDetails: graph.propertyDetails, updatedAt },
    now,
  });
  await adapter.writeGraphRecord({
    existingId: packetRecords[0]?.id,
    userId: input.userId,
    homeId: input.homeId,
    title: HOMEID_REQUEST_PACKETS_TITLE,
    payload: { requestPackets: graph.requestPackets, updatedAt },
    now,
  });

  return {
    ok: true as const,
    persistence: {
      propertyDetails: graph.propertyDetails,
      requestPackets: graph.requestPackets,
      updatedAt,
    },
  };
}

export async function persistHomeIdFullGraph(params: HomeIdFullGraphPersistenceInput) {
  return db.transaction(async (tx: any) =>
    persistHomeIdFullGraphWithTransaction(
      {
        lockOwnedHome: async ({ userId, homeId }) => {
          const result = await tx.execute(sql`
            SELECT id
            FROM user_homes
            WHERE id = ${homeId} AND owner_user_id = ${userId}
            FOR UPDATE
          `);
          return Boolean(result.rows?.[0]);
        },
        listGraphRecords: ({ userId, homeId }) =>
          tx
            .select({ id: userHomeRecords.id, title: userHomeRecords.title })
            .from(userHomeRecords)
            .where(
              and(
                eq(userHomeRecords.homeId, homeId),
                eq(userHomeRecords.createdByUserId, userId),
                inArray(userHomeRecords.title, [
                  HOMEID_PROPERTY_DETAILS_TITLE,
                  HOMEID_REQUEST_PACKETS_TITLE,
                ])
              )
            ),
        writeGraphRecord: async ({ existingId, userId, homeId, title, payload, now }) => {
          const details = JSON.stringify(payload);
          if (existingId) {
            await tx
              .update(userHomeRecords)
              .set({ details, updatedAt: now } as any)
              .where(eq(userHomeRecords.id, existingId));
            return;
          }
          await tx.insert(userHomeRecords).values({
            homeId,
            createdByUserId: userId,
            recordType: "note",
            title,
            details,
            tags: ["homeid", "persistence"],
            updatedAt: now,
          } as any);
        },
      },
      params
    )
  );
}

export type OwnedPendingHomeIdDraft = {
  requestId: string;
  homeId: string;
  homePacketId: string;
  selectedDetailIds: string[];
  requestType: string;
  description: string;
  readinessState: "ready_for_handoff";
  status: "draft";
  scope: "personal";
  visibility: "private";
  audience: "requester";
  createdAt: string;
};

export async function listOwnedPendingHomeIdDrafts(params: {
  userId: string;
  homeId: string;
}): Promise<OwnedPendingHomeIdDraft[]> {
  const requests = await db
    .select({
      id: workRequests.id,
      category: workRequests.category,
      description: workRequests.description,
      createdAt: workRequests.createdAt,
    })
    .from(workRequests)
    .where(
      and(
        eq(workRequests.createdByUserId, params.userId),
        eq(workRequests.source, "direct_connect"),
        eq(workRequests.status, "draft"),
        eq(workRequests.scope, "personal"),
        eq(workRequests.visibility, "private"),
        isNull(workRequests.shareToken)
      )
    )
    .limit(100);
  if (!requests.length) return [];

  const requestIds = requests.map((request) => String(request.id));
  const [events, assignments] = await Promise.all([
    db
      .select({
        workRequestId: workRequestEvents.workRequestId,
        type: workRequestEvents.type,
        actorUserId: workRequestEvents.actorUserId,
        metadata: workRequestEvents.metadata,
      })
      .from(workRequestEvents)
      .where(inArray(workRequestEvents.workRequestId, requestIds)),
    db
      .select({ workRequestId: workRequestAssignments.workRequestId })
      .from(workRequestAssignments)
      .where(inArray(workRequestAssignments.workRequestId, requestIds)),
  ]);
  const assignedRequestIds = new Set(
    assignments.map((assignment) => String(assignment.workRequestId || ""))
  );
  const pending: OwnedPendingHomeIdDraft[] = [];

  for (const request of requests) {
    const requestId = String(request.id || "");
    if (!requestId || assignedRequestIds.has(requestId)) continue;
    const lifecycle = events.filter((event) => String(event.workRequestId || "") === requestId);
    const created = lifecycle.filter((event) => event.type === "homeid_draft_created");
    if (
      created.length !== 1 ||
      lifecycle.some(
        (event) => event.type === "homeid_draft_reviewed" || event.type === "homeid_draft_submitted"
      )
    ) {
      continue;
    }
    const metadata = metadataObject(created[0]?.metadata);
    if (
      String(created[0]?.actorUserId || "") !== params.userId ||
      String(metadata?.homeId || "") !== params.homeId ||
      String(metadata?.directConnectRequestId || "") !== requestId
    ) {
      continue;
    }
    const homePacketId = String(metadata?.homePacketId || "").trim();
    const authority = await resolveOwnedReadyHomeIdPacketGraph({
      userId: params.userId,
      homeId: params.homeId,
      packetId: homePacketId,
      claimedSelectedDetailIds: metadata?.selectedDetailIds,
    });
    if (!authority.ok) continue;
    const expected = buildHomeIdDraftLifecycleMetadata({
      requestId,
      userId: params.userId,
      homeId: params.homeId,
      graph: authority.graph,
    });
    if (!lifecycleEventMatches({ event: created[0], userId: params.userId, expected })) continue;

    pending.push({
      requestId,
      homeId: params.homeId,
      homePacketId: authority.graph.packet.id,
      selectedDetailIds: [...authority.graph.packet.selectedDetailIds],
      requestType: authority.graph.packet.requestType,
      description: String(request.description || ""),
      readinessState: "ready_for_handoff",
      status: "draft",
      scope: "personal",
      visibility: "private",
      audience: "requester",
      createdAt: request.createdAt?.toISOString?.() || "",
    });
  }

  return pending.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
