import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
}

describe("first-use guidance production smoke", () => {
  it("renders launcher options and route map from guidance constants", () => {
    const source = read("client/src/lib/firstUseGuidance.ts");
    expect(source).toContain('label: "Fix or improve my home"');
    expect(source).toContain('label: "Keep track of my home"');
    expect(source).toContain('label: "Create a local work request"');
    expect(source).toContain('label: "Review local activity"');
    expect(source).toContain('label: "Continue something I started"');
    expect(source).toContain('label: "Just looking"');

    expect(source).toContain('href: "/homes"');
    expect(source).toContain('href: "/direct-connect"');
    expect(source).toContain('href: "/scout"');
    expect(source).toContain('href: "/scout?tab=continue"');
  });

  it("supports launcher dismiss and restore behavior", () => {
    const source = read("client/src/components/guidance/FirstUsefulStepLauncher.tsx");
    expect(source).toContain('const DISMISS_KEY = "ts:first-use-launcher:dismissed:v1"');
    expect(source).toContain("Dismiss");
    expect(source).toContain("Show choices");
    expect(source).toContain('window.localStorage.setItem(DISMISS_KEY, "1")');
    expect(source).toContain("window.localStorage.removeItem(DISMISS_KEY)");
  });

  it("shows state-based prompts on HomeID and Direct Connect without blocking the Scout snapshot", () => {
    const resolverSource = read("client/src/lib/firstUseTaskPrompts.ts");
    expect(resolverSource).toContain("Add one home detail.");
    expect(resolverSource).toContain("Add a system or component.");
    expect(resolverSource).toContain("Create request details when you need work done.");
    expect(resolverSource).toContain("Start a local work request.");
    expect(resolverSource).toContain(
      "Link a HomeID to keep this request attached to the right home."
    );
    expect(resolverSource).toContain("Review your HomeID updates.");
    expect(resolverSource).toContain("Review saved context.");

    const homesSource = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    const directConnectSource = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const scoutSource = read("client/src/scout/ScoutHome.tsx");
    expect(homesSource).toContain("homeIdFirstTaskPrompt.message");
    expect(homesSource).toContain("homeIdFirstTaskPrompt.ctaLabel");
    expect(homesSource).toContain("trackFirstUseTaskPromptClicked({");
    expect(homesSource).toContain('data-testid="homeid-first-task-prompt"');
    expect(directConnectSource).toContain("directConnectFirstTaskPrompt.message");
    expect(scoutSource).not.toContain("contextualPrompt={scoutFirstTaskPrompt}");
    expect(scoutSource).toContain("<ScoutControlSnapshot");
    expect(scoutSource).toContain('data-testid="scout-control-snapshot"');
    expect(scoutSource).not.toContain("<LocalCommandCenter");
    expect(scoutSource).not.toContain("<CommunitySnapshot");
  });

  it("avoids banned internal language in first-use guidance surfaces", () => {
    const surfaces = [
      read("client/src/lib/firstUseGuidance.ts"),
      read("client/src/lib/firstUseTaskPrompts.ts"),
      read("client/src/components/guidance/FirstUsefulStepLauncher.tsx"),
      read("client/src/components/guidance/FirstUseGuidanceCard.tsx"),
      read("client/src/pages/home.tsx"),
    ]
      .join("\n")
      .toLowerCase();

    const banned = [
      "scout helps",
      "scout recommends",
      "ask scout",
      "action surface",
      "handoff",
      "decision packet",
      "context capture",
      "bidirectional",
    ];

    for (const phrase of banned) {
      expect(surfaces).not.toContain(phrase);
    }
  });
});
