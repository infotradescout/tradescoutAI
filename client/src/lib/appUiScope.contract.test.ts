import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("TradeScout application UI upgrade scope", () => {
  it("keeps custom and public profile experiences outside application chrome changes", () => {
    const shell = read("client/src/components/layout/AppShell.tsx");

    expect(shell).toContain("__TS_CUSTOM_DOMAIN_PROFILE_SLUG__");
    expect(shell).toContain("isPublicProfileLikePath(pathOnly)");
    expect(shell).toContain("/^\\/(?:u|p)\\/[^/]+(?:\\/|$)/i");
    expect(shell).toContain("/^\\/business\\/[^/]+(?:\\/edit)?$/i");
    expect(shell).toContain("/^\\/helpers\\/[^/]+$/i");
    expect(shell).toContain('pathOnly === "/jw-stone"');
    expect(shell).toContain("!isPublicProfileSurface");
  });

  it("keeps known branded public-profile implementations out of app-theme convergence", () => {
    const audit = read("scripts/audit-theme-lock.mjs");

    expect(audit).toContain('"client/src/pages/ProfileSiteView.tsx"');
    expect(audit).toContain('"client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx"');
    expect(audit).toContain('"client/src/pages/profile-sites/SteelHomePackagesProfile.tsx"');
    expect(audit).toContain("BRANDED_SURFACE_DIRECTORY_EXCEPTIONS");
  });
});
