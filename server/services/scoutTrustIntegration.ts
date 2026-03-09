import type { ScoutAction } from "../../client/src/scout/state";

export type TrustConfidenceLevel = "low" | "medium" | "high";

export interface ScoutTrustContext {
  userId?: string;
  countyFips?: string;
  cvsScore?: number | null;
  verifiedJobsCount?: number | null;
  verifiedRecommendationsCount?: number | null;
  verificationStatus?: "approved" | "pending" | "rejected" | "suspended" | "unknown";
  riskFlags?: string[];
  confidenceLevel?: TrustConfidenceLevel;
}

export interface TrustSignalMetadata {
  cvsScore: number | null;
  confidenceLevel: TrustConfidenceLevel;
  confidenceNumeric: number;
  verifiedActivityProof: string;
  verificationStatus: ScoutTrustContext["verificationStatus"];
  riskFlags: string[];
  trustBandLabel: string;
  requiredReview: boolean;
}

export interface TrustAwareFeatureRoute {
  featureId: string;
  name: string;
  authRequired: boolean;
  roleRequirements: string[];
  keywords: string[];
}

export interface TrustAwareRoutingMetadata {
  trustSignals: TrustSignalMetadata;
  trustFilterApplied: boolean;
  minRequiredScore: number;
}

export interface TrustAwareDecision<TMetadata = Record<string, unknown> | undefined> {
  action: ScoutAction;
  confidence: number;
  reasoning: string;
  sourceLayer: "deterministic" | "fallback";
  metadata?: TMetadata;
}

const FEATURE_MIN_TRUST: Record<string, number> = {
  direct_connect: 40,
  community: 20,
  exchange: 35,
  homescout: 25,
  maps: 10,
  notes: 10,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Trust-as-a-Service integration layer for Scout.
 */
export class ScoutTrustIntegration {
  /**
   * Build trust metadata for routing and decision card display.
   */
  static buildTrustSignals(context?: ScoutTrustContext | null): TrustSignalMetadata {
    const score =
      typeof context?.cvsScore === "number" && Number.isFinite(context.cvsScore)
        ? clamp(Math.round(context.cvsScore), 0, 100)
        : null;

    const confidenceLevel =
      context?.confidenceLevel ??
      (score === null ? "medium" : score >= 80 ? "high" : score >= 50 ? "medium" : "low");

    const confidenceNumeric =
      confidenceLevel === "high" ? 0.88 : confidenceLevel === "medium" ? 0.64 : 0.38;

    const verifiedJobs = clamp(Number(context?.verifiedJobsCount ?? 0), 0, 9999);
    const verifiedRecs = clamp(Number(context?.verifiedRecommendationsCount ?? 0), 0, 9999);
    const verificationStatus = context?.verificationStatus ?? "unknown";
    const riskFlags = Array.isArray(context?.riskFlags)
      ? context!.riskFlags.filter((flag): flag is string => typeof flag === "string")
      : [];

    const verifiedActivityProof =
      verifiedJobs > 0
        ? `${verifiedJobs} local jobs verified in your county`
        : verifiedRecs > 0
          ? `${verifiedRecs} local recommendations verified`
          : "No verified activity proof yet";

    const trustBandLabel =
      score === null
        ? "CVS pending"
        : score >= 80
          ? "High trust"
          : score >= 50
            ? "Moderate trust"
            : "Trust needs review";

    const requiredReview =
      verificationStatus === "rejected" ||
      verificationStatus === "suspended" ||
      riskFlags.length > 0;

    return {
      cvsScore: score,
      confidenceLevel,
      confidenceNumeric,
      verifiedActivityProof,
      verificationStatus,
      riskFlags,
      trustBandLabel,
      requiredReview,
    };
  }

  /**
   * Return true when trust level allows feature discovery.
   */
  static canAccessFeature(featureId: string, context?: ScoutTrustContext | null): boolean {
    const signals = this.buildTrustSignals(context);
    const minScore = FEATURE_MIN_TRUST[featureId] ?? 0;
    const score = signals.cvsScore ?? 55;

    if (signals.requiredReview && minScore >= 35) return false;
    return score >= minScore;
  }

  /**
   * Apply trust-aware filtering to feature discovery results.
   */
  static filterFeaturesByTrust(
    features: TrustAwareFeatureRoute[],
    context?: ScoutTrustContext | null
  ): TrustAwareFeatureRoute[] {
    return features.filter((feature) => this.canAccessFeature(feature.featureId, context));
  }

  /**
   * Generic trust-aware filtering preserving feature shape.
   */
  static filterFeaturesByTrustGeneric<T extends TrustAwareFeatureRoute>(
    features: T[],
    context?: ScoutTrustContext | null
  ): T[] {
    return features.filter((feature) => this.canAccessFeature(feature.featureId, context));
  }

  /**
   * Attach trust metadata + trust-adjusted confidence to routing decision.
   */
  static attachTrustMetadata<TMetadata extends Record<string, unknown> | undefined>(
    decision: TrustAwareDecision<TMetadata>,
    context?: ScoutTrustContext | null
  ): TrustAwareDecision<TMetadata & { trust?: TrustAwareRoutingMetadata }> {
    const trustSignals = this.buildTrustSignals(context);
    const featureId = this.inferFeatureIdFromAction(decision.action);
    const minRequiredScore = FEATURE_MIN_TRUST[featureId] ?? 0;
    const score = trustSignals.cvsScore ?? 55;
    const trustFilterApplied = minRequiredScore > 0;

    const confidenceAdjustment = trustSignals.requiredReview
      ? -0.16
      : score >= 85
        ? 0.07
        : score >= minRequiredScore
          ? 0.02
          : -0.08;

    const confidence = clamp(
      Number((decision.confidence + confidenceAdjustment).toFixed(3)),
      0.05,
      0.99
    );

    const trustMetadata: TrustAwareRoutingMetadata = {
      trustSignals,
      trustFilterApplied,
      minRequiredScore,
    };

    const nextMetadata = {
      ...(decision.metadata || ({} as TMetadata)),
      trust: trustMetadata,
    } as TMetadata & { trust?: TrustAwareRoutingMetadata };

    return {
      ...decision,
      confidence,
      reasoning: `${decision.reasoning} Trust signal: ${trustSignals.trustBandLabel}.`,
      metadata: nextMetadata,
    };
  }

  /**
   * Build human-facing trust warning when score falls below feature minimum.
   */
  static buildTrustWarning(featureId: string, context?: ScoutTrustContext | null): string | null {
    const minScore = FEATURE_MIN_TRUST[featureId] ?? 0;
    const trust = this.buildTrustSignals(context);
    const score = trust.cvsScore ?? 55;

    if (score >= minScore && !trust.requiredReview) return null;

    if (trust.requiredReview) {
      return "Trust review is required before this feature can expose contact or high-impact actions.";
    }

    return `This feature needs a minimum CVS ${minScore}. Current score is ${score}.`;
  }

  /**
   * Return a deterministic trust rank for sorting recommendations.
   */
  static rankFeatureWithTrust(
    featureId: string,
    baseScore: number,
    context?: ScoutTrustContext | null
  ): number {
    const trust = this.buildTrustSignals(context);
    const minScore = FEATURE_MIN_TRUST[featureId] ?? 0;
    const score = trust.cvsScore ?? 55;

    const trustDelta = score - minScore;
    const riskPenalty = trust.requiredReview ? 18 : 0;
    const confidenceBoost = Math.round(trust.confidenceNumeric * 12);

    return Math.round(baseScore + trustDelta * 0.35 + confidenceBoost - riskPenalty);
  }

  /**
   * Add trust metadata to all candidate recommendations.
   */
  static addTrustToRecommendations<TMetadata extends Record<string, unknown> | undefined>(
    decisions: Array<TrustAwareDecision<TMetadata>>,
    context?: ScoutTrustContext | null
  ): Array<TrustAwareDecision<TMetadata & { trust?: TrustAwareRoutingMetadata }>> {
    return decisions.map((decision) => this.attachTrustMetadata(decision, context));
  }

  private static inferFeatureIdFromAction(action: ScoutAction): string {
    const destination = String(action.to ?? action.path ?? "").toLowerCase();
    if (destination.includes("direct-connect")) return "direct_connect";
    if (destination.includes("community")) return "community";
    if (destination.includes("exchange") || destination.includes("market")) return "exchange";
    if (destination.includes("real-estate") || destination.includes("homescout"))
      return "homescout";
    if (destination.includes("maps")) return "maps";
    return "notes";
  }
}

export default ScoutTrustIntegration;
