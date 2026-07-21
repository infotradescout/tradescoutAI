/**
 * Community action → trust-signal reflection.
 *
 * Consolidates the Community Engine loop (action → event → CVS precompute)
 * onto the canonical community feed path. Events are for XP/audit and
 * immediate observability; Profile CVS still reads validated tables in
 * trustSnapshotsScoringSql.mjs at snapshot time (precompute-only).
 */

type ReflectStorage = {
  logEvent: (eventType: string, data: Record<string, unknown>) => Promise<void>;
};

export type CommunityReflectionInput = {
  eventType: string;
  actorUserId: string;
  /** Subject whose reputation may be affected (post/comment author, report target). */
  subjectUserId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  parentCommentId?: string | null;
  contentType?: string | null;
  reportId?: string | null;
  liked?: boolean;
  extra?: Record<string, unknown>;
};

function asId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Best-effort reflection write. Never throws into the request path.
 */
export async function reflectCommunityAction(
  storage: ReflectStorage,
  input: CommunityReflectionInput
): Promise<void> {
  const actorUserId = asId(input.actorUserId);
  if (!actorUserId) return;

  const subjectUserId = asId(input.subjectUserId);
  const payload: Record<string, unknown> = {
    userId: actorUserId,
    source: "community",
    ...(subjectUserId && subjectUserId !== actorUserId ? { targetUserId: subjectUserId } : {}),
    ...(asId(input.postId) ? { postId: asId(input.postId) } : {}),
    ...(asId(input.commentId) ? { commentId: asId(input.commentId) } : {}),
    ...(asId(input.parentCommentId) ? { parentCommentId: asId(input.parentCommentId) } : {}),
    ...(asId(input.contentType) ? { contentType: asId(input.contentType) } : {}),
    ...(asId(input.reportId) ? { reportId: asId(input.reportId) } : {}),
    ...(typeof input.liked === "boolean" ? { liked: input.liked } : {}),
    ...(input.extra && typeof input.extra === "object" ? input.extra : {}),
  };

  try {
    await storage.logEvent(input.eventType, payload);
  } catch (error) {
    console.error(`[communityActionReflection] failed to log ${input.eventType}`, error);
  }
}
