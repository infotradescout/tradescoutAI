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
    expect(source).toContain("{hasRealContinuation ? (");
    expect(source).toContain(
      "<ContinueRail items={continueItems} onPromptSelect={onPromptSelect} />"
    );
    expect(source).toContain("{hasPersonalizedFeed ? (");
    expect(source).toContain("<NearbyList rows={nearbyRows} onPromptSelect={onPromptSelect} />");
    expect(source).toContain(
      "{shouldShowSnapshot ? <LocalSnapshot snapshot={data?.snapshot} /> : null}"
    );
    expect(source).toContain("{shouldShowEmptyContext ? <EmptyContextHint /> : null}");
    expect(source).toContain("if (interests.size === 0) return [];");
    expect(source).toContain("if (!isLikelyPersonalActivityQuery(activity.query)) continue;");
    expect(source).toContain(
      "const interests = inferUserInterestCategories(continueItems, data?.recentActivity ?? []);"
    );
    expect(source).toContain("const NON_PERSONAL_ACTIVITY_PHRASES = [");
    expect(source).toContain("home prices shifted nearby");
    expect(source).toContain("median home price");
  });

  it("shows onboarding setup nudges only when authenticated status exists and is incomplete", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain("if (!isAuthenticated || !onboardingStatus) return false;");
    expect(source).toContain("if (!lane) return false;");
    expect(source).toContain('if (lane === "browse_only") {');
    expect(source).toContain("if (isCompleted) return false;");
    expect(source).toContain('return params.get("resumeSetup") === "1";');
    expect(source).toContain("return !isCompleted || Boolean(onboardingStatus.nextStep);");
    expect(source).toContain("{shouldShowSetupNudge && setupNudge ? (");
    expect(source).toContain(
      "<SetupNudgeCard config={setupNudge} onPromptSelect={onPromptSelect} />"
    );
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

  it("exposes Scout as a local snapshot and action surface", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain("Local command center");
    expect(source).toContain("Your local snapshot");
    expect(source).toContain("Open Direct Connect requests");
    expect(source).toContain("HomeID reminders");
    expect(source).toContain("Recent activity");
    expect(source).toContain("Suggested next actions");
    expect(source).toContain("Search local help, requests, homes, and activity.");
    expect(source).toContain(
      'const res = await fetch("/api/direct-connect/requests", { credentials: "include" });'
    );
    expect(source).toContain('const res = await fetch("/api/homes", { credentials: "include" });');
    expect(source).toContain(
      "<LocalCommandCenter snapshot={localCommandSnapshot} onPromptSelect={onPromptSelect} />"
    );
    expect(source).toContain("You review before anything is shared.");
    expect(source).not.toContain("Ask Scout to");
  });

  it("keeps the first Scout choice clear while preserving deeper tools", () => {
    const homeSource = read("client/src/scout/ScoutHome.tsx");
    const scoutOsSource = read("client/src/scout/ScoutOS.tsx");

    expect(homeSource).toContain("What should we solve?");
    expect(homeSource).toContain("Find local help");
    expect(homeSource).toContain("Check a price");
    expect(homeSource).toContain("Start a request");
    expect(homeSource).toContain("See nearby activity");
    expect(homeSource).toContain('title="Your activity"');
    expect(homeSource).toContain('title="More ways to use Scout"');
    expect(homeSource).toContain("function ProgressiveSection");
    expect(homeSource).toContain("<details");
    expect(homeSource).toContain("<ExploreGrid onPromptSelect={onPromptSelect} />");
    expect(scoutOsSource).toContain("Fine-tune your search");
    expect(scoutOsSource).toContain("Optional filters, sources, and timing");
    expect(scoutOsSource).toContain('<details className="scout-v2-rail-card group">');
    expect(scoutOsSource).toContain("Review before contact");
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

  it("locks no-context screen against home metric filler copy", () => {
    const source = read("client/src/scout/ScoutHome.tsx");

    expect(source).toContain("Home prices shifted nearby");
    expect(source).toContain("Homes are sitting longer");
    expect(source).toContain("<NearbyList rows={nearbyRows} onPromptSelect={onPromptSelect} />");
    expect(source).toContain("const shouldShowEmptyContext = !hasPersonalizedScoutContext;");
    expect(source).toContain(
      "<ContinueRail items={continueItems} onPromptSelect={onPromptSelect} />"
    );
    expect(source).toContain(
      "const hasPersonalizedFeed = hasPersonalizedScoutContext && nearbyRows.length > 0;"
    );
    expect(source).toContain("const shouldShowSnapshot =");
    expect(source).toContain("Nothing to continue yet.");
  });
});
