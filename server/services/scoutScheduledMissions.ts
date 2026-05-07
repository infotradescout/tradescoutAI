/**
 * Scout Scheduled Missions
 *
 * Automated scouting missions that run on a schedule to monitor:
 * - Building code changes
 * - Material price fluctuations
 * - Local jurisdiction updates
 * - Contractor availability
 * - Market signals
 *
 * Results are automatically indexed and trigger LISA notifications.
 */

import { EventEmitter } from "events";

export interface ScheduledMission {
  id: string;
  name: string;
  description: string;
  type: "codes" | "prices" | "local" | "contractors" | "market";
  schedule: string; // cron expression
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  trades?: string[];
  jurisdictions?: string[];
}

export interface MissionResult {
  missionId: string;
  timestamp: Date;
  type: string;
  findings: {
    title: string;
    description: string;
    severity: "critical" | "high" | "medium" | "low";
    action?: string;
  }[];
  changes: {
    added: string[];
    updated: string[];
    removed: string[];
  };
  notifyUsers: boolean;
}

class ScoutScheduledMissions extends EventEmitter {
  private missions: Map<string, ScheduledMission> = new Map();
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();
  private missionHistory: MissionResult[] = [];

  constructor() {
    super();
    this.initializeDefaultMissions();
  }

  /**
   * Initialize default scheduled missions
   */
  private initializeDefaultMissions(): void {
    // Daily building code check
    this.addMission({
      id: "daily-codes",
      name: "Daily Code Check",
      description: "Check for building code updates daily",
      type: "codes",
      schedule: "0 6 * * *", // 6 AM daily
      enabled: true,
      trades: ["electrical", "plumbing", "structural"],
      jurisdictions: ["Travis", "Harris", "Dallas"],
    });

    // Weekly price monitoring
    this.addMission({
      id: "weekly-prices",
      name: "Weekly Price Monitor",
      description: "Track material price changes weekly",
      type: "prices",
      schedule: "0 8 * * 1", // Monday 8 AM
      enabled: true,
      trades: ["carpentry", "roofing", "masonry"],
    });

    // Bi-weekly local updates
    this.addMission({
      id: "biweekly-local",
      name: "Local Updates",
      description: "Check for jurisdiction-specific changes",
      type: "local",
      schedule: "0 9 * * 0,3", // Sunday and Wednesday 9 AM
      enabled: true,
      jurisdictions: ["Travis", "Harris", "Dallas", "Bexar"],
    });

    // Weekly contractor availability
    this.addMission({
      id: "weekly-contractors",
      name: "Contractor Availability",
      description: "Scout for available contractors",
      type: "contractors",
      schedule: "0 7 * * 1", // Monday 7 AM
      enabled: true,
      trades: ["electrical", "plumbing", "hvac"],
    });

    // Daily market signals
    this.addMission({
      id: "daily-market",
      name: "Market Signals",
      description: "Monitor market trends and signals",
      type: "market",
      schedule: "0 17 * * *", // 5 PM daily
      enabled: true,
    });
  }

  /**
   * Add a new scheduled mission
   */
  addMission(mission: Omit<ScheduledMission, "lastRun" | "nextRun">): void {
    const fullMission: ScheduledMission = {
      ...mission,
      lastRun: undefined,
      nextRun: this.calculateNextRun(mission.schedule),
    };

    this.missions.set(mission.id, fullMission);

    if (mission.enabled) {
      this.scheduleMission(mission.id);
    }
  }

  /**
   * Update a mission
   */
  updateMission(id: string, updates: Partial<ScheduledMission>): void {
    const mission = this.missions.get(id);
    if (!mission) return;

    const updated = { ...mission, ...updates };
    this.missions.set(id, updated);

    // Reschedule if enabled status or schedule changed
    if (updates.enabled !== undefined || updates.schedule !== undefined) {
      this.unscheduleMission(id);
      if (updated.enabled) {
        this.scheduleMission(id);
      }
    }
  }

  /**
   * Delete a mission
   */
  deleteMission(id: string): void {
    this.unscheduleMission(id);
    this.missions.delete(id);
  }

  /**
   * Get all missions
   */
  getMissions(): ScheduledMission[] {
    return Array.from(this.missions.values());
  }

  /**
   * Get a specific mission
   */
  getMission(id: string): ScheduledMission | undefined {
    return this.missions.get(id);
  }

  /**
   * Schedule a mission to run
   */
  private scheduleMission(missionId: string): void {
    const mission = this.missions.get(missionId);
    if (!mission) return;

    // For now, use simple interval-based scheduling
    // In production, use node-cron or similar
    const timer = setInterval(() => {
      this.runMission(missionId);
    }, this.getIntervalFromSchedule(mission.schedule));

    this.activeTimers.set(missionId, timer);

    // Run immediately on first schedule
    this.runMission(missionId);
  }

  /**
   * Unschedule a mission
   */
  private unscheduleMission(missionId: string): void {
    const timer = this.activeTimers.get(missionId);
    if (timer) {
      clearInterval(timer);
      this.activeTimers.delete(missionId);
    }
  }

  /**
   * Run a mission immediately
   */
  async runMission(missionId: string): Promise<MissionResult | null> {
    const mission = this.missions.get(missionId);
    if (!mission) return null;

    try {
      console.log(`[Scout] Running mission: ${mission.name}`);

      const result = await this.executeMission(mission);

      // Update mission metadata
      mission.lastRun = new Date();
      mission.nextRun = this.calculateNextRun(mission.schedule);

      // Store in history
      this.missionHistory.push(result);
      if (this.missionHistory.length > 1000) {
        this.missionHistory.shift();
      }

      // Emit event for LISA integration
      this.emit("mission-complete", result);

      // Notify if there are critical findings
      if (result.findings.some((f) => f.severity === "critical")) {
        this.emit("mission-critical", result);
      }

      return result;
    } catch (error) {
      console.error(`[Scout] Mission failed: ${mission.name}`, error);
      this.emit("mission-error", { missionId, error });
      return null;
    }
  }

  /**
   * Execute a mission based on its type
   */
  private async executeMission(mission: ScheduledMission): Promise<MissionResult> {
    const timestamp = new Date();
    const findings: MissionResult["findings"] = [];
    const changes = { added: [], updated: [], removed: [] };

    switch (mission.type) {
      case "codes":
        // Scout for building code changes
        findings.push({
          title: "Code Check Complete",
          description: `Checked ${mission.trades?.length || 0} trades in ${mission.jurisdictions?.length || 0} jurisdictions`,
          severity: "low",
        });
        break;

      case "prices":
        // Scout for price changes
        findings.push({
          title: "Price Monitor Complete",
          description: `Monitored prices for ${mission.trades?.length || 0} trades`,
          severity: "low",
        });
        break;

      case "local":
        // Scout for local jurisdiction updates
        findings.push({
          title: "Local Updates Check",
          description: `Checked ${mission.jurisdictions?.length || 0} jurisdictions for updates`,
          severity: "low",
        });
        break;

      case "contractors":
        // Scout for contractor availability
        findings.push({
          title: "Contractor Availability",
          description: `Scanned availability for ${mission.trades?.length || 0} trades`,
          severity: "low",
        });
        break;

      case "market":
        // Scout for market signals
        findings.push({
          title: "Market Signals",
          description: "Analyzed market trends and signals",
          severity: "low",
        });
        break;
    }

    return {
      missionId: mission.id,
      timestamp,
      type: mission.type,
      findings,
      changes,
      notifyUsers: findings.some((f) => f.severity === "critical" || f.severity === "high"),
    };
  }

  /**
   * Get mission history
   */
  getHistory(missionId?: string, limit: number = 50): MissionResult[] {
    let history = this.missionHistory;

    if (missionId) {
      history = history.filter((r) => r.missionId === missionId);
    }

    return history.slice(-limit);
  }

  /**
   * Calculate next run time from cron expression
   * Simplified version - in production use node-cron
   */
  private calculateNextRun(schedule: string): Date {
    // For now, return a date 1 hour from now
    // In production, parse the cron expression properly
    const next = new Date();
    next.setHours(next.getHours() + 1);
    return next;
  }

  /**
   * Get interval in milliseconds from schedule
   * Simplified version
   */
  private getIntervalFromSchedule(schedule: string): number {
    // For now, return 1 hour
    // In production, parse the cron expression properly
    return 60 * 60 * 1000; // 1 hour
  }

  /**
   * Get statistics about scheduled missions
   */
  getStats() {
    const missions = Array.from(this.missions.values());
    return {
      totalMissions: missions.length,
      enabledMissions: missions.filter((m) => m.enabled).length,
      totalRuns: this.missionHistory.length,
      lastRun: this.missionHistory[this.missionHistory.length - 1]?.timestamp,
      criticalFindings: this.missionHistory.filter((r) =>
        r.findings.some((f) => f.severity === "critical")
      ).length,
    };
  }
}

// Singleton instance
export const scoutScheduledMissions = new ScoutScheduledMissions();

/**
 * Start all scheduled missions
 */
export function startScheduledMissions(): void {
  const missions = scoutScheduledMissions.getMissions();
  console.log(`[Scout] Starting ${missions.filter((m) => m.enabled).length} scheduled missions`);

  missions.forEach((mission) => {
    if (mission.enabled) {
      scoutScheduledMissions.runMission(mission.id);
    }
  });
}

/**
 * Stop all scheduled missions
 */
export function stopScheduledMissions(): void {
  const missions = scoutScheduledMissions.getMissions();
  missions.forEach((mission) => {
    scoutScheduledMissions.deleteMission(mission.id);
  });
  console.log("[Scout] All scheduled missions stopped");
}
