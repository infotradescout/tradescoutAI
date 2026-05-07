/**
 * Scout LISA Action Hooks
 *
 * Enables LISA to take automated actions based on Scout's intelligence findings.
 *
 * Actions include:
 * - Send notifications to affected users
 * - Update contractor rankings
 * - Trigger alerts
 * - Generate recommendations
 * - Update pricing
 * - Create tasks
 */

import { EventEmitter } from "events";

export type ActionType =
  | "notify-users"
  | "update-ranking"
  | "trigger-alert"
  | "generate-recommendation"
  | "update-pricing"
  | "create-task"
  | "send-email"
  | "create-post";

export interface LisaAction {
  id: string;
  type: ActionType;
  trigger: string; // What Scout finding triggered this
  target: {
    type: "user" | "group" | "contractor" | "market" | "system";
    id?: string;
    filter?: Record<string, any>;
  };
  payload: Record<string, any>;
  priority: "critical" | "high" | "normal" | "low";
  executed: boolean;
  executedAt?: Date;
  result?: Record<string, any>;
}

class ScoutLisaActionHooks extends EventEmitter {
  private actions: Map<string, LisaAction> = new Map();
  private actionHistory: LisaAction[] = [];
  private actionRules: ActionRule[] = [];

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  /**
   * Initialize default action rules
   */
  private initializeDefaultRules(): void {
    // Rule: Critical code change → notify affected contractors
    this.addActionRule({
      id: "rule-critical-code",
      name: "Critical Code Change Notification",
      trigger: "code-change",
      condition: (finding) => finding.severity === "critical",
      action: (finding) => ({
        type: "notify-users" as ActionType,
        target: {
          type: "group",
          filter: {
            trade: finding.metadata.trade,
            jurisdiction: finding.metadata.jurisdiction,
          },
        },
        payload: {
          subject: `Critical Code Update: ${finding.title}`,
          message: finding.description,
          actionUrl: `/scout/codes/${finding.metadata.jurisdiction}`,
        },
        priority: "critical",
      }),
    });

    // Rule: Price spike → alert contractors
    this.addActionRule({
      id: "rule-price-spike",
      name: "Material Price Spike Alert",
      trigger: "price-change",
      condition: (finding) => finding.metadata.percentChange > 10,
      action: (finding) => ({
        type: "trigger-alert" as ActionType,
        target: {
          type: "group",
          filter: { trade: finding.metadata.trade },
        },
        payload: {
          alertType: "price-spike",
          material: finding.metadata.material,
          percentChange: finding.metadata.percentChange,
          newPrice: finding.metadata.newPrice,
          recommendation: "Consider bulk purchasing or alternative materials",
        },
        priority: "high",
      }),
    });

    // Rule: New contractor available → update rankings
    this.addActionRule({
      id: "rule-new-contractor",
      name: "New Contractor Availability",
      trigger: "contractor-available",
      condition: () => true,
      action: (finding) => ({
        type: "update-ranking" as ActionType,
        target: {
          type: "contractor",
          id: finding.metadata.contractorId,
        },
        payload: {
          availabilityStatus: "available",
          updateRankings: true,
          notifyMatches: true,
        },
        priority: "normal",
      }),
    });

    // Rule: Market signal detected → generate recommendations
    this.addActionRule({
      id: "rule-market-signal",
      name: "Market Signal Recommendations",
      trigger: "market-signal",
      condition: (finding) => finding.confidence === "high",
      action: (finding) => ({
        type: "generate-recommendation" as ActionType,
        target: {
          type: "user",
          filter: { interestedInMarketSignals: true },
        },
        payload: {
          signal: finding.content,
          confidence: finding.confidence,
          recommendation: finding.metadata.recommendation,
          actionItems: finding.metadata.actionItems,
        },
        priority: "high",
      }),
    });
  }

  /**
   * Add an action rule
   */
  addActionRule(rule: ActionRule): void {
    this.actionRules.push(rule);
    console.log(`[LISA Hooks] Added action rule: ${rule.name}`);
  }

  /**
   * Process a Scout finding and generate actions
   */
  async processScoutFinding(finding: any): Promise<LisaAction[]> {
    const actions: LisaAction[] = [];

    // Find matching rules
    const matchingRules = this.actionRules.filter(
      (rule) => rule.trigger === finding.type && rule.condition(finding)
    );

    // Generate actions from matching rules
    for (const rule of matchingRules) {
      const actionPayload = rule.action(finding);
      const action: LisaAction = {
        id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...actionPayload,
        trigger: finding.id,
        executed: false,
      };

      this.actions.set(action.id, action);
      actions.push(action);

      console.log(`[LISA Hooks] Generated action: ${action.type} (${action.id})`);

      // Execute action
      await this.executeAction(action);
    }

    return actions;
  }

  /**
   * Execute an action
   */
  async executeAction(action: LisaAction): Promise<void> {
    try {
      console.log(`[LISA Hooks] Executing action: ${action.type}`);

      switch (action.type) {
        case "notify-users":
          await this.notifyUsers(action);
          break;
        case "update-ranking":
          await this.updateRanking(action);
          break;
        case "trigger-alert":
          await this.triggerAlert(action);
          break;
        case "generate-recommendation":
          await this.generateRecommendation(action);
          break;
        case "update-pricing":
          await this.updatePricing(action);
          break;
        case "create-task":
          await this.createTask(action);
          break;
        case "send-email":
          await this.sendEmail(action);
          break;
        case "create-post":
          await this.createPost(action);
          break;
      }

      // Mark as executed
      action.executed = true;
      action.executedAt = new Date();
      action.result = { status: "success" };

      console.log(`[LISA Hooks] Action executed successfully: ${action.id}`);
      this.emit("action-executed", action);
    } catch (error) {
      console.error(`[LISA Hooks] Action failed: ${action.id}`, error);
      action.result = { status: "failed", error: String(error) };
      this.emit("action-failed", { action, error });
    }

    // Add to history
    this.actionHistory.push(action);
    if (this.actionHistory.length > 10000) {
      this.actionHistory.shift();
    }
  }

  /**
   * Notify users
   */
  private async notifyUsers(action: LisaAction): Promise<void> {
    console.log(`[LISA Hooks] Notifying users:`, action.target);
    // In production, send notifications via email, SMS, push, etc.
    this.emit("notification", {
      type: "user-notification",
      target: action.target,
      payload: action.payload,
    });
  }

  /**
   * Update contractor ranking
   */
  private async updateRanking(action: LisaAction): Promise<void> {
    console.log(`[LISA Hooks] Updating ranking for contractor:`, action.target.id);
    this.emit("ranking-update", {
      contractorId: action.target.id,
      payload: action.payload,
    });
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(action: LisaAction): Promise<void> {
    console.log(`[LISA Hooks] Triggering alert:`, action.payload.alertType);
    this.emit("alert", {
      type: action.payload.alertType,
      target: action.target,
      payload: action.payload,
    });
  }

  /**
   * Generate recommendation
   */
  private async generateRecommendation(action: LisaAction): Promise<void> {
    console.log(`[LISA Hooks] Generating recommendation`);
    this.emit("recommendation", {
      target: action.target,
      payload: action.payload,
    });
  }

  /**
   * Update pricing
   */
  private async updatePricing(action: LisaAction): Promise<void> {
    console.log(`[LISA Hooks] Updating pricing`);
    this.emit("pricing-update", action.payload);
  }

  /**
   * Create task
   */
  private async createTask(action: LisaAction): Promise<void> {
    console.log(`[LISA Hooks] Creating task`);
    this.emit("task-create", action.payload);
  }

  /**
   * Send email
   */
  private async sendEmail(action: LisaAction): Promise<void> {
    console.log(`[LISA Hooks] Sending email`);
    this.emit("email", action.payload);
  }

  /**
   * Create post
   */
  private async createPost(action: LisaAction): Promise<void> {
    console.log(`[LISA Hooks] Creating post`);
    this.emit("post-create", action.payload);
  }

  /**
   * Get action history
   */
  getHistory(limit: number = 100): LisaAction[] {
    return this.actionHistory.slice(-limit);
  }

  /**
   * Get pending actions
   */
  getPendingActions(): LisaAction[] {
    return Array.from(this.actions.values()).filter((a) => !a.executed);
  }

  /**
   * Get action statistics
   */
  getStats() {
    return {
      totalActions: this.actionHistory.length,
      pendingActions: this.getPendingActions().length,
      actionsByType: this.groupBy(this.actionHistory, (a) => a.type),
      actionsByPriority: this.groupBy(this.actionHistory, (a) => a.priority),
      successRate:
        this.actionHistory.length > 0
          ? (
              (this.actionHistory.filter((a) => a.result?.status === "success").length /
                this.actionHistory.length) *
              100
            ).toFixed(2) + "%"
          : "N/A",
    };
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

interface ActionRule {
  id: string;
  name: string;
  trigger: string;
  condition: (finding: any) => boolean;
  action: (finding: any) => Omit<LisaAction, "id" | "trigger" | "executed">;
}

// Singleton instance
export const scoutLisaActionHooks = new ScoutLisaActionHooks();

/**
 * Hook Scout learning pipeline to LISA actions
 */
export function setupScoutLisaActionHooks(scoutLearningPipeline: any): void {
  scoutLearningPipeline.on("intelligence-indexed", async (event: any) => {
    // When Scout indexes new intelligence, process it for actions
    for (const finding of event.intelligence) {
      await scoutLisaActionHooks.processScoutFinding(finding);
    }
  });

  console.log("[LISA Hooks] Scout-LISA action hooks initialized");
}
