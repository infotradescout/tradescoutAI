import { rankJwStoneCatalogForBrowse } from "./catalog";
import type { JwStoneCatalogItem } from "./types";

/**
 * Quiet search aliases for supplier spellings, common name variants, and likely
 * buyer wording. They affect matching only and never appear in public cards.
 */
const SEARCH_ALIASES_BY_STONE_ID: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "black-dunes": ["black dunes granite"],
  avalanche: ["avalanche marble"],
  "cristalita-blue": ["cristallita blue", "cristalita blue quartzite"],
  "rhino-white": ["rhino white marble"],
  "blue-bahia": ["bahia blue", "blue bahia granite"],
  "calacatta-vaguili": ["calacatta vagli", "vagli", "vaguili"],
  matarazzo: ["matarazzo dolomite", "matarazzo marble"],
  "calacatta-cremo": ["cremo calacatta"],
  "casa-blanca": ["casablanca", "casa blanca quartzite"],
  "white-santorini": ["santorini white", "white santorini quartzite"],
});

export function normalizeJwStoneSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedValues(values: ReadonlyArray<string | null | undefined>): string[] {
  return values
    .map((value) => normalizeJwStoneSearchText(value || ""))
    .filter((value) => value.length > 0);
}

function searchAliases(stone: JwStoneCatalogItem): readonly string[] {
  const direct = SEARCH_ALIASES_BY_STONE_ID[stone.id];
  if (direct) return direct;
  if (stone.shareSlug) return SEARCH_ALIASES_BY_STONE_ID[stone.shareSlug] ?? [];
  return [];
}

function searchDocument(stone: JwStoneCatalogItem) {
  const names = normalizedValues([
    stone.displayName,
    stone.publicLabel,
    stone.id,
    stone.shareSlug,
    ...searchAliases(stone),
  ]);
  const materials = normalizedValues([stone.materialLabel]);
  const colors = normalizedValues(stone.colors);
  const finishes = normalizedValues(stone.finishes);
  const origins = normalizedValues([stone.origin?.country]);
  const all = [...names, ...materials, ...colors, ...finishes, ...origins];

  return { names, materials, colors, finishes, origins, all };
}

function includesAllTokens(values: readonly string[], queryTokens: readonly string[]): boolean {
  return queryTokens.every((token) => values.some((value) => value.includes(token)));
}

export function matchesJwStoneSearch(stone: JwStoneCatalogItem, query: string): boolean {
  const normalizedQuery = normalizeJwStoneSearchText(query);
  if (!normalizedQuery) return true;
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  return includesAllTokens(searchDocument(stone).all, queryTokens);
}

function relevanceRank(stone: JwStoneCatalogItem, query: string): number {
  const normalizedQuery = normalizeJwStoneSearchText(query);
  if (!normalizedQuery) return 0;

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const document = searchDocument(stone);

  if (document.names.some((value) => value === normalizedQuery)) return 0;

  // Generic buyer intent such as "blue", "quartzite", or "polished" should
  // give every exact field match equal relevance, then let merchandising order
  // choose the strongest applicable stones rather than favoring name wording.
  if (
    document.materials.some((value) => value === normalizedQuery) ||
    document.colors.some((value) => value === normalizedQuery) ||
    document.finishes.some((value) => value === normalizedQuery) ||
    document.origins.some((value) => value === normalizedQuery)
  ) {
    return 1;
  }

  if (document.names.some((value) => value.startsWith(normalizedQuery))) return 2;
  if (document.names.some((value) => value.includes(normalizedQuery))) return 3;
  if (includesAllTokens(document.names, queryTokens)) return 4;
  if (includesAllTokens([...document.materials, ...document.colors], queryTokens)) return 5;
  if (includesAllTokens(document.all, queryTokens)) return 6;
  return Number.POSITIVE_INFINITY;
}

/**
 * Search intent wins first; JW's quiet business-priority order breaks ties.
 * This keeps an exact buyer request honest while still merchandising the best
 * applicable options ahead of ordinary matches.
 */
export function rankJwStoneSearchResults(
  stones: readonly JwStoneCatalogItem[],
  query: string
): JwStoneCatalogItem[] {
  const prioritized = rankJwStoneCatalogForBrowse(stones);
  const priorityPosition = new Map(prioritized.map((stone, index) => [stone.id, index] as const));

  return stones
    .map((stone, sourceIndex) => ({
      stone,
      sourceIndex,
      relevance: relevanceRank(stone, query),
      priorityPosition: priorityPosition.get(stone.id) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => {
      if (left.relevance !== right.relevance) return left.relevance - right.relevance;
      if (left.priorityPosition !== right.priorityPosition) {
        return left.priorityPosition - right.priorityPosition;
      }
      return left.sourceIndex - right.sourceIndex;
    })
    .map(({ stone }) => stone);
}
