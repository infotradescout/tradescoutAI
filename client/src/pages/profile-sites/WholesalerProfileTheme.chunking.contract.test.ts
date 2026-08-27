import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const profileThemePath = path.resolve(
  process.cwd(),
  "client/src/pages/profile-sites/WholesalerProfileTheme.tsx"
);
const jwProfilePath = path.resolve(
  process.cwd(),
  "client/src/pages/profile-sites/JwStoneMarketplaceProfile.tsx"
);

describe("JW Stone catalog chunk ownership", () => {
  it("keeps the full inventory out of the shared public-profile chunk", () => {
    const profileThemeSource = fs.readFileSync(profileThemePath, "utf8");
    const jwProfileSource = fs.readFileSync(jwProfilePath, "utf8");

    expect(profileThemeSource).toContain('lazy(() => import("./JwStoneMarketplaceProfile"))');
    expect(profileThemeSource).not.toContain('from "@/features/jw-stone/');
    expect(jwProfileSource).toContain('from "@/features/jw-stone/JWStoneMarketplace"');
  });
});
