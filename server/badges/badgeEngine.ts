import type { Pool } from "pg";
import type { LoggedEvent } from "../xp/eventTypes";
import { EventTypes } from "../xp/eventTypes";
import { Badges } from "./badgeRegistry";
import { withPoolTransaction } from "../utils/poolTransaction";

type Deps = {
  pool: Pool;
  logInternalEvent?: (eventType: string, data: any) => Promise<void>;
};

function getCreditedUserIdForBadge(event: LoggedEvent): string | null {
  const d = event.data ?? {};
  if (
    [EventTypes.POST_SAVED, EventTypes.REACTION_MARKED_HELPFUL, EventTypes.USER_THANKED].includes(
      String(event.eventType) as any
    )
  ) {
    return typeof d.targetUserId === "string" ? d.targetUserId : null;
  }
  if (typeof d.userId === "string") return d.userId;
  if (typeof d.actorId === "string") return d.actorId;
  return null;
}

async function hasBadge(pool: Pool, userId: string, badgeId: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM user_badges WHERE user_id = $1 AND badge_id = $2 LIMIT 1`,
    [userId, badgeId]
  );
  return (r.rowCount ?? 0) > 0;
}

async function awardBadge(pool: Pool, userId: string, badgeId: string): Promise<boolean> {
  const r = await pool.query(
    `
    INSERT INTO user_badges (user_id, badge_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, badge_id) DO NOTHING;
    `,
    [userId, badgeId]
  );
  return r.rowCount === 1;
}

async function grantBadgeXp(
  pool: Pool,
  userId: string,
  badgeId: string,
  delta: number
): Promise<void> {
  await withPoolTransaction(pool, async (client) => {
    await client.query(
      `
      INSERT INTO xp_ledger (user_id, delta, reason, source_event_id, day_key_utc)
      VALUES ($1, $2, $3, NULL, to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'));
      `,
      [userId, delta, `badge:${badgeId}`]
    );

    await client.query(
      `
      INSERT INTO user_xp (user_id, xp_total)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET xp_total = user_xp.xp_total + EXCLUDED.xp_total, updated_at = now();
      `,
      [userId, delta]
    );
  });
}

export async function evaluateBadgesForEvent(deps: Deps, event: LoggedEvent): Promise<string[]> {
  if (process.env.BADGE_ENGINE_DISABLED === "true") return [];
  if (event.eventType === "xp.applied" || event.eventType === "badge.awarded") {
    return [];
  }

  const userId = getCreditedUserIdForBadge(event);
  if (!userId) return [];

  const newlyAwarded: string[] = [];
  const type = String(event.eventType);

  if (type === EventTypes.COMMUNITY_VIEWED_SCOPE) {
    const earned = await checkExplorer(deps.pool, userId);
    if (earned) newlyAwarded.push("explorer");
  }

  if (type === EventTypes.COMMENT_CREATED || type === EventTypes.POST_CREATED) {
    const earned = await checkConversationalist(deps.pool, userId);
    if (earned) newlyAwarded.push("conversationalist");
  }

  if (
    type === EventTypes.POST_SAVED ||
    type === EventTypes.REACTION_MARKED_HELPFUL ||
    type === EventTypes.USER_THANKED
  ) {
    const earned = await checkHelper(deps.pool, userId);
    if (earned) newlyAwarded.push("helper");
  }

  if (
    type === EventTypes.COMMUNITY_VIEWED_SCOPE ||
    type === EventTypes.POST_CREATED ||
    type === EventTypes.COMMENT_CREATED
  ) {
    const earned = await checkLocal(deps.pool, userId);
    if (earned) newlyAwarded.push("local");
  }

  if (type === EventTypes.USER_SESSION_STARTED) {
    const earned = await checkRegular(deps.pool, userId);
    if (earned) newlyAwarded.push("regular");
  }

  if (type === EventTypes.FINANCE_DOCUMENT_CREATED) {
    const earned = await checkRecordKeeper(deps.pool, userId);
    if (earned) newlyAwarded.push("record_keeper");
  }

  if (
    type === EventTypes.NOTE_CREATED ||
    type === EventTypes.ITEM_SAVED ||
    type === EventTypes.TASK_CREATED
  ) {
    const earned = await checkOrganizer(deps.pool, userId);
    if (earned) newlyAwarded.push("organizer");
  }

  if (type === EventTypes.CONNECTION_CONFIRMED) {
    const earned = await checkConnector(deps.pool, userId);
    if (earned) newlyAwarded.push("connector");
  }

  if (
    type === EventTypes.CONTENT_VIEWED ||
    type === EventTypes.POST_CREATED ||
    type === EventTypes.COMMENT_CREATED
  ) {
    const earned = await checkLurker(deps.pool, userId);
    if (earned) newlyAwarded.push("lurker");
  }

  if (type === EventTypes.ACTIVITY_NIGHT_TIME) {
    const earned = await checkNightOwl(deps.pool, userId);
    if (earned) newlyAwarded.push("night_owl");
  }

  if (type === EventTypes.BETA_FEATURE_USED) {
    const earned = await checkBetaExplorer(deps.pool, userId);
    if (earned) newlyAwarded.push("beta_explorer");
  }

  for (const badgeId of newlyAwarded) {
    if (!Badges[badgeId]) continue;
    const already = await hasBadge(deps.pool, userId, badgeId);
    if (already) continue;

    const did = await awardBadge(deps.pool, userId, badgeId);
    if (!did) continue;

    const burst = Badges[badgeId].xpBurst;
    if (burst > 0) await grantBadgeXp(deps.pool, userId, badgeId, burst);

    if (deps.logInternalEvent) {
      await deps.logInternalEvent("badge.awarded", {
        userId,
        badgeId,
        xpBurst: burst,
        isSecret: Badges[badgeId].isSecret,
      });
    }
  }

  return newlyAwarded;
}

async function checkExplorer(pool: Pool, userId: string): Promise<boolean> {
  const r = await pool.query(
    `
    WITH scoped AS (
      SELECT
        (data->>'scopeType') AS scope_type,
        (data->>'scopeId') AS scope_id
      FROM events
      WHERE (data->>'userId')::text = $1
        AND event_type = 'community.viewed_scope'
        AND created_at >= now() - INTERVAL '30 days'
        AND COALESCE(data->>'scopeType','') <> ''
        AND COALESCE(data->>'scopeId','') <> ''
      GROUP BY 1,2
    )
    SELECT
      COUNT(*) AS unique_scopes,
      COUNT(DISTINCT scope_type) AS unique_types
    FROM scoped;
    `,
    [userId]
  );

  const uniqueScopes = Number(r.rows?.[0]?.unique_scopes ?? 0);
  const uniqueTypes = Number(r.rows?.[0]?.unique_types ?? 0);
  return uniqueScopes >= 5 && uniqueTypes >= 2;
}

async function checkConversationalist(pool: Pool, userId: string): Promise<boolean> {
  const r = await pool.query(
    `
    WITH c AS (
      SELECT
        created_at::date AS d,
        (data->>'postId') AS post_id
      FROM events
      WHERE (data->>'userId')::text = $1
        AND event_type = 'comment.created'
        AND created_at >= now() - INTERVAL '180 days'
        AND COALESCE(data->>'postId','') <> ''
    )
    SELECT
      COUNT(*) AS comment_count,
      COUNT(DISTINCT post_id) AS threads,
      COUNT(DISTINCT d) AS active_days
    FROM c;
    `,
    [userId]
  );

  const comments = Number(r.rows?.[0]?.comment_count ?? 0);
  const threads = Number(r.rows?.[0]?.threads ?? 0);
  const days = Number(r.rows?.[0]?.active_days ?? 0);
  return comments >= 10 && threads >= 5 && days >= 7;
}

async function checkHelper(pool: Pool, userId: string): Promise<boolean> {
  const r = await pool.query(
    `
    WITH signals AS (
      SELECT (data->>'userId') AS actor
      FROM events
      WHERE (data->>'targetUserId')::text = $1
        AND event_type IN ('post.saved','reaction.marked_helpful','user.thanked')
        AND created_at >= now() - INTERVAL '180 days'
        AND COALESCE(data->>'userId','') <> ''
      GROUP BY actor
    )
    SELECT COUNT(*) AS actors FROM signals;
    `,
    [userId]
  );
  const actors = Number(r.rows?.[0]?.actors ?? 0);
  return actors >= 3;
}

async function checkLocal(pool: Pool, userId: string): Promise<boolean> {
  const r = await pool.query(
    `
    WITH x AS (
      SELECT
        (data->>'countyFips') AS fips,
        created_at::date AS d
      FROM events
      WHERE (data->>'userId')::text = $1
        AND event_type IN ('community.viewed_scope','post.created','comment.created')
        AND created_at >= now() - INTERVAL '365 days'
        AND COALESCE(data->>'countyFips','') <> ''
    ),
    best AS (
      SELECT fips,
             COUNT(*) AS interactions,
             COUNT(DISTINCT d) AS days
      FROM x
      GROUP BY fips
      ORDER BY interactions DESC
      LIMIT 1
    )
    SELECT interactions, days FROM best;
    `,
    [userId]
  );

  const interactions = Number(r.rows?.[0]?.interactions ?? 0);
  const days = Number(r.rows?.[0]?.days ?? 0);
  return interactions >= 10 && days >= 14;
}

async function checkRegular(pool: Pool, userId: string): Promise<boolean> {
  const r = await pool.query(
    `
    SELECT COUNT(DISTINCT date_trunc('week', created_at)) AS weeks
    FROM events
    WHERE (data->>'userId')::text = $1
      AND event_type = 'user.session_started'
      AND created_at >= now() - INTERVAL '365 days';
    `,
    [userId]
  );
  const weeks = Number(r.rows?.[0]?.weeks ?? 0);
  return weeks >= 5;
}

async function checkRecordKeeper(pool: Pool, userId: string): Promise<boolean> {
  const r = await pool.query(
    `
    SELECT COUNT(*) AS c
    FROM events
    WHERE (data->>'userId')::text = $1
      AND event_type = 'finance.document_created'
      AND created_at >= now() - INTERVAL '365 days';
    `,
    [userId]
  );
  const c = Number(r.rows?.[0]?.c ?? 0);
  return c >= 3;
}

async function checkOrganizer(pool: Pool, userId: string): Promise<boolean> {
  const r = await pool.query(
    `
    WITH e AS (
      SELECT event_type, created_at::date AS d
      FROM events
      WHERE (data->>'userId')::text = $1
        AND event_type IN ('note.created','item.saved','task.created')
        AND created_at >= now() - INTERVAL '180 days'
    )
    SELECT
      COUNT(DISTINCT event_type) AS types,
      COUNT(DISTINCT d) AS days
    FROM e;
    `,
    [userId]
  );
  const types = Number(r.rows?.[0]?.types ?? 0);
  const days = Number(r.rows?.[0]?.days ?? 0);
  return types >= 3 && days >= 7;
}

async function checkConnector(pool: Pool, userId: string): Promise<boolean> {
  const r = await pool.query(
    `
    SELECT COUNT(*) AS c
    FROM events
    WHERE (data->>'userId')::text = $1
      AND event_type = 'connection.confirmed'
      AND created_at >= now() - INTERVAL '365 days';
    `,
    [userId]
  );
  const c = Number(r.rows?.[0]?.c ?? 0);
  return c >= 2;
}

async function checkLurker(pool: Pool, userId: string): Promise<boolean> {
  const r = await pool.query(
    `
    WITH views AS (
      SELECT COUNT(*) AS v, COUNT(DISTINCT created_at::date) AS days
      FROM events
      WHERE (data->>'userId')::text = $1
        AND event_type = 'content.viewed'
        AND created_at >= now() - INTERVAL '180 days'
    ),
    contrib AS (
      SELECT COUNT(*) AS c
      FROM events
      WHERE (data->>'userId')::text = $1
        AND event_type IN ('post.created','comment.created')
        AND created_at >= now() - INTERVAL '180 days'
    )
    SELECT (SELECT v FROM views) AS views,
           (SELECT days FROM views) AS days,
           (SELECT c FROM contrib) AS contrib;
    `,
    [userId]
  );

  const views = Number(r.rows?.[0]?.views ?? 0);
  const days = Number(r.rows?.[0]?.days ?? 0);
  const contrib = Number(r.rows?.[0]?.contrib ?? 0);
  return views >= 50 && days >= 14 && contrib < 3;
}

async function checkNightOwl(pool: Pool, userId: string): Promise<boolean> {
  const r = await pool.query(
    `
    SELECT COUNT(*) AS c,
           COUNT(DISTINCT created_at::date) AS nights
    FROM events
    WHERE (data->>'userId')::text = $1
      AND event_type = 'activity.night_time'
      AND created_at >= now() - INTERVAL '365 days';
    `,
    [userId]
  );

  const c = Number(r.rows?.[0]?.c ?? 0);
  const nights = Number(r.rows?.[0]?.nights ?? 0);
  return c >= 10 && nights >= 3;
}

async function checkBetaExplorer(pool: Pool, userId: string): Promise<boolean> {
  const r = await pool.query(
    `
    SELECT COUNT(DISTINCT (data->>'featureKey')) AS features
    FROM events
    WHERE (data->>'userId')::text = $1
      AND event_type = 'beta_feature.used'
      AND created_at >= now() - INTERVAL '365 days';
    `,
    [userId]
  );

  const features = Number(r.rows?.[0]?.features ?? 0);
  return features >= 1;
}
