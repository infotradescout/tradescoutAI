/**
 * Scout Heatmap Intelligence
 *
 * Aggregates Scout intelligence, contractor data, and site data by county.
 * Powers the Visual Scouting Command Center.
 *
 * Features:
 * - Intelligence overlay by county
 * - Contractor and user aggregation
 * - File and report organization
 * - Regional opportunity scoring
 * - Real-time data updates
 */

export interface CountyIntelligenceData {
  fips: string;
  county: string;
  state: string;
  scoutFindings: {
    buildingCodes: number;
    pricingData: number;
    tradeGuides: number;
    recentReports: number;
  };
  contractors: {
    total: number;
    active: number;
    byTrade: Record<string, number>;
    topContractors: ContractorSummary[];
  };
  users: {
    total: number;
    homeowners: number;
    contractors: number;
    recentActivity: number;
  };
  files: {
    total: number;
    byType: Record<string, number>;
    recentFiles: FileSummary[];
  };
  opportunities: OpportunitySummary[];
  risks: RiskSummary[];
  metrics: CountyMetrics;
  lastUpdated: Date;
}

export interface ContractorSummary {
  id: string;
  name: string;
  trade: string;
  rating: number;
  reviewCount: number;
  availability: "high" | "medium" | "low";
}

export interface FileSummary {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  relevanceScore: number; // 0-100
}

export interface OpportunitySummary {
  id: string;
  title: string;
  type: string; // "high-demand", "underserved", "emerging-trade"
  score: number; // 0-100
  description: string;
}

export interface RiskSummary {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
}

export interface CountyMetrics {
  activityScore: number; // 0-100 (based on user/contractor activity)
  opportunityScore: number; // 0-100 (based on market gaps)
  dataCompleteness: number; // 0-100 (how much we know about this county)
  trendDirection: "up" | "stable" | "down";
  competitionLevel: "low" | "medium" | "high";
}

export interface HeatmapDataRequest {
  counties?: string[]; // FIPS codes
  includeContractors?: boolean;
  includeUsers?: boolean;
  includeFiles?: boolean;
  includeOpportunities?: boolean;
  timeframe?: "7d" | "30d" | "90d" | "all";
}

class ScoutHeatmapIntelligence {
  private countyData: Map<string, CountyIntelligenceData> = new Map();
  private updateQueue: Set<string> = new Set();
  private lastUpdateTime: Map<string, Date> = new Map();

  /**
   * Get intelligence for a specific county
   */
  async getCountyIntelligence(fips: string): Promise<CountyIntelligenceData | null> {
    // Check if data is stale (older than 1 hour)
    const lastUpdate = this.lastUpdateTime.get(fips);
    if (lastUpdate && Date.now() - lastUpdate.getTime() < 60 * 60 * 1000) {
      return this.countyData.get(fips) || null;
    }

    // Fetch fresh data
    return this.fetchCountyIntelligence(fips);
  }

  /**
   * Get intelligence for multiple counties
   */
  async getMultiCountyIntelligence(request: HeatmapDataRequest): Promise<CountyIntelligenceData[]> {
    if (!request.counties || request.counties.length === 0) {
      return Array.from(this.countyData.values());
    }

    const results: CountyIntelligenceData[] = [];
    for (const fips of request.counties) {
      const data = await this.getCountyIntelligence(fips);
      if (data) results.push(data);
    }

    return results;
  }

  /**
   * Fetch fresh county intelligence from all sources
   */
  private async fetchCountyIntelligence(fips: string): Promise<CountyIntelligenceData | null> {
    try {
      // In production, this would query the database
      // For now, return a structured template

      const data: CountyIntelligenceData = {
        fips,
        county: this.getFipsCountyName(fips),
        state: this.getFipsStateName(fips),
        scoutFindings: {
          buildingCodes: Math.floor(Math.random() * 50),
          pricingData: Math.floor(Math.random() * 100),
          tradeGuides: Math.floor(Math.random() * 30),
          recentReports: Math.floor(Math.random() * 20),
        },
        contractors: {
          total: Math.floor(Math.random() * 500) + 50,
          active: Math.floor(Math.random() * 300) + 20,
          byTrade: this.generateTradeBreakdown(),
          topContractors: this.generateTopContractors(),
        },
        users: {
          total: Math.floor(Math.random() * 2000) + 100,
          homeowners: Math.floor(Math.random() * 1500) + 50,
          contractors: Math.floor(Math.random() * 500) + 20,
          recentActivity: Math.floor(Math.random() * 100),
        },
        files: {
          total: Math.floor(Math.random() * 200),
          byType: {
            "building-codes": Math.floor(Math.random() * 50),
            "pricing-data": Math.floor(Math.random() * 60),
            "contractor-profiles": Math.floor(Math.random() * 40),
            "market-analysis": Math.floor(Math.random() * 30),
            "permits-inspections": Math.floor(Math.random() * 20),
          },
          recentFiles: this.generateRecentFiles(),
        },
        opportunities: this.generateOpportunities(),
        risks: this.generateRisks(),
        metrics: {
          activityScore: Math.floor(Math.random() * 100),
          opportunityScore: Math.floor(Math.random() * 100),
          dataCompleteness: Math.floor(Math.random() * 100),
          trendDirection: ["up", "stable", "down"][Math.floor(Math.random() * 3)] as any,
          competitionLevel: ["low", "medium", "high"][Math.floor(Math.random() * 3)] as any,
        },
        lastUpdated: new Date(),
      };

      this.countyData.set(fips, data);
      this.lastUpdateTime.set(fips, new Date());

      return data;
    } catch (error) {
      console.error(`[Heatmap Intelligence] Error fetching data for ${fips}:`, error);
      return null;
    }
  }

  /**
   * Trigger a scouting mission for a specific county
   */
  async triggerCountyScouting(fips: string, missionType: string): Promise<any> {
    console.log(`[Heatmap Intelligence] Triggering ${missionType} mission for ${fips}`);

    // In production, this would queue a Scout mission
    return {
      missionId: `mission-${Date.now()}`,
      fips,
      type: missionType,
      status: "queued",
      createdAt: new Date(),
    };
  }

  /**
   * Get files for a county
   */
  async getCountyFiles(
    fips: string,
    filters?: {
      type?: string;
      sortBy?: "recent" | "relevant" | "size";
      limit?: number;
    }
  ): Promise<FileSummary[]> {
    const data = await this.getCountyIntelligence(fips);
    if (!data) return [];

    let files = data.files.recentFiles;

    if (filters?.type) {
      files = files.filter((f) => f.type === filters.type);
    }

    if (filters?.sortBy === "relevant") {
      files.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } else if (filters?.sortBy === "size") {
      files.sort((a, b) => b.size - a.size);
    }

    return files.slice(0, filters?.limit || 10);
  }

  /**
   * Assign a file to a county
   */
  async assignFileToCounty(fileId: string, fips: string): Promise<boolean> {
    console.log(`[Heatmap Intelligence] Assigning file ${fileId} to county ${fips}`);
    // In production, this would update the database
    return true;
  }

  /**
   * Get comparison between counties
   */
  async compareCounties(fips1: string, fips2: string): Promise<any> {
    const data1 = await this.getCountyIntelligence(fips1);
    const data2 = await this.getCountyIntelligence(fips2);

    if (!data1 || !data2) return null;

    return {
      county1: {
        name: data1.county,
        metrics: data1.metrics,
        contractors: data1.contractors.total,
        users: data1.users.total,
      },
      county2: {
        name: data2.county,
        metrics: data2.metrics,
        contractors: data2.contractors.total,
        users: data2.users.total,
      },
      differences: {
        contractorDiff: data1.contractors.total - data2.contractors.total,
        userDiff: data1.users.total - data2.users.total,
        opportunityDiff: data1.metrics.opportunityScore - data2.metrics.opportunityScore,
      },
    };
  }

  /**
   * Get heat intensity for a county (for color coding)
   */
  getCountyHeatIntensity(data: CountyIntelligenceData): number {
    // Combine multiple factors to determine heat intensity
    const activityWeight = 0.3;
    const opportunityWeight = 0.4;
    const dataWeight = 0.3;

    return (
      data.metrics.activityScore * activityWeight +
      data.metrics.opportunityScore * opportunityWeight +
      data.metrics.dataCompleteness * dataWeight
    );
  }

  /**
   * Helper: Get county name from FIPS code
   */
  private getFipsCountyName(fips: string): string {
    // In production, look this up from a database
    const fipsMap: Record<string, string> = {
      "48453": "Travis",
      "48201": "Harris",
      "48439": "Tarrant",
      "48113": "Dallas",
    };
    return fipsMap[fips] || "Unknown County";
  }

  /**
   * Helper: Get state name from FIPS code
   */
  private getFipsStateName(fips: string): string {
    // FIPS code format: SSCCC (SS = state, CCC = county)
    const stateCode = fips.substring(0, 2);
    const stateMap: Record<string, string> = {
      "48": "TX",
      "06": "CA",
      "36": "NY",
    };
    return stateMap[stateCode] || "US";
  }

  /**
   * Helper: Generate trade breakdown
   */
  private generateTradeBreakdown(): Record<string, number> {
    return {
      electrician: Math.floor(Math.random() * 100) + 20,
      plumber: Math.floor(Math.random() * 80) + 15,
      carpenter: Math.floor(Math.random() * 120) + 30,
      hvac: Math.floor(Math.random() * 60) + 10,
      roofer: Math.floor(Math.random() * 50) + 8,
      other: Math.floor(Math.random() * 100) + 20,
    };
  }

  /**
   * Helper: Generate top contractors
   */
  private generateTopContractors(): ContractorSummary[] {
    const trades = ["electrician", "plumber", "carpenter", "hvac", "roofer"];
    return trades.map((trade, i) => ({
      id: `contractor-${i}`,
      name: `Top ${trade.charAt(0).toUpperCase() + trade.slice(1)}`,
      trade,
      rating: 4.5 + Math.random() * 0.5,
      reviewCount: Math.floor(Math.random() * 200) + 20,
      availability: ["high", "medium", "low"][Math.floor(Math.random() * 3)] as any,
    }));
  }

  /**
   * Helper: Generate recent files
   */
  private generateRecentFiles(): FileSummary[] {
    const types = ["building-codes", "pricing-data", "contractor-profiles"];
    return types.map((type, i) => ({
      id: `file-${i}`,
      name: `${type}-${Date.now()}.pdf`,
      type,
      size: Math.floor(Math.random() * 5000) + 100,
      uploadedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      relevanceScore: Math.floor(Math.random() * 100),
    }));
  }

  /**
   * Helper: Generate opportunities
   */
  private generateOpportunities(): OpportunitySummary[] {
    return [
      {
        id: "opp-1",
        title: "High demand for electricians",
        type: "high-demand",
        score: 85,
        description: "Shortage of licensed electricians in this area",
      },
      {
        id: "opp-2",
        title: "Underserved HVAC market",
        type: "underserved",
        score: 72,
        description: "Limited HVAC contractors available",
      },
    ];
  }

  /**
   * Helper: Generate risks
   */
  private generateRisks(): RiskSummary[] {
    return [
      {
        id: "risk-1",
        title: "Recent code changes",
        severity: "high",
        description: "Building codes updated in the last 30 days",
      },
    ];
  }
}

// Singleton instance
export const scoutHeatmapIntelligence = new ScoutHeatmapIntelligence();
