import { describe, expect, it } from "vitest";
import { derivePresencePlan, type PresencePlanInput } from "../services/presencePlan";

const businessId = "business-1";
const profileId = "profile-1";

function outcome() {
  return {
    kind: "business_profile",
    businessId,
    profileId,
    completedAt: "2026-09-29T00:00:00.000Z",
    provenance: {
      source: "selective_intelligence_onboarding",
      evidence: {
        targetBusinessId: businessId,
        targetProfileId: profileId,
        name: "Example Plumbing",
        notes: "Call 850-555-0100",
        services: ["Drain cleaning"],
        links: ["https://exampleplumbing.com/services?private=secret#fragment"],
        photoUrls: ["https://exampleplumbing.com/photo.jpg"],
      },
      enrichment: {
        output: {
          services: [
            {
              name: "Drain cleaning",
              sourceUrls: ["https://exampleplumbing.com/services?private=secret"],
            },
          ],
        },
      },
    },
  };
}

describe("presence plan", () => {
  it("derives only reviewable source references from persisted onboarding evidence", () => {
    const plan = derivePresencePlan({
      businessId,
      profileId,
      onboardingEvidence: outcome(),
      externalWebsiteUrl: "https://exampleplumbing.com/",
    });

    expect(plan.sitePath).toEqual({
      recommended: "keep_external",
      allowed: ["keep_external", "preserve_migrate"],
      reason: "existing_website",
    });
    expect(plan.evidenceSources).toEqual([
      {
        path: "$.provenance.enrichment.output.services[0]",
        sourceRef: "https://exampleplumbing.com/services",
      },
      {
        path: "$.provenance.evidence.links[0]",
        sourceRef: "https://exampleplumbing.com/services",
      },
    ]);
    expect(plan.quarantinedEvidence.map(({ path, reason }) => ({ path, reason }))).toEqual([
      { path: "$.provenance.evidence.name", reason: "requires_owner_confirmation" },
      { path: "$.provenance.evidence.notes", reason: "requires_owner_confirmation" },
      { path: "$.provenance.evidence.photoUrls", reason: "requires_owner_confirmation" },
      { path: "$.provenance.evidence.services", reason: "requires_owner_confirmation" },
    ]);
    const serialized = JSON.stringify(plan);
    expect(serialized).not.toContain("Example Plumbing");
    expect(serialized).not.toContain("Drain cleaning");
    expect(serialized).not.toContain("850-555-0100");
    expect(serialized).not.toContain("private=secret");
    expect(serialized).not.toContain("externalWebsiteUrl");
  });

  it("is stable across JSON object key order, and changes when canonical evidence changes", () => {
    const original = outcome();
    const input: PresencePlanInput = { businessId, profileId, onboardingEvidence: original };
    const first = derivePresencePlan(input);
    const reordered = JSON.parse(JSON.stringify(original)) as Record<string, unknown>;
    const second = derivePresencePlan({
      businessId,
      profileId,
      onboardingEvidence: Object.fromEntries(Object.entries(reordered).reverse()),
    });
    expect(second.evidenceDigest).toBe(first.evidenceDigest);
    expect(second.planHash).toBe(first.planHash);
    expect(derivePresencePlan(input).planHash).toBe(first.planHash);

    const changedFact = outcome();
    changedFact.provenance.evidence.name = "Changed name";
    const changed = derivePresencePlan({ ...input, onboardingEvidence: changedFact });
    expect(changed.evidenceDigest).not.toBe(first.evidenceDigest);
    expect(changed.planHash).not.toBe(first.planHash);
    const changedWebsite = derivePresencePlan({
      ...input,
      externalWebsiteUrl: "https://another-business.com/",
    });
    expect(changedWebsite.evidenceDigest).not.toBe(first.evidenceDigest);
    expect(changedWebsite.planHash).not.toBe(first.planHash);
  });

  it("has no paid tier branch and leaves every action inert behind named gates", () => {
    const base: PresencePlanInput = { businessId, profileId, onboardingEvidence: outcome() };
    const free = derivePresencePlan({ ...base, tier: "free" } as PresencePlanInput);
    const paid = derivePresencePlan({ ...base, tier: "managed_annual" } as PresencePlanInput);
    expect(free).toEqual(paid);
    expect(free.sitePath).toEqual({
      recommended: "hosted_new",
      allowed: ["hosted_new"],
      reason: "no_existing_website",
    });
    expect(free.actions).toHaveLength(9);
    expect(free.actions.find((action) => action.id === "domain.connect")?.adapterAvailability).toBe(
      "absent"
    );
    for (const proposed of free.actions) {
      expect(proposed.tierNeutral).toBe(true);
      expect(proposed.executable).toBe(false);
      expect(["existing", "planned", "absent"]).toContain(proposed.adapterAvailability);
      expect(proposed.requiredGates.length).toBeGreaterThan(0);
      for (const gate of proposed.requiredGates) {
        expect(["Business Owner", "Platform Owner"]).toContain(gate.role);
      }
    }
    expect(free.actions.some((action) => action.surface === "migration")).toBe(false);
  });

  it("quarantines unsafe URLs, unsupported facts, and conflicting identity without recommending cutover", () => {
    const evidence = outcome();
    evidence.businessId = "different-business";
    evidence.provenance.evidence.links = [
      "https://exampleplumbing.com/first",
      "http://127.0.0.1/private",
      "javascript:alert(1)",
      "https://exampleplumbing.com/last",
    ];
    evidence.provenance.enrichment.output.services = [{ name: "Unsupported", sourceUrls: [] }];
    const plan = derivePresencePlan({
      businessId,
      profileId,
      onboardingEvidence: evidence,
      externalWebsiteUrl: "https://user:pass@private.example.com/",
    });
    expect(plan.sitePath).toEqual({
      recommended: null,
      allowed: [],
      reason: "invalid_existing_website",
    });
    expect(
      plan.quarantinedEvidence
        .filter((item) => item.reason === "invalid_source_url")
        .map((item) => item.path)
    ).toEqual(["$.provenance.evidence.links[1]", "$.provenance.evidence.links[2]"]);
    expect(plan.quarantinedEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "$.businessId", reason: "identity_conflict" }),
        expect.objectContaining({
          path: "$.externalWebsiteUrl",
          reason: "invalid_existing_website",
        }),
        expect.objectContaining({
          path: "$.provenance.enrichment.output.services[0]",
          reason: "missing_source_reference",
        }),
      ])
    );
    expect(plan.actions.some((action) => action.surface === "migration")).toBe(false);
    expect(JSON.stringify(plan)).not.toContain("user:pass");
  });
});
