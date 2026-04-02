import { describe, it, expect } from "vitest";
import { getUserLocationContext } from "../locationContext";

describe("getUserLocationContext", () => {
  it("defaults to county layer using user state/countyFips", () => {
    const user = { state: "TX", countyFips: "12345" };
    const ctx = getUserLocationContext(user);

    expect(ctx.layer).toBe("county");
    expect(ctx.stateCode).toBe("TX");
    expect(ctx.countyFips).toBe("12345");
  });

  it("falls back to global layer when canonical county identity is incomplete", () => {
    const user = { state: "tx", county: "Travis County" };
    const ctx = getUserLocationContext(user);

    expect(ctx.layer).toBe("global");
    expect(ctx.stateCode).toBe("TX");
    expect(ctx.countyFips).toBeUndefined();
  });

  it("allows overrides to change layer and ids", () => {
    const user = { state: "TX", countyFips: "12345" };
    const ctx = getUserLocationContext(user, {
      layer: "hoa",
      hoaId: "hoa-1",
    });

    expect(ctx.layer).toBe("hoa");
    expect(ctx.hoaId).toBe("hoa-1");
    expect(ctx.stateCode).toBe("TX");
    expect(ctx.countyFips).toBe("12345");
  });
});
