import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("public trade SEO rendering contracts", () => {
  it("recent html serves fallback content when activity query fails", () => {
    const source = read("server/publicRecentHtml.ts");
    expect(source).toContain("Recent activity query failed; serving fallback page without items");
    expect(source).toContain("rows = []");
  });

  it("best county html retains its compatibility fallback on discovery-column drift", () => {
    const bestSource = read("server/publicBestHtml.ts");
    expect(bestSource).toContain("Best trade county query failed; serving page without listings");
    expect(bestSource).toContain('isMissingColumnError(error, "public_discovery_enabled")');
  });

  it("trade directory pages expose AI-readable discovery and contact-gating context", () => {
    const tradeSource = read("server/publicTradeHtml.ts");
    const citySource = read("server/publicTradeCityHtml.ts");

    expect(tradeSource).toContain("buildTradeDiscoveryNote");
    expect(tradeSource).toContain("Visibility never grants direct contact access");
    expect(tradeSource).toContain("Local discovery context");
    expect(tradeSource).toContain("protected Direct Connect paths");

    expect(citySource).toContain("buildTradeCityDiscoveryNote");
    expect(citySource).toContain("Visibility does not grant contact access");
    expect(citySource).toContain("protected Direct Connect paths");
  });
});
