/**
 * Scout Proactive Alert Generator
 *
 * Integrates with the Agent Council to generate intelligent alerts and insights
 * that are automatically dispatched via the Scout Outbound Dispatcher (SOD).
 *
 * This transforms Scout from reactive (responding to user queries) to proactive
 * (automatically detecting opportunities and risks).
 */

import ScoutOutboundDispatcher from "./scoutOutboundDispatcher";

export interface AlertTrigger {
  trigger_type:
    | "price_spike"
    | "demand_surge"
    | "sentiment_shift"
    | "contractor_shortage"
    | "market_gap"
    | "risk_detected";
  condition: string;
  threshold: number;
  current_value: number;
}

export interface ProactiveAlert {
  alert_id: string;
  alert_type: string;
  severity: "critical" | "high" | "medium" | "low";
  trigger: AlertTrigger;
  insight: string;
  recommendation: string;
  affected_region?: string;
  affected_category?: string;
  timestamp: number;
}

/**
 * Scout Proactive Alert Generator Service
 */
export class ScoutProactiveAlerts {
  private sodService: ScoutOutboundDispatcher;
  private alertHistory: ProactiveAlert[] = [];
  private maxHistorySize: number = 5000;

  constructor(sodService: ScoutOutboundDispatcher) {
    this.sodService = sodService;
  }

  /**
   * Generate marketplace trend alerts
   */
  async generateMarketplaceTrendAlerts(): Promise<ProactiveAlert[]> {
    const alerts: ProactiveAlert[] = [];

    // Simulate detection of roofing material price spike
    const priceSpikeAlert: ProactiveAlert = {
      alert_id: `alert_${Date.now()}_roofing_price`,
      alert_type: "marketplace_trend",
      severity: "high",
      trigger: {
        trigger_type: "price_spike",
        condition: "Roofing materials price increase > 10% in 7 days",
        threshold: 10,
        current_value: 15.2,
      },
      insight:
        "Roofing materials have spiked 15.2% in the last 7 days, significantly above the 10% threshold.",
      recommendation:
        "Consider increasing inventory of roofing materials or notifying suppliers to prepare for higher demand.",
      affected_category: "Building Materials",
      timestamp: Date.now(),
    };

    alerts.push(priceSpikeAlert);

    // Simulate detection of demand surge
    const demandSurgeAlert: ProactiveAlert = {
      alert_id: `alert_${Date.now()}_electrical_demand`,
      alert_type: "marketplace_trend",
      severity: "medium",
      trigger: {
        trigger_type: "demand_surge",
        condition: "Electrical contractor inquiries > 30% increase",
        threshold: 30,
        current_value: 42,
      },
      insight:
        "Electrical contractor inquiries have surged 42% compared to the previous week, indicating strong market demand.",
      recommendation: "Recruit additional electrical contractors to capture this surge in demand.",
      affected_category: "Electrical",
      timestamp: Date.now(),
    };

    alerts.push(demandSurgeAlert);

    return alerts;
  }

  /**
   * Generate contractor market alerts
   */
  async generateContractorMarketAlerts(): Promise<ProactiveAlert[]> {
    const alerts: ProactiveAlert[] = [];

    // Simulate detection of contractor shortage
    const shortageAlert: ProactiveAlert = {
      alert_id: `alert_${Date.now()}_plumbing_shortage`,
      alert_type: "contractor_alert",
      severity: "high",
      trigger: {
        trigger_type: "contractor_shortage",
        condition: "Available plumbing contractors < 50",
        threshold: 50,
        current_value: 35,
      },
      insight:
        "Only 35 plumbing contractors are currently available, well below the healthy threshold of 50.",
      recommendation:
        "Launch a targeted recruitment campaign for plumbing contractors to meet market demand.",
      affected_category: "Plumbing",
      timestamp: Date.now(),
    };

    alerts.push(shortageAlert);

    return alerts;
  }

  /**
   * Generate community sentiment alerts
   */
  async generateCommunitySentimentAlerts(): Promise<ProactiveAlert[]> {
    const alerts: ProactiveAlert[] = [];

    // Simulate detection of sentiment shift
    const sentimentAlert: ProactiveAlert = {
      alert_id: `alert_${Date.now()}_downtown_sentiment`,
      alert_type: "community_insight",
      severity: "medium",
      trigger: {
        trigger_type: "sentiment_shift",
        condition: "Downtown district sentiment shift > -20 points",
        threshold: -20,
        current_value: -28,
      },
      insight:
        "The Downtown District community sentiment has shifted negatively by 28 points, primarily driven by safety concerns.",
      recommendation:
        "Increase community engagement and transparency initiatives in the Downtown District to address safety concerns.",
      affected_region: "Downtown District",
      timestamp: Date.now(),
    };

    alerts.push(sentimentAlert);

    return alerts;
  }

  /**
   * Generate opportunity detection alerts
   */
  async generateOpportunityAlerts(): Promise<ProactiveAlert[]> {
    const alerts: ProactiveAlert[] = [];

    // Simulate detection of market gap
    const opportunityAlert: ProactiveAlert = {
      alert_id: `alert_${Date.now()}_hvac_opportunity`,
      alert_type: "opportunity_detected",
      severity: "high",
      trigger: {
        trigger_type: "market_gap",
        condition: "HVAC contractor demand > supply by 25%",
        threshold: 25,
        current_value: 35,
      },
      insight:
        "HVAC contractor demand exceeds supply by 35%, representing a significant market gap and revenue opportunity.",
      recommendation:
        "Prioritize recruitment of HVAC contractors. This market segment could generate $500K+ in annual revenue.",
      affected_category: "HVAC",
      timestamp: Date.now(),
    };

    alerts.push(opportunityAlert);

    return alerts;
  }

  /**
   * Generate risk detection alerts
   */
  async generateRiskAlerts(): Promise<ProactiveAlert[]> {
    const alerts: ProactiveAlert[] = [];

    // Simulate detection of quality risk
    const riskAlert: ProactiveAlert = {
      alert_id: `alert_${Date.now()}_quality_risk`,
      alert_type: "risk_detected",
      severity: "critical",
      trigger: {
        trigger_type: "risk_detected",
        condition: "Contractor complaint rate > 5%",
        threshold: 5,
        current_value: 7.2,
      },
      insight:
        "Contractor complaint rate has reached 7.2%, exceeding the 5% safety threshold. This could impact platform reputation.",
      recommendation:
        "Immediately review recent complaints and implement quality assurance measures. Consider suspending low-rated contractors.",
      timestamp: Date.now(),
    };

    alerts.push(riskAlert);

    return alerts;
  }

  /**
   * Generate all proactive alerts
   */
  async generateAllAlerts(): Promise<ProactiveAlert[]> {
    const [marketplace, contractor, community, opportunity, risk] = await Promise.all([
      this.generateMarketplaceTrendAlerts(),
      this.generateContractorMarketAlerts(),
      this.generateCommunitySentimentAlerts(),
      this.generateOpportunityAlerts(),
      this.generateRiskAlerts(),
    ]);

    const allAlerts = [...marketplace, ...contractor, ...community, ...opportunity, ...risk];

    // Store in history
    allAlerts.forEach((alert) => {
      this.alertHistory.push(alert);
    });

    // Keep history size manageable
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(-this.maxHistorySize);
    }

    // Dispatch alerts via SOD
    allAlerts.forEach((alert) => {
      this.sodService.queueEvent({
        event_type: alert.alert_type as any,
        priority: alert.severity,
        source: "analysis",
        payload: alert,
        metadata: {
          tags: [alert.alert_type, alert.severity],
        },
      });
    });

    return allAlerts;
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): ProactiveAlert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: "critical" | "high" | "medium" | "low"): ProactiveAlert[] {
    return this.alertHistory.filter((a) => a.severity === severity);
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(): {
    total_alerts: number;
    critical_alerts: number;
    high_alerts: number;
    medium_alerts: number;
    low_alerts: number;
    most_common_trigger: string;
  } {
    const critical = this.alertHistory.filter((a) => a.severity === "critical").length;
    const high = this.alertHistory.filter((a) => a.severity === "high").length;
    const medium = this.alertHistory.filter((a) => a.severity === "medium").length;
    const low = this.alertHistory.filter((a) => a.severity === "low").length;

    // Find most common trigger type
    const triggerCounts: Record<string, number> = {};
    this.alertHistory.forEach((alert) => {
      triggerCounts[alert.trigger.trigger_type] =
        (triggerCounts[alert.trigger.trigger_type] || 0) + 1;
    });

    const mostCommonTrigger =
      Object.entries(triggerCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "unknown";

    return {
      total_alerts: this.alertHistory.length,
      critical_alerts: critical,
      high_alerts: high,
      medium_alerts: medium,
      low_alerts: low,
      most_common_trigger: mostCommonTrigger,
    };
  }
}

export default ScoutProactiveAlerts;
