import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("public profile install identity", () => {
  it("keeps client-side profile transitions on profile-specific install metadata", () => {
    const profilePage = read("client/src/pages/ProfileSiteView.tsx");

    expect(profilePage).toContain("buildPublicProfileAppManifestPath");
    expect(profilePage).toContain("buildPublicProfileAppIconPath");
    expect(profilePage).toContain('data-platform-manifest-href');
    expect(profilePage).toContain('apple-mobile-web-app-title');
    expect(profilePage).toContain('theme-color');
    expect(profilePage).toContain("previousAppleTouchIconHref");
    expect(profilePage).toContain("previousContent");
  });

  it("scopes canonical installs to one profile and binds mapped-domain assets", () => {
    const manifest = read("server/publicProfileApp.ts");
    const routes = read("server/routes/public-profile-app.ts");

    expect(manifest).toContain('const profilePath = isCustomDomain ? "/"');
    expect(manifest).toContain("scope: profilePath");
    expect(manifest).not.toContain('scope: "/",');
    expect(routes).toContain("resolveMappedProfileShareSlug");
    expect(routes).toContain("mappedSlug === slug");
    expect(routes).not.toContain("app.post(");
    expect(routes).not.toContain("app.put(");
    expect(routes).not.toContain("app.patch(");
    expect(routes).not.toContain("app.delete(");
  });
});
