import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("Scout home personalization contracts", () => {
  it("enforces no context, no feed", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain("Nothing to continue yet.");
    expect(source).toContain(
      "Search once, save something, or start a request and Scout will keep it here."
    );
    expect(source).toContain("const hasRealContinuation = continueItems.length > 0;");
    expect(source).toContain("const hasCategorySelectionOrSearch = interests.size > 0;");
    expect(source).toContain(
      "const hasPersonalizedScoutContext = hasRealContinuation || hasCategorySelectionOrSearch;"
    );
    expect(source).toContain(
      "const hasPersonalizedFeed = hasPersonalizedScoutContext && nearbyRows.length > 0;"
    );
    expect(source).toContain("const shouldShowEmptyContext = !hasPersonalizedScoutContext;");
    expect(source).toContain(
      "const [onboardingStatus, setOnboardingStatus] = useState<UnifiedOnboardingState | null>(null);"
    );
    expect(source).toContain(
      'const res = await fetch("/api/onboarding/status", { credentials: "include" });'
    );
    expect(source).toContain("<ScoutControlSnapshot");
    expect(source).toContain('data-testid="scout-control-snapshot"');
    expect(source).toContain("if (interests.size === 0) return [];");
    expect(source).toContain("if (!isLikelyPersonalActivityQuery(activity.query)) continue;");
    expect(source).toContain(
      "const interests = inferUserInterestCategories(continueItems, data?.recentActivity ?? []);"
    );
    expect(source).toContain("const NON_PERSONAL_ACTIVITY_PHRASES = [");
    expect(source).toContain("home prices shifted nearby");
    expect(source).toContain("median home price");
  });

  it("keeps onboarding state available without rendering another dashboard card", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain("if (!isAuthenticated || !onboardingStatus) return false;");
    expect(source).toContain("if (!lane) return false;");
    expect(source).toContain('if (lane === "browse_only") {');
    expect(source).toContain("if (isCompleted) return false;");
    expect(source).toContain('return params.get("resumeSetup") === "1";');
    expect(source).toContain("return !isCompleted || Boolean(onboardingStatus.nextStep);");
    const renderedHome = source.slice(source.lastIndexOf("return ("));
    expect(renderedHome).not.toContain("<SetupNudgeCard");
  });

  it("contains lane-specific nudge copy", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain("Finish setting up your home");
    expect(source).toContain("Add your vehicle");
    expect(source).toContain("Complete your service profile");
    expect(source).toContain("Create your first listing");
    expect(source).toContain("Set your local interests");
    expect(source).toContain('actionPrompt: "Open /homes to add my home profile."');
    expect(source).toContain('actionPrompt: "Open /vehicles to add my vehicle."');
    expect(source).toContain(
      'actionPrompt: "Open /exchange/new so I can create my first listing."'
    );
  });

  it("rejects generic continuity labels", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain("home project");
    expect(source).toContain("vehicle service");
    expect(source).toContain("saved search");
    expect(source).toContain("local request");
    expect(source).toContain("client work");
    expect(source).toContain("local help");
    expect(source).toContain("if (!looksLikeRealDisplayTitle(objectTitle)) return false;");
  });

  it("exposes real work, conversations, HomeID, activity, and Community in one compact snapshot", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain("Open work");
    expect(source).toContain("Conversations");
    expect(source).toContain("HomeID");
    expect(source).toContain("Recent activity");
    expect(source).toContain("recentActivity.length + continuationCount");
    expect(source).toContain("Community");
    expect(source).toContain("Pick up where you left off");
    expect(source).toContain("if (items.length === 0) return null");
    expect(source).toContain(
      'const res = await fetch("/api/direct-connect/requests", { credentials: "include" });'
    );
    expect(source).toContain('const res = await fetch("/api/homes", { credentials: "include" });');
    expect(source).toContain("fetchCommunityPostsForScout({");
    expect(source).toContain("buildCommunityPostPath(post.id)");
    expect(source).toContain("onNavigate={navigate}");
    expect(source).toContain("You review every next step.");
    expect(source).not.toContain("Ask Scout to");
  });

  it("renders one control snapshot and leaves the full site as direct destinations", () => {
    const homeSource = read("client/src/scout/ScoutHome.tsx");
    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");

    expect(homeSource).not.toContain("What should we solve?");
    expect(homeSource).toContain("<ScoutControlSnapshot");
    const renderedHome = homeSource.slice(homeSource.lastIndexOf("return ("));
    expect(renderedHome).not.toContain("<LocalCommandCenter");
    expect(renderedHome).not.toContain("<CommunitySnapshot");
    expect(renderedHome).not.toContain("<LocalSnapshot");
    expect(renderedHome).not.toContain("<ContinueRail");
    expect(homeSource).toContain('route: "/homes"');
    expect(homeSource).toContain('route: "/vehicles"');
    expect(homeSource).toContain('route: "/direct-connect"');
    expect(homeSource).toContain('route: "/exchange"');
    expect(homeSource).toContain('route: "/find-local-businesses"');
    expect(homeSource).toContain('route: "/community-feed"');
    expect(scoutOsSource).toContain("const showDiscoveryRail = false");
    expect(scoutOsSource).toContain("quickStartPrompts={SCOUT_QUICK_START_PROMPTS}");
    expect(scoutOsSource).toContain("const shouldPlayIntroDemo = false;");
    expect(scoutOsSource).toContain('autoDemoText=""');
    expect(scoutOsSource).not.toContain("What can TradeScout do in my local area?");
    expect(scoutOsSource).not.toContain("best 3 starting actions");
  });

  it("scopes nearby rows to user interests and dedupes by category and title", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain("filter((row) => interests.has(row.category))");
    expect(source).toContain("const key = `${row.category}:${row.title.trim().toLowerCase()}`;");
    expect(source).not.toContain("fallback-1");
    expect(source).not.toContain("fallback-2");
    expect(source).not.toContain("fallback-3");
    expect(source).not.toContain("fallback-4");
  });

  it("keeps no-context Scout free of filler modules", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain("Home prices shifted nearby");
    expect(source).toContain("Homes are sitting longer");
    expect(source).toContain("if (items.length === 0) return null;");
    const renderedHome = source.slice(source.lastIndexOf("return ("));
    expect(renderedHome).not.toContain("<NearbyList");
    expect(renderedHome).not.toContain("<ContinueRail");
    expect(renderedHome).not.toContain("<LocalSnapshot");
    expect(renderedHome).not.toContain("<EmptyContextHint");
  });
});
