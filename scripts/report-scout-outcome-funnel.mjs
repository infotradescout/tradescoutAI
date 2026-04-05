import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const daysArg = args.find((arg) => arg.startsWith("--days="));
const days = Number(daysArg?.split("=")[1] ?? "30");
const windowDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 30;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[scout-outcome-report] Missing DATABASE_URL");
  process.exit(1);
}

const pool = new Pool({ connectionString });

const sql = `
WITH filtered AS (
  SELECT event_type, data, created_at
  FROM events
  WHERE event_type IN (
    'scout_outcome_action_generated',
    'scout_outcome_action_clicked',
    'scout_outcome_action_submitted'
  )
  AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
), grouped AS (
  SELECT
    data->>'ownerModule' AS owner_module,
    data->>'target' AS target,
    COALESCE(NULLIF(data->>'confidenceBand', ''), 'unknown') AS confidence_band,
    SUM(CASE WHEN event_type = 'scout_outcome_action_generated' THEN 1 ELSE 0 END)::int AS generated,
    SUM(CASE WHEN event_type = 'scout_outcome_action_clicked' THEN 1 ELSE 0 END)::int AS clicked,
    SUM(CASE WHEN event_type = 'scout_outcome_action_submitted' THEN 1 ELSE 0 END)::int AS submitted,
    AVG(
      CASE
        WHEN event_type = 'scout_outcome_action_generated'
          THEN NULLIF((data->>'payloadCompleteness')::numeric, NULL)
        ELSE NULL
      END
    ) AS avg_payload_completeness
  FROM filtered
  WHERE data ? 'ownerModule' AND data ? 'target'
  GROUP BY 1, 2, 3
)
SELECT
  owner_module,
  target,
  confidence_band,
  generated,
  clicked,
  submitted,
  CASE WHEN generated > 0 THEN ROUND(clicked::numeric / generated, 4) ELSE 0 END AS gen_to_click_rate,
  CASE WHEN clicked > 0 THEN ROUND(submitted::numeric / clicked, 4) ELSE 0 END AS click_to_submit_rate,
  ROUND(COALESCE(avg_payload_completeness, 0), 4) AS avg_payload_completeness
FROM grouped
ORDER BY generated DESC, owner_module, target, confidence_band;
`;

const topDropsSql = `
WITH grouped AS (
  SELECT
    data->>'ownerModule' AS owner_module,
    data->>'target' AS target,
    COALESCE(NULLIF(data->>'confidenceBand', ''), 'unknown') AS confidence_band,
    SUM(CASE WHEN event_type = 'scout_outcome_action_generated' THEN 1 ELSE 0 END)::int AS generated,
    SUM(CASE WHEN event_type = 'scout_outcome_action_clicked' THEN 1 ELSE 0 END)::int AS clicked,
    SUM(CASE WHEN event_type = 'scout_outcome_action_submitted' THEN 1 ELSE 0 END)::int AS submitted
  FROM events
  WHERE event_type IN (
    'scout_outcome_action_generated',
    'scout_outcome_action_clicked',
    'scout_outcome_action_submitted'
  )
  AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
  AND data ? 'ownerModule' AND data ? 'target'
  GROUP BY 1, 2, 3
), rated AS (
  SELECT
    owner_module,
    target,
    confidence_band,
    generated,
    clicked,
    submitted,
    CASE WHEN generated > 0 THEN clicked::numeric / generated ELSE 0 END AS gen_to_click_rate,
    CASE WHEN clicked > 0 THEN submitted::numeric / clicked ELSE 0 END AS click_to_submit_rate
  FROM grouped
  WHERE generated > 0
)
SELECT
  owner_module,
  target,
  confidence_band,
  generated,
  clicked,
  submitted,
  ROUND(gen_to_click_rate, 4) AS gen_to_click_rate,
  ROUND(click_to_submit_rate, 4) AS click_to_submit_rate,
  ROUND((1 - gen_to_click_rate), 4) AS gen_to_click_drop,
  ROUND((1 - click_to_submit_rate), 4) AS click_to_submit_drop,
  ROUND(((1 - gen_to_click_rate) + (1 - click_to_submit_rate)) / 2, 4) AS combined_drop_score
FROM rated
ORDER BY combined_drop_score DESC, generated DESC
LIMIT 10;
`;

function buildMarkdown(rows, weakestRows) {
  const lines = [];
  lines.push("# Scout Outcome Funnel Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Window: last ${windowDays} day(s)`);
  lines.push("");

  if (!rows.length) {
    lines.push("## Data Status");
    lines.push("No scout_outcome_action_* telemetry rows found in this window.");
    lines.push("");
    lines.push("## Next Capture Steps");
    lines.push("1. Trigger Scout turns that produce primary actions in provider, marketplace, and community owners.");
    lines.push("2. Click each primary action once and submit at least one flow per owner.");
    lines.push("3. Re-run this report to identify real generated->clicked and clicked->submitted bottlenecks.");
    return lines.join("\n") + "\n";
  }

  lines.push("## Funnel By Owner/Target/Confidence");
  lines.push("| ownerModule | target | confidenceBand | generated | clicked | submitted | gen->click | click->submit | avg payload completeness |");
  lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of rows) {
    lines.push(
      `| ${row.owner_module} | ${row.target} | ${row.confidence_band} | ${row.generated} | ${row.clicked} | ${row.submitted} | ${row.gen_to_click_rate} | ${row.click_to_submit_rate} | ${row.avg_payload_completeness} |`
    );
  }

  lines.push("");
  lines.push("## Weakest Segments (Combined Drop)");
  if (!weakestRows.length) {
    lines.push("Insufficient generated telemetry to rank weak segments.");
  } else {
    lines.push("| ownerModule | target | confidenceBand | generated | clicked | submitted | gen->click drop | click->submit drop | combined drop score |");
    lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const row of weakestRows) {
      lines.push(
        `| ${row.owner_module} | ${row.target} | ${row.confidence_band} | ${row.generated} | ${row.clicked} | ${row.submitted} | ${row.gen_to_click_drop} | ${row.click_to_submit_drop} | ${row.combined_drop_score} |`
      );
    }
  }

  return lines.join("\n") + "\n";
}

async function run() {
  try {
    const [rowsResult, weakestResult] = await Promise.all([
      pool.query(sql, [windowDays]),
      pool.query(topDropsSql, [windowDays]),
    ]);

    const rows = rowsResult.rows;
    const weakestRows = weakestResult.rows;

    const artifactsDir = path.join(root, "artifacts");
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    const jsonPath = path.join(artifactsDir, "scout-outcome-funnel.json");
    const mdPath = path.join(artifactsDir, "scout-outcome-funnel.md");

    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          windowDays,
          rows,
          weakestRows,
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    fs.writeFileSync(mdPath, buildMarkdown(rows, weakestRows), "utf8");

    console.log(
      `[scout-outcome-report] wrote ${path.relative(root, mdPath)} and ${path.relative(root, jsonPath)} | rows=${rows.length}`
    );
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("[scout-outcome-report] failed", error);
  process.exit(1);
});
