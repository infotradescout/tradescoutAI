import { describe, expect, it } from "vitest";
import {
  matchesJwStoneSearch,
  normalizeJwStoneSearchText,
  rankJwStoneSearchResults,
} from "./browseIntelligence";
import type { JwStoneCatalogItem } from "./types";

function stone(args: {
  id: string;
  name: string;
  material?: string;
  colors?: string[];
  finishes?: string[];
}): JwStoneCatalogItem {
  return {
    id: args.id,
    displayName: args.name,
    publicLabel: args.name,
    shareSlug: args.id,
    anonymous: false,
    colors: args.colors ?? [],
    finishes: args.finishes ?? [],
    materialLabel: args.material ?? null,
    origin: null,
  } as JwStoneCatalogItem;
}

describe("JW Stone browse intelligence", () => {
  it("normalizes punctuation, accents, and spacing", () => {
    expect(normalizeJwStoneSearchText("  Calacatta—Váglí  ")).toBe("calacatta vagli");
  });

  it("matches supplier spelling aliases without changing the public stone name", () => {
    const vaguili = stone({
      id: "calacatta-vaguili",
      name: "Calacatta Vaguili",
      material: "Marble",
    });

    expect(matchesJwStoneSearch(vaguili, "calacatta vagli")).toBe(true);
    expect(vaguili.displayName).toBe("Calacatta Vaguili");
  });

  it("matches combined buyer intent across color and material", () => {
    const blueQuartzite = stone({
      id: "blue-quartzite",
      name: "Ocean Current",
      material: "Quartzite",
      colors: ["blue", "white"],
      finishes: ["Polished"],
    });

    expect(matchesJwStoneSearch(blueQuartzite, "blue quartzite")).toBe(true);
    expect(matchesJwStoneSearch(blueQuartzite, "green quartzite")).toBe(false);
  });

  it("puts an exact buyer request ahead of a promoted but less relevant result", () => {
    const promoted = stone({
      id: "black-dunes",
      name: "Black Dunes",
      material: "Granite",
      colors: ["black"],
    });
    const exact = stone({
      id: "midnight-black",
      name: "Midnight Black",
      material: "Granite",
      colors: ["black"],
    });

    expect(rankJwStoneSearchResults([promoted, exact], "midnight black").map((item) => item.id)).toEqual([
      "midnight-black",
      "black-dunes",
    ]);
  });

  it("uses the quiet business-priority order to break equal-relevance ties", () => {
    const blueBahia = stone({
      id: "blue-bahia",
      name: "Blue Bahia",
      material: "Granite",
      colors: ["blue"],
    });
    const cristalita = stone({
      id: "cristalita-blue",
      name: "Cristalita Blue",
      material: "Quartzite",
      colors: ["blue"],
    });
    const ordinary = stone({
      id: "blue-ordinary",
      name: "Blue Ordinary",
      material: "Granite",
      colors: ["blue"],
    });

    expect(
      rankJwStoneSearchResults([ordinary, blueBahia, cristalita], "blue").map((item) => item.id)
    ).toEqual(["cristalita-blue", "blue-bahia", "blue-ordinary"]);
  });
});
