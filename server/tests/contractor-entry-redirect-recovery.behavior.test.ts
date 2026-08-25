import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getContractorBySlug: vi.fn(),
  getBusinessProfileByUserId: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getContractorBySlug: (...args: unknown[]) => mocks.getContractorBySlug(...args),
    getBusinessProfileByUserId: (...args: unknown[]) =>
      mocks.getBusinessProfileByUserId(...args),
  },
}));

import { buildPublicContractorProfileHtml } from "../publicContractorProfileHtml";

const templateHtml =
  '<!doctype html><html><head><title>TradeScout</title></head><body><div id="root"></div></body></html>';

describe("contractor entry redirect recovery", () => {
  beforeEach(() => {
    mocks.getContractorBySlug.mockReset();
    mocks.getBusinessProfileByUserId.mockReset();
  });

  it.each([
    ["apply", "/claim-my-business?source=contractors_apply_legacy"],
    ["signup", "/claim-my-business?source=contractors_signup_legacy"],
    ["accelerator", "/claim-my-business?source=contractors_accelerator_legacy"],
    ["dashboard", "/business-dashboard"],
  ])("redirects reserved contractor slug %s before database lookup", async (slug, location) => {
    await expect(
      buildPublicContractorProfileHtml({
        slug,
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toEqual({ kind: "redirect", location });

    expect(mocks.getContractorBySlug).not.toHaveBeenCalled();
  });

  it("keeps ordinary contractor slugs on the existing profile lookup path", async () => {
    mocks.getContractorBySlug.mockResolvedValue(null);

    await expect(
      buildPublicContractorProfileHtml({
        slug: "real-local-provider",
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toBeNull();

    expect(mocks.getContractorBySlug).toHaveBeenCalledWith("real-local-provider");
  });
});
