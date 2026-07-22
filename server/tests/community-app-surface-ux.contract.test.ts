import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { describe, expect, it } from "vitest";
import { ContactOutcomeModal } from "../../client/src/components/community/ContactOutcomeModal";
import { ScoutRecommendationCard } from "../../client/src/components/community/ScoutRecommendationCard";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const communitySurfaceFiles = [
  "client/src/pages/community-feed.tsx",
  "client/src/components/community/CommunityCTA.tsx",
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
      "Local hub",
      "Search local context",
      "Start request",
      "Checking options...",
      "Add details first",
      "Contact readiness",
      "Request context checked.",
      "Confirm & Send",
      "No posts here yet",
      "Unavailable",
    ];

    for (const phrase of bannedVisiblePhrases) {
      expect(source, `Community surface should not expose "${phrase}"`).not.toContain(phrase);
    }
  });

  it("anchors Community in human outcomes and inviting early states", () => {
    const feed = read("client/src/pages/community-feed.tsx");
    const emptyState = read("client/src/components/community/CommunityEmptyState.tsx");
    const snapshotRail = read("client/src/components/community/CommunitySnapshotRail.tsx");
    const contactModal = read("client/src/components/community/ContactOutcomeModal.tsx");

    expect(feed).toContain("What do you need nearby?");
    expect(feed).toContain("Ask Scout for a next step");
    expect(feed).toContain("Ask Scout");
    expect(feed).toContain("Start a request");
    expect(feed).toContain("What would you like to share?");
    expect(feed).toContain("Not sure what to write?");
    expect(feed).toContain("You&apos;re here early");
    expect(emptyState).toContain("You&apos;re here early");
    expect(snapshotRail).toContain("Local offers are coming soon");
    expect(snapshotRail).toContain("Coming soon");
    expect(snapshotRail).toContain("Try again");
    expect(contactModal).toContain("Your privacy stays protected");
    expect(contactModal).toContain("Send message");
    expect(contactModal).toContain("bg-[color:var(--surface-card)]");
    expect(contactModal).not.toContain("bg-white rounded-lg");
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

    expect(html).toContain("Local match");
    expect(html).toContain("Review before contact");
    expect(html).toContain("Why this appears");
    expect(html).toContain("Jordan Lee");
  });

  it("renders contact review as a readable TradeScout surface", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const staticLocationHook = (): [string, (path: string) => void] => [
      "/community-feed",
      () => undefined,
    ];
    const staticSearchHook = () => "";

    const html = renderToStaticMarkup(
      React.createElement(
        Router,
        { hook: staticLocationHook, searchHook: staticSearchHook },
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(ContactOutcomeModal, {
            outcome: {
              targetUserId: "user_1",
              targetUserName: "Jordan Lee",
              targetRole: "Local business owner",
              targetLocation: "Fort Worth",
              suggestedIntent: "collaborate",
              reasonForContact: "I'd like to talk about working together locally.",
              decisionScope: "community",
              decisionTitle: "Community post follow-up",
              riskFlags: [],
            },
            onClose: () => undefined,
          })
        )
      )
    );

    expect(html).toContain("Send a message to Jordan Lee");
    expect(html).toContain("Your privacy stays protected");
    expect(html).toContain("Send message");
    expect(html).toContain("bg-[color:var(--surface-card)]");
    expect(html).not.toContain("Confirm &amp; Send");
    expect(html).not.toContain("bg-white rounded-lg");
  });
});
