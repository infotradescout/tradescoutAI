import { describe, expect, it } from "vitest";
import {
  parseMarketplaceUrlState,
  serializeMarketplaceUrlState,
  toMarketplaceHref,
} from "./urlState";

describe("JW Stone marketplace URL state", () => {
  it("restores color, filters, and named detail without buyer paths", () => {
    expect(parseMarketplaceUrlState("")).toEqual({
      color: null,
      material: null,
      finish: null,
      origin: null,
      stone: null,
    });

    expect(
      parseMarketplaceUrlState("?buyer=designer&material=quartzite&finish=honed&stone=cristallo")
    ).toEqual({
      color: null,
      material: "quartzite",
      finish: "honed",
      origin: null,
      stone: "cristallo",
    });
  });

  it("round trips color, material, finish, and named detail", () => {
    const state = {
      color: "warm-earthy" as const,
      material: "quartzite",
      finish: "honed",
      origin: null,
      stone: "cristallo",
    };

    expect(serializeMarketplaceUrlState(state).toString()).toBe(
      "color=warm-earthy&material=quartzite&finish=honed&stone=cristallo"
    );
    expect(toMarketplaceHref(state)).toBe(
      "/jw-stone?color=warm-earthy&material=quartzite&finish=honed&stone=cristallo"
    );
  });

  it("maps released color aliases and ignores invalid params", () => {
    expect(parseMarketplaceUrlState("?buyer=builder&color=warm-neutrals").color).toBe(
      "warm-earthy"
    );
    expect(
      parseMarketplaceUrlState(
        "?buyer=architect&color=rainbow&material=quartzite&finish=honed&origin=guessed&price=low&stone=cristallo"
      )
    ).toEqual({
      color: null,
      material: "quartzite",
      finish: "honed",
      origin: null,
      stone: "cristallo",
    });
  });

  it("serializes safe filters without manufacturing buyer", () => {
    expect(
      serializeMarketplaceUrlState({
        color: null,
        material: "granite",
        finish: null,
        origin: null,
        stone: null,
      }).toString()
    ).toBe("material=granite");
  });
});
