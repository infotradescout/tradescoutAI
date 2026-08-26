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

import { unavailableRuntimeCapability } from "./runtimeCapability";
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

class ScoutExecutiveBriefs {
  async generateWeeklyBrief(_brand?: BrandType): Promise<ExecutiveBrief> {
    return unavailableRuntimeCapability(
      "weekly executive brief generation",
      "a durable brief repository and source aggregation pipeline are not configured"
    );
  }

  async generateMonthlyBrief(_brand?: BrandType): Promise<ExecutiveBrief> {
    return unavailableRuntimeCapability(
      "monthly executive brief generation",
      "a durable brief repository and source aggregation pipeline are not configured"
    );
  }

  getBrief(_id: string): ExecutiveBrief | undefined {
    return unavailableRuntimeCapability(
      "executive brief lookup",
      "a durable brief repository is not configured"
    );
  }

  getAllBriefs(_brand?: BrandType, _limit: number = 50): ExecutiveBrief[] {
    return unavailableRuntimeCapability(
      "executive brief listing",
      "a durable brief repository is not configured"
    );
  }

  async sendBrief(_briefId: string, _recipients: string[]): Promise<void> {
    unavailableRuntimeCapability(
      "executive brief delivery",
      "a durable delivery provider and receipt ledger are not configured"
    );
  }

  markBriefOpened(_briefId: string): void {
    unavailableRuntimeCapability(
      "executive brief open tracking",
      "a durable delivery receipt ledger is not configured"
    );
  }

  getStats() {
    return {
      available: false as const,
      durable: false as const,
      reason: "executive brief repository is not configured",
      totalBriefs: 0,
      weeklyBriefs: 0,
      monthlyBriefs: 0,
      sentBriefs: 0,
      openedBriefs: 0,
      openRate: "unavailable",
    };
  }
}

// Singleton instance
export const scoutExecutiveBriefs = new ScoutExecutiveBriefs();
