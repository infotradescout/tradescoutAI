import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("public profile compatibility contracts", () => {
  it("legacy public profile API exposes canonical slug when a published profile site exists", () => {
    const source = read("server/routes.ts");

    expect(source).toContain("const canonicalPublicProfile = ownerProfiles.find");
    expect(source).toContain("canonicalProfileSlug: canonicalPublicProfile?.slug || null");
    expect(source).toContain("canonicalProfileUrl: canonicalPublicProfile?.slug");
  });

  it("legacy /profile/:userId view redirects into canonical /u/:slug pages", () => {
    const source = read("client/src/pages/PublicProfileView.tsx");

    expect(source).toContain("const [, navigate] = useLocation();");
    expect(source).toContain(
      'if (typeof data?.canonicalProfileSlug === "string" && data.canonicalProfileSlug.trim())'
    );
    expect(source).toContain(
      "navigate(`/u/${encodeURIComponent(data.canonicalProfileSlug.trim())}`"
    );
  });

  it("HomeScout listing prefers canonical public profile URLs when they are available", () => {
    const source = read("client/src/pages/homescout-listing.tsx");

    expect(source).toContain("const contactProfileHref =");
    expect(source).toContain("canonicalProfileUrl");
    expect(source).toContain("<Link href={contactProfileHref}>");
  });

  it("Community profile links prefer canonical public profile URLs when available", () => {
    const source = read("client/src/pages/CommunityProfile.tsx");

    expect(source).toContain("const publicProfileHref =");
    expect(source).toContain("canonicalProfileUrl");
    expect(source).toContain("<Link href={publicProfileHref}>View public profile</Link>");
  });

  it("Connections endpoints and UI prefer canonical public profile URLs when available", () => {
    const routesSource = read("server/social-routes.ts");
    const featuresSource = read("server/social-features.ts");
    const uiSource = read("client/src/pages/connections.tsx");

    expect(routesSource).toContain("canonicalProfileUrl:");
    expect(featuresSource).toContain("canonicalProfileUrl:");
    expect(uiSource).toContain("canonicalProfileUrl?: string | null;");
    expect(uiSource).toContain("const profileHref =");
  });

  it("Admin users view prefers canonical public profile URLs when available", () => {
    const routesSource = read("server/routes.ts");
    const uiSource = read("client/src/pages/admin-users.tsx");

    expect(routesSource).toContain("canonicalProfileUrl:");
    expect(uiSource).toContain("canonicalProfileUrl?: string | null;");
    expect(uiSource).toContain("window.location.assign(");
    expect(uiSource).toContain("user.canonicalProfileUrl");
  });

  it("Provider discovery points prefer canonical public profile URLs when available", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain(
      "const canonicalProfileUrlByProviderId = new Map<string, string>()"
    );
    expect(routesSource).toContain(
      "canonicalProfileUrlByProviderId.get(String(row.providerId)) ??"
    );
  });
});
