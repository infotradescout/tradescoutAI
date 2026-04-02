import { db } from "../db";
import { users } from "@shared/schema";
import { desc, sql } from "drizzle-orm";

// contact_permissions.authority_gate is varchar(30)
const SUPER_ADMIN_AUTHORITY_GATE = "system_super_admin_auto";
const SUPER_ADMIN_RESPONSE_REASON = "system_super_admin_auto_connection";

type EnsureSuperAdminConnectionResult = {
  ensured: boolean;
  reason?: string;
  superAdminUserId?: string;
};

const SUPER_ADMIN_SWEEP_COOLDOWN_MS = 15 * 60 * 1000;
const lastSuperAdminSweepAt = new Map<string, number>();

async function resolveSuperAdminUserId(): Promise<string | null> {
  const [superAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.role}::text) = 'super_admin'`)
    .orderBy(desc(users.updatedAt), desc(users.createdAt))
    .limit(1);

  return superAdmin?.id ? String(superAdmin.id) : null;
}

export async function ensureSuperAdminConnectionForUser(
  userId: string
): Promise<EnsureSuperAdminConnectionResult> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return { ensured: false, reason: "missing_user_id" };
  }

  const superAdminUserId = await resolveSuperAdminUserId();
  if (!superAdminUserId) {
    return { ensured: false, reason: "missing_super_admin" };
  }

  const now = Date.now();

  // If the current user is the super admin account, backfill their
  // bidirectional support link + accepted contact edge with all users.
  // Throttle to avoid repeating heavy set-based inserts on every /api/auth/user poll.
  if (superAdminUserId === normalizedUserId) {
    const lastSweep = lastSuperAdminSweepAt.get(superAdminUserId) || 0;
    if (now - lastSweep < SUPER_ADMIN_SWEEP_COOLDOWN_MS) {
      return { ensured: false, reason: "self_super_admin_recent_sweep", superAdminUserId };
    }

    await db.execute(sql`
      insert into user_follows (follower_id, following_id)
      select ${superAdminUserId}, u.id
      from users u
      where u.id <> ${superAdminUserId}
        and not exists (
          select 1 from user_follows f
          where f.follower_id = ${superAdminUserId}
            and f.following_id = u.id
        )
    `);

    await db.execute(sql`
      insert into user_follows (follower_id, following_id)
      select u.id, ${superAdminUserId}
      from users u
      where u.id <> ${superAdminUserId}
        and not exists (
          select 1 from user_follows f
          where f.follower_id = u.id
            and f.following_id = ${superAdminUserId}
        )
    `);

    await db.execute(sql`
      insert into contact_permissions (
        requester_id,
        target_user_id,
        status,
        authority_gate,
        intent,
        decision_scope,
        responded_at,
        responded_by,
        response_reason,
        updated_at
      )
      select
        ${superAdminUserId},
        u.id,
        'accepted',
        ${SUPER_ADMIN_AUTHORITY_GATE},
        'platform_support',
        'Platform support connection',
        now(),
        ${superAdminUserId},
        ${SUPER_ADMIN_RESPONSE_REASON},
        now()
      from users u
      where u.id <> ${superAdminUserId}
      on conflict (requester_id, target_user_id)
      do update set
        status = 'accepted',
        authority_gate = ${SUPER_ADMIN_AUTHORITY_GATE},
        intent = 'platform_support',
        decision_scope = 'Platform support connection',
        responded_at = now(),
        responded_by = ${superAdminUserId},
        response_reason = ${SUPER_ADMIN_RESPONSE_REASON},
        updated_at = now()
    `);

    await db.execute(sql`
      insert into contact_permissions (
        requester_id,
        target_user_id,
        status,
        authority_gate,
        intent,
        decision_scope,
        responded_at,
        responded_by,
        response_reason,
        updated_at
      )
      select
        u.id,
        ${superAdminUserId},
        'accepted',
        ${SUPER_ADMIN_AUTHORITY_GATE},
        'platform_support',
        'Platform support connection',
        now(),
        ${superAdminUserId},
        ${SUPER_ADMIN_RESPONSE_REASON},
        now()
      from users u
      where u.id <> ${superAdminUserId}
      on conflict (requester_id, target_user_id)
      do update set
        status = 'accepted',
        authority_gate = ${SUPER_ADMIN_AUTHORITY_GATE},
        intent = 'platform_support',
        decision_scope = 'Platform support connection',
        responded_at = now(),
        responded_by = ${superAdminUserId},
        response_reason = ${SUPER_ADMIN_RESPONSE_REASON},
        updated_at = now()
    `);

    lastSuperAdminSweepAt.set(superAdminUserId, now);
    return { ensured: true, reason: "self_super_admin_full_sweep", superAdminUserId };
  }

  await db.execute(sql`
    insert into user_follows (follower_id, following_id)
    select ${normalizedUserId}, ${superAdminUserId}
    where not exists (
      select 1
      from user_follows
      where follower_id = ${normalizedUserId}
        and following_id = ${superAdminUserId}
    )
  `);

  await db.execute(sql`
    insert into user_follows (follower_id, following_id)
    select ${superAdminUserId}, ${normalizedUserId}
    where not exists (
      select 1
      from user_follows
      where follower_id = ${superAdminUserId}
        and following_id = ${normalizedUserId}
    )
  `);

  await db.execute(sql`
    insert into contact_permissions (
      requester_id,
      target_user_id,
      status,
      authority_gate,
      intent,
      decision_scope,
      responded_at,
      responded_by,
      response_reason,
      updated_at
    )
    values (
      ${normalizedUserId},
      ${superAdminUserId},
      'accepted',
      ${SUPER_ADMIN_AUTHORITY_GATE},
      'platform_support',
      'Platform support connection',
      now(),
      ${superAdminUserId},
      ${SUPER_ADMIN_RESPONSE_REASON},
      now()
    )
    on conflict (requester_id, target_user_id)
    do update set
      status = 'accepted',
      authority_gate = ${SUPER_ADMIN_AUTHORITY_GATE},
      intent = 'platform_support',
      decision_scope = 'Platform support connection',
      responded_at = now(),
      responded_by = ${superAdminUserId},
      response_reason = ${SUPER_ADMIN_RESPONSE_REASON},
      updated_at = now()
  `);

  return { ensured: true, superAdminUserId };
}
