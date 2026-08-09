import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), "utf8");

describe("discovery performance report contract", () => {
  it("uses the four production evidence layers and stays read-only", () => {
    const source = read("scripts/report-discovery-performance.mjs");

    expect(source).toContain("bot_observation_events");
    expect(source).toContain("profile_view_events");
    expect(source).toContain("event_type = 'discovery_landing'");
    expect(source).toContain("work_request_events");
    expect(source).toContain("entryRequestId");
    expect(source).toContain("source_attributed_landings");
    expect(source).toContain("Search-engine impression data is not available");
    expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE)\s+(?:INTO\s+)?[a-z_]+/i);
  });

  it("keeps conversion attribution tied to the issued identity", () => {
    const source = read("scripts/report-discovery-performance.mjs");

    expect(source).toContain("wre.metadata->>'entryRequestId'");
    expect(source).toContain("r.entry_request_id = l.entry_request_id");
    expect(source).toContain("wre.type = 'created'");
    expect(source).toContain("verified server-issued entryRequestId");
  });

  it("exposes a repeatable package command", () => {
    const packageJson = JSON.parse(read("package.json"));
    expect(packageJson.scripts["report:discovery-performance"]).toBe(
      "node scripts/report-discovery-performance.mjs"
    );
  });
});
