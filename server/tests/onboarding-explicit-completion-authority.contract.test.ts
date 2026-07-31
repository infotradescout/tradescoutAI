import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isOutcomeOnboardingComplete } from "@shared/onboardingCompletion";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("explicit onboarding completion authority", () => {
  it("accepts only the explicit boolean flag", () => {
    expect(isOutcomeOnboardingComplete({ onboardingCompleted: true })).toBe(true);
    expect(isOutcomeOnboardingComplete({ onboardingCompleted: false })).toBe(false);
    expect(isOutcomeOnboardingComplete({})).toBe(false);
    expect(isOutcomeOnboardingComplete(null)).toBe(false);
  });

  it("uses the shared boolean authority in server participation and OAuth gates", () => {
    const auth = read("server/auth.ts");
    const routes = read("server/routes.ts");
    const guard = auth.slice(
      auth.indexOf("export const requireOnboardingComplete"),
      auth.indexOf("export const requireRole")
    );

    expect(guard).toContain("isOutcomeOnboardingComplete(anyUser)");
    expect(guard).not.toContain("profileVersion");
    expect(routes.match(/!isOutcomeOnboardingComplete\(anyUser\)/g)).toHaveLength(4);
  });

  it("removes schema-version inference from live client routing gates", () => {
    const files = [
      "client/src/App.tsx",
      "client/src/components/auth/AuthFlow.tsx",
      "client/src/components/profile-setup-redirect.tsx",
      "client/src/pages/TradePartnerCumulusLanding.tsx",
    ];

    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toContain("CURRENT_PROFILE_VERSION");
      expect(source, file).not.toMatch(/profileVersion\s*[<>]=?/);
    }
  });
});
