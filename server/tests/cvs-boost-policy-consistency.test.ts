import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const poolQuery = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({
  pool: { query: poolQuery },
}));

import {
  CVS_BOOST_POINTS_CAP,
  CVS_BOOST_POLICIES,
  getActiveCvsBoosts,
} from "../services/cvsBoostPolicy";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("CVS boost policy consistency", () => {
  beforeEach(() => {
    poolQuery.mockReset();
  });

  it("uses registry points for the public breakdown and applies the score cap", async () => {
    poolQuery.mockResolvedValue({
      rows: Array.from({ length: 12 }, (_, index) => ({
        policy_key: "verified_profile_launch",
        // Ledger metadata cannot override the audited registry value.
        points: 999 + index,
        expires_at: null,
      })),
    });

    const boosts = await getActiveCvsBoosts("owner-1", new Date("2026-07-18T12:00:00.000Z"));

    expect(boosts.reduce((sum, boost) => sum + boost.points, 0)).toBe(CVS_BOOST_POINTS_CAP);
    expect(boosts).toHaveLength(10);
    expect(boosts.every((boost) => boost.points === 10)).toBe(true);
  });

  it("deduplicates grants and evaluates grants, expiry, and revocation at the requested time", async () => {
    poolQuery.mockResolvedValue({ rows: [] });
    const asOf = new Date("2026-06-01T00:00:00.000Z");

    await getActiveCvsBoosts("owner-2", asOf);

    const [query, params] = poolQuery.mock.calls[0];
    expect(query).toContain("PARTITION BY g.entity_id, g.metadata ->> 'grantKey'");
    expect(query).toContain("WHERE g.grant_rank = 1");
    expect(query).toContain("g.created_at <= $6");
    expect(query).toContain("g.expires_at::timestamptz > $6");
    expect(query).toContain("r.created_at <= $6");
    expect(params[5]).toEqual(asOf);
  });

  it("keeps the snapshot scorer on the same keys, points, dedupe rule, and cap", () => {
    const scoring = read("server/services/trustSnapshotsScoringSql.mjs");

    Object.values(CVS_BOOST_POLICIES).forEach((policy) => {
      expect(scoring).toContain(`('${policy.key}', ${policy.points}::numeric)`);
    });
    expect(scoring).toContain("INNER JOIN cvs_boost_policy p");
    expect(scoring).toContain("PARTITION BY g.entity_id, g.metadata ->> 'grantKey'");
    expect(scoring).toContain("WHERE g.grant_rank = 1");
    expect(scoring).toContain("LEAST(100, SUM(points)) AS boost_points");
    expect(scoring).toContain(
      "ELSE LEAST(100, GREATEST(0, 50 + n.performance_delta)) + n.cvs_boost_points"
    );
    expect(scoring).not.toContain(
      "ELSE LEAST(100, GREATEST(0, 50 + n.performance_delta) + n.cvs_boost_points)"
    );
    expect(scoring).not.toContain("(g.metadata ->> 'points')::numeric AS points");
  });

  it("keeps inactive profile-compatibility targets out of scoring and collapses multi-business owners", () => {
    const scoring = read("server/services/trustSnapshotsScoringSql.mjs");
    const contractorSignals = scoring.slice(
      scoring.indexOf("contractor_signals AS ("),
      scoring.indexOf("provider_local_signals AS (")
    );

    expect(contractorSignals).toMatch(
      /FROM contractors\s+WHERE user_id IS NOT NULL\s+AND is_active IS TRUE\s+GROUP BY user_id/
    );
    expect(scoring).toContain("LEFT JOIN contractor_signals c ON c.user_id = u.id");
    expect(scoring).not.toContain("LEFT JOIN contractors c ON c.user_id = u.id");
  });

  it("reconciles the historical snapshot boost layer to current active policy boosts", () => {
    const routes = read("server/routes/profiles.ts");
    expect(routes).toContain("const lifetimeTrustSnapshotScope = and(");
    expect(routes).toMatch(
      /\.where\(lifetimeTrustSnapshotScope\)\s*\.orderBy\(asc\(trustSnapshots\.computedAt\)\)/
    );
    const scoreRead = routes.slice(
      routes.indexOf("const snapshotCvsScore"),
      routes.indexOf("const ownerPreferences")
    );

    expect(scoreRead).toContain("getActiveCvsBoosts(ownerUserId, latestTrustSnapshot.computedAt)");
    expect(scoreRead).toContain("getActiveCvsBoosts(ownerUserId, currentBoostAsOf)");
    expect(scoreRead).toContain("snapshotBoostEligible");
    expect(scoreRead).toContain("if (!snapshotBoostEligible)");
    expect(scoreRead).toContain("snapshotCvsScore - snapshotCvsBoostPoints");
    expect(scoreRead).toContain("publicCvsScore = snapshotCvsScore");
    expect(scoreRead).toContain("publicCvsPerformanceScore +");
    expect(scoreRead).toContain("activeCvsBoosts.reduce");
    expect(scoreRead).toContain(
      "const prior30DayScore = Number(prior30DayTrustSnapshot?.cvsScore)"
    );
  });

  it("keeps the documented performance cap separate from additive audited boosts", () => {
    const scoringDictionary = read("docs/scoring-dictionary.md");
    const trustSnapshots = read("docs/trust-snapshots.md");
    const schema = read("shared/schema.ts");

    expect(scoringDictionary).toContain("The performance component uses `0-100`");
    expect(scoringDictionary).toContain("a policy boost is the only allowed path above 100");
    expect(trustSnapshots).toContain("The live performance score is clamped to `0-100`");
    expect(trustSnapshots).toContain(
      "only mechanism allowed to take the displayed CVS total above `100`"
    );
    expect(schema).toContain(
      "Performance is capped at 100; audited policy boosts may make the total exceed 100."
    );
  });
});
