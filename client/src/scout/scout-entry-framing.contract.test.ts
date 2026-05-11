import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("Scout entry framing contracts", () => {
  it("header frames Scout as a plain normal user assistant", () => {
    const source = read("client/src/scout/ScoutHeader.tsx");

    expect(source).toContain("What do you need help with today?");
    expect(source).toContain(
      "Scout helps you find local help, compare options, and know what to check before contacting"
    );
    expect(source).toContain("compare options");
    expect(source).toContain("Find local help");
    expect(source).toContain("Ask Scout");
    expect(source).toContain("Check prices");
    expect(source).toContain("See nearby activity");
    expect(source).toContain("Start a material run");
    expect(source).toContain("Open messages");
    expect(source).toContain(
      "Send a material list or supplier link and Scout can help turn it into a Supply Run."
    );
  });

  it("input row and quick-start surfaces use plain language", () => {
    const inputSource = read("client/src/scout/ScoutInputRow.tsx");
    const promptsSource = read("client/src/scout/scoutQuickStartPrompts.ts");

    expect(inputSource).toContain(
      "Tell Scout what happened, what you need, or what you’re trying to figure out."
    );
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

    expect(threadSource).toContain("Why this helps");
    expect(threadSource).toContain("Next steps");
    expect(threadSource).toContain("Keep going");
    expect(threadSource).not.toContain("Controller actions");
    expect(tilesSource).toContain('label: "Create a local request"');
    expect(tilesSource).toContain('label: "Find local help"');
    expect(tilesSource).toContain('label: "Browse Exchange"');
  });

  it("active Scout conversations use a focused result layout", () => {
    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");

    expect(scoutOsSource).toContain("const showDiscoveryRail = !isMobile && !hasUserMessages");
    expect(scoutOsSource).toContain('showDiscoveryRail ? "max-w-7xl" : "max-w-4xl"');
    expect(scoutOsSource).toContain("{showDiscoveryRail && (");
    expect(scoutOsSource).toContain("Findings and recommended paths");
    expect(scoutOsSource).toContain("Recommended paths appear below");
  });

  it("normal user Scout copy hides internal system words", () => {
    const extractQuotedText = (source: string) =>
      Array.from(source.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g), (match) => match[2]).join("\n");

    const visibleCopySources = [
      "client/src/scout/ScoutHeader.tsx",
      "client/src/scout/ScoutInputRow.tsx",
      "client/src/scout/ScoutThread.tsx",
      "client/src/scout/ScoutDirectConnectPanel.tsx",
      "client/src/scout/scoutIntentSorter.ts",
    ]
      .map(read)
      .map(extractQuotedText)
      .join("\n");

    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");
    const scoutOs = extractQuotedText(
      scoutOsSource
        .split("\n")
        .filter((line) => {
          const internalLine =
            line.includes("type:") ||
            line.includes("action.type") ||
            line.includes("payload") ||
            line.includes("metadata") ||
            line.includes("AUTO_ROUTE") ||
            line.includes("routingDecisionCard") ||
            line.includes("syncResult.kind") ||
            line.includes("behaviorKey") ||
            line.includes("route:") ||
            line.includes("const [routing");
          return !internalLine;
        })
        .join("\n")
    );

    const normalUserCopy = `${visibleCopySources}\n${scoutOs}`.toLowerCase();
    const banned = [
      /\broute\b/,
      /\brouting\b/,
      /where scout looks/,
      /scout sorted your search/,
      /likely type/,
      /timing normal/,
      /timing: normal/,
      /tradescout search/,
      /\bsaved request\b/,
      /\bvalidator\b/,
      /call_tool/,
      /\bworkspace\b/,
      /no-op/,
    ];

    for (const term of banned) {
      expect(normalUserCopy).not.toMatch(term);
    }

    expect(scoutOsSource).toContain("How Scout helps");
    expect(scoutOsSource).toContain("Here are the best next steps");
  });
});
