import { and, eq } from "drizzle-orm";
import { db } from "../src/db/drizzle-mock";
import { contactPermissions, notifications } from "@shared/schema";
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
  postId?: string | null;
  parentCommentId?: string | null;
  source?: "social" | "community" | null;
};

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

  const now = new Date();
  await db
    .insert(contactPermissions)
    .values({
      requesterId,
      targetUserId,
      status: "pending",
      lastRequestType: metadata.contactType,
      lastRequestPreview: previewText || null,
      lastRequestNotificationId: notification?.id || null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [contactPermissions.requesterId, contactPermissions.targetUserId],
      set: {
        status: "pending",
        lastRequestType: metadata.contactType,
        lastRequestPreview: previewText || null,
        lastRequestNotificationId: notification?.id || null,
        updatedAt: now,
      },
    });

  return { status: "pending", requestId: notification?.id || null };
}

export async function updateContactPermissionStatus({
  requesterId,
  targetUserId,
  status,
}: {
  requesterId: string;
  targetUserId: string;
  status: ContactRequestStatus;
}) {
  const now = new Date();
  await db
    .insert(contactPermissions)
    .values({
      requesterId,
      targetUserId,
      status,
      respondedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [contactPermissions.requesterId, contactPermissions.targetUserId],
      set: {
        status,
        respondedAt: now,
        updatedAt: now,
      },
    });
}
