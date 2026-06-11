import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PUBLIC_SURFACE_FILES = [
  "client/src/pages/landing.tsx",
  "client/src/pages/landingVariants.ts",
  "client/src/pages/TradeScoutLandingPage.tsx",
  "client/src/pages/TradeScoutLandingPage.css",
  "client/src/AppRoutes.tsx",
] as const;

const CANONICAL_PUBLIC_LANDING = "client/src/pages/TradeScoutLandingPage.tsx";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

const readPublicSurfaceCorpus = () => PUBLIC_SURFACE_FILES.map((file) => read(file)).join("\n\n");

describe("TradeScout public copy doctrine contracts", () => {
  it("keeps required public doctrine phrases", () => {
    const landing = read(CANONICAL_PUBLIC_LANDING);
    const corpus = readPublicSurfaceCorpus();

    expect(landing).toContain("Connection Without Compromise");
    expect(landing).toContain("Start a Request");
    expect(landing).toContain("Claim Provider Profile");
    expect(landing).toContain("Direct Connect");

    const normalized = corpus.toLowerCase();
    expect(normalized).toContain("direct connect");
    expect(normalized).toContain("request");
    expect(normalized).toContain("community");
    expect(normalized.includes("profile") || normalized.includes("claim")).toBe(true);
    expect(normalized).toContain("connection");
  });

  it("rejects lead-marketplace framing drift in public copy", () => {
    const normalized = readPublicSurfaceCorpus().toLowerCase();

    expect(normalized).not.toContain("lead marketplace");
    expect(normalized).not.toContain("lead generation marketplace");
    expect(normalized).not.toContain("lead-selling");
    expect(normalized).not.toContain("buy leads");
    expect(normalized).not.toContain("sell leads");
    expect(normalized).not.toContain("contractor lead marketplace");
  });

  it("rejects disconnected-tool and chatbot framing drift in public copy", () => {
    const normalized = readPublicSurfaceCorpus().toLowerCase();

    expect(normalized).not.toContain("tool catalog");
    expect(normalized).not.toContain("collection of tools");
    expect(normalized).not.toContain("standalone tools");
    expect(normalized).not.toContain("generic saas tool bundle");

    const separateAppsIndexes = [...normalized.matchAll(/separate apps/g)].map(
      (match) => match.index ?? -1
    );

    for (const index of separateAppsIndexes) {
      const windowStart = Math.max(0, index - 100);
      const windowEnd = Math.min(normalized.length, index + 140);
      const contextWindow = normalized.slice(windowStart, windowEnd);
      const isAllowedContext =
        contextWindow.includes("inside the os") ||
        contextWindow.includes("surfaces inside the os") ||
        contextWindow.includes("not");

      expect(isAllowedContext).toBe(true);
    }

    expect(normalized).not.toContain("ask scout");
    expect(normalized).not.toContain("scout chatbot");
    expect(normalized).not.toContain("chat with scout");
    expect(normalized).not.toContain("ai chatbot");
    expect(normalized).not.toContain("virtual assistant");
  });

  it("allows Direct Connect as product copy while blocking internal architecture framing", () => {
    const normalizedLanding = read(CANONICAL_PUBLIC_LANDING).toLowerCase();

    expect(normalizedLanding).not.toContain("routing algorithm");
    expect(normalizedLanding).not.toContain("authority layer");
    expect(normalizedLanding).not.toContain("handoff doctrine");
    expect(normalizedLanding).not.toContain("backend routing system");
    expect(normalizedLanding).not.toContain("internal operating system architecture");
    expect(normalizedLanding).not.toContain("operating system architecture");
  });
});
