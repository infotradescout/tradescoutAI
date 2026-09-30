import { and, eq, sql } from "drizzle-orm";
import { profiles, type Profile } from "@shared/schema";
import { normalizeProfileCustomDomain, type ProfileTargetIdentity } from "@shared/profileTargetIdentity";
import { profileTargetIdentityFromRow } from "./profileTargetIdentity";

/** Bind a content mutation to the identity the writer actually loaded. */
export function profileTargetIdentityPredicate(expected: ProfileTargetIdentity) {
  return and(
    eq(profiles.ownerUserId, expected.ownerUserId),
    sql`${profiles.businessId} IS NOT DISTINCT FROM ${expected.businessId}`,
    eq(profiles.roleContext, expected.roleContext as Profile["roleContext"]),
    eq(profiles.slug, expected.slug),
    eq(profiles.status, expected.status),
    eq(profiles.publiclyReleased, expected.publiclyReleased),
    sql`lower(btrim(coalesce(${profiles.seoMeta} ->> 'customDomain', ''))) = ${normalizeProfileCustomDomain(expected.customDomain)}`
  );
}

/** Direct transactional writers must compare their original snapshot as well. */
export function profileContentBlocksSnapshotPredicate(snapshot: Profile) {
  if (!Number.isSafeInteger(snapshot.contentBlocksRevision) || snapshot.contentBlocksRevision < 1) {
    throw new Error("Profile content revision is required before saving content");
  }
  return and(
    eq(profiles.contentBlocksRevision, snapshot.contentBlocksRevision),
    profileTargetIdentityPredicate(profileTargetIdentityFromRow(snapshot))
  );
}

/** A transaction may version this profile while changing its own dependencies.
 * Reload the complete row before deriving its next array, preserving the target
 * identity already authorized by the caller. Never adopt only its new revision.
 */
export async function reloadProfileContentSnapshot(tx: any, previous: Profile): Promise<Profile> {
  const [current] = await tx.select().from(profiles)
    .where(and(eq(profiles.id, previous.id), profileTargetIdentityPredicate(profileTargetIdentityFromRow(previous))))
    .limit(1);
  if (!current) throw new Error("Profile target changed during dependency update");
  return current as Profile;
}
