import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("profile visibility contract guards", () => {
  it("server route supports optional unverified proceed path", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain("/api/users/profile-visibility");
    expect(routesSource).toContain("proceedUnverified");
    expect(routesSource).toContain("allowProceedUnverified");
    expect(routesSource).toContain("verificationOptional");
  });

  it("profile visibility callers handle gate contract", () => {
    const profileSettings = read("client/src/pages/ProfileSettings.tsx");
    const profileSiteEditor = read("client/src/pages/ProfileSiteEditor.tsx");
    const settings = read("client/src/pages/settings.tsx");

    expect(profileSettings).toContain("allowProceedUnverified");
    expect(profileSettings).toContain("proceedUnverified: true");

    expect(profileSiteEditor).toContain("allowProceedUnverified");
    expect(profileSiteEditor).toContain("proceedUnverified: true");

    expect(settings).toContain("proceedUnverified: true");
  });

  it("admin profile editor defaults unknown visibility to private", () => {
    const adminUsers = read("client/src/pages/admin-users.tsx");

    expect(adminUsers).toContain(
      'profileVisibility: prefs.profileVisibility === "public" ? "public" : "private"'
    );
  });
});
