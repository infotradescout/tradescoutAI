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

import { unavailableRuntimeCapability } from "./runtimeCapability";


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

class ScoutLisaActionHooks {
  addActionRule(_rule: ActionRule): void {
    unavailableRuntimeCapability(
      "LISA action rule registration",
      "a durable action repository and executor are not configured"
    );
  }

  async processScoutFinding(_finding: any): Promise<LisaAction[]> {
    return unavailableRuntimeCapability(
      "LISA action generation",
      "a durable action repository and executor are not configured"
    );
  }

  async executeAction(_action: LisaAction): Promise<void> {
    unavailableRuntimeCapability(
      "LISA action execution",
      "an operational action provider and durable receipt ledger are not configured"
    );
  }

  getHistory(_limit: number = 100): LisaAction[] {
    return unavailableRuntimeCapability(
      "LISA action history",
      "a durable action repository is not configured"
    );
  }

  getPendingActions(): LisaAction[] {
    return unavailableRuntimeCapability(
      "pending LISA actions",
      "a durable action repository is not configured"
    );
  }

  getStats() {
    return {
      available: false as const,
      durable: false as const,
      reason: "LISA action repository and executor are not configured",
      totalActions: 0,
      pendingActions: 0,
      actionsByType: {} as Record<string, number>,
      actionsByPriority: {} as Record<string, number>,
      successRate: "unavailable",
    };
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
export function setupScoutLisaActionHooks(_scoutLearningPipeline: any): void {
  console.warn(
    "[LISA Hooks] unavailable: no durable action repository or executor is configured"
  );
}
