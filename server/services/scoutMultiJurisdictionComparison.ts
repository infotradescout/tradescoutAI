/**
 * Scout Multi-Jurisdiction Intelligence Comparison
 *
 * Compare building codes, labor rates, material prices, and market conditions
 * across different jurisdictions to identify regional opportunities.
 *
 * Features:
 * - Side-by-side jurisdiction comparison
 * - Trend analysis across regions
 * - Opportunity identification
 * - Cost-benefit analysis
 * - Market gap analysis
 */

export interface JurisdictionIntelligence {
  jurisdiction: string;
  state: string;
  county: string;
  fips: string;
  buildingCodes: CodeComparison[];
  laborRates: LaborRateComparison[];
  materialPrices: MaterialPriceComparison[];
  marketConditions: MarketCondition[];
  permits: PermitComparison[];
  inspections: InspectionComparison[];
}

export interface CodeComparison {
  type: string; // e.g., "deck-railing", "electrical-panel"
  requirement: string;
  value: string | number;
  unit?: string;
  lastUpdated: Date;
  source: string;
}

export interface LaborRateComparison {
  trade: string; // e.g., "electrician", "plumber"
  hourlyRate: number;
  dailyRate: number;
  projectRate?: number;
  availability: "high" | "medium" | "low";
  certifications?: string[];
  lastUpdated: Date;
}

export interface MaterialPriceComparison {
  material: string; // e.g., "2x4 lumber", "electrical wire"
  unitPrice: number;
  unit: string; // e.g., "per board foot", "per 100 feet"
  supplier?: string;
  trend: "up" | "down" | "stable";
  percentChange30d: number;
  lastUpdated: Date;
}

export interface MarketCondition {
  metric: string;
  value: number | string;
  benchmark?: number | string;
  status: "strong" | "moderate" | "weak";
  trend: "improving" | "stable" | "declining";
}

export interface PermitComparison {
  type: string;
  processingDays: number;
  cost: number;
  requirements: string[];
  lastUpdated: Date;
}

export interface InspectionComparison {
  type: string;
  required: boolean;
  stages: number;
  averageDays: number;
  passRate: number;
  commonIssues: string[];
  lastUpdated: Date;
}

export interface ComparisonResult {
  jurisdictions: JurisdictionIntelligence[];
  comparison: {
    category: string;
    items: ComparisonItem[];
  }[];
  opportunities: RegionalOpportunity[];
  risks: RegionalRisk[];
  recommendations: ComparisonRecommendation[];
}

export interface ComparisonItem {
  metric: string;
  values: Record<string, any>;
  winner?: string; // jurisdiction with best value
  variance: number; // percentage difference from average
}

export interface RegionalOpportunity {
  id: string;
  title: string;
  description: string;
  jurisdictions: string[];
  potential: "high" | "medium" | "low";
  estimatedValue: string;
  action: string;
}

export interface RegionalRisk {
  id: string;
  title: string;
  description: string;
  affectedJurisdictions: string[];
  severity: "critical" | "high" | "medium" | "low";
  mitigation: string;
}

export interface ComparisonRecommendation {
  priority: "critical" | "high" | "medium" | "low";
  action: string;
  rationale: string;
  affectedJurisdictions: string[];
  estimatedImpact: string;
}

class ScoutMultiJurisdictionComparison {
  private jurisdictionData: Map<string, JurisdictionIntelligence> = new Map();
  private comparisonHistory: ComparisonResult[] = [];

  /**
   * Compare multiple jurisdictions
   */
  async compareJurisdictions(jurisdictions: string[]): Promise<ComparisonResult> {
    const jurisdictionData = jurisdictions
      .map((j) => this.jurisdictionData.get(j))
      .filter((d): d is JurisdictionIntelligence => d !== undefined);

    if (jurisdictionData.length === 0) {
      throw new Error("No jurisdiction data found");
    }

    const comparison: ComparisonResult = {
      jurisdictions: jurisdictionData,
      comparison: [
        this.compareBuildingCodes(jurisdictionData),
        this.compareLaborRates(jurisdictionData),
        this.compareMaterialPrices(jurisdictionData),
        this.compareMarketConditions(jurisdictionData),
        this.comparePermits(jurisdictionData),
      ],
      opportunities: this.identifyOpportunities(jurisdictionData),
      risks: this.identifyRisks(jurisdictionData),
      recommendations: this.generateRecommendations(jurisdictionData),
    };

    this.comparisonHistory.push(comparison);
    return comparison;
  }

  /**
   * Compare building codes across jurisdictions
   */
  private compareBuildingCodes(jurisdictions: JurisdictionIntelligence[]) {
    const items: ComparisonItem[] = [];

    // Group codes by type
    const codesByType = new Map<string, CodeComparison[]>();
    jurisdictions.forEach((j) => {
      j.buildingCodes.forEach((code) => {
        if (!codesByType.has(code.type)) {
          codesByType.set(code.type, []);
        }
        codesByType.get(code.type)!.push(code);
      });
    });

    // Compare each code type
    codesByType.forEach((codes, type) => {
      const values: Record<string, any> = {};
      codes.forEach((code) => {
        const jName = jurisdictions.find((j) => j.buildingCodes.includes(code))?.jurisdiction;
        if (jName) {
          values[jName] = code.value;
        }
      });

      items.push({
        metric: type,
        values,
        variance: this.calculateVariance(Object.values(values)),
      });
    });

    return { category: "Building Codes", items };
  }

  /**
   * Compare labor rates across jurisdictions
   */
  private compareLaborRates(jurisdictions: JurisdictionIntelligence[]) {
    const items: ComparisonItem[] = [];

    // Group rates by trade
    const ratesByTrade = new Map<string, LaborRateComparison[]>();
    jurisdictions.forEach((j) => {
      j.laborRates.forEach((rate) => {
        if (!ratesByTrade.has(rate.trade)) {
          ratesByTrade.set(rate.trade, []);
        }
        ratesByTrade.get(rate.trade)!.push(rate);
      });
    });

    // Compare each trade
    ratesByTrade.forEach((rates, trade) => {
      const values: Record<string, any> = {};
      const hourlyRates: number[] = [];

      rates.forEach((rate) => {
        const jName = jurisdictions.find((j) => j.laborRates.includes(rate))?.jurisdiction;
        if (jName) {
          values[jName] = `$${rate.hourlyRate}/hr`;
          hourlyRates.push(rate.hourlyRate);
        }
      });

      const avgRate = hourlyRates.reduce((a, b) => a + b, 0) / hourlyRates.length;
      const winner = Object.entries(values).reduce((prev, [jName, rate]) => {
        const jRate = parseFloat(rate.toString());
        return jRate < parseFloat(prev[1].toString()) ? [jName, rate] : prev;
      })[0];

      items.push({
        metric: trade,
        values,
        winner,
        variance: this.calculateVariance(hourlyRates),
      });
    });

    return { category: "Labor Rates", items };
  }

  /**
   * Compare material prices across jurisdictions
   */
  private compareMaterialPrices(jurisdictions: JurisdictionIntelligence[]) {
    const items: ComparisonItem[] = [];

    // Group prices by material
    const pricesByMaterial = new Map<string, MaterialPriceComparison[]>();
    jurisdictions.forEach((j) => {
      j.materialPrices.forEach((price) => {
        if (!pricesByMaterial.has(price.material)) {
          pricesByMaterial.set(price.material, []);
        }
        pricesByMaterial.get(price.material)!.push(price);
      });
    });

    // Compare each material
    pricesByMaterial.forEach((prices, material) => {
      const values: Record<string, any> = {};
      const unitPrices: number[] = [];

      prices.forEach((price) => {
        const jName = jurisdictions.find((j) => j.materialPrices.includes(price))?.jurisdiction;
        if (jName) {
          values[jName] = `$${price.unitPrice}/${price.unit}`;
          unitPrices.push(price.unitPrice);
        }
      });

      const avgPrice = unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length;
      const winner = Object.entries(values).reduce((prev, [jName, price]) => {
        const jPrice = parseFloat(price.toString());
        return jPrice < parseFloat(prev[1].toString()) ? [jName, price] : prev;
      })[0];

      items.push({
        metric: material,
        values,
        winner,
        variance: this.calculateVariance(unitPrices),
      });
    });

    return { category: "Material Prices", items };
  }

  /**
   * Compare market conditions across jurisdictions
   */
  private compareMarketConditions(jurisdictions: JurisdictionIntelligence[]) {
    const items: ComparisonItem[] = [];

    // Group conditions by metric
    const conditionsByMetric = new Map<string, MarketCondition[]>();
    jurisdictions.forEach((j) => {
      j.marketConditions.forEach((condition) => {
        if (!conditionsByMetric.has(condition.metric)) {
          conditionsByMetric.set(condition.metric, []);
        }
        conditionsByMetric.get(condition.metric)!.push(condition);
      });
    });

    // Compare each metric
    conditionsByMetric.forEach((conditions, metric) => {
      const values: Record<string, any> = {};
      conditions.forEach((condition) => {
        const jName = jurisdictions.find((j) =>
          j.marketConditions.includes(condition)
        )?.jurisdiction;
        if (jName) {
          values[jName] = condition.value;
        }
      });

      items.push({
        metric,
        values,
        variance: 0,
      });
    });

    return { category: "Market Conditions", items };
  }

  /**
   * Compare permits across jurisdictions
   */
  private comparePermits(jurisdictions: JurisdictionIntelligence[]) {
    const items: ComparisonItem[] = [];

    // Group permits by type
    const permitsByType = new Map<string, PermitComparison[]>();
    jurisdictions.forEach((j) => {
      j.permits.forEach((permit) => {
        if (!permitsByType.has(permit.type)) {
          permitsByType.set(permit.type, []);
        }
        permitsByType.get(permit.type)!.push(permit);
      });
    });

    // Compare each permit type
    permitsByType.forEach((permits, type) => {
      const values: Record<string, any> = {};
      permits.forEach((permit) => {
        const jName = jurisdictions.find((j) => j.permits.includes(permit))?.jurisdiction;
        if (jName) {
          values[jName] = `${permit.processingDays}d, $${permit.cost}`;
        }
      });

      items.push({
        metric: type,
        values,
        variance: 0,
      });
    });

    return { category: "Permits", items };
  }

  /**
   * Identify regional opportunities
   */
  private identifyOpportunities(jurisdictions: JurisdictionIntelligence[]): RegionalOpportunity[] {
    const opportunities: RegionalOpportunity[] = [];

    // Opportunity: Lower labor costs in specific jurisdiction
    const laborCosts = new Map<string, number[]>();
    jurisdictions.forEach((j) => {
      const rates = j.laborRates.map((r) => r.hourlyRate);
      laborCosts.set(j.jurisdiction, rates);
    });

    const avgCosts = Array.from(laborCosts.entries()).map(([j, rates]) => ({
      jurisdiction: j,
      avg: rates.reduce((a, b) => a + b, 0) / rates.length,
    }));

    const lowestCost = avgCosts.reduce((prev, curr) => (curr.avg < prev.avg ? curr : prev));

    if (lowestCost.avg < (avgCosts.reduce((a, b) => a + b.avg, 0) / avgCosts.length) * 0.9) {
      opportunities.push({
        id: "opp-labor-arbitrage",
        title: "Labor Cost Arbitrage",
        description: `${lowestCost.jurisdiction} has significantly lower labor costs`,
        jurisdictions: [lowestCost.jurisdiction],
        potential: "high",
        estimatedValue: "10-15% cost savings on labor",
        action: "Consider expanding operations in lower-cost jurisdiction",
      });
    }

    return opportunities;
  }

  /**
   * Identify regional risks
   */
  private identifyRisks(jurisdictions: JurisdictionIntelligence[]): RegionalRisk[] {
    return [
      {
        id: "risk-code-variance",
        title: "Code Compliance Variance",
        description: "Building codes vary significantly across jurisdictions",
        affectedJurisdictions: jurisdictions.map((j) => j.jurisdiction),
        severity: "high",
        mitigation: "Maintain jurisdiction-specific compliance checklists",
      },
    ];
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    jurisdictions: JurisdictionIntelligence[]
  ): ComparisonRecommendation[] {
    return [
      {
        priority: "high",
        action:
          "Standardize processes where possible, customize for jurisdiction-specific requirements",
        rationale: "Reduce complexity while maintaining compliance",
        affectedJurisdictions: jurisdictions.map((j) => j.jurisdiction),
        estimatedImpact: "20-30% operational efficiency improvement",
      },
    ];
  }

  /**
   * Calculate variance (coefficient of variation)
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    return (stdDev / mean) * 100; // Coefficient of variation as percentage
  }

  /**
   * Get comparison history
   */
  getHistory(limit: number = 50): ComparisonResult[] {
    return this.comparisonHistory.slice(-limit);
  }
}

// Singleton instance
export const scoutMultiJurisdictionComparison = new ScoutMultiJurisdictionComparison();
