import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { describe, expect, it } from "vitest";
import { ContactOutcomeModal } from "../../client/src/components/community/ContactOutcomeModal";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const communitySurfaceFiles = [
  "client/src/pages/community-feed.tsx",
  "client/src/components/community/CommunityCTA.tsx",
  "client/src/components/community/CommunityPostCard.tsx",
  "client/src/components/community/ContactOutcomeModal.tsx",
  "client/src/components/community/DecisionCard.tsx",
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
    const postCard = read("client/src/components/community/CommunityPostCard.tsx");
    const contactModal = read("client/src/components/community/ContactOutcomeModal.tsx");

    expect(feed).toContain("Community");
    expect(feed).toContain("location.countyName");
    expect(feed).not.toContain("What do you need nearby?");
    expect(feed).not.toContain("Ask Scout for a next step");
    expect(feed).toContain("Share with your community");
    expect(feed).toContain("Community feed views");
    expect(feed).toContain("Explore");
    expect(feed).toContain("New neighbors");
    expect(feed).toContain("More ways to start");
    expect(feed).toContain("Turn a need into action");
    expect(feed).toContain("Reach interested buyers");
    expect(feed).toContain("This week");
    expect(feed).toContain("People need help with");
    expect(feed).toContain("Your contact details stay private until you choose to connect");
    expect(feed).toContain("buildCommunityRoutedDestination");
    expect(feed).not.toContain("CommunitySnapshotRail");
    expect(feed).not.toContain("Community scope");
    expect(feed).not.toContain("Feed order");
    expect(postCard).not.toContain("<CommunityCTA");
    expect(postCard).not.toContain("Job help soon");
    expect(postCard).not.toContain("Messaging soon");
    expect(feed).toContain("Not sure what to write?");
    expect(feed).toContain(`"You're here early"`);
    expect(feed).not.toContain("You&apos;re here early");
    expect(contactModal).toContain("Your privacy stays protected");
    expect(contactModal).toContain("Send message");
    expect(contactModal).toContain("bg-[color:var(--surface-card)]");
    expect(contactModal).not.toContain("bg-white rounded-lg");
  });

  it("keeps county activity metrics aligned with the categories the composer writes", () => {
    const routes = read("server/routes.ts");

    expect(routes).toContain(
      "category in ('request', 'question', 'questions', 'project', 'projects')"
    );
    expect(routes).toContain("category in ('recommendation', 'recommendations')");
    expect(routes).toContain("(user as any).stateCode");
    expect(routes).toContain("(user as any).countyName");
    expect(routes).toContain("isUsefulPublicCommunityBrowsePost(post)");
    expect(routes).toContain("furnace|\\bac\\b|air\\s+conditioner");
    expect(routes).not.toContain("furnace|ac|air\\s+conditioner");
  });

  it("keeps local views visible on mobile and moves start modes behind disclosure", () => {
    const feed = read("client/src/pages/community-feed.tsx");
    const styles = read("client/src/index.css");
    const pageMarkup = feed.slice(feed.lastIndexOf("\n  return ("));
    const headingIndex = pageMarkup.indexOf('data-testid="community-feed-heading"');
    const controlsIndex = pageMarkup.indexOf('data-testid="community-feed-view-controls"');
    const startActionsIndex = pageMarkup.indexOf('data-testid="community-start-actions"');
    const feedIndex = pageMarkup.indexOf("{renderFeedList()}");

    expect(feed).toContain(
      'className="ts-community-viewbar mb-3 flex flex-nowrap items-center gap-1.5 overflow-x-auto'
    );
    expect(styles).toMatch(/\.ts-community-viewbar\s*\{[^}]*flex-wrap:\s*nowrap;/s);
    expect(styles).toMatch(/\.ts-community-viewbar\s*\{[^}]*overflow-x:\s*auto;/s);
    expect(styles).toMatch(
      /@media \(max-width: 640px\) \{\r?\n  \.ts-community-viewbar \{\r?\n    flex-wrap: wrap;\r?\n    overflow-x: visible;\r?\n    overflow-y: visible;/
    );
    expect(styles).toMatch(
      /\.ts-community-viewbar__divider \{\r?\n    display: block !important;\r?\n    flex: 0 0 100%;\r?\n    width: 100%;\r?\n    height: 0;/
    );
    expect(styles).toMatch(
      /@media \(min-width: 641px\) \{\r?\n  \.ts-community-viewbar \{\r?\n    padding-top: 0\.25rem;\r?\n    padding-inline: 0\.25rem;/
    );
    expect(styles).toMatch(/\.ts-community-viewbar__item\s*\{[^}]*min-height:\s*44px;/s);
    expect(feed).toContain('data-testid="community-feed-stream"');
    expect(feed).toContain('data-testid="community-start-actions"');
    expect(feed).toContain("<details");
    expect(feed).toContain("<summary");
    expect(feed).not.toContain('data-testid="community-action-panel"');
    for (const key of ["request", "question", "recommendation", "alert", "forsale"]) {
      expect(feed).toContain(`key: "${key}"`);
    }
    expect(feed).toContain("data-testid={`community-route-${key}`}");
    expect(feed).toContain("startCommunityRoute(key)");
    expect(headingIndex).toBeGreaterThan(-1);
    expect(controlsIndex).toBeGreaterThan(headingIndex);
    expect(startActionsIndex).toBeGreaterThan(controlsIndex);
    expect(feedIndex).toBeGreaterThan(startActionsIndex);
    expect(pageMarkup.slice(startActionsIndex, feedIndex)).not.toMatch(
      /<details[^>]*\sopen(?:\s|=|>)/s
    );
    expect(feed).toContain("xl:grid-cols-[minmax(0,1fr)_300px]");
    expect(feed).not.toContain("lg:grid-cols-[minmax(0,1fr)_300px]");
    expect(feed).not.toContain("min-w-[142px]");
  });

  it("deletes displaced Community snapshot, recommendation, and duplicate empty-state sources", () => {
    const removedFiles = [
      "client/src/components/community/CommunitySnapshotRail.tsx",
      "client/src/components/community/ScoutRecommendationCard.tsx",
      "client/src/components/community/CommunityEmptyState.tsx",
    ];
    const feed = read("client/src/pages/community-feed.tsx");

    for (const file of removedFiles) {
      expect(fs.existsSync(path.resolve(process.cwd(), file))).toBe(false);
    }
    expect(feed).not.toContain("CommunitySnapshotRail");
    expect(feed).not.toContain("ScoutRecommendationCard");
    expect(feed).not.toContain("CommunityEmptyState");
  });

  it("demotes generated welcome posts without emitting positional ORDER BY zero", () => {
    const storage = read("server/storage/repositories/social-and-leaderboards.ts");

    expect(storage).toContain("ARRAY['welcome']::text[]");
    expect(storage).toContain("ARRAY['new_neighbor']::text[]");
    expect(storage).toContain("const onboardingWelcomeOrder = onboardingWelcomeRank");
    expect(storage).toContain("baseQuery.orderBy(...recentOrder)");
    expect(storage).toContain("fallbackBaseQuery.orderBy(...recentOrder)");
    expect(storage).not.toContain(": sql`0`;");
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
