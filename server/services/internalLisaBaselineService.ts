import { pool } from "../db";

export type CrawlSignalBaseline = {
  currentHits: number;
  baselineAvgHits: number | null;
  deltaPct: number | null;
};

export type ActionSignalBaseline = {
  currentValue: number;
  baselineAvgValue: number | null;
  deltaPct: number | null;
};

export async function getBotSignalBaseline(params: {
  routeFamily: string;
  county?: string | null;
  state?: string | null;
  trade?: string | null;
  currentHits: number;
}): Promise<CrawlSignalBaseline> {
  const { routeFamily, county = null, state = null, trade = null, currentHits } = params;

  const result = await pool.query(
    `
      select avg(hits)::float as baseline_avg_hits
      from bot_observation_daily_agg
      where date >= current_date - interval '7 days'
        and date < current_date
        and route_family = $1
        and coalesce(county, '') = coalesce($2, '')
        and coalesce(state, '') = coalesce($3, '')
        and coalesce(trade, '') = coalesce($4, '')
    `,
    [routeFamily, county, state, trade]
  );

  const baselineAvgHits = result.rows[0]?.baseline_avg_hits
    ? Number(result.rows[0].baseline_avg_hits)
    : null;

  const deltaPct =
    baselineAvgHits && baselineAvgHits > 0
      ? Number((((currentHits - baselineAvgHits) / baselineAvgHits) * 100).toFixed(1))
      : null;

  return {
    currentHits,
    baselineAvgHits,
    deltaPct,
  };
}

export async function getScoutInteractionBaseline(params: {
  currentValue: number;
}): Promise<ActionSignalBaseline> {
  const { currentValue } = params;

  const result = await pool.query(
    `
      select avg((payload_json->>'interaction_count')::float)::float as baseline_avg_value
      from lisa_findings
      where generated_at >= now() - interval '7 days'
        and generated_at < now()
        and source_kind = 'scout_interactions'
        and payload_json ? 'interaction_count'
    `
  );

  const baselineAvgValue = result.rows[0]?.baseline_avg_value
    ? Number(result.rows[0].baseline_avg_value)
    : null;

  const deltaPct =
    baselineAvgValue && baselineAvgValue > 0
      ? Number((((currentValue - baselineAvgValue) / baselineAvgValue) * 100).toFixed(1))
      : null;

  return {
    currentValue,
    baselineAvgValue,
    deltaPct,
  };
}
