import { describe, expect, it } from "vitest";
import {
  parseMarketplaceUrlState,
  serializeMarketplaceUrlState,
  toMarketplaceHref,
} from "./urlState";

describe("JW Stone marketplace URL state", () => {
  it("restores aesthetic, color, filters, and named detail without buyer paths", () => {
    expect(parseMarketplaceUrlState("")).toEqual({
      aesthetic: null,
      color: null,
      material: null,
      origin: null,
      stone: null,
    });

    expect(
      parseMarketplaceUrlState("?buyer=designer&material=quartzite&finish=honed&stone=cristallo")
    ).toEqual({
      aesthetic: null,
      color: null,
      material: "quartzite",
      origin: null,
      stone: "cristallo",
    });
  });

  it("round trips aesthetic, literal color, material, and named detail", () => {
    const state = {
      aesthetic: "warm-earthy" as const,
      color: "white",
      material: "quartzite",
      origin: null,
      stone: "cristallo",
    };

    expect(serializeMarketplaceUrlState(state).toString()).toBe(
      "aesthetic=warm-earthy&color=white&material=quartzite&stone=cristallo"
    );
    expect(toMarketplaceHref(state)).toBe(
      "/jw-stone?aesthetic=warm-earthy&color=white&material=quartzite&stone=cristallo"
    );
  });

  it("maps legacy color= aesthetic values and released aliases", () => {
    expect(parseMarketplaceUrlState("?buyer=builder&color=warm-neutrals")).toMatchObject({
      aesthetic: "warm-earthy",
      color: null,
    });
    expect(parseMarketplaceUrlState("?color=warm-earthy")).toMatchObject({
      aesthetic: "warm-earthy",
      color: null,
    });
    expect(parseMarketplaceUrlState("?aesthetic=soft-light&color=white")).toMatchObject({
      aesthetic: "soft-light",
      color: "white",
    });
    expect(
      parseMarketplaceUrlState(
        "?buyer=architect&color=rainbow&material=quartzite&finish=honed&origin=guessed&price=low&stone=cristallo"
      )
    ).toEqual({
      aesthetic: null,
      color: null,
      material: "quartzite",
      origin: null,
      stone: "cristallo",
    });
  });

  it("serializes safe filters without manufacturing buyer", () => {
    expect(
      serializeMarketplaceUrlState({
        aesthetic: null,
        color: null,
        material: "granite",
        origin: null,
        stone: null,
      }).toString()
    ).toBe("material=granite");
  });

  it("drops legacy finish query params", () => {
    expect(parseMarketplaceUrlState("?finish=polished&material=quartzite")).toEqual({
      aesthetic: null,
      color: null,
      material: "quartzite",
      origin: null,
      stone: null,
    });
    expect(
      serializeMarketplaceUrlState(parseMarketplaceUrlState("?finish=polished")).toString()
    ).toBe("");
  });
});
