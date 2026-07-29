export const PROFILE_SECTIONS_BLOCK_TYPE = "profileSections" as const;

export const PROFILE_SECTION_KEYS = [
  "about",
  "rolesAndBadges",
  "stats",
  "services",
  "marketplaceListings",
  "reviews",
  "communityActivity",
  "contactCard",
] as const;

export type ProfileSectionKey = (typeof PROFILE_SECTION_KEYS)[number];
export type ProfileSectionConfig = Partial<Record<ProfileSectionKey, boolean>>;

function normalizeSections(value: unknown): ProfileSectionConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return PROFILE_SECTION_KEYS.reduce<ProfileSectionConfig>((result, key) => {
    if (typeof source[key] === "boolean") result[key] = source[key] as boolean;
    return result;
  }, {});
}

export function readProfileSectionConfigBlock(contentBlocks: unknown): ProfileSectionConfig | null {
  if (!Array.isArray(contentBlocks)) return null;
  const block = contentBlocks.find(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      (entry as Record<string, unknown>).type === PROFILE_SECTIONS_BLOCK_TYPE
  ) as Record<string, unknown> | undefined;
  if (!block) return null;
  const data =
    block.data && typeof block.data === "object" ? (block.data as Record<string, unknown>) : {};
  const sections = normalizeSections(data.sections || data);
  return Object.keys(sections).length > 0 ? sections : {};
}

export function upsertProfileSectionConfigBlock(
  contentBlocks: unknown,
  updates: ProfileSectionConfig,
  legacyFallback: ProfileSectionConfig = {}
): Array<Record<string, unknown>> {
  const blocks = Array.isArray(contentBlocks)
    ? contentBlocks.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
      )
    : [];
  const stored = readProfileSectionConfigBlock(blocks);
  const existing = stored === null ? normalizeSections(legacyFallback) : stored;
  const sections = { ...existing, ...normalizeSections(updates) };
  const nextBlock = {
    type: PROFILE_SECTIONS_BLOCK_TYPE,
    data: { sections },
  };
  const existingIndex = blocks.findIndex((entry) => entry.type === PROFILE_SECTIONS_BLOCK_TYPE);
  if (existingIndex < 0) return [nextBlock, ...blocks];
  return blocks.map((entry, index) => (index === existingIndex ? nextBlock : entry));
}
