import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

function sliceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("Pensacola liquidity ops aggregates", () => {
  const adminSource = read("server/routes/admin.ts");
  const analyticsSource = read("server/routes/analytics-routes.ts");
  const businessOpsPage = read("client/src/pages/admin-business-directory-ops.tsx");
  const platformAnalyticsPage = read("client/src/pages/platform-analytics.tsx");

  it("keeps supply liquidity visibility staff-gated, aggregate-only, and Escambia-scoped", () => {
    const route = sliceBetween(
      adminSource,
      '"/api/admin/business-directory/pensacola-liquidity/summary"',
      '"/api/admin/business-directory/suggestions"'
    );

    expect(route).toContain("isAuthenticated");
    expect(route).toContain("requireAdmin");
    expect(adminSource).toContain('const PENSACOLA_COUNTY_FIPS = "12033"');
    expect(route).toContain("c.fips = $1");
    expect(route).toContain("COUNT(DISTINCT b.id)::int AS candidate_count");
    expect(route).toContain("verified_active_count");
    expect(route).toContain("GROUP BY 1");
    expect(route).toContain("supported: false");

    for (const forbidden of [
      "phone",
      "email",
      "address",
      "contactName",
      "privateNotes",
      "requestText",
      "messageText",
      "uploadedContent",
    ]) {
      expect(route).not.toContain(`${forbidden}:`);
      expect(route).not.toContain(`.${forbidden}`);
    }
  });

  it("keeps demand liquidity visibility staff-gated, aggregate-only, and Escambia-scoped", () => {
    const route = sliceBetween(
      analyticsSource,
      '"/api/analytics/pensacola-liquidity/summary"',
      "// Internal: progressive exposure"
    );

    expect(route).toContain("isStaff");
    expect(analyticsSource).toContain('const PENSACOLA_COUNTY_FIPS = "12033"');
    expect(route).toContain("wr.source = 'direct_connect'");
    expect(route).toContain("wr.county_fips = $1");
    expect(route).toContain("route_ready_count");
    expect(route).toContain("contractor_visible_count");
    expect(route).toContain("stalled_no_provider_count");
    expect(route).toContain("provider_action_count");
    expect(route).toContain("routedToProviderPct");

    for (const forbidden of [
      "phone",
      "email",
      "address",
      "contactName",
      "privateNotes",
      "requestText",
      "messageText",
      "uploadedContent",
      "description",
      "title",
    ]) {
      expect(route).not.toContain(`${forbidden}:`);
      expect(route).not.toContain(`.${forbidden}`);
    }
  });

  it("derives supply liquidity from existing aggregate fields without activation schema", () => {
    const route = sliceBetween(
      adminSource,
      '"/api/admin/business-directory/pensacola-liquidity/summary"',
      '"/api/admin/business-directory/suggestions"'
    );

    expect(route).toContain("FROM businesses b");
    expect(route).toContain("INNER JOIN business_counties bc ON bc.business_id = b.id");
    expect(route).toContain("INNER JOIN counties c ON c.id = bc.county_id");
    expect(route).toContain("LEFT JOIN users u ON u.id = b.owner_user_id");
    expect(route).toContain("b.status = 'active'");
    expect(route).toContain("b.claim_status = 'claimed'");
    expect(route).toContain("u.verification_status = 'approved'");
    expect(route).toContain("COALESCE(u.verified_badge, false) = true");
    expect(route).toContain(
      "COALESCE(NULLIF(b.profile_data->>'category', ''), b.type, 'uncategorized')"
    );
    expect(route).toContain("COUNT(DISTINCT b.id)::int AS candidate_count");
    expect(route).not.toContain("provider_activation");
  });

  it("derives demand liquidity from existing request, assignment, and event aggregates", () => {
    const route = sliceBetween(
      analyticsSource,
      '"/api/analytics/pensacola-liquidity/summary"',
      "// Internal: progressive exposure"
    );

    expect(route).toContain("WITH pensacola_requests AS");
    expect(route).toContain("FROM work_requests wr");
    expect(route).toContain("FROM work_request_assignments");
    expect(route).toContain("INNER JOIN work_requests wr ON wr.id = wra.work_request_id");
    expect(route).toContain("status <> 'draft' AND status <> 'cancelled'");
    expect(route).toContain("contractor_visible_count");
    expect(route).toContain("stalled_no_provider_count");
    expect(route).toContain("direct_connect_request_submitted");
    expect(route).toContain("direct_connect_visible_to_contractors");
    expect(route).toContain("direct_connect_contractor_action_started");
    expect(route).toContain("direct_connect_form_validation_blocked");
    expect(route).toContain("direct_connect_permission_or_role_blocked");
    expect(route).toContain("direct_connect_funnel_step_stalled");
  });

  it("reuses existing admin surfaces instead of creating a new dashboard", () => {
    expect(businessOpsPage).toContain("/api/admin/business-directory/pensacola-liquidity/summary");
    expect(platformAnalyticsPage).toContain("/api/analytics/pensacola-liquidity/summary");
    expect(businessOpsPage).toContain("Aggregated county supply health only");
    expect(businessOpsPage).toContain("does not expose contact lists or sell leads");
    expect(platformAnalyticsPage).toContain("No raw request text, contact fields");
    expect(platformAnalyticsPage).toContain("lead exports");
  });

  it("does not introduce schema, migration, outreach automation, or ranking behavior", () => {
    const combined = [adminSource, analyticsSource, businessOpsPage, platformAnalyticsPage].join(
      "\n"
    );

    expect(combined).not.toContain("provider_activation");
    expect(combined).not.toContain("CREATE TABLE");
    expect(combined).not.toContain("ALTER TABLE");
    expect(combined).not.toContain("prisma migrate");
    expect(combined).not.toContain("exportCsv");
    expect(combined).not.toContain("downloadLeads");
    expect(combined).not.toContain("smart ranking");
    expect(combined).not.toContain("MealScout");
  });
});
