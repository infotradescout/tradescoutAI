import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildTrustSnapshotsInsertSql } from "../services/trustSnapshotsScoringSql.mjs";
import { TRUST_SNAPSHOTS_VERSION } from "../services/trustSnapshotsJob";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("community action reflection → Profile CVS consolidation", () => {
  it("bumps trust snapshot scoring to v5 with community reputation inputs", () => {
    expect(TRUST_SNAPSHOTS_VERSION).toBe(5);
    const sql = buildTrustSnapshotsInsertSql({ forceOverwrite: true });
    expect(sql).toContain("community_reputation_signals");
    expect(sql).toContain("community_debate_signals");
    expect(sql).toContain("community_moderation_signals");
    expect(sql).toContain("community_reputation_delta");
    expect(sql).toContain("distinct_likers");
    expect(sql).toContain("debate_threads");
    expect(sql).toContain("adverse_outcomes");
    expect(sql).toContain("community_moderation_adverse");
  });

  it("only counts upheld adverse moderation outcomes, not pending reports", () => {
    const sql = buildTrustSnapshotsInsertSql({ forceOverwrite: true });
    expect(sql).toContain("content_removed");
    expect(sql).toContain("warning_issued");
    expect(sql).toContain("status IN ('resolved', 'escalated')");
    expect(sql).not.toMatch(
      /adverse_outcomes[\s\S]*status\s*=\s*'pending'|status\s*=\s*'pending'[\s\S]*adverse_outcomes/
    );
  });

  it("caps community reputation contribution (anti-gaming)", () => {
    const sql = buildTrustSnapshotsInsertSql({ forceOverwrite: true });
    expect(sql).toContain("LEAST(4, community_distinct_likers)");
    expect(sql).toContain("LEAST(3, community_distinct_commenters)");
    expect(sql).toContain("LEAST(2, community_debate_threads)");
    expect(sql).toContain("LEAST(12, community_adverse_outcomes * 4)");
  });

  it("wires canonical community routes through reflectCommunityAction", () => {
    const routes = read("server/routes.ts");
    const helper = read("server/services/communityActionReflection.ts");
    expect(helper).toContain("export async function reflectCommunityAction");
    expect(routes).toContain('from "./services/communityActionReflection"');
    expect(routes).toContain("EventTypes.POST_CREATED");
    expect(routes).toContain("EventTypes.POST_LIKED");
    expect(routes).toContain("EventTypes.COMMENT_CREATED");
    expect(routes).toContain("EventTypes.MODERATION_REPORT_FILED");
  });

  it("keeps moderation visibility score separate from Profile CVS dictionary rule", () => {
    const dictionary = read("docs/scoring-dictionary.md");
    expect(dictionary).toContain("community_reputation_delta");
    expect(dictionary).toContain("moderation_community_score");
    expect(dictionary).toMatch(
      /moderation_community_score[\s\S]*Not allowed to influence:[\s\S]*provider CVS directly/
    );
  });
});
