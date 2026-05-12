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

  it("Scout home exposes the production Scout 2 capability map honestly", () => {
    const homeSource = read("client/src/scout/ScoutHome.tsx");
    const experienceSource = read("client/src/scout/scoutExperience.ts");
    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");

    expect(homeSource).toContain("What Scout can help with");
    expect(homeSource).toContain("SCOUT_CAPABILITY_COPY");
    expect(experienceSource).toContain("Plan work");
    expect(experienceSource).toContain("Collect the right details");
    expect(experienceSource).toContain("Find local help");
    expect(experienceSource).toContain("Materials");
    expect(experienceSource).toContain("Prices and trends");
    expect(experienceSource).toContain("Compare options");
    expect(experienceSource).toContain("Trust checks");
    expect(experienceSource).toContain("Saved conversations");
    expect(experienceSource).toContain("Community activity");
    expect(experienceSource).toContain(
      "I can send a material list or supplier link and Scout can help turn it into a Supply Run."
    );
    expect(experienceSource).toContain("Full Scout view");
    expect(experienceSource).toContain("Materials and local options");
    expect(experienceSource).toContain("Price and trend checks");
    expect(experienceSource).toContain("supplierUrl=");
    expect(experienceSource).toContain("Supplier page read");
    expect(experienceSource).toContain("Supplier page needs review");
    expect(experienceSource).toContain("/finances/materials");
    expect(experienceSource).toContain("Review before anything is sent");
    expect(experienceSource).toContain("Right details only");
    expect(experienceSource).toContain("Exchange activity");
    expect(experienceSource).toContain("Verified local help");
    expect(experienceSource).toContain("Local trend signal");
    expect(scoutOsSource).toContain("sourceSignals: scoutSourceSignalsQuery.data");
    expect(experienceSource).not.toContain("Scout Vault");
    expect(experienceSource).not.toContain("LISA");
  });

  it("documents competitive patterns without importing bad marketplace incentives", () => {
    const matrixSource = read("docs/audits/SCOUT_2_CATCHUP_MATRIX.md");
    const routeSource = read("server/routes/scout.ts");
    const polishSource = read("server/scout/scoutLaunchResponsePolish.ts");

    expect(matrixSource).toContain("Competitive Adoption Map");
    expect(matrixSource).toContain(
      "copy proven interaction patterns, not competitor business models"
    );
    expect(matrixSource).toContain("No lead selling");
    expect(routeSource).toContain("Like Thumbtack");
    expect(routeSource).toContain("Like Yelp");
    expect(routeSource).toContain("Like Google Local Services");
    expect(routeSource).toContain("Like Houzz");
    expect(routeSource).toContain("never imply Scout already booked");
    expect(polishSource).toContain("approval_boundary_added");
    expect(polishSource).toContain(
      "nothing is booked, ordered, paid, messaged, posted, quoted, or invoiced"
    );
  });

  it("Scout 2 catch-up matrix keeps every showcase claim tied to a real state", () => {
    const matrixSource = read("docs/audits/SCOUT_2_CATCHUP_MATRIX.md");
    const featureMatrix = matrixSource
      .split("## Feature Matrix")[1]
      .split("## Competitive Adoption Map")[0];
    const rows = featureMatrix
      .split("\n")
      .filter((line) => line.startsWith("| ") && !line.includes("---"))
      .slice(1);

    expect(rows.length).toBeGreaterThanOrEqual(10);

    for (const row of rows) {
      const cells = row
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);

      expect(cells).toHaveLength(4);
      expect(cells[0]).not.toMatch(/\btbd\b|\bunknown\b/i);
      expect(cells[1]).toMatch(/\b(enforced|partial|policy target|internal only)\b/i);
      expect(cells[2]).not.toMatch(/\btbd\b|\bnone\b|\bunknown\b/i);
      expect(cells[3]).not.toMatch(/\btbd\b|\bunknown\b/i);
    }
  });

  it("thread and quick-start actions avoid internal controller framing", () => {
    const threadSource = read("client/src/scout/ScoutThread.tsx");
    const tilesSource = read("client/src/scout/scoutActionTiles.ts");

    expect(threadSource).toContain("Why this helps");
    expect(threadSource).toContain("Next steps");
    expect(threadSource).toContain("Keep going");
    expect(threadSource).toContain("Here are the best next steps");
    expect(threadSource).toContain("Best next step");
    expect(threadSource).toContain("AssistantMessageBubble");
    expect(threadSource).not.toContain("Controller actions");
    expect(threadSource).not.toContain("Top Recommendation");
    expect(tilesSource).toContain('label: "Create a local request"');
    expect(tilesSource).toContain('label: "Find local help"');
    expect(tilesSource).toContain('label: "Browse Exchange"');
  });

  it("active Scout conversations use a focused result layout", () => {
    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");

    expect(scoutOsSource).toContain("const showDiscoveryRail = !isMobile && !hasUserMessages");
    expect(scoutOsSource).toContain('showDiscoveryRail ? "max-w-7xl" : "max-w-4xl"');
    expect(scoutOsSource).toContain("{showDiscoveryRail && (");
    expect(scoutOsSource).not.toContain("pendingContextCards={scoutContextCards}");
    expect(scoutOsSource).toContain('className="scout-input-bottom-pin order-3"');
    expect(scoutOsSource).toContain("Findings and recommended paths");
    expect(scoutOsSource).toContain("Recommended paths appear below");
    expect(scoutOsSource).toContain("Search saved conversations");
    expect(scoutOsSource).toContain("Related to");
    expect(scoutOsSource).toContain("Open related view");
    expect(scoutOsSource).toContain("relatedPath");
    expect(scoutOsSource).toContain("countyFips");
    expect(scoutOsSource).toContain("/api/scout/conversations?q=");
    expect(scoutOsSource).toContain('title: "Recommended paths"');
  });

  it("Scout shell keeps the composer visible without ambient background bleed", () => {
    const cssSource = read("client/src/index.css");

    expect(cssSource).toContain(".scout-input-bottom-pin");
    expect(cssSource).toContain("position: sticky");
    expect(cssSource).toContain("bottom: 0");
    expect(cssSource).toContain("z-index: 30");
    expect(cssSource).toContain("overflow: clip !important");
    expect(cssSource).toContain(".scout-section-label");
    expect(cssSource).toContain(".scout-section-label__icon");
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
      "client/src/scout/scoutExperience.ts",
    ]
      .map(read)
      .map(extractQuotedText)
      .join("\n");

    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");
    const threadSource = read("client/src/scout/ScoutThread.tsx");
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
    expect(threadSource).toContain("Here are the best next steps");
  });
});
