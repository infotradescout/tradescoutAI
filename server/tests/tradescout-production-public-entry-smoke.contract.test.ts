import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("TradeScout production public-entry freshness smoke contract", () => {
  const script = () => read("scripts/tradescout-production-public-entry-smoke.mjs");

  it("is wired as an explicit operator-run smoke script", () => {
    const pkg = JSON.parse(read("package.json"));

    expect(pkg.scripts["smoke:production-public-entry"]).toBe(
      "node scripts/tradescout-production-public-entry-smoke.mjs"
    );
    expect(script()).toContain("RUN_TRADESCOUT_PRODUCTION_PUBLIC_ENTRY_SMOKE");
    expect(script()).toContain("TRADESCOUT_PUBLIC_BASE_URL");
    expect(script()).toContain("TRADESCOUT_PRODUCTION_ORIGIN");
    expect(script()).toContain("TRADESCOUT_EXPECTED_COMMIT");
    expect(script()).toContain("normalizedFinalUrl === normalizedOrigin");
  });

  it("checks live public entry routes for current rendered public-entry behavior", () => {
    const source = script();
    const forbiddenBlock = source.match(/const forbiddenCopy = \[(.*?)\];/s)?.[1] || "";

    expect(source).toContain('const publicEntryPaths = ["/", "/landing", "/lp"]');
    expect(source).toContain("TradeScoutBot production public-entry freshness smoke");
    expect(source).toContain("Connection Without Compromise");
    expect(source).toContain("Direct Connect");
    expect(source).toContain("Make A Request");
    expect(source).toContain("Claim my business");
    expect(source).toContain("Made you look");
    expect(source).toContain("free forever");
    expect(source).toContain('href="/direct-connect?source=landing_primary_cta"');
    expect(source).toContain('href="/claim-my-business?source=landing_business"');

    expect(source).toContain("Ask Scout");
    expect(source).toContain("Search with Scout");
    expect(source).toContain("Scout chatbot");
    expect(source).toContain("lead marketplace");
    expect(source).toContain("lead-selling");
    expect(source).toContain("tool catalog");
    expect(source).toContain("standalone tools");
    expect(source).toContain("routing algorithm");
    expect(source).toContain("authority layer");
    expect(source).toContain("handoff doctrine");
    expect(source).toContain("backend routing system");
    expect(source).toContain("operating system architecture");
    expect(forbiddenBlock).not.toContain("Direct Connect");
  });

  it("keeps the smoke read-only and tied to production build identity", () => {
    const source = script();

    expect(source).toContain('method: "GET"');
    expect(source).toContain("x-tradescout-build");
    expect(source).toContain("/api/version");
    expect(source).toContain("/api/public/config");
    expect(source).toContain("git");
    expect(source).toContain("rev-parse");

    expect(source).not.toMatch(/\bmethod:\s*"(POST|PUT|PATCH|DELETE)"/);
    expect(source).not.toContain("TRADESCOUT_REQUESTER_COOKIE");
    expect(source).not.toContain("TRADESCOUT_PROVIDER_COOKIE");
    expect(source).not.toContain("DATABASE_URL");
  });
});
