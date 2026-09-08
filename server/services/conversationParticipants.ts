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

/** Staff display only: names follow the same unambiguous profile/account ownership. */
export async function resolveConversationProviderIdentity(providerKey: string): Promise<{
  userId: string;
  displayName: string | null;
} | null> {
  if (!providerKey.trim()) return null;
  const result = await db.execute(sql`
    SELECT account.id AS "userId",
      COALESCE(NULLIF(TRIM(profile.company_name), ''),
        NULLIF(TRIM(CONCAT_WS(' ', account.first_name, account.last_name)), '')) AS "displayName"
    FROM users account
    LEFT JOIN contractors profile ON profile.id = ${providerKey} AND profile.user_id = account.id
    WHERE account.id = ${conversationProviderUserSql(sql`${providerKey}`)}
  `);
  const row = result.rows[0];
  return typeof row?.userId === "string"
    ? {
        userId: row.userId,
        displayName: typeof row.displayName === "string" ? row.displayName : null,
      }
    : null;
}

/** Presentation follows exact server-owned acceptance proof, never participant similarity. */
export async function loadLegacyConversationContext(threadId: string, viewerUserId: string) {
  const [conversation] = await db
    .select({ homeownerId: conversations.homeownerId, contractorId: conversations.contractorId })
    .from(conversations)
    .where(
      and(eq(conversations.id, threadId), conversationParticipantSql(conversations, viewerUserId))
    )
    .limit(1);
  if (!conversation) return null;
  const job = await loadAcceptedJobForConversation({
    threadId,
    requesterUserId: conversation.homeownerId,
    providerKey: conversation.contractorId,
  });
  if (!job) return null;
  return {
    kind: "direct_connect" as const,
    label: "Direct Connect",
    title: String(job.title),
    entityId: String(job.request_id),
  };
}

/** Exact accepted-event ownership for one conversation; callers enforce viewer membership. */
export async function loadAcceptedJobForConversation(params: {
  threadId: string;
  requesterUserId: string;
  providerKey: string;
}): Promise<Record<string, any> | null> {
  const { threadId, requesterUserId, providerKey } = params;
  const providerUserId = await resolveConversationProviderUserId(providerKey);
  if (!providerUserId) return null;
  const acceptedRows = await db.execute(sql`
          SELECT
            wr.id AS request_id,
            wr.title,
            wr.description,
            wr.category,
            COALESCE(dispatch.county, wr.county_fips) AS county,
            dispatch.city_area,
            wr.status AS request_status,
            wr.created_at AS request_created_at,
            a.id AS assignment_id,
            a.status AS assignment_status,
            a.response_summary
          FROM work_requests wr
          INNER JOIN work_request_assignments a ON a.work_request_id = wr.id
          LEFT JOIN direct_connect_dispatch_requests dispatch
            ON dispatch.id = wr.id AND dispatch.user_id = wr.created_by_user_id
          INNER JOIN work_request_events acceptance
            ON acceptance.work_request_id = wr.id
            AND acceptance.type = 'provider_accepted'
            AND acceptance.actor_user_id = ${providerUserId}
            AND acceptance.created_at >= a.created_at
            AND acceptance.metadata ->> 'conversationId' = ${threadId}
            AND (NULLIF(acceptance.metadata ->> 'assignmentId', '') IS NULL
              OR acceptance.metadata ->> 'assignmentId' = a.id)
            AND (
              (a.contractor_id IS NOT NULL AND acceptance.metadata ->> 'contractorId' = a.contractor_id)
              OR (a.contractor_id IS NULL AND acceptance.metadata ->> 'responderUserId' = a.responder_user_id)
            )
          WHERE wr.created_by_user_id = ${requesterUserId}
            AND wr.source = 'direct_connect'
            AND a.status = 'accepted'
            AND COALESCE(a.contractor_id, a.responder_user_id) = ${providerKey}
            AND (a.contractor_id IS NULL OR a.responder_user_id IS NULL
              OR a.responder_user_id = ${providerUserId})
            AND NOT EXISTS (
              SELECT 1 FROM work_request_assignments other
              WHERE other.work_request_id = wr.id AND other.status = 'accepted' AND other.id <> a.id
            )
            AND 1 = (
              SELECT COUNT(*) FROM work_request_events proof
              WHERE proof.work_request_id = wr.id AND proof.type = 'provider_accepted'
                AND proof.created_at >= a.created_at
                AND (NULLIF(proof.metadata ->> 'assignmentId', '') IS NULL
                  OR proof.metadata ->> 'assignmentId' = a.id)
                AND (
                  (a.contractor_id IS NOT NULL AND proof.metadata ->> 'contractorId' = a.contractor_id)
                  OR (a.contractor_id IS NULL AND proof.metadata ->> 'responderUserId' = a.responder_user_id)
                )
            )
          LIMIT 2
        `);
  return acceptedRows.rows?.length === 1 ? acceptedRows.rows[0] : null;
}
