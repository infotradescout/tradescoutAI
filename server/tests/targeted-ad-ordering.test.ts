import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const storageSource = readFileSync(new URL("../storage.ts", import.meta.url), "utf8");

describe("targeted ad ordering", () => {
  it("omits the optional affiliate ordering instead of emitting ORDER BY 0", () => {
    const methodStart = storageSource.indexOf("async getTargetedAd(");
    const methodEnd = storageSource.indexOf("async incrementAdImpressions", methodStart);
    const methodSource = storageSource.slice(methodStart, methodEnd);

    expect(methodStart).toBeGreaterThan(-1);
    expect(methodEnd).toBeGreaterThan(methodStart);
    expect(methodSource).toContain(
      "...(preferAffiliate ? [desc(advertisements.isAffiliate)] : [])"
    );
    expect(methodSource).toContain(".orderBy(...adOrdering)");
    expect(methodSource).not.toContain("sql`0`");
  });
});
