import { describe, expect, it } from "vitest";
import { getAnalytics } from "../services/adminAnalytics";
import { scoutBrandGuardrails } from "../services/scoutBrandGuardrails";
import { scoutExecutiveBriefs } from "../services/scoutExecutiveBriefs";
import { ScoutHeatmapIntelligence } from "../services/scoutHeatmapIntelligence";
import {
  scoutLisaActionHooks,
  setupScoutLisaActionHooks,
} from "../services/scoutLisaActionHooks";
import {
  scoutLisaIntegration,
  setupScoutLisaHooks,
} from "../services/scoutLisaIntegration";
import ScoutOutboundDispatcher from "../services/scoutOutboundDispatcher";
import { ScoutVisualFileSorting } from "../services/scoutVisualFileSorting";
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

  it("derives heatmap evidence without fabricating signals and rejects unavailable operations", async () => {
    const database = {
      query: async (sql: string) => {
        const normalized = sql.replace(/\s+/g, " ");
        if (normalized.includes("contractor_counties")) {
          return { rows: [{ fips: "48453", total: 3, active: 2 }] };
        }
        if (normalized.includes(" FROM users")) {
          return {
            rows: [
              {
                fips: "48453",
                total: 8,
                homeowners: 5,
                contractors: 3,
                recent: 4,
              },
            ],
          };
        }
        if (normalized.includes(" FROM county_notes")) {
          return { rows: [{ fips: "48453", category: "permit", count: 2 }] };
        }
        if (normalized.includes(" FROM counties")) {
          return { rows: [{ fips: "48453", name: "Travis", state_code: "TX" }] };
        }
        throw new Error(`Unhandled heatmap query: ${normalized}`);
      },
    };
    const fileReader = {
      getCountyFilesBatch: async () => new Map(),
    };
    const heatmap = new ScoutHeatmapIntelligence(database as any, fileReader as any);

    await expect(heatmap.getCountyIntelligence("48453")).resolves.toMatchObject({
      opportunities: [],
      risks: [],
      metrics: {
        activityScore: 6,
        opportunityScore: null,
        dataCompleteness: 75,
        trendDirection: null,
        competitionLevel: null,
      },
      evidence: {
        source: "database",
        opportunityEvidenceAvailable: false,
        riskEvidenceAvailable: false,
        rankingEvidenceAvailable: false,
      },
    });
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

  it("never falls back to process-local visual assignment state", async () => {
    const missingTable = Object.assign(new Error("assignment table unavailable"), {
      code: "42P01",
    });
    const database = {
      query: async () => {
        throw missingTable;
      },
      connect: async () => ({
        query: async () => {
          throw missingTable;
        },
        release: () => undefined,
      }),
    };
    const fileSorting = new ScoutVisualFileSorting(database as any);

    await expect(
      fileSorting.assignFileToCounty(
        "document-1",
        "48453",
        "admin-1"
      )
    ).rejects.toMatchObject({
      code: "SCOUT_FILE_ASSIGNMENT_STORAGE_UNAVAILABLE",
      statusCode: 503,
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
