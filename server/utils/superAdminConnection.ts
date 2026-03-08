import { db } from "../db";
import { users } from "@shared/schema";
import { desc, sql } from "drizzle-orm";

type EnsureSuperAdminConnectionResult = {
  ensured: boolean;
  reason?: string;
  superAdminUserId?: string;
};

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

  // Super admin account does not need an auto-link to itself.
  if (superAdminUserId === normalizedUserId) {
    return { ensured: false, reason: "self_super_admin", superAdminUserId };
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
      'system_super_admin_auto_connection',
      'platform_support',
      'Platform support connection',
      now(),
      ${superAdminUserId},
      'system_super_admin_auto_connection',
      now()
    )
    on conflict (requester_id, target_user_id)
    do update set
      status = 'accepted',
      authority_gate = 'system_super_admin_auto_connection',
      intent = 'platform_support',
      decision_scope = 'Platform support connection',
      responded_at = now(),
      responded_by = ${superAdminUserId},
      response_reason = 'system_super_admin_auto_connection',
      updated_at = now()
  `);

  return { ensured: true, superAdminUserId };
}
