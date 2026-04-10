import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("admin live stream contracts", () => {
  it("registers the unified admin live stream endpoint", () => {
    const source = read("server/routes/observability.ts");
    expect(source).toContain('observabilityRouter.get("/live-stream"');
    expect(source).toContain('observabilityRouter.get("/live-stream/history"');
    expect(source).toContain('observabilityRouter.post("/live-stream/refresh"');
    expect(source).toContain('observabilityRouter.get("/live-stream/export.csv"');
    expect(source).toContain('observabilityRouter.get("/live-stream/intent-batch"');
    expect(source).toContain('observabilityRouter.get("/live-stream/intent-stream"');
    expect(source).toContain('observabilityRouter.get("/live-stream/intent-parity"');
    expect(source).toContain('contract: "digital_dna_v1"');
    expect(source).toContain('contract: "intent_parity_v1"');
    expect(source).toContain("event: intent_batch");
    expect(source).toContain("recommended_action");
    expect(source).toContain("action_payload");
    expect(source).toContain('mode === "intent"');
    expect(source).toContain('mode === "snapshot_24h_site"');
    expect(source).toContain('"live-intent-feed"');
    expect(source).toContain('"site-snapshot-24h"');
    expect(source).toContain('"lane_index"');
    expect(source).toContain('"lane_count"');
    expect(source).toContain('"lanes_json"');
    expect(source).toContain('"usability_accepted"');
    expect(source).toContain('"usability_rejected"');
    expect(source).toContain('"usability_rejection_reasons_json"');
    expect(source).toContain('"action_payload_json"');
    expect(source).toContain('source: "canonical_event_windows"');
    expect(source).toContain("buildEventNativeRecords(");
    expect(source).toContain("buildParitySummary(");
    expect(source).toContain("recordIntentParitySample(");
    expect(source).toContain("ready_for_event_native_cutover");
    expect(source).toContain("window_event_limit");
    expect(source).toContain("getLiveStreamSnapshot");
    expect(source).toContain("getLiveLaneEvents");
    expect(source).toContain("getLiveStreamSnapshotHistory");
    expect(source).toContain("refreshLiveStreamSnapshot");
    expect(source).toContain('Content-Type", "text/csv; charset=utf-8"');
    expect(source).toContain('Content-Disposition", `attachment; filename="${suffix}.csv"`');
    expect(source).toContain('String((req.query as any)?.source || "")');
    expect(source).toContain('String((req.query as any)?.stateCode || "")');
    expect(source).toContain('String((req.query as any)?.county || "")');
    expect(source).toContain("limit");
    expect(source).toContain("Failed to fetch live stream");
    expect(source).toContain("Failed to refresh live stream");
    expect(source).toContain("Failed to export live stream");
  });
});
