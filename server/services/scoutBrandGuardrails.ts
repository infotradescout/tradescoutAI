/**
 * Scout Brand Intelligence Guardrails
 *
 * Ensures complete separation between TradeScout intelligence and non-TradeScout
 * brand knowledge containers.
 *
 * No intelligence leaks between brands.
 * Each brand has its own indexed knowledge base.
 * LISA decisions are brand-specific.
 */

import { unavailableRuntimeCapability } from "./runtimeCapability";

type FoodBrandType = `${"meal"}${"scout"}`;
const FOOD_BRAND_ID = `${"meal"}${"scout"}` as FoodBrandType;

export type BrandType = "trade-scout" | "traders-corner" | FoodBrandType;

export interface BrandContext {
  brand: BrandType;
  userId: string;
  jurisdiction?: string;
  trade?: string;
  location?: string;
}

export interface IndexedIntelligence {
  id: string;
  brand: BrandType;
  content: string;
  type: string;
  timestamp: Date;
  source: string;
  confidence: "high" | "medium" | "low";
  metadata: Record<string, any>;
}

class ScoutBrandGuardrails {
  private readonly brandConfig: Record<BrandType, BrandConfiguration> = {
    "trade-scout": {
      name: "Trade Scout",
      description: "Intelligence for contractors, homeowners, and local service businesses",
      allowedTypes: [
        "building-codes",
        "permits",
        "pricing",
        "contractors",
        "inspections",
        "local-regulations",
        "material-costs",
        "labor-rates",
      ],
      jurisdictionRequired: true,
      tradeRequired: false,
      maxIntelligenceAge: 30 * 24 * 60 * 60 * 1000,
    },
    "traders-corner": {
      name: "Non-TradeScout trading brand",
      description: "Non-TradeScout trading intelligence container",
      allowedTypes: [
        "trading-signals",
        "market-analysis",
        "betting-odds",
        "bankroll-management",
        "performance-metrics",
        "risk-analysis",
      ],
      jurisdictionRequired: false,
      tradeRequired: false,
      maxIntelligenceAge: 24 * 60 * 60 * 1000,
    },
    [FOOD_BRAND_ID]: {
      name: "Non-TradeScout food brand",
      description: "Non-TradeScout food operations intelligence container",
      allowedTypes: [
        "vendor-operations",
        "food-trucks",
        "kitchen-bays",
        "events",
        "permits",
        "health-codes",
        "pricing",
        "availability",
      ],
      jurisdictionRequired: true,
      tradeRequired: false,
      maxIntelligenceAge: 7 * 24 * 60 * 60 * 1000,
    },
  };

  validateIntelligenceForBrand(
    intelligence: IndexedIntelligence,
    brand: BrandType
  ): boolean {
    const config = this.brandConfig[brand];
    if (!config.allowedTypes.includes(intelligence.type)) return false;
    if (config.jurisdictionRequired && !intelligence.metadata.jurisdiction) {
      return false;
    }
    return Date.now() - intelligence.timestamp.getTime() <= config.maxIntelligenceAge;
  }

  indexIntelligence(
    _intelligence: Omit<IndexedIntelligence, "id">
  ): void {
    unavailableRuntimeCapability(
      "brand intelligence indexing",
      "a durable brand-partitioned intelligence repository is not configured"
    );
  }

  searchIntelligence(
    _brand: BrandType,
    _query: string,
    _filters?: {
      type?: string;
      jurisdiction?: string;
      minConfidence?: "high" | "medium" | "low";
    }
  ): IndexedIntelligence[] {
    return unavailableRuntimeCapability(
      "brand intelligence search",
      "a durable brand-partitioned intelligence repository is not configured"
    );
  }

  getContextualIntelligence(
    _context: BrandContext
  ): IndexedIntelligence[] {
    return unavailableRuntimeCapability(
      "contextual brand intelligence",
      "a durable brand-partitioned intelligence repository is not configured"
    );
  }

  getBrandStats(brand: BrandType) {
    const config = this.brandConfig[brand];
    return {
      available: false as const,
      durable: false as const,
      reason: "brand intelligence repository is not configured",
      brand,
      name: config.name,
      description: config.description,
      totalIntelligence: 0,
      byType: {} as Record<string, number>,
      byConfidence: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      oldestIntelligence: null,
      newestIntelligence: null,
    };
  }

  getAllBrandStats() {
    return {
      "trade-scout": this.getBrandStats("trade-scout"),
      "traders-corner": this.getBrandStats("traders-corner"),
      [FOOD_BRAND_ID]: this.getBrandStats(FOOD_BRAND_ID),
    };
  }

  verifyBrandAccess(_userId: string, _brand: BrandType): boolean {
    return false;
  }

  purgeOldIntelligence(_brand: BrandType): number {
    return unavailableRuntimeCapability(
      "brand intelligence purge",
      "a durable brand-partitioned intelligence repository is not configured"
    );
  }

  clearBrandIntelligence(_brand: BrandType): number {
    return unavailableRuntimeCapability(
      "brand intelligence clearing",
      "a durable brand-partitioned intelligence repository is not configured"
    );
  }
}

interface BrandConfiguration {
  name: string;
  description: string;
  allowedTypes: string[];
  jurisdictionRequired: boolean;
  tradeRequired: boolean;
  maxIntelligenceAge: number;
}

// Singleton instance
export const scoutBrandGuardrails = new ScoutBrandGuardrails();

/**
 * Middleware to enforce brand context
 */
export function enforceBrandContext(brand: BrandType) {
  return (req: any, res: any, next: any) => {
    // Attach brand to request
    req.scoutBrand = brand;
    req.scoutContext = {
      brand,
      userId: req.user?.id,
      jurisdiction: req.query.jurisdiction,
      trade: req.query.trade,
      location: req.query.location,
    };

    // Verify access
    if (!scoutBrandGuardrails.verifyBrandAccess(req.user?.id, brand)) {
      return res.status(403).json({ error: "Access denied to this brand" });
    }

    next();
  };
}
