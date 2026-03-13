import { pool } from "../db";

export type PartnerObservationWindow = "1h" | "24h" | "7d" | "30d";

type SurfaceMixEntry = {
  surface: string;
  requestCount: number;
  sharePct: number;
  okRatePct: number;
  trend: "up" | "down" | "flat";
  changePct: number;
};

export type PartnerCountyObservationSnapshotRow = {
  countyFips: string;
  countyName: string;
  stateCode: string;
  requestCount: number;
  okRatePct: number;
  trend: "up" | "down" | "flat";
  changePct: number;
  dominantSurface: string;
  surfaceMix: SurfaceMixEntry[];
  computedAt: string;
};

let ensurePromise: Promise<void> | null = null;

function marketSignalsInterval(window: PartnerObservationWindow): string {
  switch (window) {
    case "1h":
      return "1 hour";
    case "7d":
      return "7 days";
    case "30d":
      return "30 days";
    case "24h":
    default:
      return "24 hours";
  }
}

function normalizeTrend(changePct: number): "up" | "down" | "flat" {
  if (changePct > 5) return "up";
  if (changePct < -5) return "down";
  return "flat";
}

function parseWindowsFromEnv(): PartnerObservationWindow[] {
  const raw = String(process.env.PARTNER_COUNTY_OBSERVATION_WINDOWS || "24h,7d")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const valid = raw.filter(
    (value): value is PartnerObservationWindow =>
      value === "1h" || value === "24h" || value === "7d" || value === "30d"
  );
  return valid.length > 0 ? Array.from(new Set(valid)) : ["24h", "7d"];
}

export async function ensureTradepartnerCountyObservationSnapshotsTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tradepartner_county_observation_snapshots (
          id bigserial PRIMARY KEY,
          partner_slug text NOT NULL,
          window text NOT NULL,
          county_fips varchar(5) NOT NULL,
          county_name text NOT NULL,
          state_code varchar(2) NOT NULL,
          request_count integer NOT NULL DEFAULT 0,
          ok_rate_pct integer NOT NULL DEFAULT 0,
          trend text NOT NULL DEFAULT 'flat',
          change_pct integer NOT NULL DEFAULT 0,
          dominant_surface text NOT NULL DEFAULT 'unknown',
          surface_mix_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          computed_at timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_tradepartner_county_observation_unique
         ON tradepartner_county_observation_snapshots (partner_slug, window, county_fips);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_tradepartner_county_observation_partner_window
         ON tradepartner_county_observation_snapshots (partner_slug, window, computed_at DESC);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_tradepartner_county_observation_state
         ON tradepartner_county_observation_snapshots (state_code);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_tradepartner_county_observation_county
         ON tradepartner_county_observation_snapshots (county_fips);`
      );
    })();
  }

  await ensurePromise;
}

async function computePartnerWindowRows(
  partnerSlug: string,
  window: PartnerObservationWindow
): Promise<PartnerCountyObservationSnapshotRow[]> {
  const interval = marketSignalsInterval(window);
  const result = await pool.query(
    `
      with current_rollups as (
        select
          r.county_fips,
          coalesce(c.name, 'Unknown county') as county_name,
          coalesce(r.state_code, c.state_code) as state_code,
          coalesce(r.source_surface, 'unknown') as source_surface,
          sum(r.request_count)::int as request_count,
          sum(case when r.status_class = '2xx' then r.request_count else 0 end)::int as ok_count
        from crawler_request_hourly_rollups r
        left join counties c on c.fips = r.county_fips
        where r.bucket_start >= (now() - ($1::interval))
          and r.county_fips is not null
        group by r.county_fips, county_name, state_code, source_surface
      ),
      previous_rollups as (
        select
          r.county_fips,
          coalesce(r.source_surface, 'unknown') as source_surface,
          sum(r.request_count)::int as request_count
        from crawler_request_hourly_rollups r
        left join counties c on c.fips = r.county_fips
        where r.bucket_start >= (now() - (($1::interval) * 2))
          and r.bucket_start < (now() - ($1::interval))
          and r.county_fips is not null
        group by r.county_fips, source_surface
      )
      select
        c.county_fips,
        c.county_name,
        c.state_code,
        c.source_surface,
        c.request_count,
        c.ok_count,
        coalesce(p.request_count, 0)::int as previous_request_count
      from current_rollups c
      left join previous_rollups p
        on p.county_fips = c.county_fips
       and p.source_surface = c.source_surface
      where c.request_count >= 10
      order by c.request_count desc, c.county_name asc
    `,
    [interval]
  );

  const countyMap = new Map<
    string,
    {
      countyFips: string;
      countyName: string;
      stateCode: string;
      requestCount: number;
      okCount: number;
      previousRequestCount: number;
      surfaceMix: SurfaceMixEntry[];
    }
  >();

  for (const row of result.rows || []) {
    const countyFips = String((row as any).county_fips || "");
    const stateCode = String((row as any).state_code || "");
    if (!countyFips || !stateCode) continue;
    const key = `${countyFips}:${stateCode}`;
    const requestCount = Number((row as any).request_count || 0);
    const okCount = Number((row as any).ok_count || 0);
    const previousRequestCount = Number((row as any).previous_request_count || 0);
    const rawChangePct =
      previousRequestCount > 0
        ? ((requestCount - previousRequestCount) / previousRequestCount) * 100
        : requestCount > 0
          ? 100
          : 0;
    const changePct = Math.round(rawChangePct);
    const existing = countyMap.get(key) || {
      countyFips,
      countyName: String((row as any).county_name || "Unknown county"),
      stateCode,
      requestCount: 0,
      okCount: 0,
      previousRequestCount: 0,
      surfaceMix: [],
    };

    existing.requestCount += requestCount;
    existing.okCount += okCount;
    existing.previousRequestCount += previousRequestCount;
    existing.surfaceMix.push({
      surface: String((row as any).source_surface || "unknown"),
      requestCount,
      sharePct: 0,
      okRatePct: requestCount > 0 ? Math.round((okCount / requestCount) * 100) : 0,
      trend: normalizeTrend(changePct),
      changePct,
    });
    countyMap.set(key, existing);
  }

  return Array.from(countyMap.values())
    .map((county) => {
      const dominantSurface =
        [...county.surfaceMix].sort((a, b) => b.requestCount - a.requestCount)[0]?.surface ||
        "unknown";
      const changePct = Math.round(
        county.previousRequestCount > 0
          ? ((county.requestCount - county.previousRequestCount) / county.previousRequestCount) *
              100
          : county.requestCount > 0
            ? 100
            : 0
      );

      return {
        countyFips: county.countyFips,
        countyName: county.countyName,
        stateCode: county.stateCode,
        requestCount: county.requestCount,
        okRatePct:
          county.requestCount > 0 ? Math.round((county.okCount / county.requestCount) * 100) : 0,
        trend: normalizeTrend(changePct),
        changePct,
        dominantSurface,
        surfaceMix: county.surfaceMix
          .sort((a, b) => b.requestCount - a.requestCount)
          .map((surface) => ({
            ...surface,
            sharePct:
              county.requestCount > 0
                ? Math.round((surface.requestCount / county.requestCount) * 100)
                : 0,
          })),
        computedAt: new Date().toISOString(),
      };
    })
    .sort((a, b) => b.requestCount - a.requestCount);
}

export async function refreshPartnerCountyObservationSnapshots(params?: {
  partnerSlug?: string;
  windows?: PartnerObservationWindow[];
}): Promise<{ partnerSlugs: string[]; windows: PartnerObservationWindow[]; rowsWritten: number }> {
  await ensureTradepartnerCountyObservationSnapshotsTable();

  const partnerSlugs = params?.partnerSlug?.trim().length
    ? [String(params.partnerSlug).trim().toLowerCase()]
    : (
        await pool.query(
          `
              select partner_slug
              from tradepartner_campaigns
              where is_active = true
              order by partner_slug asc
            `
        )
      ).rows
        .map((row) =>
          String((row as any).partner_slug || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean);

  const windows = params?.windows?.length ? params.windows : parseWindowsFromEnv();
  let rowsWritten = 0;

  for (const partnerSlug of partnerSlugs) {
    for (const window of windows) {
      const rows = await computePartnerWindowRows(partnerSlug, window);
      await pool.query("BEGIN");
      try {
        await pool.query(
          `
            delete from tradepartner_county_observation_snapshots
            where partner_slug = $1 and window = $2
          `,
          [partnerSlug, window]
        );

        for (const row of rows) {
          await pool.query(
            `
              insert into tradepartner_county_observation_snapshots (
                partner_slug,
                window,
                county_fips,
                county_name,
                state_code,
                request_count,
                ok_rate_pct,
                trend,
                change_pct,
                dominant_surface,
                surface_mix_json,
                computed_at
              )
              values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,now())
            `,
            [
              partnerSlug,
              window,
              row.countyFips,
              row.countyName,
              row.stateCode,
              row.requestCount,
              row.okRatePct,
              row.trend,
              row.changePct,
              row.dominantSurface,
              JSON.stringify(row.surfaceMix),
            ]
          );
        }

        await pool.query("COMMIT");
        rowsWritten += rows.length;
      } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
      }
    }
  }

  return { partnerSlugs, windows, rowsWritten };
}

export async function getPartnerCountyObservationSnapshots(params: {
  partnerSlug: string;
  window: PartnerObservationWindow;
  stateCode?: string;
  surface?: string;
  limit?: number;
  maxSnapshotAgeMinutes?: number;
}) {
  await ensureTradepartnerCountyObservationSnapshotsTable();

  const maxSnapshotAgeMinutes = Math.max(5, Number(params.maxSnapshotAgeMinutes || 30));
  const freshnessResult = await pool.query(
    `
      select max(computed_at) as latest_computed_at
      from tradepartner_county_observation_snapshots
      where partner_slug = $1
        and window = $2
    `,
    [params.partnerSlug, params.window]
  );

  const latestComputedAtRaw = freshnessResult.rows?.[0]?.latest_computed_at;
  const latestComputedAt = latestComputedAtRaw ? new Date(String(latestComputedAtRaw)) : null;
  const isStale =
    !latestComputedAt ||
    !Number.isFinite(latestComputedAt.getTime()) ||
    Date.now() - latestComputedAt.getTime() > maxSnapshotAgeMinutes * 60 * 1000;

  if (isStale) {
    await refreshPartnerCountyObservationSnapshots({
      partnerSlug: params.partnerSlug,
      windows: [params.window],
    });
  }

  const stateCode = String(params.stateCode || "")
    .trim()
    .toUpperCase();
  const limit = Math.max(25, Math.min(500, Number(params.limit || 100)));
  const rowsResult = await pool.query(
    `
      select
        county_fips,
        county_name,
        state_code,
        request_count,
        ok_rate_pct,
        trend,
        change_pct,
        dominant_surface,
        surface_mix_json,
        computed_at
      from tradepartner_county_observation_snapshots
      where partner_slug = $1
        and window = $2
        and ($3::text = '' or state_code = $3)
      order by request_count desc, county_name asc
      limit $4
    `,
    [params.partnerSlug, params.window, stateCode, limit]
  );

  const surfaceFilter = String(params.surface || "")
    .trim()
    .toLowerCase();

  const counties = (rowsResult.rows || [])
    .map((row) => {
      const surfaceMix = Array.isArray((row as any).surface_mix_json)
        ? ((row as any).surface_mix_json as SurfaceMixEntry[])
        : [];

      if (surfaceFilter) {
        const match = surfaceMix.find(
          (entry) => String(entry.surface || "").toLowerCase() === surfaceFilter
        );
        if (!match || Number(match.requestCount || 0) < 10) return null;
        return {
          countyFips: String((row as any).county_fips || ""),
          countyName: String((row as any).county_name || "Unknown county"),
          stateCode: String((row as any).state_code || ""),
          requestCount: Number(match.requestCount || 0),
          okRatePct: Number(match.okRatePct || 0),
          trend: normalizeTrend(Number(match.changePct || 0)),
          changePct: Number(match.changePct || 0),
          dominantSurface: String(match.surface || surfaceFilter),
          surfaceMix,
          computedAt: new Date(
            String((row as any).computed_at || new Date().toISOString())
          ).toISOString(),
        };
      }

      return {
        countyFips: String((row as any).county_fips || ""),
        countyName: String((row as any).county_name || "Unknown county"),
        stateCode: String((row as any).state_code || ""),
        requestCount: Number((row as any).request_count || 0),
        okRatePct: Number((row as any).ok_rate_pct || 0),
        trend: normalizeTrend(Number((row as any).change_pct || 0)),
        changePct: Number((row as any).change_pct || 0),
        dominantSurface: String((row as any).dominant_surface || "unknown"),
        surfaceMix,
        computedAt: new Date(
          String((row as any).computed_at || new Date().toISOString())
        ).toISOString(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number((b as any).requestCount || 0) - Number((a as any).requestCount || 0))
    .slice(0, limit) as PartnerCountyObservationSnapshotRow[];

  return {
    generatedAt:
      counties[0]?.computedAt ||
      (latestComputedAt && Number.isFinite(latestComputedAt.getTime())
        ? latestComputedAt.toISOString()
        : new Date().toISOString()),
    counties,
  };
}

export async function runPartnerCountyObservationSnapshotJob(): Promise<{
  partnerSlugs: string[];
  windows: PartnerObservationWindow[];
  rowsWritten: number;
}> {
  return refreshPartnerCountyObservationSnapshots();
}
