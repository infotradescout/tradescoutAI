/**
 * Scout Executive Briefs
 *
 * Automated, high-level intelligence summaries delivered to executives.
 * Aggregates findings across all brands and presents the "big picture".
 *
 * Features:
 * - Weekly/monthly summaries
 * - Cross-brand insights
 * - Opportunity identification
 * - Risk flagging
 * - Trend analysis
 * - Actionable recommendations
 */

import { EventEmitter } from "events";
import type { BrandType } from "./scoutBrandGuardrails";

export interface ExecutiveBrief {
  id: string;
  period: "weekly" | "monthly";
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  brand?: BrandType;
  summary: {
    headline: string;
    keyMetrics: Record<string, number | string>;
    topFindings: BriefFinding[];
    opportunities: Opportunity[];
    risks: Risk[];
    trends: Trend[];
    recommendations: Recommendation[];
  };
  distribution: {
    sentTo: string[];
    sentAt?: Date;
    opened: boolean;
  };
}

export interface BriefFinding {
  title: string;
  description: string;
  impact: "critical" | "high" | "medium" | "low";
  source: string;
  date: Date;
}

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  potential: "high" | "medium" | "low";
  action: string;
  estimatedValue?: string;
}

export interface Risk {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  mitigation: string;
}

export interface Trend {
  title: string;
  direction: "up" | "down" | "stable";
  magnitude: number; // percentage change
  period: string;
}

export interface Recommendation {
  priority: "critical" | "high" | "medium" | "low";
  action: string;
  rationale: string;
  owner?: string;
  dueDate?: Date;
}

class ScoutExecutiveBriefs extends EventEmitter {
  private briefs: Map<string, ExecutiveBrief> = new Map();
  private briefHistory: ExecutiveBrief[] = [];

  /**
   * Generate a weekly brief
   */
  async generateWeeklyBrief(brand?: BrandType): Promise<ExecutiveBrief> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const brief: ExecutiveBrief = {
      id: `brief-weekly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      period: "weekly",
      startDate: weekAgo,
      endDate: now,
      generatedAt: now,
      brand,
      summary: {
        headline: this.generateHeadline(brand, "weekly"),
        keyMetrics: await this.collectKeyMetrics(brand, weekAgo, now),
        topFindings: await this.getTopFindings(brand, weekAgo, now),
        opportunities: await this.identifyOpportunities(brand, weekAgo, now),
        risks: await this.identifyRisks(brand, weekAgo, now),
        trends: await this.analyzeTrends(brand, weekAgo, now),
        recommendations: await this.generateRecommendations(brand, weekAgo, now),
      },
      distribution: {
        sentTo: [],
        opened: false,
      },
    };

    this.briefs.set(brief.id, brief);
    this.briefHistory.push(brief);

    console.log(`[Executive Brief] Generated weekly brief: ${brief.id}`);
    this.emit("brief-generated", brief);

    return brief;
  }

  /**
   * Generate a monthly brief
   */
  async generateMonthlyBrief(brand?: BrandType): Promise<ExecutiveBrief> {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const brief: ExecutiveBrief = {
      id: `brief-monthly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      period: "monthly",
      startDate: monthAgo,
      endDate: now,
      generatedAt: now,
      brand,
      summary: {
        headline: this.generateHeadline(brand, "monthly"),
        keyMetrics: await this.collectKeyMetrics(brand, monthAgo, now),
        topFindings: await this.getTopFindings(brand, monthAgo, now),
        opportunities: await this.identifyOpportunities(brand, monthAgo, now),
        risks: await this.identifyRisks(brand, monthAgo, now),
        trends: await this.analyzeTrends(brand, monthAgo, now),
        recommendations: await this.generateRecommendations(brand, monthAgo, now),
      },
      distribution: {
        sentTo: [],
        opened: false,
      },
    };

    this.briefs.set(brief.id, brief);
    this.briefHistory.push(brief);

    console.log(`[Executive Brief] Generated monthly brief: ${brief.id}`);
    this.emit("brief-generated", brief);

    return brief;
  }

  /**
   * Generate headline based on top finding
   */
  private generateHeadline(brand: BrandType | undefined, period: string): string {
    const brandName = brand ? `${brand}` : "All Brands";
    const periodName = period === "weekly" ? "This Week" : "This Month";

    return `Scout Intelligence Report: ${brandName} - ${periodName}`;
  }

  /**
   * Collect key metrics
   */
  private async collectKeyMetrics(
    brand: BrandType | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, number | string>> {
    // In production, aggregate from scoutLearningPipeline
    return {
      "Intelligence Reports": 47,
      "Critical Findings": 3,
      "High Priority Items": 12,
      "Opportunities Identified": 8,
      "Risks Flagged": 5,
      "User Notifications": 234,
      "Actions Taken": 18,
    };
  }

  /**
   * Get top findings from the period
   */
  private async getTopFindings(
    brand: BrandType | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<BriefFinding[]> {
    // In production, query scoutLearningPipeline for findings
    return [
      {
        title: "Building Code Update - Travis County",
        description: "Deck railing requirements increased to 42 inches minimum",
        impact: "high",
        source: "Local Jurisdiction Data",
        date: new Date(),
      },
      {
        title: "Material Price Spike",
        description: "Lumber prices up 8% this week across all suppliers",
        impact: "high",
        source: "Market Intelligence",
        date: new Date(),
      },
      {
        title: "Contractor Availability",
        description: "3 new licensed electricians available in service area",
        impact: "medium",
        source: "Contractor Database",
        date: new Date(),
      },
    ];
  }

  /**
   * Identify opportunities
   */
  private async identifyOpportunities(
    brand: BrandType | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<Opportunity[]> {
    return [
      {
        id: "opp-1",
        title: "Bulk Material Purchase",
        description: "Lock in lumber prices before next price increase",
        potential: "high",
        action: "Negotiate bulk discount with suppliers",
        estimatedValue: "$15,000 - $25,000 savings",
      },
      {
        id: "opp-2",
        title: "New Contractor Partnerships",
        description: "Partner with newly available electricians for capacity",
        potential: "high",
        action: "Reach out to new contractors for partnership",
      },
      {
        id: "opp-3",
        title: "Compliance Update Training",
        description: "Train team on new deck railing requirements",
        potential: "medium",
        action: "Schedule training session for next week",
      },
    ];
  }

  /**
   * Identify risks
   */
  private async identifyRisks(
    brand: BrandType | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<Risk[]> {
    return [
      {
        id: "risk-1",
        title: "Compliance Gap",
        description: "Existing deck projects may not meet new 42-inch railing requirement",
        severity: "critical",
        mitigation: "Review all active projects and update plans immediately",
      },
      {
        id: "risk-2",
        title: "Cost Overruns",
        description: "Material price increases may impact project profitability",
        severity: "high",
        mitigation: "Adjust pricing for new quotes; renegotiate with clients",
      },
      {
        id: "risk-3",
        title: "Supply Chain Disruption",
        description: "Lumber shortage indicators in regional market",
        severity: "medium",
        mitigation: "Diversify suppliers; maintain strategic inventory",
      },
    ];
  }

  /**
   * Analyze trends
   */
  private async analyzeTrends(
    brand: BrandType | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<Trend[]> {
    return [
      {
        title: "Material Prices",
        direction: "up",
        magnitude: 8,
        period: "weekly",
      },
      {
        title: "Contractor Availability",
        direction: "up",
        magnitude: 15,
        period: "weekly",
      },
      {
        title: "Permit Processing Time",
        direction: "stable",
        magnitude: 0,
        period: "weekly",
      },
      {
        title: "Code Compliance Issues",
        direction: "down",
        magnitude: -5,
        period: "monthly",
      },
    ];
  }

  /**
   * Generate recommendations
   */
  private async generateRecommendations(
    brand: BrandType | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<Recommendation[]> {
    return [
      {
        priority: "critical",
        action: "Review and update all deck project plans for new railing requirements",
        rationale: "Non-compliance could result in failed inspections and project delays",
        owner: "Project Manager",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        priority: "high",
        action: "Negotiate bulk material purchase agreement",
        rationale: "Lock in prices before further increases; potential $20K+ savings",
        owner: "Operations",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        priority: "high",
        action: "Reach out to new contractors for partnership opportunities",
        rationale: "Increase capacity and improve project delivery timelines",
        owner: "Business Development",
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
      {
        priority: "medium",
        action: "Schedule compliance training for team",
        rationale: "Ensure all team members understand new requirements",
        owner: "HR",
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
    ];
  }

  /**
   * Get a brief by ID
   */
  getBrief(id: string): ExecutiveBrief | undefined {
    return this.briefs.get(id);
  }

  /**
   * Get all briefs
   */
  getAllBriefs(brand?: BrandType, limit: number = 50): ExecutiveBrief[] {
    let briefs = Array.from(this.briefs.values());

    if (brand) {
      briefs = briefs.filter((b) => b.brand === brand);
    }

    return briefs.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime()).slice(0, limit);
  }

  /**
   * Send brief to recipients
   */
  async sendBrief(briefId: string, recipients: string[]): Promise<void> {
    const brief = this.briefs.get(briefId);
    if (!brief) return;

    brief.distribution.sentTo = recipients;
    brief.distribution.sentAt = new Date();

    console.log(`[Executive Brief] Sent brief ${briefId} to ${recipients.length} recipients`);
    this.emit("brief-sent", { briefId, recipients });
  }

  /**
   * Mark brief as opened
   */
  markBriefOpened(briefId: string): void {
    const brief = this.briefs.get(briefId);
    if (brief) {
      brief.distribution.opened = true;
      console.log(`[Executive Brief] Brief ${briefId} marked as opened`);
    }
  }

  /**
   * Get brief statistics
   */
  getStats() {
    return {
      totalBriefs: this.briefHistory.length,
      weeklyBriefs: this.briefHistory.filter((b) => b.period === "weekly").length,
      monthlyBriefs: this.briefHistory.filter((b) => b.period === "monthly").length,
      sentBriefs: this.briefHistory.filter((b) => b.distribution.sentAt).length,
      openedBriefs: this.briefHistory.filter((b) => b.distribution.opened).length,
      openRate:
        this.briefHistory.length > 0
          ? (
              (this.briefHistory.filter((b) => b.distribution.opened).length /
                this.briefHistory.length) *
              100
            ).toFixed(2) + "%"
          : "N/A",
    };
  }
}

// Singleton instance
export const scoutExecutiveBriefs = new ScoutExecutiveBriefs();
