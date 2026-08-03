import { describe, expect, it } from "vitest";
import {
  DEFAULT_JW_STONE_2_FILTERS,
  getJwStone2DiscoveryStage,
  mergeJwStone2DiscoveryState,
  parseJwStone2DiscoveryState,
  serializeJwStone2DiscoveryState,
} from "./discoveryState";

describe("JW Stone 2.0 discovery URL state", () => {
  it("enforces the buyer then color then results progression", () => {
    expect(getJwStone2DiscoveryStage(DEFAULT_JW_STONE_2_FILTERS)).toBe("buyer");
    const buyerSelected = mergeJwStone2DiscoveryState(DEFAULT_JW_STONE_2_FILTERS, {
      buyer: "designer",
    });
    expect(getJwStone2DiscoveryStage(buyerSelected)).toBe("color");
    expect(
      getJwStone2DiscoveryStage(
        mergeJwStone2DiscoveryState(buyerSelected, { color: "warm-neutrals" })
      )
    ).toBe("results");
  });

  it("round trips every supported buyer and filter field", () => {
    const state = {
      buyer: "designer",
      color: "warm-neutrals",
      material: "Quartzite",
      finish: "Honed",
      size: "126 x 78 in",
      availability: "In stock",
      translucency: "Translucent",
      origin: "Brazil",
      stone: "taj-mahal",
    } as const;
    const serialized = serializeJwStone2DiscoveryState(state);
    expect(serialized).toBe(
      "buyer=designer&color=warm-neutrals&material=Quartzite&finish=Honed&size=126+x+78+in&availability=In+stock&translucency=Translucent&origin=Brazil&stone=taj-mahal"
    );
    expect(parseJwStone2DiscoveryState(`https://example.com/jw-stone?${serialized}`)).toEqual(
      state
    );
  });

  it("never restores or serializes price state", () => {
    const parsed = parseJwStone2DiscoveryState(
      "?buyer=builder&color=cool-lights&price=999&minPrice=100&sort=price"
    );
    expect(parsed).toEqual({
      ...DEFAULT_JW_STONE_2_FILTERS,
      buyer: "builder",
      color: "cool-lights",
    });
    expect(serializeJwStone2DiscoveryState(parsed)).not.toMatch(/price/i);
  });

  it("restores named stone slugs and discards anonymous or unknown identities", () => {
    expect(parseJwStone2DiscoveryState("?stone=amazonic-green").stone).toBe("amazonic-green");
    expect(parseJwStone2DiscoveryState("?stone=trending-selection-05").stone).toBeNull();
    expect(parseJwStone2DiscoveryState("?stone=removed-stone").stone).toBeNull();
    expect(
      serializeJwStone2DiscoveryState({
        ...DEFAULT_JW_STONE_2_FILTERS,
        stone: "trending-selection-05",
      })
    ).toBe("");
  });

  it("rejects unknown buyer/color tokens and strips control characters", () => {
    expect(
      parseJwStone2DiscoveryState(
        "?buyer=dealer&color=rainbow&material=%00Quartzite&origin=%0ABrazil"
      )
    ).toEqual({
      ...DEFAULT_JW_STONE_2_FILTERS,
      material: "Quartzite",
      origin: "Brazil",
    });
  });
});
