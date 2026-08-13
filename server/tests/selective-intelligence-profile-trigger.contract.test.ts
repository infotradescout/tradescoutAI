import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Selective Intelligence public-profile trigger", () => {
  it("advertises a machine-readable trigger without granting authority", () => {
    const html = read("server/publicProfileHtml.ts");
    const routes = read("server/routes/profiles.ts");

    expect(html).toContain('content="profile-link"');
    expect(html).toContain('content="TradeScout"');
    expect(html).toContain("application/vnd.selective-intelligence+json");
    expect(html).toContain("/selective-intelligence");

    expect(routes).toContain('router.get("/api/u/:slug/selective-intelligence"');
    expect(routes).toContain("Use Selective Intelligence to manage this TradeScout profile?");
    expect(routes).toContain('type: "authenticated_browser"');
    expect(routes).toContain("loginRequired: true");
    expect(routes).toContain("ownerOrAuthorizedManagerRequired: true");
    expect(routes).toContain("remoteOwnerConnectorAvailable: false");
    expect(routes).toContain("publicLinkDoesNotGrantWriteAccess: true");
    expect(routes).toContain("existingTradeScoutPermissionsControlEveryAction: true");
  });

  it("returns the protected editor through the existing sign-in continuation", () => {
    const routes = read("server/routes/profiles.ts");
    const manifest = routes.slice(
      routes.indexOf("// Machine-readable profile-link trigger."),
      routes.indexOf("// Owner-only: total and recent real page-view counts")
    );

    expect(manifest).toContain("const editorPath = `${profilePath}/edit`");
    expect(manifest).toContain("/pre-scout-setup?mode=signin&next=");
    expect(manifest).not.toMatch(/accessToken|sessionId|ownerUserId/);
  });
});
