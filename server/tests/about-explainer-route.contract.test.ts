import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(repoRoot, relativePath), "utf8");
}

describe("TradeScout About explainer route", () => {
  const aboutSource = read("client/src/pages/about.tsx");
  const routesSource = read("client/src/AppRoutes.tsx");

  it("keeps /about routed to the full published explainer", () => {
    expect(routesSource).toContain('<Route path="/about">');
    expect(aboutSource).toContain("https://tradescout.mrplatypus4777.chatgpt.site/");
    expect(aboutSource).toContain('title="About TradeScout — complete system explainer"');
    expect(aboutSource).toContain('canonical="https://www.thetradescout.com/about"');
  });

  it("removes the unsupported legacy About claims", () => {
    expect(aboutSource).not.toContain("15,000+");
    expect(aboutSource).not.toContain("250,000+");
    expect(aboutSource).not.toContain("$50M+");
    expect(aboutSource).not.toContain("Mike Rowe Works Foundation");
  });
});
