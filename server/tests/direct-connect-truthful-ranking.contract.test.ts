import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Direct Connect truthful ranking contract", () => {
  it("does not assign optimistic provider evidence constants", () => {
    const route = read("server/routes/direct-connect.ts");
    const scorer = read("server/services/directConnectProviderFitScore.ts");

    for (const fabricatedDefault of [
      "verificationScore: requirements ? 0.8 : 0.6",
      "verificationScore: 0.65",
      "verificationScore: 0.55",
      "responseRate: 0.6",
      "responseRate: 0.55",
      "responseRate: 0.5",
      "recommendationTrust: 0.45",
      "recommendationTrust: 0.4",
    ]) {
      expect(route).not.toContain(fabricatedDefault);
    }
    expect(scorer).not.toContain("input.verificationScore ??");
    expect(scorer).not.toContain("input.responseRate ??");
    expect(scorer).not.toContain("input.recommendationTrust ??");
  });

  it("persists nullable evidence instead of converting unknown to false", () => {
    const service = read("server/services/directConnectDispatchLedgerService.ts");
    const migration = read("migrations/0112_nullable_direct_connect_candidate_evidence.sql");

    expect(service).toContain("territoryMatched: boolean | null");
    expect(service).toContain("categoryMatched: boolean | null");
    expect(service).toContain("contactEligibility: boolean | null");
    expect(service).toContain("territory_matched boolean NULL");
    expect(service).toContain("ALTER COLUMN territory_matched DROP NOT NULL");
    expect(service).toContain("ALTER COLUMN category_matched DROP NOT NULL");
    expect(service).toContain("ALTER COLUMN contact_eligibility DROP NOT NULL");
    expect(migration).toContain("ALTER COLUMN territory_matched DROP NOT NULL");
    expect(migration).toContain("ALTER COLUMN category_matched DROP NOT NULL");
    expect(migration).toContain("ALTER COLUMN contact_eligibility DROP NOT NULL");
  });
});
