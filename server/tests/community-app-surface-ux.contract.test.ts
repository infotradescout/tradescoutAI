import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const communitySurfaceFiles = [
  "client/src/pages/community.tsx",
  "client/src/pages/community-feed.tsx",
  "client/src/components/community/CommunityCTA.tsx",
  "client/src/components/community/CommunityComposerInline.tsx",
  "client/src/components/community/CommunityEmptyState.tsx",
  "client/src/components/community/CommunityPostCard.tsx",
  "client/src/components/community/CommunitySnapshotRail.tsx",
  "client/src/components/community/ContactOutcomeModal.tsx",
  "client/src/components/community/DecisionCard.tsx",
  "client/src/components/community/ScoutRecommendationCard.tsx",
];

describe("Community app surface UX contract", () => {
  it("keeps Community visible copy out of AI/system explanation framing", () => {
    const source = communitySurfaceFiles.map((file) => read(file)).join("\n\n");

    const bannedVisiblePhrases = [
      "Draft imported from Scout",
      "Scout recommendation",
      "How Scout governs this decision right now",
      "Scout policy indicates",
      "Scout policy blocks",
      "Authority verified by Scout policy",
      "Confidence:",
      "Trust Request",
      "Trust Signal",
      "Use Scout to nominate",
      "Quick Connect",
      "Community Snapshot",
      "Scout or your neighbors can help",
      "Get help from Scout or locals",
      "community assistant",
      "AI helper",
      "decision engine",
      "routing matrix",
      "lead marketplace",
      "best contractor",
    ];

    for (const phrase of bannedVisiblePhrases) {
      expect(source, `Community surface should not expose "${phrase}"`).not.toContain(phrase);
    }
  });

  it("keeps the Community app surface anchored to local activity actions", () => {
    const feed = read("client/src/pages/community-feed.tsx");
    const community = read("client/src/pages/community.tsx");

    expect(feed).toContain("Local activity");
    expect(feed).toContain("Browse updates, ask a question, or start a request.");
    expect(feed).toContain("Start a post");
    expect(community).toContain("Local updates, questions, and projects.");
    expect(community).toContain("Draft ready");
  });
});
