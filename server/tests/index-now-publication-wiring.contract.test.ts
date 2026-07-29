import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("IndexNow publication event wiring", () => {
  it("notifies profile publish, update, unpublish, and inventory changes", () => {
    const source = read("server/routes/profiles.ts");
    expect(source).toContain("collectEligibleProfileIndexNowUrls");
    expect(source).toContain('router.put("/api/profiles/:id/publish"');
    expect(source).toContain('router.put("/api/profiles/:id/unpublish"');
    expect(source).toContain("combineIndexNowChangeUrls(beforeUrls, afterUrls)");
    expect(source.match(/notifyIndexNow\(/g)?.length || 0).toBeGreaterThanOrEqual(5);
  });

  it("notifies business publish and update visibility transitions", () => {
    const source = read("server/routes/business-profile.ts");
    expect(source).toContain('"/api/business-profile/publish"');
    expect(source).toContain('app.patch("/api/business-profile/me"');
    expect(source.match(/collectBusinessIndexNowUrls\(/g)?.length || 0).toBeGreaterThanOrEqual(4);
    expect(source.match(/notifyIndexNow\(/g)?.length || 0).toBeGreaterThanOrEqual(2);
  });

  it("notifies service offer create, update, unpublish, and account deletion", () => {
    const offers = read("server/invoicingDocumentsRouter.ts");
    const deletion = read("server/data-management.ts");
    expect(
      offers.match(/notifyProfileServiceOfferPublication\(/g)?.length || 0
    ).toBeGreaterThanOrEqual(3);
    expect(offers).toContain("hasExposureAuthority");
    expect(deletion).toContain("collectProfileServiceOfferIndexNowUrls");
    expect(deletion.indexOf("notifyIndexNow(deletionPublicationUrls)")).toBeGreaterThan(
      deletion.indexOf("await db.transaction")
    );
  });
});
