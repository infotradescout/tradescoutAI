import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("product KPI audit route contract", () => {
  const analyticsRoutesPath = path.resolve(process.cwd(), "server/routes/analytics-routes.ts");
  const source = fs.readFileSync(analyticsRoutesPath, "utf8");

  it("registers a staff-gated product KPI summary endpoint", () => {
    expect(source).toContain('"/api/analytics/product-kpi/summary"');
    expect(source).toContain("isStaff");
  });

  it("includes first-use and core product KPI event types", () => {
    expect(source).toContain('"first_use_guidance_viewed"');
    expect(source).toContain('"homeid_started"');
    expect(source).toContain('"direct_connect_homeid_link_selected"');
    expect(source).toContain('"direct_connect_home_record_prompt_viewed"');
    expect(source).toContain('"direct_connect_home_record_link_selected"');
    expect(source).toContain('"direct_connect_home_record_create_selected"');
    expect(source).toContain('"direct_connect_home_record_skipped"');
    expect(source).toContain('"direct_connect_request_submitted_after_home_record_skip"');
    expect(source).toContain('"scout_homeid_action_card_clicked"');
  });
});
