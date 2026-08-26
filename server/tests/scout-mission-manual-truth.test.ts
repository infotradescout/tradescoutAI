import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  ScoutScheduledMissions,
  type ScoutMissionRepository,
} from "../services/scoutScheduledMissions";

describe("Scout manual mission truth", () => {
  it("records manual review with unknown impact and no executor claim", async () => {
    const createMissionAction = vi.fn(async () => ({
      id: "mission-action-1",
      createdAt: new Date("2026-08-26T12:00:00.000Z"),
    }));
    const repository: ScoutMissionRepository = { createMissionAction };
    const service = new ScoutScheduledMissions(repository);

    const result = await service.recordManualMission({
      fips: "48453",
      missionType: "codes",
      requestedBy: "admin-1",
      requestId: "request-1",
    });

    expect(createMissionAction).toHaveBeenCalledWith({
      sourceId: "manual:48453:codes:request-1",
      countyFips: "48453",
      type: "codes",
      requestedBy: "admin-1",
    });
    expect(createMissionAction.mock.calls[0][0]).not.toHaveProperty("impactScore");
    expect(result).toMatchObject({
      status: "recorded",
      impactScore: null,
      execution: {
        available: false,
        state: "manual_review_required",
      },
      evidence: {
        durable: true,
        impactScoreAvailable: false,
        executorAvailable: false,
      },
    });
  });

  it("persists NULL rather than an invented neutral score", () => {
    const source = readFileSync("server/services/scoutScheduledMissions.ts", "utf8");
    expect(source).toMatch(/impact_score\)\s*VALUES[\s\S]*NULL\)/);
    expect(source).not.toContain("impactScore: 50");
    expect(source).not.toContain("impact_score, 50");
    expect(source).not.toContain("status: \"queued\"");
  });
});
