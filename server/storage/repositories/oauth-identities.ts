import { and, eq, or, sql } from "drizzle-orm";
import { users, type User } from "../../../shared/schema";
import { OAuthIdentityCollisionError, type OAuthProvider } from "../../utils/oauthIdentityPolicy";

/** Read both supported subject representations; never choose an arbitrary owner. */
export async function loadUniqueOAuthProviderUser(
  database: any,
  provider: OAuthProvider,
  subject: string
): Promise<User | undefined> {
  const normalized = String(subject || "").trim();
  if (!normalized) return undefined;
  const legacyColumn = provider === "google" ? users.googleId : users.facebookId;
  const matches: User[] = await database
    .select()
    .from(users)
    .where(
      or(
        eq(legacyColumn, normalized),
        and(eq(users.provider, provider), eq(users.providerId, normalized))
      )
    )
    .limit(2);
  if (matches.length > 1) throw new OAuthIdentityCollisionError();
  const user = matches[0];
  if (!user) return undefined;
  const legacySubject = provider === "google" ? user.googleId : user.facebookId;
  if (
    (legacySubject && legacySubject !== normalized) ||
    (user.provider === provider && user.providerId && user.providerId !== normalized)
  )
    throw new OAuthIdentityCollisionError();
  return user;
}

/** Email is collision evidence, including legacy case-only duplicates. */
export async function loadOAuthEmailCandidates(database: any, email: string): Promise<User[]> {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized) return [];
  return database
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized}`)
    .limit(2);
}
