import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHomeScoutInspectionRequestDecisionAuthority,
  createHomeScoutInspectionServiceDecisionAuthority,
} from "./homeScoutAuthority";

describe("HomeScout decision authority", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates exact hiring authority for an inspection request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "decision-inspection" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createHomeScoutInspectionRequestDecisionAuthority({
        listingId: "listing-123",
        listingTitle: "Stone cottage",
      })
    ).resolves.toEqual({
      authorityGate: "decision_card",
      sourceDecisionCardId: "decision-inspection",
      decisionScope: "homescout_inspection_request:listing-123",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      intent: "hire",
      decisionScope: "homescout_inspection_request:listing-123",
      title: "Request inspection: Stone cottage",
    });
  });

  it("creates exact hiring authority for a report repair request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "decision-service" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createHomeScoutInspectionServiceDecisionAuthority({
        reportId: "report-456",
        listingTitle: "Stone cottage",
      })
    ).resolves.toEqual({
      authorityGate: "decision_card",
      sourceDecisionCardId: "decision-service",
      decisionScope: "homescout_inspection_service:report-456",
    });
  });

  it("rejects malformed identifiers before creating authority", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createHomeScoutInspectionRequestDecisionAuthority({
        listingId: "../private",
        listingTitle: "Private",
      })
    ).rejects.toThrow("not available");
    await expect(
      createHomeScoutInspectionServiceDecisionAuthority({
        reportId: "report/../../private",
        listingTitle: "Private",
      })
    ).rejects.toThrow("not available");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
