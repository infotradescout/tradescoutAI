import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("affiliate sharing from verified profile domains", () => {
  it("stores the exact custom-domain destination while keeping the short link on TradeScout", () => {
    const routes = fs.readFileSync(path.resolve(process.cwd(), "server/routes.ts"), "utf8");

    expect(routes).toContain("if (!isSafeAffiliateShareDestination(destination))");
    expect(routes).toContain(
      "const destinationOrigin = await resolveAffiliateOriginForRequest("
    );
    expect(routes).toContain(
      "destinationOrigin === baseOrigin ? baseOrigin : resolvePublicOrigin(req)"
    );
    expect(routes).toContain("const full = new URL(destination, destinationOrigin);");
    expect(routes).toContain("shortUrl: `${shortLinkOrigin}/r/");
  });
});
