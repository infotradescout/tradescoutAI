export type ProfileAccountIdentityRequirement = "user" | "business";

export type ProfileAccountPolicy = Readonly<{
  enabled: boolean;
  profileSlug: string;
  requiredIdentity: ProfileAccountIdentityRequirement;
  includesBidRock: boolean;
  priorityKey: string;
  label: "Account";
  heading: "Create an account";
  description: string;
}>;

const STONE_PROFILE_SLUGS = new Set(["jw-stone", "issa-build", "red-graniti"]);
const STONE_MATERIAL_TERMS = new Set([
  "stone",
  "natural-stone",
  "engineered-stone",
  "granite",
  "marble",
  "quartz",
  "quartzite",
  "onyx",
  "soapstone",
  "travertine",
  "limestone",
  "dolomite",
  "porcelain",
  "sintered-stone",
  "slab",
  "slabs",
]);

function normalizeSlug(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function normalizePriorityKey(value: unknown, fallback: string): string {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function contentContainsStone(contentBlocks: unknown): boolean {
  for (const block of readArray(contentBlocks)) {
    if (!block || typeof block !== "object") continue;
    const record = block as Record<string, unknown>;
    if (String(record.type || "") !== "inventoryCatalog") continue;
    const data =
      record.data && typeof record.data === "object"
        ? (record.data as Record<string, unknown>)
        : {};
    for (const category of readArray(data.categories)) {
      if (!category || typeof category !== "object") continue;
      const categoryRecord = category as Record<string, unknown>;
      const candidates = [
        categoryRecord.categorySlug,
        categoryRecord.category,
        categoryRecord.title,
        categoryRecord.material,
      ];
      if (candidates.some((candidate) => STONE_MATERIAL_TERMS.has(normalizeSlug(candidate)))) {
        return true;
      }
    }
  }
  return false;
}

function readProfilePriorityConfig(value: unknown): Readonly<{
  requiredIdentity: ProfileAccountIdentityRequirement | null;
  priorityKey: string | null;
  description: string | null;
}> {
  if (!value || typeof value !== "object") {
    return Object.freeze({ requiredIdentity: null, priorityKey: null, description: null });
  }
  const record = value as Record<string, unknown>;
  const requiredIdentity =
    record.requiredIdentity === "business" || record.requiredIdentity === "user"
      ? record.requiredIdentity
      : null;
  const priorityKey = String(record.priorityKey || "").trim().slice(0, 80) || null;
  const description = String(record.description || "").trim().slice(0, 280) || null;
  return Object.freeze({ requiredIdentity, priorityKey, description });
}

export function profileAccountIncludesBidRock(args: {
  profileSlug: string;
  contentBlocks?: unknown;
}): boolean {
  const profileSlug = normalizeSlug(args.profileSlug);
  return STONE_PROFILE_SLUGS.has(profileSlug) || contentContainsStone(args.contentBlocks);
}

export function resolveProfileAccountPolicy(args: {
  profileSlug: string;
  profileName?: string | null;
  contentBlocks?: unknown;
  profilePriorityConfig?: unknown;
}): ProfileAccountPolicy {
  const profileSlug = normalizeSlug(args.profileSlug);
  const profileName = String(args.profileName || "this profile").trim() || "this profile";
  const stoneProfile = profileAccountIncludesBidRock({
    profileSlug,
    contentBlocks: args.contentBlocks,
  });
  const configured = readProfilePriorityConfig(args.profilePriorityConfig);

  // Stone profiles are the first completed business-account lane because they
  // can unlock verified-business stone access and BidRock. The customer still
  // creates the account directly with the business whose profile they opened.
  const requiredIdentity: ProfileAccountIdentityRequirement = stoneProfile
    ? "business"
    : configured.requiredIdentity || "user";
  const priorityKey = stoneProfile
    ? "stone_business_access"
    : normalizePriorityKey(configured.priorityKey, "profile_account");
  const defaultDescription =
    requiredIdentity === "business"
      ? `Any business can create an account directly with ${profileName}.`
      : `Create an account directly with ${profileName}.`;

  return Object.freeze({
    enabled: true,
    profileSlug,
    requiredIdentity,
    includesBidRock: stoneProfile,
    priorityKey,
    label: "Account" as const,
    heading: "Create an account" as const,
    description: configured.description || defaultDescription,
  });
}

export function buildProfileAccountReturnPath(profileSlug: string): string {
  const normalized = normalizeSlug(profileSlug);
  const params = new URLSearchParams({ profileAccount: "1" });
  const profilePath =
    normalized === "jw-stone" ? "/jw-stone" : `/u/${encodeURIComponent(normalized)}`;
  return `${profilePath}?${params.toString()}`;
}
