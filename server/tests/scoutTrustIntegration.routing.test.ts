import { describe, expect, it } from "vitest";
import ScoutTrustIntegration from "../services/scoutTrustIntegration";
import {
  FEATURE_ROUTING_MAP,
  UnifiedScoutRouter,
  type UnifiedScoutUserContext,
} from "../services/unifiedScoutRouter";

describe("ScoutTrustIntegration", () => {
  it("builds verified activity proof from jobs count", () => {
    const signals = ScoutTrustIntegration.buildTrustSignals({
      cvsScore: 82,
      verifiedJobsCount: 12,
      verificationStatus: "approved",
      riskFlags: [],
    });

    expect(signals.verifiedActivityProof).toContain("12 local jobs verified");
    expect(signals.confidenceLevel).toBe("high");
    expect(signals.requiredReview).toBe(false);
  });

  it("flags required review for suspended/rejected states", () => {
    const signals = ScoutTrustIntegration.buildTrustSignals({
      cvsScore: 79,
      verificationStatus: "suspended",
      riskFlags: ["verification_suspended"],
    });

    expect(signals.requiredReview).toBe(true);
    expect(signals.riskFlags).toContain("verification_suspended");
  });

  it("filters features below trust thresholds", () => {
    const allFeatures = Object.values(FEATURE_ROUTING_MAP).map((f) => ({
      featureId: f.featureId,
      name: f.name,
      authRequired: f.authRequired,
      roleRequirements: f.roleRequirements,
      keywords: f.keywords,
    }));

    const filtered = ScoutTrustIntegration.filterFeaturesByTrust(allFeatures, {
      cvsScore: 15,
      verificationStatus: "approved",
      riskFlags: [],
    });

    expect(filtered.some((f) => f.featureId === "maps")).toBe(true);
    expect(filtered.some((f) => f.featureId === "direct_connect")).toBe(false);
  });

  it("attaches trust metadata and adjusts confidence", () => {
    const decision = {
      action: { type: "NAVIGATE", to: "/direct-connect", label: "Direct Connect" } as const,
      confidence: 0.81,
      reasoning: "Matched direct connect",
      sourceLayer: "deterministic" as const,
      metadata: {
        riskLevel: "low" as const,
      },
    };

    const enriched = ScoutTrustIntegration.attachTrustMetadata(decision, {
      cvsScore: 90,
      verifiedJobsCount: 44,
      verificationStatus: "approved",
      riskFlags: [],
    });

    expect(enriched.metadata?.trust).toBeDefined();
    expect(enriched.confidence).toBeGreaterThan(0.81);
    expect(enriched.reasoning).toContain("Trust signal");
  });

  it("generates trust warning when below required score", () => {
    const warning = ScoutTrustIntegration.buildTrustWarning("direct_connect", {
      cvsScore: 20,
      verificationStatus: "approved",
      riskFlags: [],
    });

    expect(warning).toContain("minimum CVS");
  });
});

describe("UnifiedScoutRouter trust-aware routing", () => {
  const baseContext: UnifiedScoutUserContext = {
    userId: "u-100",
    isAuthenticated: true,
    userRole: "homeowner",
  };

  it("blocks intent resolution when trust is below minimum for feature", () => {
    const decision = UnifiedScoutRouter.resolveIntent("open direct connect", baseContext, {
      trust: {
        cvsScore: 22,
        verificationStatus: "approved",
        riskFlags: [],
      },
    });

    expect(decision).toBeNull();
  });

  it("returns trust metadata in routing decision when trust context is provided", () => {
    const decision = UnifiedScoutRouter.resolveIntent("open community", baseContext, {
      trust: {
        cvsScore: 78,
        verifiedJobsCount: 12,
        verificationStatus: "approved",
        riskFlags: [],
      },
    });

    expect(decision).not.toBeNull();
    expect(decision?.metadata?.trust).toBeDefined();
    expect(decision?.metadata?.trust?.trustSignals.verifiedActivityProof).toContain("12");
  });

  it("elevates risk level to high when trust review is required", () => {
    const decision = UnifiedScoutRouter.resolveIntent("open community", baseContext, {
      trust: {
        cvsScore: 85,
        verificationStatus: "suspended",
        riskFlags: ["verification_suspended"],
      },
    });

    expect(decision).not.toBeNull();
    expect(decision?.metadata?.riskLevel).toBe("high");
  });

  it("applies trust-aware filtering in discoverFeatures", () => {
    const lowTrustFeatures = UnifiedScoutRouter.discoverFeatures(
      "community direct connect",
      baseContext,
      {
        trust: {
          cvsScore: 18,
          verificationStatus: "approved",
          riskFlags: [],
        },
      }
    );

    expect(lowTrustFeatures.some((f) => f.featureId === "community")).toBe(false);
    expect(lowTrustFeatures.some((f) => f.featureId === "maps")).toBe(false);

    const highTrustFeatures = UnifiedScoutRouter.discoverFeatures(
      "community direct connect",
      baseContext,
      {
        trust: {
          cvsScore: 90,
          verificationStatus: "approved",
          riskFlags: [],
        },
      }
    );

    expect(highTrustFeatures.some((f) => f.featureId === "community")).toBe(true);
    expect(highTrustFeatures.some((f) => f.featureId === "direct_connect")).toBe(true);
  });

  it("keeps non-trust invocation compatible", () => {
    const decision = UnifiedScoutRouter.resolveIntent("open exchange", baseContext);
    expect(decision).not.toBeNull();
    expect(decision?.metadata?.trust).toBeUndefined();
  });
});

describe("ScoutTrustIntegration matrix coverage", () => {
  const scores = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const features = ["direct_connect", "community", "exchange", "homescout", "maps"];
  const verificationStatuses = ["approved", "suspended"] as const;

  const matrix = features.flatMap((featureId) =>
    scores.flatMap((score) =>
      verificationStatuses.map((verificationStatus) => ({
        featureId,
        score,
        verificationStatus,
      }))
    )
  );

  it.each(matrix)(
    "evaluates trust gates for feature=%s score=%s status=%s",
    ({ featureId, score, verificationStatus }) => {
      const canAccess = ScoutTrustIntegration.canAccessFeature(featureId, {
        cvsScore: score,
        verificationStatus,
        riskFlags: verificationStatus === "suspended" ? ["verification_suspended"] : [],
      });

      const warning = ScoutTrustIntegration.buildTrustWarning(featureId, {
        cvsScore: score,
        verificationStatus,
        riskFlags: verificationStatus === "suspended" ? ["verification_suspended"] : [],
      });

      if (canAccess && verificationStatus === "approved") {
        expect(warning).toBeNull();
      } else {
        expect(typeof warning).toBe("string");
      }
    }
  );
});
