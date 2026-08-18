import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("directory business profile fallback", () => {
  it("renders active imported directory businesses instead of hard-failing SEO publication checks", () => {
    const routeSource = read("server/routes/business-directory-public.ts");

    expect(routeSource).toContain('router.get("/api/public/businesses/:slug"');
    expect(routeSource).toContain("publication: {");
    expect(routeSource).toContain("crawlable: pub.ok");
    expect(routeSource).toContain("reason: pub.reason || null");
    expect(routeSource).not.toContain(
      'if (!pub.ok) return res.status(410).json({ message: "Listing inactive/out of date" });'
    );
  });

  it("carries safe imported Google fields for profile shells without exposing direct contact", () => {
    const routeSource = read("server/routes/business-directory-public.ts");
    const viewSource = read("client/src/pages/BusinessProfileView.tsx");

    expect(routeSource).toContain("average_rating");
    expect(routeSource).toContain("review_count");
    expect(routeSource).toContain("google_maps_url");
    expect(routeSource).toContain('source: "google_import"');
    expect(viewSource).toContain("googleRating");
    expect(viewSource).toContain("googleReviewCount");
    expect(viewSource).not.toContain("Google-imported fields queued for enrichment");
    expect(viewSource).toContain("showCallDecisionCard");
    expect(viewSource).toContain("DecisionCard");
  });
});
