import { randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { userHomeRecords, userHomes, workRequestEvents, workRequests } from "@shared/schema";
import { db } from "../../db";

export async function resolveOwnedHomeForDirectConnect(userId: string, homeId?: string | null) {
  const normalizedHomeId = String(homeId || "").trim();
  if (!normalizedHomeId) return null;
  const [home] = await db
    .select()
    .from(userHomes)
    .where(and(eq(userHomes.id, normalizedHomeId), eq(userHomes.ownerUserId, userId)))
    .limit(1);
  return home || null;
}

const HOMEID_PERSISTENCE_COMPONENTS_TITLE = "homeid:persistence:components";
const HOMEID_PERSISTENCE_EVIDENCE_TITLE = "homeid:persistence:evidence";
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

function parseJsonObjectSafe(input: unknown): Record<string, any> | null {
  if (typeof input !== "string") return null;
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function normalizeHomeIdComponentType(input?: string | null) {
  const value = String(input || "")
    .trim()
    .toLowerCase();
  if (!value) return "";
  if (HOMEID_COMPONENT_TYPES.has(value)) return value;
  return "custom";
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
    .select({
      id: userHomeRecords.id,
      details: userHomeRecords.details,
    })
    .from(userHomeRecords)
    .where(
      and(
        eq(userHomeRecords.homeId, params.homeId),
        eq(userHomeRecords.createdByUserId, params.userId),
        eq(userHomeRecords.title, HOMEID_PERSISTENCE_COMPONENTS_TITLE)
      )
    )
    .limit(1);

  const payload = parseJsonObjectSafe(existingRecord?.details);
  const existingComponents = Array.isArray(payload?.components)
    ? (payload?.components as HomeIdComponentRecord[]) || []
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
    return typeMatch || labelMatch;
  });

  const existing = componentIndex >= 0 ? existingComponents[componentIndex] : null;
  const linkedRequestIds = new Set<string>(existing?.linkedDirectConnectRequestIds || []);
  linkedRequestIds.add(params.requestId);
  const linkedPacketIds = new Set<string>(existing?.linkedHomePacketIds || []);
  if (params.homePacketId) linkedPacketIds.add(String(params.homePacketId));

  const baseId = existing?.id || `cmp_${randomBytes(8).toString("hex")}`;
  const nextComponent: HomeIdComponentRecord = {
    id: baseId,
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

  const nextComponents =
    componentIndex >= 0
      ? existingComponents.map((component, idx) =>
          idx === componentIndex ? nextComponent : component
        )
      : [...existingComponents, nextComponent];
  const nextPayload = {
    components: nextComponents,
    updatedAt: nowIso,
  };

  if (existingRecord?.id) {
    await db
      .update(userHomeRecords)
      .set({ details: JSON.stringify(nextPayload), updatedAt: new Date() } as any)
      .where(eq(userHomeRecords.id, existingRecord.id));
  } else {
    await db.insert(userHomeRecords).values({
      homeId: params.homeId,
      createdByUserId: params.userId,
      recordType: "note",
      title: HOMEID_PERSISTENCE_COMPONENTS_TITLE,
      details: JSON.stringify(nextPayload),
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
      homePacketSelectedDetailIds: Array.isArray(params.homePacketSelectedDetailIds)
        ? params.homePacketSelectedDetailIds
        : [],
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
    homePacketId: params.homePacketId || null,
    componentType: params.componentType || null,
    componentLabel: params.componentLabel || null,
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
    .select({
      id: userHomeRecords.id,
      details: userHomeRecords.details,
    })
    .from(userHomeRecords)
    .where(
      and(
        eq(userHomeRecords.homeId, params.homeId),
        eq(userHomeRecords.createdByUserId, params.userId),
        eq(userHomeRecords.title, HOMEID_PERSISTENCE_EVIDENCE_TITLE)
      )
    )
    .limit(1);

  const payload = parseJsonObjectSafe(existingRecord?.details);
  const existingEvidence = Array.isArray(payload?.evidence)
    ? (payload?.evidence as HomeIdEvidenceRecord[]) || []
    : [];
  const nowIso = new Date().toISOString();
  const nextEvidence: HomeIdEvidenceRecord = {
    id: `evd_${randomBytes(8).toString("hex")}`,
    homeId: params.homeId,
    componentId: params.componentId || undefined,
    directConnectRequestId: params.requestId,
    homePacketId: params.homePacketId || undefined,
    selectedDetailIds: (Array.isArray(params.selectedDetailIds) ? params.selectedDetailIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
      .slice(0, 200),
    evidenceType: params.evidenceType,
    title: params.title.trim().slice(0, 220),
    description: params.description ? params.description.trim().slice(0, 2000) : undefined,
    source: params.source,
    status: params.status,
    fileUrl: params.fileUrl ? params.fileUrl.trim().slice(0, 1000) : undefined,
    fileName: params.fileName ? params.fileName.trim().slice(0, 260) : undefined,
    mimeType: params.mimeType ? params.mimeType.trim().slice(0, 120) : undefined,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const nextPayload = {
    evidence: [...existingEvidence, nextEvidence].slice(-1200),
    updatedAt: nowIso,
  };
  if (existingRecord?.id) {
    await db
      .update(userHomeRecords)
      .set({ details: JSON.stringify(nextPayload), updatedAt: new Date() } as any)
      .where(eq(userHomeRecords.id, existingRecord.id));
  } else {
    await db.insert(userHomeRecords).values({
      homeId: params.homeId,
      createdByUserId: params.userId,
      recordType: "note",
      title: HOMEID_PERSISTENCE_EVIDENCE_TITLE,
      details: JSON.stringify(nextPayload),
      tags: ["homeid", "persistence", "evidence"],
      updatedAt: new Date(),
    } as any);
  }
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

  await db.insert(userHomeRecords).values({
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
  } as any);

  await db.insert(userHomeRecords).values({
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
  } as any);

  return createdHome;
}

type HomeIdTimelineContext = {
  homeId: string;
  requestOwnerUserId: string;
  homePacketId: string | null;
  selectedDetailIds: string[];
  componentType: string | null;
  componentLabel: string | null;
};

export async function resolveHomeIdTimelineContextForRequest(
  requestId: string
): Promise<HomeIdTimelineContext | null> {
  const [requestRow] = await db
    .select()
    .from(workRequests)
    .where(eq(workRequests.id, requestId))
    .limit(1);
  if (!requestRow?.createdByUserId) return null;

  const requestOwnerUserId = String(requestRow.createdByUserId);
  const timelineCandidates = await db
    .select({
      metadata: workRequestEvents.metadata,
      createdAt: workRequestEvents.createdAt,
    })
    .from(workRequestEvents)
    .where(eq(workRequestEvents.workRequestId, requestId))
    .orderBy(desc(workRequestEvents.createdAt))
    .limit(30);

  let homeId: string | null = null;
  let homePacketId: string | null = null;
  let selectedDetailIds: string[] = [];
  let componentType: string | null = null;
  let componentLabel: string | null = null;

  for (const row of timelineCandidates as any[]) {
    const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const assetLink =
      metadata?.assetLink && typeof metadata.assetLink === "object" ? metadata.assetLink : {};

    if (!homeId) {
      const directHomeId = String(metadata?.homeId || "").trim();
      const assetHomeId = String(assetLink?.homeId || "").trim();
      homeId = directHomeId || assetHomeId || null;
    }
    if (!homePacketId) {
      const directPacketId = String(metadata?.homePacketId || "").trim();
      const assetPacketId = String(assetLink?.homePacketId || "").trim();
      homePacketId = directPacketId || assetPacketId || null;
    }
    if (selectedDetailIds.length === 0) {
      const directIds = Array.isArray(metadata?.selectedDetailIds)
        ? metadata.selectedDetailIds
        : [];
      const assetIds = Array.isArray(assetLink?.homePacketSelectedDetailIds)
        ? assetLink.homePacketSelectedDetailIds
        : [];
      const ids = [...directIds, ...assetIds]
        .map((id: unknown) => String(id || "").trim())
        .filter(Boolean)
        .slice(0, 50);
      if (ids.length > 0) selectedDetailIds = ids;
    }
    if (!componentType) {
      componentType = String(assetLink?.assetComponentType || "").trim() || null;
    }
    if (!componentLabel) {
      componentLabel = String(assetLink?.assetLabel || "").trim() || null;
    }
  }

  if (!homeId) return null;
  const ownedHome = await resolveOwnedHomeForDirectConnect(requestOwnerUserId, homeId);
  if (!ownedHome?.id) return null;

  return {
    homeId: String(ownedHome.id),
    requestOwnerUserId,
    homePacketId,
    selectedDetailIds,
    componentType,
    componentLabel,
  };
}

export async function appendHomeIdTimelineEventFromDirectConnect(params: {
  requestId: string;
  eventType:
    | "direct_connect_request_submitted"
    | "direct_connect_estimate_sent"
    | "direct_connect_estimate_accepted"
    | "direct_connect_scheduled"
    | "direct_connect_work_started"
    | "direct_connect_change_order_created"
    | "direct_connect_completed"
    | "direct_connect_cancelled";
  title: string;
  summary?: string | null;
  occurredAt?: string;
}) {
  const context = await resolveHomeIdTimelineContextForRequest(params.requestId);
  if (!context) return;

  const nowIso = new Date().toISOString();
  const occurredAt = params.occurredAt || nowIso;
  await db.insert(userHomeRecords).values({
    homeId: context.homeId,
    createdByUserId: context.requestOwnerUserId,
    recordType: "note",
    title: `homeid:timeline:${params.eventType}`,
    details: JSON.stringify({
      homeId: context.homeId,
      directConnectRequestId: params.requestId,
      homePacketId: context.homePacketId || null,
      selectedDetailIds: context.selectedDetailIds,
      componentType: context.componentType || null,
      componentLabel: context.componentLabel || null,
      eventType: params.eventType,
      source: "direct_connect_jobflow",
      title: params.title,
      summary: params.summary || null,
      occurredAt,
      createdAt: nowIso,
    }),
    tags: ["homeid", "timeline", "direct_connect_jobflow", params.eventType],
    occurredAt: new Date(occurredAt),
    updatedAt: new Date(),
  } as any);
}

export async function appendHomeIdCompletedWorkEnrichmentFromDirectConnect(params: {
  requestId: string;
  completedAt?: string;
  workSummary?: string | null;
}) {
  const context = await resolveHomeIdTimelineContextForRequest(params.requestId);
  if (!context) return;

  const nowIso = new Date().toISOString();
  const completedAt = params.completedAt || nowIso;
  await db.insert(userHomeRecords).values({
    homeId: context.homeId,
    createdByUserId: context.requestOwnerUserId,
    recordType: "note",
    title: "homeid:completed_work_enrichment",
    details: JSON.stringify({
      source: "direct_connect_completed_work",
      homeId: context.homeId,
      directConnectRequestId: params.requestId,
      homePacketId: context.homePacketId || null,
      selectedDetailIds: context.selectedDetailIds,
      componentType: context.componentType || null,
      componentLabel: context.componentLabel || null,
      completedAt,
      workSummary: params.workSummary || null,
      enrichedAt: nowIso,
    }),
    tags: ["homeid", "completed_work", "direct_connect"],
    occurredAt: new Date(completedAt),
    updatedAt: new Date(),
  } as any);

  await upsertHomeIdComponentFromDirectConnect({
    homeId: context.homeId,
    userId: context.requestOwnerUserId,
    requestId: params.requestId,
    homePacketId: context.homePacketId || null,
    componentType: context.componentType || null,
    componentLabel: context.componentLabel || null,
    source: "direct_connect_completed_work",
    status: "known",
  });

  const [requestRow] = await db
    .select({ attachments: workRequests.attachments })
    .from(workRequests)
    .where(eq(workRequests.id, params.requestId))
    .limit(1);
  const rawAttachments = (requestRow as any)?.attachments;
  const attachmentKeys = Array.isArray(rawAttachments)
    ? rawAttachments
        .map((value: unknown) => String(value || "").trim())
        .filter((value: string) => value.length >= 10)
        .slice(0, 8)
    : [];
  if (attachmentKeys.length > 0) {
    await upsertHomeIdEvidenceFromDirectConnect({
      homeId: context.homeId,
      userId: context.requestOwnerUserId,
      requestId: params.requestId,
      homePacketId: context.homePacketId || null,
      selectedDetailIds: context.selectedDetailIds,
      evidenceType: "document",
      title: "Direct Connect completed-work attachment",
      description: "Captured from completed Direct Connect request attachment reference.",
      source: "direct_connect_completed_work",
      status: "needs_review",
      fileUrl: attachmentKeys[0],
      fileName: `direct-connect-${params.requestId}-attachment-1`,
    });
  }
}
