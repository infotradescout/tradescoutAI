import type { Pool } from "@neondatabase/serverless";
import type { LoggedEvent } from "./eventTypes";
import { xpRules, getDayKeyUtc } from "./xpRules";

export type XpEngineDeps = {
  pool: Pool;
  logInternalEvent?: (eventType: string, data: any) => Promise<void>;
};

function safeUserIdFromEvent(e: LoggedEvent): string | null {
  const d = e.data ?? {};
  const target = typeof d.targetUserId === "string" ? d.targetUserId : null;
  const userId = typeof d.userId === "string" ? d.userId : null;
  const actorId = typeof d.actorId === "string" ? d.actorId : null;

  if (
    target &&
    [
      "post.saved",
      "reaction.marked_helpful",
      "user.thanked",
      "user.profile_viewed",
    ].includes(String(e.eventType))
  ) {
    return target;
  }
  return userId ?? actorId;
}

function isDuplicateKeyUniqueToEventType(eventType: string): boolean {
  return [
    "community.viewed_scope",
    "user.profile_viewed",
    "post.saved",
    "reaction.marked_helpful",
    "user.thanked",
    "beta_feature.used",
  ].includes(eventType);
}

export async function processXpForEvent(
  deps: XpEngineDeps,
  event: LoggedEvent,
): Promise<number> {
  if (process.env.XP_ENGINE_DISABLED === "true") return 0;
  if (
    event.eventType === "xp.applied" ||
    event.eventType === "badge.awarded"
  ) {
    return 0;
  }

  const rule = xpRules[String(event.eventType)];
  if (!rule) return 0;

  const userId = safeUserIdFromEvent(event);
  if (!userId) return 0;

  const eventData = event.data ?? {};
  const createdAt =
    event.createdAt instanceof Date ? event.createdAt : new Date(event.createdAt);
  const dayKey = getDayKeyUtc(createdAt);
  const capKey = rule.capKey(eventData);

  if (isDuplicateKeyUniqueToEventType(String(event.eventType))) {
    const inserted = await tryInsertUnique(
      deps.pool,
      String(event.eventType),
      userId,
      dayKey,
      eventData,
    );
    if (!inserted) return 0;
  }

  const base = Math.max(0, Math.floor(rule.base(eventData)));
  if (base <= 0) return 0;

  const dailyCount = await incrementDailyCount(deps.pool, userId, dayKey, capKey);

  const grant = Math.max(
    0,
    Math.floor(rule.applyCap(base, dailyCount - 1, eventData)),
  );
  if (grant <= 0) return 0;

  await applyXp(deps.pool, userId, grant, String(event.eventType), event.id, dayKey);

  if (deps.logInternalEvent) {
    await deps.logInternalEvent("xp.applied", {
      userId,
      delta: grant,
      reason: String(event.eventType),
      eventId: event.id,
      dayKeyUtc: dayKey,
    });
  }

  return grant;
}

async function incrementDailyCount(
  pool: Pool,
  userId: string,
  dayKeyUtc: string,
  capKey: string,
): Promise<number> {
  const { rows } = await pool.query(
    `
    INSERT INTO xp_daily_counters (user_id, day_key_utc, cap_key, count)
    VALUES ($1, $2, $3, 1)
    ON CONFLICT (user_id, day_key_utc, cap_key)
    DO UPDATE SET count = xp_daily_counters.count + 1
    RETURNING count;
    `,
    [userId, dayKeyUtc, capKey],
  );
  return Number(rows?.[0]?.count ?? 0);
}

async function applyXp(
  pool: Pool,
  userId: string,
  delta: number,
  reason: string,
  sourceEventId: string,
  dayKeyUtc: string,
): Promise<void> {
  await pool.query("BEGIN");
  try {
    await pool.query(
      `
      INSERT INTO xp_ledger (user_id, delta, reason, source_event_id, day_key_utc)
      VALUES ($1, $2, $3, $4, $5);
      `,
      [userId, delta, reason, sourceEventId, dayKeyUtc],
    );

    await pool.query(
      `
      INSERT INTO user_xp (user_id, xp_total)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET xp_total = user_xp.xp_total + EXCLUDED.xp_total, updated_at = now();
      `,
      [userId, delta],
    );

    await pool.query("COMMIT");
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }
}

async function tryInsertUnique(
  pool: Pool,
  eventType: string,
  creditedUserId: string,
  dayKeyUtc: string,
  d: any,
): Promise<boolean> {
  let uniqueKey = "";

  if (eventType === "community.viewed_scope") {
    const scopeType = String(d?.scopeType ?? "");
    const scopeId = String(d?.scopeId ?? "");
    if (!scopeType || !scopeId) return false;
    uniqueKey = `scope:${scopeType}:${scopeId}`;
  } else if (eventType === "user.profile_viewed") {
    const viewer = String(d?.userId ?? "");
    if (!viewer) return false;
    uniqueKey = `viewer:${viewer}`;
  } else if (eventType === "post.saved") {
    const saver = String(d?.userId ?? "");
    const postId = String(d?.postId ?? "");
    if (!saver || !postId) return false;
    uniqueKey = `post:${postId}:saver:${saver}`;
  } else if (
    eventType === "reaction.marked_helpful" ||
    eventType === "user.thanked"
  ) {
    const actor = String(d?.userId ?? "");
    if (!actor) return false;
    uniqueKey = `actor:${actor}`;
  } else if (eventType === "beta_feature.used") {
    const featureKey = String(d?.featureKey ?? "");
    if (!featureKey) return false;
    uniqueKey = `feature:${featureKey}`;
  } else {
    return true;
  }

  const res = await pool.query(
    `
    INSERT INTO xp_daily_uniques (user_id, day_key_utc, event_type, unique_key)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, day_key_utc, event_type, unique_key)
    DO NOTHING;
    `,
    [creditedUserId, dayKeyUtc, eventType, uniqueKey],
  );

  return res.rowCount === 1;
}
