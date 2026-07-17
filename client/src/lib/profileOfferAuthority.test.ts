import { afterEach, describe, expect, it, vi } from "vitest";
import { createProfileServiceOfferDecisionAuthority } from "./profileOfferAuthority";

describe("profile service offer decision authority", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an exact hiring Decision Card authority packet", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "decision-123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createProfileServiceOfferDecisionAuthority({
        offerId: "service-123",
        title: "Natural stone consultation",
      })
    ).resolves.toEqual({
      authorityGate: "decision_card",
      sourceDecisionCardId: "decision-123",
      decisionScope: "profile_service_offer:service-123",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      intent: "hire",
      decisionScope: "profile_service_offer:service-123",
      title: "Start service: Natural stone consultation",
      description: "Create a protected job draft for Natural stone consultation.",
    });
  });

  it("rejects malformed offer IDs before creating authority", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createProfileServiceOfferDecisionAuthority({ offerId: "../private", title: "Private" })
    ).rejects.toThrow("not available");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
