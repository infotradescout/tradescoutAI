import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("Scout entry framing contracts", () => {
  it("header frames Scout as site search plus local discovery", () => {
    const source = read("client/src/scout/ScoutHeader.tsx");

    expect(source).toContain("What do you need help with today?");
    expect(source).toContain("find local contractors");
    expect(source).toContain("compare options");
    expect(source).toContain("Fix something");
    expect(source).toContain("Start a project");
    expect(source).toContain("Compare prices");
    expect(source).toContain("Find trusted local help");
    expect(source).toContain("Ask a question");
  });

  it("input row and quick-start surfaces use plain language", () => {
    const inputSource = read("client/src/scout/ScoutInputRow.tsx");
    const promptsSource = read("client/src/scout/scoutQuickStartPrompts.ts");

    expect(inputSource).toContain("AC not cooling");
    expect(inputSource).toContain("Ask");
    expect(inputSource).toContain("Compare");
    expect(inputSource).toContain("Choose");
    expect(inputSource).toContain("Your area:");
    expect(inputSource).toContain("Use current location");
    expect(promptsSource).toContain("What's happening near me today?");
    expect(promptsSource).toContain("Who nearby can help with this?");
    expect(promptsSource).toContain("Any local prices or deals I should know about?");
    expect(promptsSource).toContain("What's my next step?");
  });

  it("thread and quick-start actions avoid internal controller framing", () => {
    const threadSource = read("client/src/scout/ScoutThread.tsx");
    const tilesSource = read("client/src/scout/scoutActionTiles.ts");

    expect(threadSource).toContain("Why this answer");
    expect(threadSource).toContain("Next steps");
    expect(threadSource).toContain("Keep going");
    expect(threadSource).not.toContain("Controller actions");
    expect(tilesSource).toContain('label: "Create a local request"');
    expect(tilesSource).toContain('label: "Find local help"');
    expect(tilesSource).toContain('label: "Browse Exchange"');
  });
});
