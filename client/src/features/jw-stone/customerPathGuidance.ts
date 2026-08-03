import { JW_STONE_PROFILE_PRESENTATION_BLOCK } from "@/data/jwStoneProfilePresentation";
import { JW_STONE_CATALOG } from "./catalog";
import { BUYER_TYPES, type BuyerType, type JwStoneCatalogItem } from "./types";

export const CUSTOMER_PATH_MAX_KNOWLEDGE_POINTS = 3;
export const CUSTOMER_PATH_MAX_RAIL_ITEMS = 6;

const SAFE_SOURCE_HOSTS = new Set(["usenaturalstone.org", "www.naturalstoneinstitute.org"]);
const UNSAFE_CLAIM_PATTERN =
  /\b(best|ideal|perfect|popular|preference|preferred|recommend(?:ation|ed)|suitab(?:le|ility)|availability|available now|in[- ]stock|live[- ]stock|guarantee(?:d)?)\b/i;

export type CustomerPathSource = Readonly<{
  label: string;
  url: string;
}>;

export type CustomerPathKnowledgePoint = Readonly<{
  text: string;
  source: CustomerPathSource;
}>;

type CustomerPathSelectionRule =
  | Readonly<{ kind: "fabricator-documented" }>
  | Readonly<{ kind: "builder-source-review" }>
  | Readonly<{ kind: "allowlist"; ids: readonly string[] }>;

export type CustomerPathGuidanceDefinition = Readonly<{
  id: BuyerType;
  label: string;
  knowledgePoints: readonly CustomerPathKnowledgePoint[];
  rail: Readonly<{
    title: string;
    reason: string;
    selection: CustomerPathSelectionRule;
  }>;
}>;

export type CustomerPathRailItem = Readonly<{
  id: string;
  stone: JwStoneCatalogItem;
  reason: string;
}>;

export type ResolvedCustomerPathGuidance = Readonly<{
  id: BuyerType;
  label: string;
  knowledgePoints: readonly CustomerPathKnowledgePoint[];
  rail: Readonly<{
    title: string;
    reason: string;
    items: readonly CustomerPathRailItem[];
  }>;
}>;

function createSource(label: string, url: string): CustomerPathSource {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !SAFE_SOURCE_HOSTS.has(parsed.hostname)) {
    throw new Error(`Unsafe JW Stone customer-path source URL: ${url}`);
  }
  if (!label.trim()) throw new Error("JW Stone customer-path sources require a visible label.");
  return Object.freeze({ label, url: parsed.toString() });
}

const SOURCES = Object.freeze({
  fabricatorPlanning: createSource(
    "Use Natural Stone — What Stone Fabricators Wish You Knew",
    "https://usenaturalstone.org/stone-fabricators-wish-knew-good/"
  ),
  bookmatching: createSource(
    "Use Natural Stone — Bookmatching",
    "https://usenaturalstone.org/bookmatching/"
  ),
  stoneSelection: createSource(
    "Use Natural Stone — A Beginner's Guide to Stone Selection",
    "https://usenaturalstone.org/a-beginners_guide_stone_selection/"
  ),
  testing: createSource(
    "Natural Stone Institute — Testing Services",
    "https://www.naturalstoneinstitute.org/resources/natural-stone-testing-services/"
  ),
  finishAppearance: createSource(
    "Use Natural Stone — Adding Value with Natural Stone",
    "https://usenaturalstone.org/how-to-add-value-to-your-project-with-natural-stone/"
  ),
  care: createSource(
    "Natural Stone Institute — Natural Stone Care",
    "https://www.naturalstoneinstitute.org/consumers/care/"
  ),
});

export const JW_STONE_GUIDANCE_PICK_IDS: readonly string[] = Object.freeze([
  ...JW_STONE_PROFILE_PRESENTATION_BLOCK.data.inventory.featuredCollection.slugs,
]);

function freezeKnowledgePoints(
  points: readonly CustomerPathKnowledgePoint[]
): readonly CustomerPathKnowledgePoint[] {
  return Object.freeze(points.map((point) => Object.freeze(point)));
}

const DEFINITIONS = {
  fabricator: Object.freeze({
    id: "fabricator",
    label: "Fabricators",
    knowledgePoints: freezeKnowledgePoints([
      {
        text: "Review actual slabs and the proposed layout before cutting; variation changes vein and seam placement.",
        source: SOURCES.fabricatorPlanning,
      },
      {
        text: "Bookmatching needs sequential slabs and layout approval before cutting.",
        source: SOURCES.bookmatching,
      },
    ]),
    rail: Object.freeze({
      title: "More documented selections",
      reason:
        "Named selections with documented material, finish, source counts, and multiple supplied views.",
      selection: Object.freeze({ kind: "fabricator-documented" as const }),
    }),
  }),
  builder: Object.freeze({
    id: "builder",
    label: "Builders & Developers",
    knowledgePoints: freezeKnowledgePoints([
      {
        text: "A sample cannot show a whole slab; review the actual slabs selected for the project.",
        source: SOURCES.stoneSelection,
      },
      {
        text: "Use project-specific testing; appearance alone does not prove performance.",
        source: SOURCES.testing,
      },
    ]),
    rail: Object.freeze({
      title: "More source records to review",
      reason: "Named selections with recorded source counts and four or more supplied views.",
      selection: Object.freeze({ kind: "builder-source-review" as const }),
    }),
  }),
  designer: Object.freeze({
    id: "designer",
    label: "Architects & Designers",
    knowledgePoints: freezeKnowledgePoints([
      {
        text: "Bookmatching needs sequential slabs plus edge, seam, and layout review.",
        source: SOURCES.bookmatching,
      },
      {
        text: "Finish changes tone and appearance; compare the intended finish, not photography alone.",
        source: SOURCES.finishAppearance,
      },
    ]),
    rail: Object.freeze({
      title: "JW Stone Picks",
      reason: "The six existing owner-curated JW Stone Picks.",
      selection: Object.freeze({
        kind: "allowlist" as const,
        ids: JW_STONE_GUIDANCE_PICK_IDS,
      }),
    }),
  }),
  homeowner: Object.freeze({
    id: "homeowner",
    label: "Homeowners",
    knowledgePoints: freezeKnowledgePoints([
      {
        text: "Use neutral cleaner; acids can etch calcareous stone, and sealer is not stain-proofing.",
        source: SOURCES.care,
      },
      {
        text: "Review actual slabs; a sample cannot show natural variation across a whole slab.",
        source: SOURCES.stoneSelection,
      },
    ]),
    rail: Object.freeze({
      title: "A starting edit",
      reason: "The six owner-curated JW Stone Picks, as a manageable visual starting point.",
      selection: Object.freeze({
        kind: "allowlist" as const,
        ids: JW_STONE_GUIDANCE_PICK_IDS,
      }),
    }),
  }),
} satisfies Record<BuyerType, CustomerPathGuidanceDefinition>;

export const CUSTOMER_PATH_GUIDANCE_BY_ID: Readonly<
  Record<BuyerType, CustomerPathGuidanceDefinition>
> = Object.freeze(DEFINITIONS);

export const CUSTOMER_PATH_GUIDANCE: readonly CustomerPathGuidanceDefinition[] = Object.freeze(
  BUYER_TYPES.map((id) => CUSTOMER_PATH_GUIDANCE_BY_ID[id])
);

function indexCatalog(catalog: readonly JwStoneCatalogItem[]): Map<string, JwStoneCatalogItem> {
  const byId = new Map<string, JwStoneCatalogItem>();
  for (const stone of catalog) {
    if (byId.has(stone.id)) throw new Error(`Duplicate JW Stone catalog ID: ${stone.id}`);
    byId.set(stone.id, stone);
  }
  return byId;
}

function assertNamedPublicStone(stone: JwStoneCatalogItem, id: string): void {
  if (stone.anonymous || !stone.displayName || !stone.shareSlug) {
    throw new Error(`JW Stone customer-path item must be a named public selection: ${id}`);
  }
}

export function resolveValidatedNamedCatalogItems(
  ids: readonly string[],
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): readonly JwStoneCatalogItem[] {
  const byId = indexCatalog(catalog);
  const seen = new Set<string>();
  const resolved = ids.map((id) => {
    if (seen.has(id)) throw new Error(`Duplicate JW Stone customer-path item ID: ${id}`);
    seen.add(id);
    const stone = byId.get(id);
    if (!stone) throw new Error(`Missing JW Stone customer-path item ID: ${id}`);
    assertNamedPublicStone(stone, id);
    return stone;
  });
  return Object.freeze(resolved);
}

function validateResolvedStones(
  stones: readonly JwStoneCatalogItem[],
  catalog: readonly JwStoneCatalogItem[]
): readonly JwStoneCatalogItem[] {
  indexCatalog(catalog);
  const seen = new Set<string>();
  for (const stone of stones) {
    if (seen.has(stone.id))
      throw new Error(`Duplicate JW Stone customer-path item ID: ${stone.id}`);
    seen.add(stone.id);
    assertNamedPublicStone(stone, stone.id);
  }
  return Object.freeze([...stones].slice(0, CUSTOMER_PATH_MAX_RAIL_ITEMS));
}

function resolveStones(
  definition: CustomerPathGuidanceDefinition,
  catalog: readonly JwStoneCatalogItem[]
): readonly JwStoneCatalogItem[] {
  const { selection } = definition.rail;

  if (selection.kind === "allowlist") {
    return resolveValidatedNamedCatalogItems(selection.ids, catalog).slice(
      0,
      CUSTOMER_PATH_MAX_RAIL_ITEMS
    );
  }

  if (selection.kind === "fabricator-documented") {
    return validateResolvedStones(
      catalog.filter(
        (stone) =>
          !stone.anonymous &&
          Boolean(stone.displayName && stone.shareSlug) &&
          Boolean(stone.materialLabel) &&
          stone.finishStatus === "explicit" &&
          stone.finishes.length > 0 &&
          Boolean(stone.sourceEvidence?.counts.length) &&
          stone.images.length >= 2
      ),
      catalog
    );
  }

  const sorted = catalog
    .map((stone, catalogIndex) => ({ stone, catalogIndex }))
    .filter(
      ({ stone }) =>
        !stone.anonymous &&
        Boolean(stone.displayName && stone.shareSlug) &&
        Boolean(stone.sourceEvidence?.counts.length) &&
        stone.images.length >= 4
    )
    .sort(
      (left, right) =>
        right.stone.images.length - left.stone.images.length ||
        left.catalogIndex - right.catalogIndex
    )
    .map(({ stone }) => stone);
  return validateResolvedStones(sorted, catalog);
}

function itemReason(buyer: BuyerType, stone: JwStoneCatalogItem): string {
  if (buyer === "fabricator") {
    return `${stone.materialLabel}; ${stone.finishes.join(
      " / "
    )}; ${stone.images.length} views; source counts recorded.`;
  }
  if (buyer === "builder") {
    return `${stone.images.length} views; source counts recorded.`;
  }
  if (buyer === "designer") {
    return "Owner-curated JW Stone Pick.";
  }
  return "Owner-curated visual starting point.";
}

function validatePublicCopy(value: string): void {
  if (!value.trim()) throw new Error("JW Stone customer-path copy cannot be empty.");
  if (UNSAFE_CLAIM_PATTERN.test(value)) {
    throw new Error(`Unsupported JW Stone customer-path claim: ${value}`);
  }
}

export function validateCustomerPathGuidanceDefinitions(): void {
  if (CUSTOMER_PATH_GUIDANCE.length !== BUYER_TYPES.length) {
    throw new Error(
      "JW Stone customer-path guidance must define every customer path exactly once."
    );
  }

  const seen = new Set<BuyerType>();
  for (const definition of CUSTOMER_PATH_GUIDANCE) {
    if (seen.has(definition.id)) {
      throw new Error(`Duplicate JW Stone customer-path ID: ${definition.id}`);
    }
    seen.add(definition.id);
    validatePublicCopy(definition.label);
    validatePublicCopy(definition.rail.title);
    validatePublicCopy(definition.rail.reason);
    if (
      definition.knowledgePoints.length === 0 ||
      definition.knowledgePoints.length > CUSTOMER_PATH_MAX_KNOWLEDGE_POINTS
    ) {
      throw new Error(`JW Stone customer path ${definition.id} must have one to three points.`);
    }
    for (const point of definition.knowledgePoints) {
      validatePublicCopy(point.text);
      createSource(point.source.label, point.source.url);
    }
  }

  resolveValidatedNamedCatalogItems(JW_STONE_GUIDANCE_PICK_IDS);
}

export function resolveCustomerPathGuidance(
  buyer: BuyerType,
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): ResolvedCustomerPathGuidance {
  const definition = CUSTOMER_PATH_GUIDANCE_BY_ID[buyer];
  const items = resolveStones(definition, catalog).map((stone) => {
    const reason = itemReason(buyer, stone);
    validatePublicCopy(reason);
    return Object.freeze({ id: stone.id, stone, reason });
  });

  return Object.freeze({
    id: definition.id,
    label: definition.label,
    knowledgePoints: definition.knowledgePoints,
    rail: Object.freeze({
      title: definition.rail.title,
      reason: definition.rail.reason,
      items: Object.freeze(items),
    }),
  });
}

validateCustomerPathGuidanceDefinitions();
