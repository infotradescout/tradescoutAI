import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("universal attribution ref contract", () => {
  it("defines strict fail-closed ref target rules", () => {
    const source = read("server/utils/universalAttributionRef.ts");

    expect(source).toContain('BLOCKED_TARGET_PREFIXES = ["/admin", "/staff", "/api", "/ref"]');
    expect(source).toContain("isDefaultLookingAffiliateTag");
    expect(source).toContain("MISSING_TARGET");
    expect(source).toContain("INVALID_TARGET");
    expect(source).toContain("UNKNOWN_TAG");
  });

  it("keeps click attribution separate from payout/payment logic", () => {
    const source = read("server/utils/universalAttributionRef.ts").toLowerCase();

    expect(source).not.toContain("commission");
    expect(source).not.toContain("payout");
    expect(source).not.toContain("stripe");
    expect(source).not.toContain("paymentintent");
  });

  it("registers GET /ref/:tag using the universal click handler", () => {
    const routes = read("server/routes.ts");

    expect(routes).toContain('app.get("/ref/:tag"');
    expect(routes).toContain("handleUniversalAttributionClick({");
    expect(routes).toContain('source: "universal_ref"');
    expect(routes).not.toContain("/ref/:tag/share");
  });
});
