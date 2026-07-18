import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile TradeScout handoff", () => {
  const handoffSource = read("client/src/pages/profile-sites/TradeScoutProfileHandoff.tsx");
  const routeSource = read("client/src/AppRoutes.tsx");

  it("offers useful working destinations without creating another contact path", () => {
    for (const href of ["/home", "/scout", "/community-feed", "/exchange", "/homes"]) {
      expect(handoffSource).toContain(href === "/home" ? `href=\"${href}\"` : `href: \"${href}\"`);
      expect(routeSource).toContain(`path=\"${href}\"`);
    }
    expect(handoffSource).not.toContain("Direct Connect");
    expect(handoffSource).not.toMatch(/contact|call|message|request/i);
  });

  it("appears on every paid public-profile theme and the generic profile", () => {
    for (const relativePath of [
      "client/src/pages/profile-sites/LocalServiceProfileTheme.tsx",
      "client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx",
      "client/src/pages/profile-sites/WholesalerProfileTheme.tsx",
      "client/src/pages/ProfileSiteView.tsx",
    ]) {
      expect(read(relativePath), relativePath).toContain("<TradeScoutProfileHandoff");
    }
  });
});
