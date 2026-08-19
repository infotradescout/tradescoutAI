export type ProfileAccountPolicy = Readonly<{
  enabled: boolean;
  profileSlug: string;
  businessOnly: true;
  includesBidRock: boolean;
  label: string;
  heading: string;
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
}): ProfileAccountPolicy {
  const profileSlug = normalizeSlug(args.profileSlug);
  const profileName = String(args.profileName || "this profile").trim() || "this profile";

  return Object.freeze({
    enabled: true,
    profileSlug,
    businessOnly: true as const,
    includesBidRock: profileAccountIncludesBidRock({
      profileSlug,
      contentBlocks: args.contentBlocks,
    }),
    label: `${profileName} account`,
    heading: `Create an account with ${profileName}`,
    description:
      "Businesses can create an account with this profile using their existing TradeScout business identity.",
  });
}

export function buildProfileAccountReturnPath(profileSlug: string): string {
  const normalized = normalizeSlug(profileSlug);
  const params = new URLSearchParams({ profileAccount: "1" });
  return `/u/${encodeURIComponent(normalized)}?${params.toString()}`;
}
