import { describe, expect, it } from "vitest";
import { JW_STONE_ANONYMOUS_CATALOG, JW_STONE_CATALOG } from "./catalog";
import {
  parseMarketplaceUrlState,
  serializeMarketplaceUrlState,
  toMarketplaceHref,
} from "./urlState";
import type { JwStoneCatalogItem, MarketplaceUrlState } from "./types";

describe("JW Stone shareable marketplace URL state", () => {
  it("restores buyer, color, filters, and named detail without a staged dependency", () => {
    expect(
      parseMarketplaceUrlState("?color=warm-earthy&material=quartzite&finish=honed&stone=cristallo")
    ).toEqual({
      buyer: null,
      color: "warm-earthy",
      material: "quartzite",
      finish: "honed",
      origin: null,
      stone: "cristallo",
    });
    expect(
      parseMarketplaceUrlState("?buyer=designer&material=quartzite&finish=honed&stone=cristallo")
    ).toEqual({
      buyer: "designer",
      color: null,
      material: "quartzite",
      finish: "honed",
      origin: null,
      stone: "cristallo",
    });
  });

  it("round trips a valid buyer, color, material, finish, and named detail", () => {
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

  it("keeps independently valid filters and named detail even when they do not match color", () => {
    expect(
      parseMarketplaceUrlState(
        "?buyer=designer&color=soft-light&material=quartzite&finish=honed&stone=cristallo"
      )
    ).toEqual({
      buyer: "designer",
      color: "soft-light",
      material: "quartzite",
      finish: "honed",
      origin: null,
      stone: "cristallo",
    });
  });

  it("recovers links created by the rejected renderer without losing the selected stone", () => {
    expect(
      parseMarketplaceUrlState(
        "?buyer=designer&color=cool-lights&material=Quartzite&finish=Honed&stone=cristallo"
      )
    ).toEqual({
      buyer: "designer",
      color: "warm-earthy",
      material: "quartzite",
      finish: "honed",
      origin: null,
      stone: "cristallo",
    });
    expect(parseMarketplaceUrlState("?buyer=builder&color=warm-neutrals").color).toBe(
      "warm-earthy"
    );
  });

  it("drops only invalid values while retaining unrelated valid state", () => {
    expect(
      parseMarketplaceUrlState(
        "?buyer=architect&color=rainbow&material=quartzite&finish=honed&origin=guessed&price=low&stone=cristallo"
      )
    ).toEqual({
      buyer: null,
      color: null,
      material: "quartzite",
      finish: "honed",
      origin: null,
      stone: "cristallo",
    });
  });

  it("rejects anonymous and unknown stone ids without discarding other state", () => {
    const anonymous = JW_STONE_ANONYMOUS_CATALOG[0]!;
    expect(anonymous.anonymous).toBe(true);
    expect(parseMarketplaceUrlState(`?material=quartzite&stone=${anonymous.id}`)).toEqual({
      buyer: null,
      color: null,
      material: "quartzite",
      finish: null,
      origin: null,
      stone: null,
    });
    expect(parseMarketplaceUrlState("?stone=not-a-real-stone").stone).toBeNull();
  });

  it("accepts verified-origin state only when the supplied catalog exposes it", () => {
    const base = JW_STONE_CATALOG.find((stone) => stone.id === "cristallo")!;
    const fixture: JwStoneCatalogItem = {
      ...base,
      origin: { country: "Brazil", verified: true, source: "test source record" },
    };
    const fixtureCatalog = [fixture];
    const query = "https://www.thetradescout.com/jw-stone?origin=brazil&stone=cristallo";

    expect(parseMarketplaceUrlState(query).origin).toBeNull();
    expect(parseMarketplaceUrlState(query, fixtureCatalog)).toEqual({
      buyer: null,
      color: null,
      material: null,
      finish: null,
      origin: "brazil",
      stone: "cristallo",
    });
  });

  it("serializes safe filters and named detail without manufacturing buyer or color", () => {
    const state: MarketplaceUrlState = {
      buyer: null,
      color: null,
      material: "quartzite",
      finish: "honed",
      origin: null,
      stone: "cristallo",
    };

    expect(serializeMarketplaceUrlState(state).toString()).toBe(
      "material=quartzite&finish=honed&stone=cristallo"
    );
    expect(toMarketplaceHref(state)).toBe(
      "/jw-stone?material=quartzite&finish=honed&stone=cristallo"
    );
    expect(parseMarketplaceUrlState(serializeMarketplaceUrlState(state))).toEqual(state);
  });
});
