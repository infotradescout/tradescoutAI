import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const profilesRoute = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/profiles.ts"),
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

describe("profile template manage surface contracts", () => {
  it("returns viewerCanManage and siteTemplate on the public profile payload", () => {
    expect(profilesRoute).toContain("viewerCanManage");
    expect(profilesRoute).toContain("siteTemplate");
    expect(profilesRoute).toContain("isSuperAdminRequester");
    expect(profilesRoute).toContain("updateProfileById");
  });

  it("routes live profiles by resolved siteTemplate ids", () => {
    expect(profileView).toContain('siteTemplate === "auto-glass"');
    expect(profileView).toContain('siteTemplate === "plumbing-company"');
    expect(profileView).toContain('siteTemplate === "electrician-solo"');
    expect(profileView).toContain('siteTemplate === "wholesaler"');
    expect(profileView).toContain("ProfileSiteManageChrome");
    expect(profileView).toContain("viewerCanManage");
  });

  it("offers the v1 template gallery in the profile editor", () => {
    expect(editor).toContain("listSelectableProfileSiteTemplates");
    expect(editor).toContain("profile-editor-template-");
    expect(editor).toContain("Advanced JSON");
  });

  it("honors curated featuredStoneSlugs on wholesaler profiles", () => {
    expect(wholesaler).toContain("featuredStoneSlugs");
    expect(wholesaler).toContain("Curated featured picks win");
  });

  it("exposes lead-photo picking for JW Stone inventory on the live manage chrome", () => {
    const manageChrome = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/components/profile/ProfileSiteManageChrome.tsx"),
      "utf8"
    );
    const templates = fs.readFileSync(
      path.resolve(process.cwd(), "shared/profileSiteTemplates.ts"),
      "utf8"
    );
    expect(manageChrome).toContain("Pick lead photos");
    expect(manageChrome).toContain("upsertInventoryLeadImage");
    expect(templates).toContain("leadImageBySlug");
    expect(templates).toContain("applyInventoryLeadImageOverrides");
    expect(profileView).toContain("applyInventoryLeadImageOverrides");
    expect(profileView).toContain("profile-site-manage-signin");
    expect(profilesRoute).toContain("isStaffProfileManager");
  });
});
