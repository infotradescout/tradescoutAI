import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("snapshot status contracts", () => {
  it("exposes the snapshot status route in admin observability", () => {
    const source = read("server/routes/observability.ts");
    expect(source).toContain('observabilityRouter.get("/snapshot-status"');
    expect(source).toContain("getSnapshotStatusSummary");
    expect(source).toContain("Failed to fetch snapshot status");
  });

  it("renders snapshot status in admin observability", () => {
    const source = read("client/src/pages/admin-observability.tsx");
    expect(source).toContain('fetch("/api/admin/observability/snapshot-status")');
    expect(source).toContain("Snapshot Status");
    expect(source).toContain("snapshotStatus.schedulerEnabled");
    expect(source).toContain("snapshotStatus.statuses.map");
    expect(source).toContain("Stale after");
    expect(source).toContain("Refresh Snapshot");
    expect(source).toContain("/api/admin/cumulus-intelligence/refresh");
    expect(source).toContain("/api/admin/seo-directory-scope/refresh");
    expect(source).toContain("/api/admin/observability/live-stream/refresh");
    expect(source).toContain("Background scheduler is disabled");
  });
});
