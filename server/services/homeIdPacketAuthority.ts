import { and, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  resolveReadyHomeIdPacketGraph,
  type ReadyHomeIdPacketGraph,
} from "../../shared/homeIdPacketAuthority";
import { userHomeRecords, userHomes, workRequestEvents } from "../../shared/schema";
import { db } from "../db";

const HOMEID_PROPERTY_DETAILS_TITLE = "homeid:persistence:property_details";
const HOMEID_REQUEST_PACKETS_TITLE = "homeid:persistence:request_packets";
const HOMEID_COMPONENTS_TITLE = "homeid:persistence:components";
const HOMEID_EVIDENCE_TITLE = "homeid:persistence:evidence";
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
  const normalized = left.map((value) =>
    typeof value === "string" ? value.trim() : ""
  );
  if (normalized.some((value) => !value) || new Set(normalized).size !== normalized.length) {
    return false;
  }
  const expected = new Set(right);
  return normalized.length === expected.size && normalized.every((value) => expected.has(value));
}

function normalizeHomeIdComponentType(input?: string | null) {
  const value = String(input || "").trim().toLowerCase();
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
      normalizedType && String(component.type || "").trim().toLowerCase() === normalizedType;
    const labelMatch =
      normalizedLabel &&
      String(component.label || "").trim().toLowerCase() === normalizedLabel.toLowerCase();
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
    type: normalizedType || String(existing?.type || "").trim().toLowerCase() || "custom",
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
    .where(
      and(eq(userHomes.id, normalizedHomeId), eq(userHomes.ownerUserId, normalizedUserId))
    )
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
export async function resolveOwnedReadyHomeIdPacketGraph(params: {
  userId: string;
  homeId: string;
  packetId: string;
  claimedSelectedDetailIds: unknown;
}): Promise<OwnedHomeIdPacketAuthorityResult> {
  const userId = String(params.userId || "").trim();
  const homeId = String(params.homeId || "").trim();
  const packetId = String(params.packetId || "").trim();
  if (!userId || !homeId || !packetId) return { ok: false, reason: "invalid_packet_graph" };

  const [ownedHome] = await db
    .select({ id: userHomes.id })
    .from(userHomes)
    .where(and(eq(userHomes.id, homeId), eq(userHomes.ownerUserId, userId)))
    .limit(1);
  if (!ownedHome?.id) return { ok: false, reason: "home_not_owned" };

  const records = await db
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

export async function resolveHomeIdDraftSubmissionAuthority(params: {
  userId: string;
  requestId: string;
  claimedHomeId: string;
  claimedPacketId: string;
  claimedSelectedDetailIds: unknown;
}): Promise<OwnedHomeIdPacketAuthorityResult> {
  const userId = String(params.userId || "").trim();
  const requestId = String(params.requestId || "").trim();
  const claimedHomeId = String(params.claimedHomeId || "").trim();
  const claimedPacketId = String(params.claimedPacketId || "").trim();
  if (!userId || !requestId || !claimedHomeId || !claimedPacketId) {
    return { ok: false, reason: "invalid_packet_graph" };
  }

  const events = await db
    .select({
      type: workRequestEvents.type,
      actorUserId: workRequestEvents.actorUserId,
      metadata: workRequestEvents.metadata,
    })
    .from(workRequestEvents)
    .where(eq(workRequestEvents.workRequestId, requestId));
  const draftEvents = events.filter((event) => event.type === "homeid_draft_created");
  const alreadySubmitted = events.some((event) => event.type === "homeid_draft_submitted");
  if (draftEvents.length !== 1 || alreadySubmitted) {
    return { ok: false, reason: "ambiguous_persistence_records" };
  }

  const draft = draftEvents[0];
  const metadata =
    draft?.metadata && typeof draft.metadata === "object" && !Array.isArray(draft.metadata)
      ? (draft.metadata as Record<string, unknown>)
      : null;
  const eventHomeId = String(metadata?.homeId || "").trim();
  const eventPacketId = String(metadata?.homePacketId || "").trim();
  if (
    String(draft?.actorUserId || "") !== userId ||
    eventHomeId !== claimedHomeId ||
    eventPacketId !== claimedPacketId
  ) {
    return { ok: false, reason: "invalid_packet_graph" };
  }

  const owned = await resolveOwnedReadyHomeIdPacketGraph({
    userId,
    homeId: eventHomeId,
    packetId: eventPacketId,
    claimedSelectedDetailIds: metadata?.selectedDetailIds,
  });
  if (!owned.ok) return owned;
  if (
    !sameStringSet(params.claimedSelectedDetailIds, owned.graph.packet.selectedDetailIds) ||
    !sameStringSet(metadata?.selectedDetailIds, owned.graph.packet.selectedDetailIds)
  ) {
    return { ok: false, reason: "invalid_packet_graph" };
  }
  return owned;
}
