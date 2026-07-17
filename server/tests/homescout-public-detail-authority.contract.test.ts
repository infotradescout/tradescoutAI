import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("HomeScout public detail authority contract", () => {
  it("uses explicit public response maps and never returns whole HomeScout records", () => {
    const routes = read("server/routes.ts");
    const boundary = read("server/publicHomeScoutListing.ts");
    const page = read("client/src/pages/homescout-listing.tsx");

    expect(routes).toContain("toPublicHomeScoutListing(listing, { canonicalProfileUrl })");
    expect(routes).toContain("events.map(toPublicHomeScoutListingEvent)");
    expect(routes).toContain("inspectionReports.map(toPublicHomeScoutInspectionReport)");
    expect(routes).toContain(".map(toVisibleHomeScoutInspectionRequest)");
    expect(routes).not.toContain("sanitizeHomeScoutPublicListing");
    expect(boundary).not.toContain("...source");
    expect(boundary).toContain("listHomeScoutListingPhotoUrls(source.photos)");
    expect(page).not.toContain("listing.latitude");
    expect(page).not.toContain("listing.longitude");
  });

  it("hides request identity and filters recommended inspectors through Trust and CVS", () => {
    const routes = read("server/routes.ts");
    const boundary = read("server/publicHomeScoutListing.ts");

    expect(routes).toContain("requesterUserId:");
    expect(routes).toContain("access.isAdminLikeViewer || access.isOwnerViewer");
    expect(routes).toContain("inspectorAuthorityByUserId");
    expect(routes).toContain("buildExposureAuthorityMap");
    expect(boundary).not.toContain("requesterUserId:");
    expect(boundary).not.toContain("submittedByUserId:");
    expect(boundary).not.toContain("countyEntityId:");
  });

  it("requires and atomically completes exact hiring Decision Cards", () => {
    const routes = read("server/routes.ts");
    const authority = read("client/src/lib/homeScoutAuthority.ts");

    expect(routes).toContain("buildHomeScoutInspectionRequestDecisionScope(listingId)");
    expect(routes).toContain("buildHomeScoutInspectionServiceDecisionScope(reportId)");
    expect(routes).toContain('eq(decisionCards.intent, "hire")');
    expect(routes).toContain("eq(decisionCards.decisionScope, args.decisionScope)");
    expect(routes).toContain("db.transaction(async (tx)");
    expect(routes).toContain('status: "completed"');
    expect(authority).toContain('intent: "hire"');
    expect(authority).toContain('authorityGate: "decision_card"');
  });

  it("blocks arbitrary report hosts and keeps report URLs out of community requests", () => {
    const routes = read("server/routes.ts");
    const boundary = read("server/publicHomeScoutListing.ts");

    expect(routes).toContain("normalizeHomeScoutReportSourceUrl");
    expect(routes).toContain('redirect: "manual"');
    expect(routes).toContain("HOME_SCOUT_REPORT_DOWNLOAD_MAX_BYTES");
    expect(routes).toContain("Inspection report reviewed through HomeScout.");
    expect(routes).not.toContain("`Inspection report: ${String((report as any).reportUrl");
    expect(boundary).toContain('parsed.protocol !== "https:"');
    expect(boundary).toContain('decoded?.startsWith("/uploads/")');
  });
});
