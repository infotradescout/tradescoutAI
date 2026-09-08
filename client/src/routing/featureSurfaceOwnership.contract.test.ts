import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PAGES_ROOT = path.resolve(process.cwd(), "client/src/pages");
const ISOLATED_VIEWPORT_OWNERS = new Set([
  "client/src/pages/ProfileSiteView.tsx",
  "client/src/pages/profile-sites/LocalServiceProfileTheme.tsx",
  "client/src/pages/profile-sites/ProFabProfileTheme.tsx",
  "client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx",
  "client/src/pages/profile-sites/SteelHomePackagesProfile.tsx",
  "client/src/pages/profile-sites/WholesalerProfileTheme.tsx",
  "client/src/pages/trade-up-for-trade-schools.tsx",
]);

function repoRelative(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

function pageFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return pageFiles(absolutePath);
    return entry.name.endsWith(".tsx") ? [absolutePath] : [];
  });
}

describe("feature surface ownership", () => {
  it("keeps viewport height and background ownership out of AppShell pages", () => {
    const violations = pageFiles(PAGES_ROOT)
      .filter((file) => !ISOLATED_VIEWPORT_OWNERS.has(repoRelative(file)))
      .filter((file) => fs.readFileSync(file, "utf8").includes("min-h-screen"))
      .map(repoRelative);

    expect(violations).toEqual([]);
  });

  it("keeps the one viewport-owning campaign outside AppShell", () => {
    const routes = fs.readFileSync(path.resolve(process.cwd(), "client/src/AppRoutes.tsx"), "utf8");
    const campaignBranch = routes.indexOf(") : isPublicCampaignRoute ? (");
    const campaignRoute = routes.indexOf(
      '<Route path="/trade-up-for-trade-schools">',
      campaignBranch
    );
    const appShell = routes.indexOf("<AppShell>", campaignBranch);

    expect(campaignBranch).toBeGreaterThan(-1);
    expect(campaignRoute).toBeGreaterThan(campaignBranch);
    expect(campaignRoute).toBeLessThan(appShell);
  });
});
