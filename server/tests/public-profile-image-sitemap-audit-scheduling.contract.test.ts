import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile image sitemap audit scheduling", () => {
  it("runs once in production after the feeds are available", () => {
    const service = read("server/services/indexNowService.ts");

    expect(service).toContain("schedulePublicProfileImageSitemapAudit");
    expect(service).toContain("imageSitemapAuditScheduled");
    expect(service).toContain('process.env.NODE_ENV !== "production"');
    expect(service).toContain("PUBLIC_PROFILE_IMAGE_SITEMAP_AUDIT_DISABLED");
    expect(service).toContain("PUBLIC_PROFILE_IMAGE_SITEMAP_AUDIT_DELAY_MS");
    expect(service).toContain('import("./publicProfileImageSitemapAudit")');
    expect(service).toContain("runPublicProfileImageSitemapAudit");
    expect(service).toContain("timer.unref?.()");
    expect(service).toContain("schedulePublicProfileImageSitemapAudit();");
  });

  it("proves deployed XML without turning a sitemap into ranking evidence", () => {
    const audit = read("server/services/publicProfileImageSitemapAudit.ts");

    expect(audit).toContain('"production_verified" | "production_failed" | "unavailable"');
    expect(audit).toContain("sitemap-profile-images.xml");
    expect(audit).toContain("landing/profile-images.xml");
    expect(audit).toContain("expectedPageUrlsPresent");
    expect(audit).toContain("expectedImageUrlsPresent");
    expect(audit).toContain("directOnlyProfileAbsent");
    expect(audit).toContain("placeholderTokensAbsent");
    expect(audit).toContain("It is not proof of indexing, ranking, image visibility");
  });
});
