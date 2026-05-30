import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const TARGET_FILES = [
  "client/src/pages/home.tsx",
  "client/src/pages/homes.tsx",
  "client/src/pages/direct-connect/DirectConnectShell.tsx",
  "client/src/scout/ScoutHome.tsx",
  "client/src/scout/ScoutHeader.tsx",
  "client/src/pages/how-it-works.tsx",
  "client/src/pages/landing.tsx",
  "client/src/pages/landingVariants.ts",
  "client/src/pages/scout-info-showcase.tsx",
];

const BANNED_PHRASES = [
  "Scout helps",
  "Scout recommends",
  "Scout says",
  "Ask Scout",
  "Scout AI",
  "AI agent",
  "take action",
  "action surface",
  "handoff preview",
  "decision packet",
  "bidirectional",
  "context capture",
];

function extractStringLiterals(source: string): string {
  const matches = source.match(/(["'`])(?:\\.|(?!\1)[\s\S])*\1/g) || [];
  return matches.join("\n");
}

describe("product language guard", () => {
  it("keeps banned internal phrases out of primary user-facing surfaces", () => {
    for (const relPath of TARGET_FILES) {
      const absPath = path.resolve(process.cwd(), relPath);
      const source = fs.readFileSync(absPath, "utf8");
      const literals = extractStringLiterals(source).toLowerCase();
      for (const banned of BANNED_PHRASES) {
        expect(literals).not.toContain(banned.toLowerCase());
      }
    }
  });
});
