import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { ScoutRecommendationCard } from "../../client/src/components/community/ScoutRecommendationCard";

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
      "chatbot",
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
    expect(feed).toContain("See what neighbors and local businesses are sharing, then start");
    expect(feed).toContain("you need work done.");
    expect(feed).toContain("Search local context");
    expect(feed).toContain("Start request");
    expect(feed).toContain("Local hub");
    expect(feed).toContain("Share a local update");
    expect(feed).toContain("Start a post");
    expect(community).toContain("Local updates, questions, and projects.");
    expect(community).toContain("Draft ready");
  });

  it("keeps default recommendation cards out of system-level framing", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const html = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(ScoutRecommendationCard, {
          recommendation: {
            recommendationId: "rec_1",
            targetUserId: "user_1",
            targetUserName: "Jordan Lee",
            targetRole: "Electrician",
            targetLocation: "Fort Worth",
            suggestedIntent: "hire",
            reasoning:
              "Internal AI scoring says confidence tier is high from recommendation vector weights.",
            confidenceScore: 0.91,
            confidenceTier: "auto_allow",
            confidenceComponents: {
              expertise_match: 0.95,
              location_match: 0.9,
              trust_signal: 0.86,
              past_success: 0.82,
              availability_match: 0.76,
            },
            riskFlags: ["debug risk flag should stay hidden by default"],
            decisionScope: "system state: mutationAllowed=true",
            createdAt: new Date("2026-06-15T00:00:00.000Z"),
          },
        })
      )
    );

    const defaultVisibleForbiddenTerms = [
      "assistant",
      "recommendation vector",
      "AI scoring",
      "scoring",
      "confidence",
      "confidence tier",
      "risk flag",
      "mutationAllowed",
      "raw JSON",
      "debug",
      "system state",
      "recommendation engine",
    ];

    for (const term of defaultVisibleForbiddenTerms) {
      expect(
        html.toLowerCase(),
        `Default Community recommendation HTML leaked "${term}"`
      ).not.toContain(term.toLowerCase());
    }

    expect(html).toContain("Recommended pro");
    expect(html).toContain("Review before contact");
    expect(html).toContain("Why this appears");
    expect(html).toContain("Jordan Lee");
  });
});
