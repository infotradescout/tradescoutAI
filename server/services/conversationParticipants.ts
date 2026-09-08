import { and, eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { conversations } from "@shared/schema";
import { db } from "../db";

/**
 * A legacy conversation provider key is either a contractor profile ID or a
 * direct business/worker account ID. Resolve both through one SQL contract.
 * An existing contractor row owns its key even when its owner is missing;
 * never fall back to a different account that happens to have the same ID.
 */
function conversationProviderUserSql(providerKey: SQLWrapper): SQL<string | null> {
  return sql<string | null>`(
    SELECT COALESCE(profile_account.id, direct_account.id)
    FROM (SELECT ${providerKey}::varchar AS provider_key) participant_key
    LEFT JOIN contractors provider_profile ON provider_profile.id = participant_key.provider_key
    LEFT JOIN users profile_account ON profile_account.id = provider_profile.user_id
    LEFT JOIN users direct_account ON direct_account.id = participant_key.provider_key
    WHERE (
      provider_profile.id IS NOT NULL
      AND profile_account.id IS NOT NULL
      AND (direct_account.id IS NULL OR direct_account.id = profile_account.id)
    ) OR (
      provider_profile.id IS NULL AND direct_account.id IS NOT NULL
    )
    LIMIT 1
  )`;
}

/** Membership only; callers retain their request, contact and status gates. */
export function conversationProviderParticipantSql(
  providerKey: SQLWrapper,
  userId: string
): SQL<boolean> {
  const viewerId = typeof userId === "string" ? userId.trim() : "";
  return viewerId
    ? sql<boolean>`${conversationProviderUserSql(providerKey)} = ${viewerId}`
    : sql<boolean>`FALSE`;
}

export function conversationParticipantSql(
  conversation: { homeownerId: SQLWrapper; contractorId: SQLWrapper },
  userId: string
): SQL<boolean> {
  const viewerId = typeof userId === "string" ? userId.trim() : "";
  if (!viewerId) return sql<boolean>`FALSE`;
  // The explicit homeowner is independent of provider identity. Neither a
  // staff role nor a guessed provider/profile key grants membership.
  return sql<boolean>`(
    ${conversation.homeownerId} = ${viewerId}
    OR ${conversationProviderParticipantSql(conversation.contractorId, viewerId)}
  )`;
}

export async function canAccessConversation(
  conversationId: string,
  userId: string
): Promise<boolean> {
  if (
    typeof conversationId !== "string" ||
    typeof userId !== "string" ||
    !conversationId.trim() ||
    !userId.trim()
  )
    return false;
  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(eq(conversations.id, conversationId), conversationParticipantSql(conversations, userId))
    )
    .limit(1);
  return Boolean(conversation);
}

export async function resolveConversationProviderUserId(
  providerKey: string
): Promise<string | null> {
  const key = typeof providerKey === "string" ? providerKey.trim() : "";
  if (!key) return null;
  const result = await db.execute(sql`
    SELECT ${conversationProviderUserSql(sql`${key}`)} AS "userId"
  `);
  return typeof result.rows[0]?.userId === "string" ? result.rows[0].userId : null;
}
