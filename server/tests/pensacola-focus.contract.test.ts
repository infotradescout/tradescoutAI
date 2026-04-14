import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("pensacola focus contracts", () => {
  it("find local businesses page contains pensacola launch focus and query cluster", () => {
    const source = read("client/src/pages/find-local-businesses.tsx");
    expect(source).toContain("Ground Zero Market");
    expect(source).toContain("Pensacola, FL first");
    expect(source).toContain("county=12033");
    expect(source).toContain("HOMEOWNER_POPULAR_QUERIES");
  });

  it("for businesses page contains pensacola onboarding focus and query cluster", () => {
    const source = read("client/src/pages/for-businesses.tsx");
    expect(source).toContain("Launch Focus");
    expect(source).toContain("Pensacola, FL business launch");
    expect(source).toContain("county=12033");
    expect(source).toContain("BUSINESS_POPULAR_QUERIES");
  });
});
