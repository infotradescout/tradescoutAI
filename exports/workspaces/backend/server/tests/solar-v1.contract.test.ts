import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function read(relativePath: string): string {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
}

describe("Solar v1 authority and gating contracts", () => {
  it("keeps provider estimate endpoint gated by auth + contractor role", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain(
      'app.post("/api/solar/provider/estimate", isAuthenticated, isContractor'
    );
    expect(routesSource).toContain("if (!isSolarV1Enabled())");
  });

  it("exposes a read-only public solar price range endpoint", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain('app.get("/api/public/solar/price-range"');
    expect(routesSource).toContain('res.setHeader("Cache-Control", "public, max-age=300');
  });

  it("documents non-contact posture in solar service output notes", () => {
    const serviceSource = read("server/services/solarInsightsService.ts");

    expect(serviceSource).toContain(
      "No direct homeowner contact is granted by this estimate path."
    );
    expect(serviceSource).toContain("Contact remains gated through TradeScout decision pathways.");
  });
});
