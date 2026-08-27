import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const profilesRoute = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/profiles.ts"),
  "utf8"
);
const profileRepository = fs.readFileSync(
  path.resolve(process.cwd(), "server/repositories/profileRepository.ts"),
  "utf8"
);
const profileView = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/ProfileSiteView.tsx"),
  "utf8"
);
const editor = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/ProfileSiteEditor.tsx"),
  "utf8"
);
const wholesaler = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/profile-sites/WholesalerProfileTheme.tsx"),
  "utf8"
);
const legacyWholesaler = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx"),
  "utf8"
);
const contentAdapters = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/data/profileSiteContentAdapters.ts"),
  "utf8"
);
const manageChrome = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/components/profile/ProfileSiteManageChrome.tsx"),
  "utf8"
);

describe("profile template manage surface contracts", () => {
  it("returns viewerCanManage and siteTemplate on the public profile payload", () => {
    expect(profilesRoute).toContain("viewerCanManage");
    expect(profilesRoute).toContain("siteTemplate");
    expect(profilesRoute).toContain("isSuperAdminRequester");
    expect(profilesRoute).toContain("updateProfileById");
  });

  it("lets authorized managers resolve drafts without weakening public profile reads", () => {
    expect(profilesRoute).toContain("storage.getProfileBySlugForManagement(slug)");
    expect(profilesRoute).toContain("storage.getProfileBySlugPublic(slug)");
    expect(profileRepository).toContain("async getProfileBySlugForManagement");
    expect(profileRepository).toContain("this.getProfileBySlugRecord(slug, false)");
    expect(profileRepository.match(/this\.getProfileBySlugRecord\(slug, true\)/g)).toHaveLength(2);
  });

  it("routes live profiles by resolved siteTemplate ids", () => {
    expect(profileView).toContain('siteTemplate === "auto-glass"');
    expect(profileView).toContain('siteTemplate === "plumbing-company"');
    expect(profileView).toContain('siteTemplate === "electrician-solo"');
    expect(profileView).toContain('siteTemplate === "wholesaler"');
    expect(profileView).toContain("ProfileSiteManageChrome");
    expect(profileView).toContain("viewerCanManage");
    expect(profileView).not.toMatch(/import WholesalerProfileTheme from/);
    expect(profileView).toMatch(
      /const WholesalerProfileTheme = lazy\(\s*\(\) => import\("@\/pages\/profile-sites\/WholesalerProfileTheme"\)\s*\)/
    );
    expect(profileView).toContain("<WholesalerProfileBoundary>");
    expect(profileView).toMatch(
      /data-testid="wholesaler-profile-loading"[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-busy="true"/
    );
  });

  it("keeps owner controls in document flow above every profile site", () => {
    expect(manageChrome).toContain('className="relative z-[80]');
    expect(manageChrome).not.toContain('className="fixed inset-x-0 top-0');
    expect(profileView).not.toContain("manageChromeSpacer");
    expect(profileView.match(/\{manageChrome\}/g)).toHaveLength(8);
  });

  it("offers the v1 template gallery in the profile editor", () => {
    expect(editor).toContain("listSelectableProfileSiteTemplates");
    expect(editor).toContain("profile-editor-template-");
    expect(editor).toContain("Advanced JSON");
  });

  it("honors curated featuredStoneSlugs on wholesaler profiles", () => {
    expect(wholesaler).toContain("LegacyWholesalerProfileTheme");
    expect(legacyWholesaler).toContain("featuredStoneSlugs");
    expect(legacyWholesaler).toContain("Curated featured picks win");
  });

  it("exposes lead-photo picking for JW Stone inventory on the live manage chrome", () => {
    const templates = fs.readFileSync(
      path.resolve(process.cwd(), "shared/profileSiteTemplates.ts"),
      "utf8"
    );
    expect(manageChrome).toContain("Pick lead photos");
    expect(manageChrome).toContain("upsertInventoryLeadImage");
    expect(templates).toContain("leadImageBySlug");
    expect(templates).toContain("applyInventoryLeadImageOverrides");
    expect(contentAdapters).toContain("applyInventoryLeadImageOverrides");
    expect(profileView).toContain("applyProfileSiteContentAdapter");
    expect(profileView).toContain("profile-site-manage-signin");
    expect(profilesRoute).toContain("isStaffProfileManager");
  });
});
