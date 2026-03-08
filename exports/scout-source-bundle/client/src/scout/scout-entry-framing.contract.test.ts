import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("Scout entry framing contracts", () => {
  it("header frames Scout as the operating layer and focuses on outcomes", () => {
    const source = read("client/src/scout/ScoutHeader.tsx");

    expect(source).toContain("TradeScout • Scout Operating Layer");
    expect(source).toContain("What local outcome are you trying to move forward");
    expect(source).toContain(
      "Scout will interpret the need, explain the next step, and keep action governed."
    );
  });

  it("input row and quick-start surfaces use operating-flow language", () => {
    const inputSource = read("client/src/scout/ScoutInputRow.tsx");
    const osSource = read("client/src/scout/ScoutOS.tsx");

    expect(inputSource).toContain("Flow options");
    expect(inputSource).toContain("Auto-open obvious next steps");
    expect(inputSource).toContain(
      "Describe the local outcome, problem, or task you need to move forward"
    );
    expect(osSource).toContain("Start with Scout");
    expect(osSource).toContain(
      "Pick the operating path that matches what you need to move forward right now."
    );
    expect(osSource).toContain("Start here");
  });

  it("thread and quick-start actions avoid internal controller framing", () => {
    const threadSource = read("client/src/scout/ScoutThread.tsx");
    const tilesSource = read("client/src/scout/scoutActionTiles.ts");

    expect(threadSource).toContain("Why this answer");
    expect(threadSource).toContain("Next steps");
    expect(threadSource).toContain("Keep going");
    expect(threadSource).not.toContain("Controller actions");
    expect(tilesSource).toContain('label: "Start a governed local request"');
    expect(tilesSource).toContain('label: "Find the right local providers"');
  });
});
