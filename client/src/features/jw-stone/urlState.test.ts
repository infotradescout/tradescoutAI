import { describe, expect, it } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import {
  parseMarketplaceUrlState,
  serializeMarketplaceUrlState,
  toMarketplaceHref,
} from "./urlState";
import type { JwStoneCatalogItem, MarketplaceUrlState } from "./types";

describe("JW Stone shareable marketplace URL state", () => {
  it("requires buyer before color and color before all discovery state", () => {
    expect(
      parseMarketplaceUrlState("?color=warm-earthy&material=quartzite&finish=honed&stone=cristallo")
    ).toEqual({
      buyer: null,
      color: null,
      material: null,
      finish: null,
      origin: null,
      stone: null,
    });
    expect(
      parseMarketplaceUrlState("?buyer=designer&material=quartzite&finish=honed&stone=cristallo")
    ).toEqual({
      buyer: "designer",
      color: null,
      material: null,
      finish: null,
      origin: null,
      stone: null,
    });
  });

  it("round trips a valid buyer, color, filter, and named detail", () => {
    const state: MarketplaceUrlState = {
      buyer: "designer",
      color: "warm-earthy",
      material: "quartzite",
      finish: "honed",
      origin: null,
      stone: "cristallo",
    };
    const serialized = serializeMarketplaceUrlState(state);

    expect(serialized.toString()).toBe(
      "buyer=designer&color=warm-earthy&material=quartzite&finish=honed&stone=cristallo"
    );
    expect(parseMarketplaceUrlState(serialized)).toEqual(state);
    expect(toMarketplaceHref(state)).toBe(
      "/jw-stone?buyer=designer&color=warm-earthy&material=quartzite&finish=honed&stone=cristallo"
    );
  });

  it("drops unsupported filters, price state, mismatched details, and anonymous ids", () => {
    expect(
      parseMarketplaceUrlState(
        "?buyer=fabricator&color=cool-serene&material=fiction&finish=dual-finish&origin=guessed&price=low&stone=cristallo"
      )
    ).toEqual({
      buyer: "fabricator",
      color: "cool-serene",
      material: null,
      finish: null,
      origin: null,
      stone: null,
    });

    expect(
      parseMarketplaceUrlState("?buyer=homeowner&color=bold-expressive&stone=trending-selection-05")
        .stone
    ).toBeNull();
  });

  it("accepts verified-origin state only when the supplied catalog exposes it", () => {
    const base = JW_STONE_CATALOG.find((stone) => stone.id === "cristallo")!;
    const fixture: JwStoneCatalogItem = {
      ...base,
      origin: { country: "Brazil", verified: true, source: "test source record" },
    };
    const fixtureCatalog = [fixture];
    const query =
      "https://www.thetradescout.com/jw-stone?buyer=designer&color=warm-earthy&origin=brazil&stone=cristallo";

    expect(parseMarketplaceUrlState(query).origin).toBeNull();
    expect(parseMarketplaceUrlState(query, fixtureCatalog)).toEqual({
      buyer: "designer",
      color: "warm-earthy",
      material: null,
      finish: null,
      origin: "brazil",
      stone: "cristallo",
    });
  });

  it("recovers invalid buyer and color values at the nearest valid stage", () => {
    expect(parseMarketplaceUrlState("?buyer=architect&color=soft-light").buyer).toBeNull();
    expect(parseMarketplaceUrlState("?buyer=builder&color=rainbow")).toEqual({
      buyer: "builder",
      color: null,
      material: null,
      finish: null,
      origin: null,
      stone: null,
    });
  });
});
