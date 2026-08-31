import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1p homeid end-to-end production smoke contracts", () => {
  it("keeps the HomeID runtime path wired from create through persistence and packet readiness", () => {
    const homesSource = read("server/routes/homes.ts");

    expect(homesSource).toContain('router.post("/api/homeid/create"');
    expect(homesSource).toContain('router.get("/api/homeid/:homeId/persistence"');
    expect(homesSource).toContain('router.put("/api/homeid/:homeId/property-details"');
    expect(homesSource).toContain('router.put("/api/homeid/:homeId/components"');
    expect(homesSource).toContain('router.put("/api/homeid/:homeId/request-packets"');
    expect(homesSource).toContain('router.put("/api/homeid/:homeId/evidence"');
    expect(homesSource).toContain('router.get("/api/homes/:homeId/homeid-dashboard"');
    expect(homesSource).toContain('router.post("/api/homes/:homeId/homeid/request-packet"');
  });

  it("keeps the HomeID to Direct Connect draft and submit bridge with safety boundary", () => {
    const directConnectSource = read("server/routes/direct-connect.ts");

    expect(directConnectSource).toContain('"/api/direct-connect/requests"');
    expect(directConnectSource).toContain('type: "homeid_draft_created"');
    expect(directConnectSource).toContain('"/api/direct-connect/requests/:id/submit-homeid-draft"');
    expect(directConnectSource).toContain('type: "homeid_draft_submitted"');
    expect(directConnectSource).toContain('title: "homeid:direct_connect_request_submitted"');
    expect(directConnectSource).toContain('source: "homeid_packet"');
  });

  it("keeps Direct Connect jobflow and completion enrichment writing back into HomeID", () => {
    const directConnectSource = [
      read("server/routes/direct-connect.ts"),
      read("server/routes/direct-connect/completion.ts"),
    ].join("\n");

    expect(directConnectSource).toContain("appendHomeIdTimelineEventFromDirectConnect");
    expect(directConnectSource).toContain('eventType: "direct_connect_request_submitted"');
    expect(directConnectSource).toContain('eventType: "direct_connect_completed"');
    expect(directConnectSource).toContain('source: "direct_connect_jobflow"');

    expect(directConnectSource).toContain("appendHomeIdCompletedWorkEnrichmentFromDirectConnect");
    expect(directConnectSource).toContain('title: "homeid:completed_work_enrichment"');
    expect(directConnectSource).toContain('source: "direct_connect_completed_work"');
  });

  it("keeps Scout able to read HomeID state and render context, suggestions, signals, and action cards", () => {
    const scoutSource = read("client/src/scout/ScoutOS.tsx");

    expect(scoutSource).toContain('"/api/homeid/persistence"');
    expect(scoutSource).toContain('"/api/homes/homeid-dashboard"');
    expect(scoutSource).toContain("function evaluateHomeIdMaintenanceSuggestions");
    expect(scoutSource).toContain("function evaluateHomeIdSimilarLocalSignals");
    expect(scoutSource).toContain("function buildHomeIdActionCards");
    expect(scoutSource).toContain("HomeID context");
    expect(scoutSource).toContain("Maintenance suggestions");
    expect(scoutSource).toContain("Similar-home local signals");
    expect(scoutSource).toContain("HomeID action cards");
  });
});
