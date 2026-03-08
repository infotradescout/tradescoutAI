import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("entry surface operating-system contracts", () => {
  it("landing variant copy frames TradeScout as the local operating system", () => {
    const source = read("client/src/pages/landingVariants.ts");

    expect(source).toContain('badgeText: "Local Operating System"');
    expect(source).toContain('["The Local", "Operating System", "for Community Interaction"]');
    expect(source).toContain("Scout coordinates discovery, trust, intent, decision, and contact");
  });

  it("landing hero and footer preserve operating-system framing", () => {
    const source = read("client/src/pages/landing.tsx");

    expect(source).toContain("Scout is the operating layer for local interaction");
    expect(source).toContain(
      "The local operating system for community interaction. Trust-first local action powered by Scout."
    );
    expect(source).toContain(
      "TradeScout is not a lead funnel. Scout runs the local operating flow from discovery to governed action."
    );
    expect(source).toContain("TradeScout | The Local Operating System for Community Interaction");
  });

  it("global beta notice stays transparent without apologizing for roughness", () => {
    const source = read("client/src/App.tsx");

    expect(source).toContain("TradeScout is being hardened in public.");
    expect(source).not.toContain("Some features may be rough.");
  });
});
