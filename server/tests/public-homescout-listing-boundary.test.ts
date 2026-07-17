import { describe, expect, it } from "vitest";
import {
  normalizeHomeScoutReportSourceUrl,
  toPublicHomeScoutCountyMetric,
  toPublicHomeScoutInspectionReport,
  toPublicHomeScoutListing,
  toPublicHomeScoutListingEvent,
  toPublicHomeScoutMarketBucket,
  toPublicHomeScoutPartnerRecommendation,
  toVisibleHomeScoutInspectionRequest,
} from "../publicHomeScoutListing";

describe("public HomeScout listing boundary", () => {
  it("keeps public property facts and the exact photo while removing private source and location data", () => {
    const result = toPublicHomeScoutListing(
      {
        id: "listing-123",
        status: "active",
        title: "Stone cottage",
        description: "Call 850-555-0188 to arrange a tour.",
        price: "425000.00",
        propertyType: "house",
        beds: 3,
        baths: "2.0",
        sqft: 1840,
        lotSqft: 7000,
        yearBuilt: 1952,
        features: ["Stone fireplace", "Email owner@example.com"],
        photos: ["/uploads/homescout/stone-cottage.webp"],
        countyFips: "12033",
        stateCode: "fl",
        city: "Pensacola",
        listedAt: "2026-07-16T12:00:00.000Z",
        createdAt: "2026-07-15T12:00:00.000Z",
        listingAuthorType: "owner",
        sourceKey: "private-feed",
        sourceListingId: "feed-991",
        dedupeKey: "secret-dedupe",
        address1: "100 Private Way",
        address2: "Unit 4",
        zipCode: "32501",
        latitude: "30.42131",
        longitude: "-87.21691",
        externalUrl: "https://source.example/private",
        sellerUserId: "seller-private",
        agentUserId: "agent-private",
        contactUserId: "contact-private",
        approvedByUserId: "admin-private",
      },
      { canonicalProfileUrl: "/u/stone-pro" }
    );

    expect(result).toMatchObject({
      id: "listing-123",
      title: "Stone cottage",
      description: "Call Continue through TradeScout to arrange a tour.",
      photos: ["/uploads/homescout/stone-cottage.webp"],
      countyFips: "12033",
      stateCode: "FL",
      canonicalProfileUrl: "/u/stone-pro",
    });
    const serialized = JSON.stringify(result);
    for (const privateValue of [
      "private-feed",
      "feed-991",
      "secret-dedupe",
      "100 Private Way",
      "32501",
      "30.42131",
      "-87.21691",
      "source.example",
      "seller-private",
      "agent-private",
      "contact-private",
      "admin-private",
      "owner@example.com",
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it("whitelists timeline, county, market, partner, report, and request fields", () => {
    expect(
      toPublicHomeScoutListingEvent({
        id: "event-1",
        eventType: "created",
        observedAt: "2026-07-16T12:00:00.000Z",
        payload: { status: "active", sourceKey: "private-feed", sourceListingId: "private-id" },
      })
    ).toEqual({
      id: "event-1",
      eventType: "created",
      observedAt: "2026-07-16T12:00:00.000Z",
      payload: { status: "active" },
    });
    expect(
      toPublicHomeScoutListingEvent({
        id: "event-2",
        eventType: "updated",
        observedAt: "2026-07-16T12:00:00.000Z",
        payload: { fields: ["contactUserId"] },
      })
    ).toBeNull();

    const market = toPublicHomeScoutMarketBucket({
      id: "private-bucket-id",
      countyFips: "12033",
      stateCode: "FL",
      propertyType: "house",
      activeCount: 14,
      medianPrice: "410000.00",
      medianPricePerSqft: "225.10",
      medianDomDays: 28,
      priceDropCount7d: 2,
      updatedAt: "private-timestamp",
    });
    expect(market).toMatchObject({ activeCount: 14, medianDomDays: 28 });
    expect(JSON.stringify(market)).not.toContain("private-bucket-id");

    expect(
      toPublicHomeScoutCountyMetric({
        id: "metric-private",
        countyFips: "12033",
        metricKey: "homescout_median_price",
        metricValue: "410000",
        metadata: { private: true },
      })
    ).toEqual({
      countyFips: "12033",
      metricKey: "homescout_median_price",
      metricValue: "410000",
    });
    expect(
      toPublicHomeScoutCountyMetric({
        countyFips: "12033",
        metricKey: "internal_source_health",
        metricValue: "bad",
      })
    ).toBeNull();

    const partner = toPublicHomeScoutPartnerRecommendation({
      category: "inspector",
      userId: "private-user",
      displayName: "Safe Inspector",
      company: "Safe Inspection Co.",
      countyEntityId: "private-entity",
      source: "county_entity",
      rankScore: 99,
      metadata: { email: "inspector@example.com" },
    });
    expect(partner).toEqual({
      category: "inspector",
      displayName: "Safe Inspector",
      company: "Safe Inspection Co.",
    });

    const report = toPublicHomeScoutInspectionReport({
      id: "report-123",
      listingId: "listing-private",
      submittedByUserId: "submitter-private",
      reportType: "buyer_independent",
      inspectorName: "Inspector Name",
      inspectorCompany: "Inspector Co.",
      inspectorLicense: "LICENSE-PRIVATE",
      summary: "Call 850-555-0188 about the roof.",
      highlights: ["Roof repair at 100 Private Way"],
      reportUrl: "https://private.example/report.pdf",
      sourceRequestId: "request-private",
      visibility: "public",
      status: "published",
      createdAt: "2026-07-16T12:00:00.000Z",
    });
    expect(report).toMatchObject({
      id: "report-123",
      summary: "Call Continue through TradeScout about the roof.",
      downloadPath: "/api/homescout/inspection-reports/report-123/download",
    });
    expect(JSON.stringify(report)).not.toContain("private.example");
    expect(JSON.stringify(report)).not.toContain("submitter-private");
    expect(JSON.stringify(report)).not.toContain("LICENSE-PRIVATE");
    expect(JSON.stringify(report)).not.toContain("request-private");

    const request = toVisibleHomeScoutInspectionRequest({
      id: "request-123",
      requesterUserId: "requester-private",
      status: "open",
      requestMessage: "Call 850-555-0188 before the inspection.",
      preferredWindow: "Email buyer@example.com tomorrow",
      createdAt: "2026-07-16T12:00:00.000Z",
    });
    expect(request).toMatchObject({
      id: "request-123",
      requestMessage: "Call Continue through TradeScout before the inspection.",
      preferredWindow: "Email Continue through TradeScout tomorrow",
    });
    expect(JSON.stringify(request)).not.toContain("requester-private");
  });

  it("accepts only TradeScout-owned upload sources", () => {
    const env = {
      R2_PUBLIC_URL: "https://assets.thetradescout.com",
      PUBLIC_BASE_URL: "https://www.thetradescout.com",
    } as NodeJS.ProcessEnv;

    expect(normalizeHomeScoutReportSourceUrl("/uploads/report-1.pdf", env)).toBe(
      "/uploads/report-1.pdf"
    );
    expect(
      normalizeHomeScoutReportSourceUrl(
        "https://assets.thetradescout.com/uploads/report-2.pdf",
        env
      )
    ).toBe("https://assets.thetradescout.com/uploads/report-2.pdf");
    expect(
      normalizeHomeScoutReportSourceUrl("https://cdn.example/tradescout/uploads/report-3.pdf", {
        R2_PUBLIC_URL: "https://cdn.example/tradescout",
      } as NodeJS.ProcessEnv)
    ).toBe("https://cdn.example/tradescout/uploads/report-3.pdf");
    expect(normalizeHomeScoutReportSourceUrl("https://evil.example/uploads/report.pdf", env)).toBe(
      null
    );
    expect(normalizeHomeScoutReportSourceUrl("http://127.0.0.1/uploads/report.pdf", env)).toBe(
      null
    );
    expect(normalizeHomeScoutReportSourceUrl("/uploads/../private/report.pdf", env)).toBe(null);
    expect(normalizeHomeScoutReportSourceUrl("/uploads/%2e%2e/private/report.pdf", env)).toBe(null);
  });
});
