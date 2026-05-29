import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("ScoutCoin panel copy contracts", () => {
  it("has buy button disabled copy until provider is configured", () => {
    const src = read("client/src/components/wallet/ScoutCoinPanel.tsx");
    expect(src).toContain("Buy unavailable until provider is configured");
  });

  it("avoids investment/profit language", () => {
    const src = read("client/src/components/wallet/ScoutCoinPanel.tsx").toLowerCase();
    expect(src).not.toContain("investment");
    expect(src).not.toContain("profit");
    expect(src).not.toContain("roi");
  });
});
