import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("onboarding flow contracts", () => {
  it("routes profile normalization into intent confirmation before exiting setup", () => {
    const profileSource = read("client/src/pages/onboarding-profile.tsx");

    expect(profileSource).toContain(
      "return `/onboarding/intent?next=${encodeURIComponent(next)}`;"
    );
    expect(profileSource).toContain("navigate(buildIntentRoute(postProfileNext));");
    expect(profileSource).toContain(
      "if ((anyUser.onboardingCompleted as boolean | undefined) === true)"
    );
  });

  it("marks onboarding complete from the intent step", () => {
    const intentSource = read("client/src/pages/onboarding-intent.tsx");

    expect(intentSource).toContain('apiRequest("POST", "/api/user/complete-onboarding", {})');
    expect(intentSource).toContain("onSuccess: (_data, intent) => {");
    expect(intentSource).toContain("navigate(postIntentNext || routeForIntent(intent));");
  });
});
