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
});
