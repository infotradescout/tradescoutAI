import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("pricing analytics real-data fallback contract", () => {
  it("uses real tables for fallback instead of synthetic starter payloads", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "server/pricing-analytics.ts"),
      "utf8"
    );

    expect(source).toContain("from(pricingData)");
    expect(source).toContain("from(workRequests)");
    expect(source).not.toContain("starter");
  });
});
