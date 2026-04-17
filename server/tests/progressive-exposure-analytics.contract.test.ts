import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("progressive exposure analytics contracts", () => {
  it("exposes read-only summary and timeline endpoints for staff analytics", () => {
    const source = read("server/routes/analytics-routes.ts");

    expect(source).toContain('"/api/analytics/progressive-exposure/summary"');
    expect(source).toContain('"/api/analytics/progressive-exposure/timeline"');
    expect(source).toContain("isStaff");
    expect(source).toContain("event_type = 'progressive_exposure_shadow'");
  });

  it("keeps summary payload contract fields stable", () => {
    const source = read("server/routes/analytics-routes.ts");

    expect(source).toContain("totalEvents");
    expect(source).toContain("tiers");
    expect(source).toContain("topReasons");
    expect(source).toContain("signals");
    expect(source).toContain("avgAccountAgeDays");
    expect(source).toContain("avgMeaningfulActivityCount");
    expect(source).toContain("setupCompletionPct");
    expect(source).toContain("verifiedContactPct");
  });

  it("keeps timeline payload contract fields stable", () => {
    const source = read("server/routes/analytics-routes.ts");

    expect(source).toContain("date_trunc('day', created_at)");
    expect(source).toContain("points");
    expect(source).toContain("day");
    expect(source).toContain("tiers");
    expect(source).toContain("total");
  });

  it("surfaces timeline in admin control as read-only trend", () => {
    const source = read("client/src/pages/admin-control.tsx");

    expect(source).toContain('"/api/analytics/progressive-exposure/summary"');
    expect(source).toContain('"/api/analytics/progressive-exposure/timeline"');
    expect(source).toContain("Progressive Exposure (Shadow)");
    expect(source).toContain("Daily tier trend (last 7 days with events)");
  });
});
