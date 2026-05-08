import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("Scout entry framing contracts", () => {
  it("header frames Scout as a casual starting point", () => {
    const source = read("client/src/scout/ScoutHeader.tsx");

    expect(source).toContain("Start with Scout");
    expect(source).toContain("What are you trying to get done");
    expect(source).toContain("Pick a starting point or type it in");
    expect(source).toContain("Find help");
    expect(source).toContain("Estimate cost");
    expect(source).toContain("Check permits");
  });

  it("input row and quick-start surfaces use plain language", () => {
    const inputSource = read("client/src/scout/ScoutInputRow.tsx");
    const promptsSource = read("client/src/scout/scoutQuickStartPrompts.ts");

    expect(inputSource).toContain("I want to remodel a bathroom");
    expect(inputSource).toContain("Tell Scout");
    expect(inputSource).toContain("Review");
    expect(inputSource).toContain("Choose");
    expect(inputSource).toContain("Your area:");
    expect(inputSource).toContain("Use current location");
    expect(promptsSource).toContain("Help me find the right local help");
    expect(promptsSource).toContain("Help me figure out cost and timing");
    expect(promptsSource).toContain("What's my next step?");
  });

  it("thread and quick-start actions avoid internal controller framing", () => {
    const threadSource = read("client/src/scout/ScoutThread.tsx");
    const tilesSource = read("client/src/scout/scoutActionTiles.ts");

    expect(threadSource).toContain("Why this answer");
    expect(threadSource).toContain("Next steps");
    expect(threadSource).toContain("Keep going");
    expect(threadSource).not.toContain("Controller actions");
    expect(tilesSource).toContain('label: "Start a local request"');
    expect(tilesSource).toContain('label: "Find local pros"');
    expect(tilesSource).toContain('label: "Browse Exchange"');
  });
});
