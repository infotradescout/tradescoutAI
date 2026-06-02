import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_ORIGIN = "https://www.thetradescout.com";
const ARTIFACT_PATH = path.resolve(
  process.cwd(),
  "artifacts/tradescout-staff-kpi-smoke-latest.json"
);

const KPI_KEYS = [
  "direct_connect_request_started",
  "direct_connect_home_record_prompt_viewed",
  "direct_connect_home_record_link_selected",
  "direct_connect_home_record_create_selected",
  "direct_connect_home_record_skipped",
  "direct_connect_request_submitted_after_home_record_skip",
  "direct_connect_request_review_opened",
  "direct_connect_request_submitted",
  "direct_connect_request_visible_to_contractors",
  "direct_connect_contractor_action_started",
  "direct_connect_homeid_link_selected",
] as const;

type KpiKey = (typeof KPI_KEYS)[number];

type ProductKpiSummary = {
  window?: { from?: string; to?: string };
  totalEvents?: number;
  countsByEvent?: Record<string, number>;
  breakdowns?: Record<string, unknown>;
};

function asCount(summary: ProductKpiSummary, key: KpiKey): number {
  const raw = summary.countsByEvent?.[key];
  const parsed = typeof raw === "number" ? raw : Number(raw ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

async function fetchJsonWithCookie<T>(
  url: string,
  staffCookie: string
): Promise<{ status: number; json: T | null; text: string; headers: Headers }> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Cookie: staffCookie,
    },
  });
  const text = await response.text();
  let json: T | null = null;
  try {
    json = text ? (JSON.parse(text) as T) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text, headers: response.headers };
}

function isLikelyJsonResponse(text: string, headers: Headers): boolean {
  const contentType = headers.get("content-type") || "";
  if (contentType.toLowerCase().includes("application/json")) return true;
  const trimmed = text.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

async function run() {
  const origin = (process.env.TRADESCOUT_PRODUCTION_ORIGIN || DEFAULT_ORIGIN).trim();
  const rawCookie = (process.env.TRADESCOUT_STAFF_COOKIE || "").trim();
  const staffCookie = rawCookie
    .replace(/^cookie:\s*/i, "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!staffCookie) {
    console.error("Set TRADESCOUT_STAFF_COOKIE from a logged-in staff session. Do not commit it.");
    process.exit(1);
  }

  const healthUrl = `${origin}/api/health`;
  const healthResponse = await fetch(healthUrl, {
    method: "GET",
    headers: { Cookie: staffCookie },
  });
  const buildHeader = healthResponse.headers.get("x-tradescout-build") || "";
  console.log(`Health status: ${healthResponse.status}`);
  console.log(`Build header: ${buildHeader || "(missing)"}`);

  const kpiCandidates = [
    `${origin}/api/analytics/product-kpi/summary`,
    `${origin}/direct-connect/api/analytics/product-kpi/summary`,
  ];

  const candidateResults = await Promise.all(
    kpiCandidates.map((url) => fetchJsonWithCookie<ProductKpiSummary>(url, staffCookie))
  );

  let chosenIndex = 0;
  const json200Index = candidateResults.findIndex(
    (r) => r.status === 200 && !!r.json && isLikelyJsonResponse(r.text, r.headers)
  );
  if (json200Index >= 0) {
    chosenIndex = json200Index;
  } else {
    const firstNonHtml = candidateResults.findIndex((r) => isLikelyJsonResponse(r.text, r.headers));
    if (firstNonHtml >= 0) chosenIndex = firstNonHtml;
  }

  const kpi = candidateResults[chosenIndex];
  const kpiUrlUsed = kpiCandidates[chosenIndex];

  console.log(`KPI status: ${kpi.status}`);
  console.log(`KPI URL used: ${kpiUrlUsed}`);

  if (kpi.status === 403) {
    console.error("Staff auth failed or account is not staff.");
    process.exit(1);
  }

  if (kpi.status !== 200 || !kpi.json) {
    console.error("Failed to fetch KPI summary.");
    if (!isLikelyJsonResponse(kpi.text, kpi.headers)) {
      console.error("Endpoint returned non-JSON content (likely app HTML), not KPI API JSON.");
    }
    if (kpi.status === 401) {
      console.error(
        "Authentication required. Copy the full Request Headers Cookie value from a logged-in /api/analytics/product-kpi/summary or /direct-connect/api/analytics/product-kpi/summary request."
      );
    }
    if (kpi.text) console.error(kpi.text);
    process.exit(1);
  }

  const summary = kpi.json;
  const counts: Record<KpiKey, number> = Object.fromEntries(
    KPI_KEYS.map((key) => [key, asCount(summary, key)])
  ) as Record<KpiKey, number>;

  const rates = {
    promptViewedOverRequestStarted: asRate(
      counts.direct_connect_home_record_prompt_viewed,
      counts.direct_connect_request_started
    ),
    reviewOpenedOverRequestStarted: asRate(
      counts.direct_connect_request_review_opened,
      counts.direct_connect_request_started
    ),
    requestSubmittedOverReviewOpened: asRate(
      counts.direct_connect_request_submitted,
      counts.direct_connect_request_review_opened
    ),
    visibleToContractorsOverRequestSubmitted: asRate(
      counts.direct_connect_request_visible_to_contractors,
      counts.direct_connect_request_submitted
    ),
    contractorActionStartedOverVisibleToContractors: asRate(
      counts.direct_connect_contractor_action_started,
      counts.direct_connect_request_visible_to_contractors
    ),
  };

  console.log(
    `Measurement window: ${summary.window?.from || "unknown"} -> ${summary.window?.to || "unknown"}`
  );
  console.log("Direct Connect KPI counts:");
  for (const key of KPI_KEYS) {
    console.log(`  ${key}: ${counts[key]}`);
  }
  console.log("Computed rates (%):");
  console.log(
    `  prompt_viewed/request_started: ${
      rates.promptViewedOverRequestStarted === null ? "n/a" : rates.promptViewedOverRequestStarted
    }`
  );
  console.log(
    `  review_opened/request_started: ${
      rates.reviewOpenedOverRequestStarted === null ? "n/a" : rates.reviewOpenedOverRequestStarted
    }`
  );
  console.log(
    `  request_submitted/review_opened: ${
      rates.requestSubmittedOverReviewOpened === null
        ? "n/a"
        : rates.requestSubmittedOverReviewOpened
    }`
  );
  console.log(
    `  visible_to_contractors/request_submitted: ${
      rates.visibleToContractorsOverRequestSubmitted === null
        ? "n/a"
        : rates.visibleToContractorsOverRequestSubmitted
    }`
  );
  console.log(
    `  contractor_action_started/visible_to_contractors: ${
      rates.contractorActionStartedOverVisibleToContractors === null
        ? "n/a"
        : rates.contractorActionStartedOverVisibleToContractors
    }`
  );

  await fs.mkdir(path.dirname(ARTIFACT_PATH), { recursive: true });
  await fs.writeFile(
    ARTIFACT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        origin,
        health: {
          status: healthResponse.status,
          buildHeader,
        },
        kpi: {
          status: kpi.status,
          window: summary.window || null,
          totalEvents: summary.totalEvents ?? null,
          counts,
          rates,
        },
      },
      null,
      2
    )
  );
  console.log(`Artifact written: ${ARTIFACT_PATH}`);
}

run().catch((error) => {
  console.error("Staff KPI smoke runner failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
