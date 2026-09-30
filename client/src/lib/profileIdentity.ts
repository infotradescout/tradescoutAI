import {
  normalizeProfileCustomDomain,
  type ProfileTargetIdentity,
} from "@shared/profileTargetIdentity";

export type ProfileIdentity = ProfileTargetIdentity;
export { profileTargetIdentitiesEqual as sameProfileIdentity } from "@shared/profileTargetIdentity";

export function readProfileIdentity(value: unknown): ProfileIdentity | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.ownerUserId !== "string" || !row.ownerUserId ||
    !(row.businessId === null || (typeof row.businessId === "string" && row.businessId)) ||
    typeof row.roleContext !== "string" || !row.roleContext ||
    typeof row.slug !== "string" || !row.slug ||
    (row.status !== "draft" && row.status !== "published") ||
    typeof row.publiclyReleased !== "boolean" ||
    !Object.prototype.hasOwnProperty.call(row, "seoMeta") ||
    !(row.seoMeta === null ||
      (typeof row.seoMeta === "object" && !Array.isArray(row.seoMeta)))
  ) return null;
  const domain = (row.seoMeta as Record<string, unknown> | null)?.customDomain;
  if (!(domain === undefined || domain === null || typeof domain === "string")) return null;
  return {
    ownerUserId: row.ownerUserId,
    businessId: row.businessId,
    roleContext: row.roleContext,
    slug: row.slug,
    status: row.status,
    publiclyReleased: row.publiclyReleased,
    customDomain: normalizeProfileCustomDomain(domain),
  };
}

export function sameProfileTargetAsidePublication(left: ProfileIdentity, right: ProfileIdentity): boolean {
  return left.ownerUserId === right.ownerUserId &&
    left.businessId === right.businessId &&
    left.roleContext === right.roleContext &&
    left.slug === right.slug &&
    left.customDomain === right.customDomain;
}
