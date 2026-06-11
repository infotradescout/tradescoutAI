import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SYSTEM_MAP_PATH = "TRADESCOUT_SYSTEM_MAP.md";

const readSystemMap = () => {
  const fullPath = path.resolve(process.cwd(), SYSTEM_MAP_PATH);
  return fs.readFileSync(fullPath, "utf-8");
};

const countMatches = (source: string, pattern: RegExp) => [...source.matchAll(pattern)].length;

describe("TradeScout system map OS doctrine contract", () => {
  it("keeps required OS architecture sections", () => {
    const source = readSystemMap();

    expect(source).toContain("## TradeScout OS Principle");
    expect(source).toContain("## Shared Context Layer");
    expect(source).toContain("## Tool Handoff Rules");
    expect(source).toContain("## Primary Tools");
    expect(source).toContain("## Supporting Services");
    expect(source).toContain("## User-Facing Navigation");
    expect(source).toContain("## Internal System Ownership Matrix");
  });

  it("keeps per-system architecture fields across all system entries", () => {
    const source = readSystemMap();

    const purposeCount = countMatches(source, /^Purpose:/gm);
    const userJobCount = countMatches(source, /^User job:/gm);
    const inputsCount = countMatches(source, /^Inputs:/gm);
    const outputsCount = countMatches(source, /^Outputs:/gm);
    const dependenciesCount = countMatches(source, /^Dependencies:/gm);
    const handoffCount = countMatches(source, /^Handoff behavior:/gm);

    expect(purposeCount).toBeGreaterThanOrEqual(12);
    expect(userJobCount).toBeGreaterThanOrEqual(12);
    expect(inputsCount).toBeGreaterThanOrEqual(12);
    expect(outputsCount).toBeGreaterThanOrEqual(12);
    expect(dependenciesCount).toBeGreaterThanOrEqual(12);
    expect(handoffCount).toBeGreaterThanOrEqual(12);
  });

  it("preserves core OS doctrine and explicit handoff chain", () => {
    const source = readSystemMap();

    expect(source).toContain("one operating system");
    expect(source).toContain("shared context");
    expect(source).toContain("Canonical handoff chain:");
    expect(source).toContain("Community -> Scout");
    expect(source).toContain("Scout -> Decision Cards");
    expect(source).toContain("Decision Cards -> Direct Connect");
    expect(source).toContain("Direct Connect -> HomeID");
  });

  it("rejects weak standalone-tool framing drift", () => {
    const source = readSystemMap();
    const normalized = source.toLowerCase();

    expect(normalized).not.toContain("tool catalog");
    expect(normalized).not.toContain("standalone tools");
    expect(normalized).not.toContain("collection of tools");

    const separateAppsIndexes = [...normalized.matchAll(/separate apps/g)].map(
      (match) => match.index ?? -1
    );

    for (const index of separateAppsIndexes) {
      const windowStart = Math.max(0, index - 80);
      const windowEnd = Math.min(normalized.length, index + 120);
      const contextWindow = normalized.slice(windowStart, windowEnd);
      const isAllowedContext =
        contextWindow.includes("inside the os") || contextWindow.includes("not");

      expect(isAllowedContext).toBe(true);
    }

    const strongOsFraming =
      countMatches(normalized, /operating system/g) +
      countMatches(normalized, /shared context/g) +
      countMatches(normalized, /handoff/g);

    const weakFraming = countMatches(normalized, /separate apps/g);
    expect(strongOsFraming).toBeGreaterThan(weakFraming);
  });
});
