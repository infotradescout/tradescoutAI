import { and, desc, eq } from "drizzle-orm";
import { db } from ".././db";
import {
  contactPermissionEvents,
  contactPermissions,
  notifications,
  trustSnapshots,
} from "@shared/schema";
import { storage } from "../storage";

export type ContactRequestType = "message" | "comment";
export type ContactRequestStatus = "pending" | "accepted" | "declined" | "blocked";

export type ContactRequestMetadata = {
  contactType: ContactRequestType;
  preview?: string | null;
  content?: string | null;
  intent?: string | null;
  authorityGate?: string | null;
  sourceDecisionCardId?: string | null;
  sourceScoutRecommendationId?: string | null;
  decisionScope?: string | null;
  confidenceScore?: number | string | null;
  riskFlags?: string[] | null;
  countyFips?: string | null;
  requesterTrustSnapshotId?: string | null;
  targetTrustSnapshotId?: string | null;
  postId?: string | null;
  parentCommentId?: string | null;
  source?: "social" | "community" | null;
};

async function getLatestTrustSnapshotId(userId: string, countyFips?: string | null) {
  if (!userId || !countyFips) return null;
  const [row] = await db
    .select({ id: trustSnapshots.id })
    .from(trustSnapshots)
    .where(and(eq(trustSnapshots.userId, userId), eq(trustSnapshots.countyFips, countyFips)))
    .orderBy(desc(trustSnapshots.computedAt))
    .limit(1);
  return row?.id ?? null;
}

export async function getContactPermission(requesterId: string, targetUserId: string) {
  const [existing] = await db
    .select()
    .from(contactPermissions)
    .where(
      and(
        eq(contactPermissions.requesterId, requesterId),
        eq(contactPermissions.targetUserId, targetUserId)
      )
    )
    .limit(1);
  return existing ?? null;
}

export async function ensureContactRequest({
  requesterId,
  targetUserId,
  preview,
  metadata,
}: {
  requesterId: string;
  targetUserId: string;
  preview?: string | null;
  metadata: ContactRequestMetadata;
}): Promise<{ status: ContactRequestStatus; requestId?: string | null }> {
  if (requesterId === targetUserId) {
    return { status: "accepted" };
  }

  const existing = await getContactPermission(requesterId, targetUserId);
  if (existing) {
    if (existing.status === "accepted") return { status: "accepted" };
    if (existing.status === "pending")
      return { status: "pending", requestId: existing.lastRequestNotificationId || null };
    return { status: existing.status as ContactRequestStatus };
  }

  const requester = await storage.getUser(requesterId);
  const target = await storage.getUser(targetUserId);
  const resolvedCountyFips =
    (metadata.countyFips || null) ?? (requester as any)?.countyFips ?? null;
  const requesterTrustSnapshotId =
    metadata.requesterTrustSnapshotId ||
    (await getLatestTrustSnapshotId(requesterId, resolvedCountyFips));
  const targetTrustSnapshotId =
    metadata.targetTrustSnapshotId ||
    (await getLatestTrustSnapshotId(targetUserId, resolvedCountyFips));

  const requesterName =
    `${(requester as any)?.firstName || ""} ${(requester as any)?.lastName || ""}`.trim() ||
    (requester as any)?.email ||
    "A community member";
  const targetName =
    `${(target as any)?.firstName || ""} ${(target as any)?.lastName || ""}`.trim() ||
    (target as any)?.email ||
    null;

  const previewText = typeof preview === "string" ? preview.trim().slice(0, 280) : "";
  const contentText =
    typeof metadata.content === "string" && metadata.content.trim()
      ? metadata.content.trim().slice(0, 1000)
      : null;
  const message =
    previewText ||
    (metadata.contactType === "comment"
      ? "Review this comment preview before allowing it to post."
      : "Review this first-contact request before opening chat.");

  const [notification] = await db
    .insert(notifications)
    .values({
      userId: targetUserId,
      type: "new_message",
      priority: "normal",
      title: `${requesterName} wants to contact you`,
      message,
      actionUrl: "/messages",
      actionText: "Review request",
      iconName: "message-square",
      iconColor: "blue",
      deliveryMethods: ["in_app"],
      metadata: {
        kind: "contact_request",
        status: "pending",
        requesterId,
        requesterName,
        requesterRole: (requester as any)?.role || null,
        requesterVerified: Boolean((requester as any)?.addressVerified),
        targetUserId,
        targetName,
        preview: previewText || null,
        content: contentText || null,
        contactType: metadata.contactType,
        intent: metadata.intent || null,
        authorityGate: metadata.authorityGate || null,
        sourceDecisionCardId: metadata.sourceDecisionCardId || null,
        sourceScoutRecommendationId: metadata.sourceScoutRecommendationId || null,
        decisionScope: metadata.decisionScope || null,
        postId: metadata.postId || null,
        parentCommentId: metadata.parentCommentId || null,
        source: metadata.source || null,
        createdAt: new Date().toISOString(),
      },
    } as any)
    .returning();

  const notificationId = notification?.id != null ? String(notification.id) : null;
  const confidenceScore =
    metadata.confidenceScore != null && String(metadata.confidenceScore).trim().length > 0
      ? (() => {
          const n = Number(metadata.confidenceScore);
          return Number.isFinite(n) ? String(n) : null;
        })()
      : null;

  const now = new Date();
  const [permissionRow] = await db
    .insert(contactPermissions)
    .values({
      requesterId,
      targetUserId,
      status: "pending",
      lastRequestType: metadata.contactType,
      lastRequestPreview: previewText || null,
      lastRequestNotificationId: notificationId,
      authorityGate: metadata.authorityGate || null,
      sourceDecisionCardId: metadata.sourceDecisionCardId || null,
      sourceScoutRecommendationId: metadata.sourceScoutRecommendationId || null,
      intent: metadata.intent || null,
      decisionScope: metadata.decisionScope || null,
      confidenceScore,
      riskFlags: metadata.riskFlags || null,
      countyFips: resolvedCountyFips,
      requesterTrustSnapshotId,
      targetTrustSnapshotId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [contactPermissions.requesterId, contactPermissions.targetUserId],
      set: {
        status: "pending",
        lastRequestType: metadata.contactType,
        lastRequestPreview: previewText || null,
        lastRequestNotificationId: notificationId,
        authorityGate: metadata.authorityGate || null,
        sourceDecisionCardId: metadata.sourceDecisionCardId || null,
        sourceScoutRecommendationId: metadata.sourceScoutRecommendationId || null,
        intent: metadata.intent || null,
        decisionScope: metadata.decisionScope || null,
        confidenceScore,
        riskFlags: metadata.riskFlags || null,
        countyFips: resolvedCountyFips,
        requesterTrustSnapshotId,
        targetTrustSnapshotId,
        updatedAt: now,
      },
    })
    .returning({ id: contactPermissions.id });

  if (permissionRow?.id) {
    await db.insert(contactPermissionEvents).values({
      contactPermissionId: permissionRow.id,
      requesterId,
      targetUserId,
      actorId: requesterId,
      eventType: "request_created",
      fromStatus: null,
      toStatus: "pending",
      reasonCode: null,
      metadata: {
        preview: previewText || null,
        contactType: metadata.contactType,
        postId: metadata.postId || null,
        parentCommentId: metadata.parentCommentId || null,
        source: metadata.source || null,
      },
      authorityGate: metadata.authorityGate || null,
      sourceDecisionCardId: metadata.sourceDecisionCardId || null,
      sourceScoutRecommendationId: metadata.sourceScoutRecommendationId || null,
      intent: metadata.intent || null,
      decisionScope: metadata.decisionScope || null,
      confidenceScore,
      riskFlags: metadata.riskFlags || null,
      countyFips: resolvedCountyFips,
    } as any);
  }

  return { status: "pending", requestId: notificationId };
}

export async function updateContactPermissionStatus({
  requesterId,
  targetUserId,
  status,
  respondedBy,
  responseReason,
}: {
  requesterId: string;
  targetUserId: string;
  status: ContactRequestStatus;
  respondedBy?: string | null;
  responseReason?: string | null;
}) {
  const now = new Date();
  const existing = await getContactPermission(requesterId, targetUserId);
  const [permissionRow] = await db
    .insert(contactPermissions)
    .values({
      requesterId,
      targetUserId,
      status,
      respondedAt: now,
      respondedBy: respondedBy || null,
      responseReason: responseReason || null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [contactPermissions.requesterId, contactPermissions.targetUserId],
      set: {
        status,
        respondedAt: now,
        respondedBy: respondedBy || null,
        responseReason: responseReason || null,
        updatedAt: now,
      },
    })
    .returning({ id: contactPermissions.id });

  if (permissionRow?.id) {
    await db.insert(contactPermissionEvents).values({
      contactPermissionId: permissionRow.id,
      requesterId,
      targetUserId,
      actorId: respondedBy || null,
      eventType:
        status === "accepted"
          ? "accepted"
          : status === "declined"
            ? "declined"
            : status === "blocked"
              ? "blocked"
              : "status_update",
      fromStatus: (existing?.status as any) || null,
      toStatus: status,
      reasonCode: responseReason || null,
      metadata: null,
      authorityGate: (existing as any)?.authorityGate || null,
      sourceDecisionCardId: (existing as any)?.sourceDecisionCardId || null,
      sourceScoutRecommendationId: (existing as any)?.sourceScoutRecommendationId || null,
      intent: (existing as any)?.intent || null,
      decisionScope: (existing as any)?.decisionScope || null,
      confidenceScore: (existing as any)?.confidenceScore || null,
      riskFlags: (existing as any)?.riskFlags || null,
      countyFips: (existing as any)?.countyFips || null,
    } as any);
  }
}
