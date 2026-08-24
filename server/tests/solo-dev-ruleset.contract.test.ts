import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rulesetPath = path.resolve(
  process.cwd(),
  "docs/release/minimum-release-ruleset.json"
);

type RulesetRule = {
  type: string;
  parameters?: Record<string, unknown>;
};

describe("solo-developer main ruleset", () => {
  const ruleset = JSON.parse(fs.readFileSync(rulesetPath, "utf8")) as {
    enforcement: string;
    bypass_actors: unknown[];
    conditions: { ref_name: { include: string[] } };
    rules: RulesetRule[];
  };

  it("protects main without requiring a second person or external runner", () => {
    const ruleTypes = ruleset.rules.map((rule) => rule.type);
    const pullRequest = ruleset.rules.find((rule) => rule.type === "pull_request");

    expect(ruleset.enforcement).toBe("active");
    expect(ruleset.conditions.ref_name.include).toContain("refs/heads/main");
    expect(ruleset.bypass_actors).toEqual([]);
    expect(pullRequest?.parameters).toMatchObject({
      allowed_merge_methods: ["merge", "squash", "rebase"],
      required_approving_review_count: 0,
      require_code_owner_review: false,
      require_last_push_approval: false,
      required_review_thread_resolution: true,
    });
    expect(ruleTypes).toEqual([
      "pull_request",
      "deletion",
      "non_fast_forward",
    ]);
  });

  it("blocks destructive main-branch operations", () => {
    const ruleTypes = ruleset.rules.map((rule) => rule.type);

    expect(ruleTypes).toContain("deletion");
    expect(ruleTypes).toContain("non_fast_forward");
  });
});
