import { db } from "../db";
import { users, userFollows, contactPermissions } from "@shared/schema";
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

async function ensureFollowEdge(followerId: string, followingId: string): Promise<void> {
  if (!followerId || !followingId || followerId === followingId) return;

  // user_follows does not currently enforce a unique pair index.
  // Use "insert where not exists" semantics to keep this idempotent.
  await db.execute(sql`
    insert into user_follows (id, follower_id, following_id, created_at)
    select gen_random_uuid(), ${followerId}, ${followingId}, now()
    where not exists (
      select 1
      from user_follows uf
      where uf.follower_id = ${followerId}
        and uf.following_id = ${followingId}
    )
  `);
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

  const now = new Date();

  // Social graph: enforce mutual follow so social connections are always present.
  await ensureFollowEdge(normalizedUserId, superAdminUserId);
  await ensureFollowEdge(superAdminUserId, normalizedUserId);

  // Contact graph: enforce accepted first-contact permission so "Connections" tab
  // includes super admin support as an approved contact path.
  await db
    .insert(contactPermissions)
    .values({
      requesterId: superAdminUserId,
      targetUserId: normalizedUserId,
      status: "accepted",
      authorityGate: "system_super_admin_auto_connection",
      intent: "platform_support",
      respondedAt: now,
      respondedBy: superAdminUserId,
      updatedAt: now,
    } as any)
    .onConflictDoUpdate({
      target: [contactPermissions.requesterId, contactPermissions.targetUserId],
      set: {
        status: "accepted",
        authorityGate: "system_super_admin_auto_connection",
        intent: "platform_support",
        respondedAt: now,
        respondedBy: superAdminUserId,
        updatedAt: now,
      } as any,
    });

  return { ensured: true, superAdminUserId };
}
