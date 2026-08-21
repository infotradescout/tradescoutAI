import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("Scout home personalization contracts", () => {
  it("renders one compact control snapshot and no filler modules", () => {
    const source = read("client/src/scout/ScoutHome.tsx");
    const renderedHome = source.slice(source.lastIndexOf("return ("));

    expect(source).toContain("<ScoutControlSnapshot");
    expect(source).toContain('data-testid="scout-control-snapshot"');
    expect(source).toContain("if (items.length === 0) return null;");
    expect(renderedHome).toContain("<ScoutHero");
    expect(renderedHome).toContain("{primaryOutcomeInput}");
    expect(renderedHome).toContain("<ScoutControlSnapshot");
    expect(renderedHome.indexOf("{primaryOutcomeInput}")).toBeLessThan(
      renderedHome.indexOf("<ScoutControlSnapshot")
    );
    expect(renderedHome).not.toContain("<LocalCommandCenter");
    expect(renderedHome).not.toContain("<CommunitySnapshot");
    expect(renderedHome).not.toContain("<LocalSnapshot");
    expect(renderedHome).not.toContain("<ContinueRail");
    expect(renderedHome).not.toContain("<NearbyList");
    expect(renderedHome).not.toContain("<SetupNudgeCard");
    expect(renderedHome).not.toContain("<EmptyContextHint");
  });

  it("builds the snapshot only from real account and location data", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain('fetch("/api/direct-connect/requests"');
    expect(source).toContain('fetch("/api/homes"');
    expect(source).toContain("fetchCommunityPostsForScout({");
    expect(source).toContain('enabled: location.status === "resolved" && Boolean(location.fips)');
    expect(source).toContain("recentActivity: data?.recentActivity ?? []");
    expect(source).toContain("args.recentActivity.length + args.continuationCount");
    expect(source).not.toContain('fetch("/api/onboarding/status"');
    expect(source).not.toContain("UnifiedOnboardingState");
    expect(source).not.toContain("ObjectiveOnboardingBundle");
    expect(source).not.toContain("fallback-1");
    expect(source).not.toContain("fallback-2");
  });

  it("rejects generic continuity labels instead of manufacturing activity", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain("home project");
    expect(source).toContain("vehicle service");
    expect(source).toContain("saved search");
    expect(source).toContain("local request");
    expect(source).toContain("client work");
    expect(source).toContain("local help");
    expect(source).toContain("if (!looksLikeRealDisplayTitle(objectTitle)) return false;");
    expect(source).toContain("getMeaningfulContinuations(continuationThreads)");
  });

  it("exposes real work, conversations, HomeID, activity, and Community as direct actions", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain("Open work");
    expect(source).toContain("Conversations");
    expect(source).toContain("HomeID");
    expect(source).toContain("Recent activity");
    expect(source).toContain("Community");
    expect(source).toContain("Pick up where you left off");
    expect(source).toContain('onNavigate("/direct-connect")');
    expect(source).toContain("onClick: onContinueConversation");
    expect(source).toContain('onNavigate("/homes")');
    expect(source).toContain('onNavigate("/community-feed")');
    expect(source).toContain("onNavigate={navigate}");
    expect(source).toContain("onContinuationSelect(meaningfulContinuations[0].id)");

    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");
    expect(scoutOsSource).toContain("onContinuationSelect={(threadId) => {");
    expect(scoutOsSource).toContain("handleLoadSavedThread(thread)");
  });

  it("does not present freshness or location controls without supporting evidence", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain("detail: `${snapshot.communityPostCount} nearby`");
    expect(source).not.toContain("detail: `${snapshot.communityPostCount} new`");
    expect(source).toContain("{locationLabel ? (");
    expect(source).not.toContain('t("scout.setLocation")');
    expect(source).not.toContain("ChevronDown");
  });

  it("describes current Scout capability without claiming the unfinished intelligence layer", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain("understand codes and permits");
    expect(source).toContain("price the work");
    expect(source).toContain("compare options");
    expect(source).toContain("You review every next step.");
    expect(source).not.toContain("world-premier");
    expect(source).not.toContain("world premier");
    expect(source).not.toContain("expert in every trade");
    expect(source).not.toContain("Ask Scout to");
  });

  it("keeps the empty-state demo disabled in ScoutOS", () => {
    const source = read("client/src/scout/ScoutOS.tsx");

    expect(source).toContain("const showDiscoveryRail = false");
    expect(source).toContain("quickStartPrompts={SCOUT_QUICK_START_PROMPTS}");
    expect(source).toContain("const shouldPlayIntroDemo = false;");
    expect(source).toContain('autoDemoText=""');
    expect(source).not.toContain("What can TradeScout do in my local area?");
    expect(source).not.toContain("best 3 starting actions");
  });
});
