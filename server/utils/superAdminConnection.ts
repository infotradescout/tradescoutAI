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

  // Platform law: visibility never grants contact or power.
  // Resolve the support account for callers, but do not create follows or accepted contact edges.
  return { ensured: false, reason: "contact_gated", superAdminUserId };
}
