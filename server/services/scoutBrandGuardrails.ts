/**
 * Scout Brand Intelligence Guardrails
 *
 * Ensures complete separation of intelligence between:
 * - Trade Scout (contractors, building codes, permits, local services)
 * - Trader's Corner (trading signals, betting tools, bankroll management)
 * - MealScout (food vendors, events, kitchen operations)
 *
 * No intelligence leaks between brands.
 * Each brand has its own indexed knowledge base.
 * LISA decisions are brand-specific.
 */

export type BrandType = "trade-scout" | "traders-corner" | "mealscout";

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
  // Separate knowledge bases per brand
  private brandKnowledge: Map<BrandType, IndexedIntelligence[]> = new Map([
    ["trade-scout", []],
    ["traders-corner", []],
    ["mealscout", []],
  ]);

  // Brand-specific configuration
  private brandConfig: Record<BrandType, BrandConfiguration> = {
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
      maxIntelligenceAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
    "traders-corner": {
      name: "Trader's Corner",
      description: "Intelligence for trading signals, betting tools, and bankroll management",
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
      maxIntelligenceAge: 24 * 60 * 60 * 1000, // 1 day
    },
    mealscout: {
      name: "MealScout",
      description: "Intelligence for food vendors, events, and kitchen operations",
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
      maxIntelligenceAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  };

  /**
   * Validate that intelligence is appropriate for a brand
   */
  validateIntelligenceForBrand(intelligence: IndexedIntelligence, brand: BrandType): boolean {
    const config = this.brandConfig[brand];

    // Check if intelligence type is allowed
    if (!config.allowedTypes.includes(intelligence.type)) {
      console.warn(
        `[Brand Guard] Intelligence type "${intelligence.type}" not allowed for ${brand}`
      );
      return false;
    }

    // Check jurisdiction requirement
    if (config.jurisdictionRequired && !intelligence.metadata.jurisdiction) {
      console.warn(`[Brand Guard] Jurisdiction required for ${brand}`);
      return false;
    }

    // Check age
    const age = Date.now() - intelligence.timestamp.getTime();
    if (age > config.maxIntelligenceAge) {
      console.warn(`[Brand Guard] Intelligence too old for ${brand}`);
      return false;
    }

    return true;
  }

  /**
   * Index intelligence for a specific brand
   */
  indexIntelligence(intelligence: Omit<IndexedIntelligence, "id">): void {
    const config = this.brandConfig[intelligence.brand];

    // Validate
    if (
      !this.validateIntelligenceForBrand(intelligence as IndexedIntelligence, intelligence.brand)
    ) {
      throw new Error(`Invalid intelligence for brand: ${intelligence.brand}`);
    }

    // Create indexed record
    const indexed: IndexedIntelligence = {
      ...intelligence,
      id: `${intelligence.brand}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Store in brand-specific knowledge base
    const knowledge = this.brandKnowledge.get(intelligence.brand) || [];
    knowledge.push(indexed);
    this.brandKnowledge.set(intelligence.brand, knowledge);

    console.log(`[Brand Guard] Indexed intelligence for ${intelligence.brand}: ${indexed.id}`);
  }

  /**
   * Search intelligence for a specific brand
   * Returns ONLY intelligence from that brand
   */
  searchIntelligence(
    brand: BrandType,
    query: string,
    filters?: {
      type?: string;
      jurisdiction?: string;
      minConfidence?: "high" | "medium" | "low";
    }
  ): IndexedIntelligence[] {
    const knowledge = this.brandKnowledge.get(brand) || [];
    const lowerQuery = query.toLowerCase();

    const results = knowledge.filter((intel) => {
      // Text search
      if (!intel.content.toLowerCase().includes(lowerQuery)) {
        return false;
      }

      // Type filter
      if (filters?.type && intel.type !== filters.type) {
        return false;
      }

      // Jurisdiction filter
      if (filters?.jurisdiction && intel.metadata.jurisdiction !== filters.jurisdiction) {
        return false;
      }

      // Confidence filter
      if (filters?.minConfidence) {
        const confidenceRank = { high: 3, medium: 2, low: 1 };
        if (confidenceRank[intel.confidence] < confidenceRank[filters.minConfidence]) {
          return false;
        }
      }

      return true;
    });

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get intelligence for a specific brand context
   * Respects all brand boundaries
   */
  getContextualIntelligence(context: BrandContext): IndexedIntelligence[] {
    let results = this.searchIntelligence(context.brand, "");

    // Filter by jurisdiction if provided
    if (context.jurisdiction) {
      results = results.filter((intel) => intel.metadata.jurisdiction === context.jurisdiction);
    }

    // Filter by trade if provided
    if (context.trade) {
      results = results.filter((intel) => intel.metadata.trade === context.trade);
    }

    return results;
  }

  /**
   * Get brand-specific statistics
   */
  getBrandStats(brand: BrandType) {
    const knowledge = this.brandKnowledge.get(brand) || [];
    const config = this.brandConfig[brand];

    return {
      brand,
      name: config.name,
      description: config.description,
      totalIntelligence: knowledge.length,
      byType: this.groupBy(knowledge, (i) => i.type),
      byConfidence: this.groupBy(knowledge, (i) => i.confidence),
      bySource: this.groupBy(knowledge, (i) => i.source),
      oldestIntelligence: knowledge.length > 0 ? knowledge[knowledge.length - 1].timestamp : null,
      newestIntelligence: knowledge.length > 0 ? knowledge[0].timestamp : null,
    };
  }

  /**
   * Get all brand statistics
   */
  getAllBrandStats() {
    return {
      "trade-scout": this.getBrandStats("trade-scout"),
      "traders-corner": this.getBrandStats("traders-corner"),
      mealscout: this.getBrandStats("mealscout"),
    };
  }

  /**
   * Verify that a user has access to a brand's intelligence
   */
  verifyBrandAccess(userId: string, brand: BrandType): boolean {
    // In production, check user's brand permissions
    // For now, assume all users have access to all brands
    // but their data is isolated
    return true;
  }

  /**
   * Purge old intelligence from a brand
   */
  purgeOldIntelligence(brand: BrandType): number {
    const knowledge = this.brandKnowledge.get(brand) || [];
    const config = this.brandConfig[brand];
    const now = Date.now();

    const before = knowledge.length;
    const filtered = knowledge.filter(
      (intel) => now - intel.timestamp.getTime() <= config.maxIntelligenceAge
    );

    this.brandKnowledge.set(brand, filtered);

    const purged = before - filtered.length;
    console.log(`[Brand Guard] Purged ${purged} old intelligence from ${brand}`);

    return purged;
  }

  /**
   * Clear all intelligence for a brand (admin only)
   */
  clearBrandIntelligence(brand: BrandType): number {
    const knowledge = this.brandKnowledge.get(brand) || [];
    const count = knowledge.length;
    this.brandKnowledge.set(brand, []);
    console.log(`[Brand Guard] Cleared ${count} intelligence records for ${brand}`);
    return count;
  }

  /**
   * Helper: group array by key
   */
  private groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, number> {
    return arr.reduce(
      (acc, item) => {
        const key = keyFn(item);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
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
