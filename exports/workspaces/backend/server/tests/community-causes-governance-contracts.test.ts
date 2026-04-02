import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("community causes governance contracts", () => {
  it("storage keeps weighted proportional cause vote outputs", () => {
    const storageSource = read("server/storage.ts");
    const integrationTestSource = read(
      "server/tests/community-causes-allocation.integration.test.ts"
    );

    expect(storageSource).toContain("computeCommunityCauseVoteWeight");
    expect(storageSource).toContain("weightedVoteTotal");
    expect(storageSource).toContain("allocationShare");
    expect(storageSource).toContain("voteWeight");
    expect(storageSource).toContain("listCommunityCausesByProfile");
    expect(storageSource).toContain("voteForCommunityCause");

    expect(integrationTestSource).toContain("returns allocation shares summing to exactly 100.00");
    expect(integrationTestSource).toContain("expect(totalShare).toBe(100)");
    expect(integrationTestSource).toContain(
      "keeps duplicate vote submissions idempotent for the same user/cause"
    );
    expect(integrationTestSource).toContain(
      "keeps concurrent duplicate vote submissions idempotent"
    );
    expect(integrationTestSource).toContain("expect(second.voteCount).toBe(first.voteCount)");
    expect(integrationTestSource).toContain(
      "expect(afterRows).toHaveLength(beforeRows.length + 1)"
    );
    expect(integrationTestSource).toContain("expect(uniqueVoteIds.size).toBe(1)");
  });

  it("causes route enforces platform curator cause creation", () => {
    const causesRouteSource = read("server/routes/community-causes-routes.ts");

    expect(causesRouteSource).toContain("PLATFORM_CAUSE_CURATOR_ROLES");
    expect(causesRouteSource).toContain("Platform curator access required to create causes");
    expect(causesRouteSource).not.toContain("Community Builder badge required to create causes");
  });

  it("causes vote response exposes weighted representation fields", () => {
    const causesRouteSource = read("server/routes/community-causes-routes.ts");
    const routeContractTestSource = read("server/tests/community-causes-route-contract.test.ts");
    const routeIntegrationTestSource = read(
      "server/tests/community-causes-route-integration.test.ts"
    );

    expect(causesRouteSource).toContain("weightedVoteTotal: result.weightedVoteTotal");
    expect(causesRouteSource).toContain("allocationShare: result.allocationShare");
    expect(causesRouteSource).toContain("voteWeight: result.voteWeight");

    expect(routeContractTestSource).toContain(
      "returns weighted representation fields from vote endpoint"
    );
    expect(routeContractTestSource).toContain(
      "allows cause creation only for platform curator roles"
    );
    expect(routeContractTestSource).toContain(
      "keeps repeated vote responses stable when storage vote handling is idempotent"
    );
    expect(routeIntegrationTestSource).toContain(
      "returns profile causes with allocation shares summing to exactly 100.00"
    );
    expect(routeIntegrationTestSource).toContain(
      "returns profile causes in deterministic newest-first order"
    );
    expect(routeIntegrationTestSource).toContain(
      "returns zero weighted totals and zero allocation shares when no votes exist"
    );
    expect(routeIntegrationTestSource).toContain("expect(totalShare).toBe(100)");
    expect(routeIntegrationTestSource).toContain("expect(totalShare).toBe(0)");
    expect(routeIntegrationTestSource).toContain(
      "expect(res.body.map((cause: any) => cause.id)).toEqual([causeIds[2], causeIds[1], causeIds[0]])"
    );
  });

  it("community builder causes UI shows weighted representation metrics", () => {
    const profileCommunitySource = read("client/src/pages/community-builder/profile-community.tsx");

    expect(profileCommunitySource).toContain("Causes (Weighted Representation)");
    expect(profileCommunitySource).toContain("Representation share:");
    expect(profileCommunitySource).toContain("normalized to 100.00% after rounding");
    expect(profileCommunitySource).toContain("Vote weight");
    expect(profileCommunitySource).not.toContain("Create a cause (owner-only)");
  });

  it("contribution flows keep checkout routed to vault and avoid payout status UI", () => {
    const contributionDetailSource = read(
      "client/src/pages/community-builder/contribution-detail.tsx"
    );
    const contributionSuccessSource = read(
      "client/src/pages/community-builder/contribution-success.tsx"
    );

    expect(contributionDetailSource).toContain("payoutToVault: true");
    expect(contributionDetailSource).not.toContain("Route to builder");
    expect(contributionDetailSource).not.toContain("Payout Status");

    expect(contributionSuccessSource).not.toContain("Payout Status");
    expect(contributionSuccessSource).not.toContain("Pending linkage");
  });
});
