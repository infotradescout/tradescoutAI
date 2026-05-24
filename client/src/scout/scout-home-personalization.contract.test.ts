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
      "{hasRealContinuation ? <ContinueRail items={continueItems} onPromptSelect={onPromptSelect} /> : null}"
    );
    expect(source).toContain(
      "{hasPersonalizedFeed ? <NearbyList rows={nearbyRows} onPromptSelect={onPromptSelect} /> : null}"
    );
    expect(source).toContain(
      "{shouldShowSnapshot ? <LocalSnapshot snapshot={data?.snapshot} /> : null}"
    );
    expect(source).toContain("{shouldShowEmptyContext ? <EmptyContextHint /> : null}");
    expect(source).toContain("if (interests.size === 0) return [];");
    expect(source).toContain("if (isGenericContinuityLabel(activity.query)) continue;");
    expect(source).toContain(
      "const interests = inferUserInterestCategories(continueItems, data?.recentActivity ?? []);"
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
    expect(source).toContain(
      "{hasPersonalizedFeed ? <NearbyList rows={nearbyRows} onPromptSelect={onPromptSelect} /> : null}"
    );
    expect(source).toContain("const shouldShowEmptyContext = !hasPersonalizedScoutContext;");
  });
});
