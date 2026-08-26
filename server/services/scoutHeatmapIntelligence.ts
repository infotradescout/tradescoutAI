/**
 * Evidence-backed Scout heatmap intelligence.
 *
 * Every value here is derived from bounded database reads. Unknown opportunity,
 * risk, ranking, and trend signals stay unknown instead of being synthesized.
 */
import { pool } from "../db";
import {
  MAX_SCOUT_COUNTIES,
  scoutVisualFileSorting,
  type CountyFileOrganization,
  type CountyFile,
} from "./scoutVisualFileSorting";
import { scoutScheduledMissions, type ManualMissionRecord } from "./scoutScheduledMissions";

type Queryable = {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
};

export interface CountyIntelligenceData {
  fips: string;
  county: string;
  state: string;
  scoutFindings: {
    notes: number;
    byCategory: Record<string, number>;
  };
  contractors: {
    total: number;
    active: number;
    byTrade: Record<string, number>;
    topContractors: [];
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
    recentFiles: CountyFile[];
  };
  opportunities: [];
  risks: [];
  metrics: {
    activityScore: number;
    opportunityScore: null;
    dataCompleteness: number;
    trendDirection: null;
    competitionLevel: null;
  };
  evidence: {
    source: "database";
    opportunityEvidenceAvailable: false;
    riskEvidenceAvailable: false;
    rankingEvidenceAvailable: false;
  };
  lastUpdated: Date;
}

export interface HeatmapDataRequest {
  counties?: string[];
  includeContractors?: boolean;
  includeUsers?: boolean;
  includeFiles?: boolean;
  includeOpportunities?: boolean;
  timeframe?: "7d" | "30d" | "90d" | "all";
}

function normalizeFips(value: unknown): string {
  const fips = String(value || "").trim();
  if (!/^\d{5}$/.test(fips)) throw new Error("A valid five-digit county FIPS is required");
  return fips;
}

export class ScoutHeatmapIntelligence {
  constructor(
    private readonly database: Queryable = pool as unknown as Queryable,
    private readonly fileReader = scoutVisualFileSorting
  ) {}

  async getCountyIntelligence(fips: string): Promise<CountyIntelligenceData | null> {
    const results = await this.getMultiCountyIntelligence({ counties: [fips] });
    return results[0] || null;
  }

  async getMultiCountyIntelligence(request: HeatmapDataRequest): Promise<CountyIntelligenceData[]> {
    let requested = Array.from(new Set((request.counties || []).map(normalizeFips)));
    if (requested.length > MAX_SCOUT_COUNTIES) {
      throw new Error(`A maximum of ${MAX_SCOUT_COUNTIES} counties can be requested`);
    }

    if (requested.length === 0) {
      const defaults = await this.database.query(
        "SELECT fips FROM counties ORDER BY fips LIMIT $1",
        [MAX_SCOUT_COUNTIES]
      );
      requested = defaults.rows.map((row) => String(row.fips));
    }
    if (requested.length === 0) return [];

    const [counties, contractors, users, notes, files] = await Promise.all([
      this.database.query(
        `SELECT fips, name, state_code
           FROM counties
          WHERE fips = ANY($1::varchar[])
          ORDER BY fips`,
        [requested]
      ),
      this.database.query(
        `SELECT c.fips,
                count(DISTINCT ct.id)::int AS total,
                count(DISTINCT ct.id) FILTER (WHERE ct.is_active = true)::int AS active
           FROM counties c
           LEFT JOIN contractor_counties cc ON cc.county_id = c.id
           LEFT JOIN contractors ct ON ct.id = cc.contractor_id
          WHERE c.fips = ANY($1::varchar[])
          GROUP BY c.fips`,
        [requested]
      ),
      this.database.query(
        `SELECT county_fips AS fips,
                count(*)::int AS total,
                count(*) FILTER (WHERE role = 'homeowner')::int AS homeowners,
                count(*) FILTER (WHERE role = 'contractor')::int AS contractors,
                count(*) FILTER (WHERE updated_at >= now() - interval '30 days')::int AS recent
           FROM users
          WHERE county_fips = ANY($1::varchar[])
          GROUP BY county_fips`,
        [requested]
      ),
      this.database.query(
        `SELECT county_fips AS fips, category::text AS category, count(*)::int AS count
           FROM county_notes
          WHERE county_fips = ANY($1::varchar[])
          GROUP BY county_fips, category`,
        [requested]
      ),
      this.fileReader.getCountyFilesBatch(requested, 10),
    ]);

    const contractorMap = new Map(
      contractors.rows.map((row) => [
        String(row.fips),
        { total: Number(row.total || 0), active: Number(row.active || 0) },
      ])
    );
    const userMap = new Map(
      users.rows.map((row) => [
        String(row.fips),
        {
          total: Number(row.total || 0),
          homeowners: Number(row.homeowners || 0),
          contractors: Number(row.contractors || 0),
          recent: Number(row.recent || 0),
        },
      ])
    );
    const noteMap = new Map<string, Record<string, number>>();
    for (const row of notes.rows) {
      const key = String(row.fips);
      const categories = noteMap.get(key) || {};
      categories[String(row.category)] = Number(row.count || 0);
      noteMap.set(key, categories);
    }

    return counties.rows.map((county) => {
      const fips = String(county.fips);
      const contractor = contractorMap.get(fips) || { total: 0, active: 0 };
      const countyUsers = userMap.get(fips) || {
        total: 0,
        homeowners: 0,
        contractors: 0,
        recent: 0,
      };
      const categories = noteMap.get(fips) || {};
      const fileOrg: CountyFileOrganization | undefined = files.get(fips);
      const notesTotal = Object.values(categories).reduce((sum, value) => sum + value, 0);
      const completenessSignals = [
        contractor.total > 0,
        countyUsers.total > 0,
        notesTotal > 0,
        Number(fileOrg?.totalFiles || 0) > 0,
      ].filter(Boolean).length;

      return {
        fips,
        county: String(county.name),
        state: String(county.state_code),
        scoutFindings: { notes: notesTotal, byCategory: categories },
        contractors: {
          total: contractor.total,
          active: contractor.active,
          byTrade: {},
          topContractors: [],
        },
        users: {
          total: countyUsers.total,
          homeowners: countyUsers.homeowners,
          contractors: countyUsers.contractors,
          recentActivity: countyUsers.recent,
        },
        files: {
          total: Number(fileOrg?.totalFiles || 0),
          byType: fileOrg?.filesByType || {},
          recentFiles: fileOrg?.files || [],
        },
        opportunities: [],
        risks: [],
        metrics: {
          activityScore: Math.min(100, contractor.active + countyUsers.recent),
          opportunityScore: null,
          dataCompleteness: completenessSignals * 25,
          trendDirection: null,
          competitionLevel: null,
        },
        evidence: {
          source: "database",
          opportunityEvidenceAvailable: false,
          riskEvidenceAvailable: false,
          rankingEvidenceAvailable: false,
        },
        lastUpdated: fileOrg?.lastModified || new Date(),
      } satisfies CountyIntelligenceData;
    });
  }

  async triggerCountyScouting(
    fips: string,
    missionType: string,
    requestedBy: string,
    requestId?: string
  ): Promise<ManualMissionRecord> {
    const normalized = normalizeFips(fips);
    const county = await this.database.query(
      "SELECT fips FROM counties WHERE fips = $1 LIMIT 1",
      [normalized]
    );
    if (!county.rows[0]) throw new Error(`County ${normalized} was not found`);
    return scoutScheduledMissions.recordManualMission({
      fips: normalized,
      missionType,
      requestedBy,
      requestId,
    });
  }

  async getCountyFiles(
    fips: string,
    filters?: { type?: string; sortBy?: "recent" | "type"; limit?: number; offset?: number }
  ): Promise<CountyFileOrganization | null> {
    return this.fileReader.getCountyFiles(fips, filters);
  }

  async compareCounties(fips1: string, fips2: string): Promise<Record<string, unknown> | null> {
    const data = await this.getMultiCountyIntelligence({ counties: [fips1, fips2] });
    if (data.length !== 2) return null;
    const byFips = new Map(data.map((item) => [item.fips, item]));
    const first = byFips.get(normalizeFips(fips1));
    const second = byFips.get(normalizeFips(fips2));
    if (!first || !second) return null;
    return {
      county1: first,
      county2: second,
      differences: {
        contractorDiff: first.contractors.total - second.contractors.total,
        userDiff: first.users.total - second.users.total,
        opportunityDiff: null,
      },
      evidence: { opportunityComparisonAvailable: false },
    };
  }

  getCountyHeatIntensity(data: CountyIntelligenceData): number {
    return Math.round((data.metrics.activityScore + data.metrics.dataCompleteness) / 2);
  }
}

export const scoutHeatmapIntelligence = new ScoutHeatmapIntelligence();
