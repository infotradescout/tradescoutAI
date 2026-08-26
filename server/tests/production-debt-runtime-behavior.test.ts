import { describe, expect, it } from "vitest";
import { getAnalytics } from "../services/adminAnalytics";
import { scoutBrandGuardrails } from "../services/scoutBrandGuardrails";
import { scoutExecutiveBriefs } from "../services/scoutExecutiveBriefs";
import { scoutHeatmapIntelligence } from "../services/scoutHeatmapIntelligence";
import {
  scoutLisaActionHooks,
  setupScoutLisaActionHooks,
} from "../services/scoutLisaActionHooks";
import {
  scoutLisaIntegration,
  setupScoutLisaHooks,
} from "../services/scoutLisaIntegration";
import ScoutOutboundDispatcher from "../services/scoutOutboundDispatcher";
import { scoutVisualFileSorting } from "../services/scoutVisualFileSorting";
import ScoutWatchdog from "../services/scoutWatchdog";

describe("production-debt runtime behavior", () => {
  it("exposes process-local analytics without claiming durability", () => {
    expect(getAnalytics()).toMatchObject({
      scope: "process_local",
      durable: false,
    });
  });

  it("fails closed when brand authorization has no policy store", () => {
    expect(scoutBrandGuardrails.verifyBrandAccess("user", "trade-scout")).toBe(
      false
    );
    expect(() =>
      scoutBrandGuardrails.searchIntelligence("trade-scout", "permit")
    ).toThrow(/durable brand-partitioned intelligence repository/i);
  });

  it("rejects fabricated heatmap, brief, and LISA operations", async () => {
    await expect(
      scoutHeatmapIntelligence.getCountyIntelligence("48453")
    ).rejects.toMatchObject({ code: "RUNTIME_CAPABILITY_UNAVAILABLE" });
    await expect(
      scoutExecutiveBriefs.generateWeeklyBrief()
    ).rejects.toMatchObject({ code: "RUNTIME_CAPABILITY_UNAVAILABLE" });
    await expect(
      scoutLisaActionHooks.processScoutFinding({})
    ).rejects.toMatchObject({ code: "RUNTIME_CAPABILITY_UNAVAILABLE" });
    await expect(
      scoutLisaIntegration.triggerCountyUpdate("48453", "test")
    ).rejects.toMatchObject({ code: "RUNTIME_CAPABILITY_UNAVAILABLE" });
  });

  it("does not register log-only action or decision hooks", () => {
    const pipeline = { on: () => {
      throw new Error("a log-only hook must not be registered");
    } };
    expect(() => setupScoutLisaActionHooks(pipeline)).not.toThrow();
    expect(() => setupScoutLisaHooks()).not.toThrow();
  });

  it("returns an unavailable dispatcher instead of simulated success", () => {
    const dispatcher = new ScoutOutboundDispatcher();
    expect(
      dispatcher.queueEvent({
        event_type: "risk_detected",
        priority: "high",
        source: "analysis",
        payload: {},
        metadata: { tags: [] },
      })
    ).toEqual({
      success: false,
      error: "durable outbound dispatcher is not configured",
    });
    expect(dispatcher.getStatistics()).toMatchObject({
      available: false,
      durable: false,
      queued_events: 0,
    });
  });

  it("rejects process-local visual assignment state", async () => {
    await expect(
      scoutVisualFileSorting.assignFileToCounty(
        "file",
        "48453",
        "user"
      )
    ).rejects.toMatchObject({ code: "RUNTIME_CAPABILITY_UNAVAILABLE" });
    expect(scoutVisualFileSorting.getStatistics()).toMatchObject({
      available: false,
      durable: false,
      totalAssignments: 0,
    });
  });

  it("reports only observed server metrics and discloses history scope", async () => {
    const report = await new ScoutWatchdog().generateHealthReport();
    expect(report.server_metrics.length).toBeGreaterThan(0);
    expect(report.api_metrics).toEqual([]);
    expect(report.database_metrics).toEqual([]);
    expect(report.feature_health).toEqual([]);
    expect(report.coverage.server).toEqual({
      observed: true,
      source: "node_os",
    });
    expect(report.coverage.api.observed).toBe(false);
    expect(report.history_scope).toBe("process_local");
    expect(report.durable).toBe(false);
  });
});
