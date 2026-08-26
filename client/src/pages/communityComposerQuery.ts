export const COMMUNITY_COMPOSER_CATEGORIES = [
  "general",
  "question",
  "recommendation",
  "event",
  "tip",
  "request",
  "alert",
  "forsale",
] as const;

export type CommunityComposerCategory = (typeof COMMUNITY_COMPOSER_CATEGORIES)[number];

export type CommunityComposerQuery = Readonly<{
  shouldOpen: boolean;
  prefill: string | null;
  category: CommunityComposerCategory | null;
}>;

export function parseCommunityComposerQuery(search: string): CommunityComposerQuery {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const rawCategory = String(params.get("category") || "").trim().toLowerCase();
  const category = COMMUNITY_COMPOSER_CATEGORIES.includes(
    rawCategory as CommunityComposerCategory
  )
    ? (rawCategory as CommunityComposerCategory)
    : null;
  const prefill = params.get("prefill");

  return {
    shouldOpen: params.get("compose") === "1",
    prefill: prefill ? prefill.slice(0, 4000) : null,
    category,
  };
}
