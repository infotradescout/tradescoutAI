import { describe, it, expect, vi } from "vitest";
import { getUserLocationContext, resolveUserCountyWriteContext } from "../locationContext";

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

  it("prefers and normalizes the canonical stateCode field", () => {
    const ctx = getUserLocationContext({
      stateCode: " fl ",
      state: "TX",
      countyFips: " 12033 ",
    });

    expect(ctx).toMatchObject({
      layer: "county",
      stateCode: "FL",
      countyFips: "12033",
    });
  });

  it("rejects malformed non-empty canonical state codes and non-digit FIPS values", () => {
    expect(
      getUserLocationContext({ stateCode: "F1", state: "FL", countyFips: "12033" })
    ).toMatchObject({
      layer: "global",
      stateCode: undefined,
      countyFips: "12033",
    });
    expect(getUserLocationContext({ stateCode: "FL", countyFips: "12O33" })).toMatchObject({
      layer: "global",
      stateCode: "FL",
      countyFips: undefined,
    });
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

describe("resolveUserCountyWriteContext", () => {
  it("returns county-table geography for a matching canonical persisted identity", async () => {
    const getCountyByFips = vi.fn().mockResolvedValue({
      fips: "12033",
      stateCode: "fl",
    });

    await expect(
      resolveUserCountyWriteContext(
        { stateCode: "FL", state: "TX", countyFips: "12033" },
        getCountyByFips
      )
    ).resolves.toEqual({
      scope: "county",
      stateCode: "FL",
      countyFips: "12033",
    });
    expect(getCountyByFips).toHaveBeenCalledOnce();
    expect(getCountyByFips).toHaveBeenCalledWith("12033");
  });

  it("supports a valid legacy state only when canonical stateCode is absent", async () => {
    const getCountyByFips = vi.fn().mockResolvedValue({
      fips: "12033",
      stateCode: "FL",
    });

    await expect(
      resolveUserCountyWriteContext({ state: "fl", countyFips: "12033" }, getCountyByFips)
    ).resolves.toEqual({
      scope: "county",
      stateCode: "FL",
      countyFips: "12033",
    });
  });

  it.each([
    ["unknown county", undefined],
    ["state mismatch", { fips: "12033", stateCode: "AL" }],
    ["FIPS mismatch", { fips: "12031", stateCode: "FL" }],
    ["malformed county row", { fips: "12O33", stateCode: "FL" }],
  ])("rejects %s", async (_label, countyRecord) => {
    await expect(
      resolveUserCountyWriteContext(
        { stateCode: "FL", countyFips: "12033" },
        vi.fn().mockResolvedValue(countyRecord)
      )
    ).resolves.toBeUndefined();
  });

  it("fails before county lookup when persisted geography is incomplete or malformed", async () => {
    const getCountyByFips = vi.fn();

    await expect(
      resolveUserCountyWriteContext(
        { stateCode: "F1", state: "FL", countyFips: "12033" },
        getCountyByFips
      )
    ).resolves.toBeUndefined();
    await expect(
      resolveUserCountyWriteContext({ stateCode: "FL", countyFips: "12O33" }, getCountyByFips)
    ).resolves.toBeUndefined();
    expect(getCountyByFips).not.toHaveBeenCalled();
  });
});
