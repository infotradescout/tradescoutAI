/** Fields that bind a whole-page edit to the target the manager actually loaded. */
export type ProfileTargetIdentity = {
  ownerUserId: string;
  businessId: string | null;
  roleContext: string;
  slug: string;
  status: "draft" | "published";
  publiclyReleased: boolean;
  customDomain: string;
};

export const PROFILE_TARGET_IDENTITY_KEYS = [
  "ownerUserId",
  "businessId",
  "roleContext",
  "slug",
  "status",
  "publiclyReleased",
  "customDomain",
] as const;

export function normalizeProfileCustomDomain(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function profileTargetIdentitiesEqual(
  left: ProfileTargetIdentity,
  right: ProfileTargetIdentity
): boolean {
  return PROFILE_TARGET_IDENTITY_KEYS.every((key) => left[key] === right[key]);
}
