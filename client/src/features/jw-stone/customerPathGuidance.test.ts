import { describe, expect, it } from "vitest";
import { JW_STONE_ANONYMOUS_CATALOG, JW_STONE_CATALOG } from "./catalog";
import {
  CUSTOMER_PATH_GUIDANCE,
  CUSTOMER_PATH_GUIDANCE_BY_ID,
  CUSTOMER_PATH_MAX_KNOWLEDGE_POINTS,
  CUSTOMER_PATH_MAX_RAIL_ITEMS,
  JW_STONE_GUIDANCE_PICK_IDS,
  resolveCustomerPathGuidance,
  resolveValidatedNamedCatalogItems,
  validateCustomerPathGuidanceDefinitions,
} from "./customerPathGuidance";
import { BUYER_TYPES } from "./types";

const EXPECTED_PICKS = [
  "blue-dunes",
  "cristallo",
  "gold-macaubas",
  "rhino-white",
  "taj-mahal",
  "titanium",
];

const EXPECTED_RAIL_IDS = {
  fabricator: [
    "arizona-gold",
    "blue-dunes",
    "fantasy-black",
    "preto-sao-gabriel",
    "titanium",
    "viscount-white",
  ],
  builder: [
    "alabama-white",
    "cristallo",
    "fantasy-brown",
    "taj-mahal",
    "aj-quartz",
    "alabama-rose",
  ],
  designer: EXPECTED_PICKS,
  homeowner: EXPECTED_PICKS,
} as const;

describe("JW Stone customer-path guidance", () => {
  it("defines the four compact paths with safe sourced knowledge", () => {
    expect(CUSTOMER_PATH_GUIDANCE.map((path) => path.id)).toEqual(BUYER_TYPES);
    expect(CUSTOMER_PATH_GUIDANCE.map((path) => path.label)).toEqual([
      "Fabricators",
      "Builders & Developers",
      "Architects & Designers",
      "Homeowners",
    ]);
    expect(() => validateCustomerPathGuidanceDefinitions()).not.toThrow();

    const sourceUrls = new Set<string>();
    for (const path of CUSTOMER_PATH_GUIDANCE) {
      expect(path.knowledgePoints.length).toBeGreaterThan(0);
      expect(path.knowledgePoints.length).toBeLessThanOrEqual(CUSTOMER_PATH_MAX_KNOWLEDGE_POINTS);
      for (const point of path.knowledgePoints) {
        expect(point.text.trim()).not.toBe("");
        expect(point.source.label.trim()).not.toBe("");
        const sourceUrl = new URL(point.source.url);
        expect(sourceUrl.protocol).toBe("https:");
        expect(["usenaturalstone.org", "www.naturalstoneinstitute.org"]).toContain(
          sourceUrl.hostname
        );
        sourceUrls.add(sourceUrl.toString());
      }
    }

    expect([...sourceUrls].sort()).toEqual(
      [
        "https://usenaturalstone.org/stone-fabricators-wish-knew-good/",
        "https://usenaturalstone.org/bookmatching/",
        "https://usenaturalstone.org/a-beginners_guide_stone_selection/",
        "https://www.naturalstoneinstitute.org/resources/natural-stone-testing-services/",
        "https://usenaturalstone.org/how-to-add-value-to-your-project-with-natural-stone/",
        "https://www.naturalstoneinstitute.org/consumers/care/",
      ].sort()
    );
  });

  it("resolves the sealed current rails in the required order and caps each at six", () => {
    expect(JW_STONE_GUIDANCE_PICK_IDS).toEqual(EXPECTED_PICKS);

    for (const buyer of BUYER_TYPES) {
      const resolved = resolveCustomerPathGuidance(buyer);
      expect(resolved.rail.items.map((item) => item.id)).toEqual(EXPECTED_RAIL_IDS[buyer]);
      expect(resolved.rail.items).toHaveLength(CUSTOMER_PATH_MAX_RAIL_ITEMS);
      expect(new Set(resolved.rail.items.map((item) => item.id)).size).toBe(
        resolved.rail.items.length
      );
    }
  });

  it("derives Fabricator and Builder items only from their factual catalog rules", () => {
    const fabricator = resolveCustomerPathGuidance("fabricator");
    for (const { stone, reason } of fabricator.rail.items) {
      expect(stone.anonymous).toBe(false);
      expect(stone.materialLabel).toBeTruthy();
      expect(stone.finishStatus).toBe("explicit");
      expect(stone.finishes.length).toBeGreaterThan(0);
      expect(stone.sourceEvidence?.counts.length).toBeGreaterThan(0);
      expect(stone.images.length).toBeGreaterThanOrEqual(2);
      if (!stone.materialLabel) throw new Error(`Missing material for ${stone.id}`);
      expect(reason).toContain(stone.materialLabel);
      expect(reason).toContain(`${stone.images.length} views`);
      expect(reason).toContain("source counts recorded");
    }

    const builder = resolveCustomerPathGuidance("builder");
    expect(builder.rail.items.map(({ stone }) => stone.images.length)).toEqual([
      40, 25, 19, 17, 13, 9,
    ]);
    for (const { stone, reason } of builder.rail.items) {
      expect(stone.anonymous).toBe(false);
      expect(stone.sourceEvidence?.counts.length).toBeGreaterThan(0);
      expect(stone.images.length).toBeGreaterThanOrEqual(4);
      expect(reason).toBe(`${stone.images.length} views; source counts recorded.`);
    }
  });

  it("gives every item a visible factual reason without unsafe product claims", () => {
    const unsafeClaim =
      /\b(best|ideal|perfect|popular|preference|preferred|recommend(?:ation|ed)|suitab(?:le|ility)|availability|available now|in[- ]stock|live[- ]stock|guarantee(?:d)?)\b/i;

    for (const buyer of BUYER_TYPES) {
      const definition = CUSTOMER_PATH_GUIDANCE_BY_ID[buyer];
      const resolved = resolveCustomerPathGuidance(buyer);
      const publicCopy = [
        definition.label,
        definition.rail.title,
        definition.rail.reason,
        ...definition.knowledgePoints.map((point) => point.text),
        ...resolved.rail.items.map((item) => item.reason),
      ];

      expect(resolved.rail.items.length).toBeLessThanOrEqual(CUSTOMER_PATH_MAX_RAIL_ITEMS);
      for (const item of resolved.rail.items) expect(item.reason.trim()).not.toBe("");
      for (const copy of publicCopy) expect(copy).not.toMatch(unsafeClaim);
    }

    expect(resolveCustomerPathGuidance("designer").rail.items.map((item) => item.reason)).toEqual(
      Array.from({ length: 6 }, () => "Owner-curated JW Stone Pick.")
    );
    expect(resolveCustomerPathGuidance("homeowner").rail.reason).toContain("manageable visual");
  });

  it("rejects missing, anonymous, duplicate allowlist, and duplicate catalog IDs", () => {
    expect(() => resolveValidatedNamedCatalogItems(["not-a-real-stone"])).toThrow(/Missing/);
    expect(() => resolveValidatedNamedCatalogItems([JW_STONE_ANONYMOUS_CATALOG[0].id])).toThrow(
      /named public selection/
    );
    expect(() => resolveValidatedNamedCatalogItems(["blue-dunes", "blue-dunes"])).toThrow(
      /Duplicate.*item ID/
    );

    const blueDunes = JW_STONE_CATALOG.find((stone) => stone.id === "blue-dunes");
    if (!blueDunes) throw new Error("Missing Blue Dunes test fixture");
    expect(() => resolveValidatedNamedCatalogItems(["blue-dunes"], [blueDunes, blueDunes])).toThrow(
      /Duplicate.*catalog ID/
    );
  });
});
