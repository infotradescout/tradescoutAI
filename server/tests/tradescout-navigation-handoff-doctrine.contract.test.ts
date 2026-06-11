import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const TARGET_FILES = [
  "client/src/config/nav.ts",
  "client/src/AppRoutes.tsx",
  "client/src/pages/landing.tsx",
  "client/src/pages/landingVariants.ts",
  "client/src/lib/postOnboardingRoute.ts",
  "client/src/components/navigation/RoleBasedNavigation.tsx",
] as const;

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

const readAll = () => TARGET_FILES.map((file) => read(file)).join("\n\n");

const countMatches = (source: string, pattern: RegExp) => [...source.matchAll(pattern)].length;

describe("TradeScout navigation and handoff doctrine contracts", () => {
  it("keeps OS framing in user-facing navigation surfaces", () => {
    const routes = read("client/src/AppRoutes.tsx");
    const landingVariants = read("client/src/pages/landingVariants.ts");

    expect(routes).toContain("Scout OS");
    expect(routes).toContain('path="/scout"');
    expect(routes).toContain('path="/direct-connect"');
    expect(routes).toContain('path="/community"');

    expect(landingVariants).toContain("Local Operating System");
    expect(landingVariants).toContain("operating flow");
  });

  it("keeps continuity concepts in nav and handoff copy", () => {
    const source = readAll().toLowerCase();

    expect(source).toContain("request");
    expect(source).toContain("community");
    expect(source.includes("profile") || source.includes("claim")).toBe(true);
    expect(source).toContain("connection");
    expect(source.includes("context") || source.includes("handoff")).toBe(true);
  });

  it("rejects disconnected-tool framing in navigation surfaces", () => {
    const source = readAll().toLowerCase();

    expect(source).not.toContain("tool catalog");
    expect(source).not.toContain("collection of tools");
    expect(source).not.toContain("standalone tools");
    expect(source).not.toContain("generic saas tool bundle");

    const separateAppsIndexes = [...source.matchAll(/separate apps/g)].map(
      (match) => match.index ?? -1
    );

    for (const index of separateAppsIndexes) {
      const windowStart = Math.max(0, index - 100);
      const windowEnd = Math.min(source.length, index + 140);
      const contextWindow = source.slice(windowStart, windowEnd);
      const isAllowedContext =
        contextWindow.includes("inside the os") ||
        contextWindow.includes("surfaces inside the os") ||
        contextWindow.includes("not");

      expect(isAllowedContext).toBe(true);
    }

    const strongOsFraming =
      countMatches(source, /operating system/g) +
      countMatches(source, /shared context/g) +
      countMatches(source, /handoff/g);

    const weakFraming =
      countMatches(source, /separate apps/g) +
      countMatches(source, /tool catalog/g) +
      countMatches(source, /collection of tools/g) +
      countMatches(source, /standalone tools/g);

    expect(strongOsFraming).toBeGreaterThan(weakFraming);
  });
});
