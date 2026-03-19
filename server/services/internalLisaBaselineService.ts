import { pool } from "../db";

export type CrawlSignalBaseline = {
  currentHits: number;
  baselineAvgHits: number | null;
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
