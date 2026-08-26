/**
 * Scout mission recording.
 *
 * There is no scheduler or executor in this service. A request creates a durable
 * Mission Control item for manual review and reports that limitation honestly.
 */
import { randomUUID } from "crypto";
import { pool } from "../db";

export const SCOUT_MISSION_TYPES = [
  "codes",
  "prices",
  "local",
  "contractors",
  "market",
] as const;
export type ScoutMissionType = (typeof SCOUT_MISSION_TYPES)[number];

type MissionQuery = {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
};

export interface ManualMissionRecord {
  missionId: string;
  fips: string;
  type: ScoutMissionType;
  status: "recorded";
  createdAt: Date;
  impactScore: null;
  execution: {
    available: false;
    state: "manual_review_required";
  };
  evidence: {
    durable: true;
    impactScoreAvailable: false;
    executorAvailable: false;
  };
}

export interface ScoutMissionRepository {
  createMissionAction(input: {
    sourceId: string;
    countyFips: string;
    type: ScoutMissionType;
    requestedBy: string;
  }): Promise<{ id: string; createdAt: Date }>;
}

export class DatabaseScoutMissionRepository implements ScoutMissionRepository {
  constructor(private readonly database: MissionQuery = pool as unknown as MissionQuery) {}

  async createMissionAction(input: {
    sourceId: string;
    countyFips: string;
    type: ScoutMissionType;
    requestedBy: string;
  }): Promise<{ id: string; createdAt: Date }> {
    const result = await this.database.query(
      `INSERT INTO mission_control_actions
         (source_type, source_id, status, summary, suggested_fix, impact_score)
       VALUES ('scout', $1, 'open', $2, $3, NULL)
       ON CONFLICT (source_type, source_id) DO UPDATE
         SET updated_at = now()
       RETURNING id, created_at`,
      [
        input.sourceId,
        `Manual Scout ${input.type} review requested for county ${input.countyFips}`,
        `Review requested by user ${input.requestedBy}; no automated executor is configured.`,
      ]
    );
    return {
      id: String(result.rows[0].id),
      createdAt: new Date(result.rows[0].created_at),
    };
  }
}

export class ScoutScheduledMissions {
  constructor(private readonly repository: ScoutMissionRepository = new DatabaseScoutMissionRepository()) {}

  async recordManualMission(input: {
    fips: string;
    missionType: string;
    requestedBy: string;
    requestId?: string;
  }): Promise<ManualMissionRecord> {
    const fips = String(input.fips || "").trim();
    if (!/^\d{5}$/.test(fips)) throw new Error("A valid five-digit county FIPS is required");
    const type = String(input.missionType || "").trim() as ScoutMissionType;
    if (!SCOUT_MISSION_TYPES.includes(type)) throw new Error("Unsupported Scout mission type");
    const requestedBy = String(input.requestedBy || "").trim();
    if (!requestedBy) throw new Error("requestedBy is required");
    const requestId = String(input.requestId || randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    const sourceId = `manual:${fips}:${type}:${requestId}`.slice(0, 128);
    const action = await this.repository.createMissionAction({
      sourceId,
      countyFips: fips,
      type,
      requestedBy,
    });
    return {
      missionId: action.id,
      fips,
      type,
      status: "recorded",
      createdAt: action.createdAt,
      impactScore: null,
      execution: { available: false, state: "manual_review_required" },
      evidence: {
        durable: true,
        impactScoreAvailable: false,
        executorAvailable: false,
      },
    };
  }
}

export const scoutScheduledMissions = new ScoutScheduledMissions();

export function startScheduledMissions(): void {
  console.info("[Scout Missions] Automatic scheduling is not configured; manual review only.");
}

export function stopScheduledMissions(): void {
  // No timers exist.
}
