import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_EXPORTS = ["Chart.csv", "Pages.csv", "Queries.csv", "Filters.csv"];
const ALLOWED_HOSTS = new Set(["thetradescout.com", "www.thetradescout.com"]);
const DAY_MS = 24 * 60 * 60 * 1000;

function normalize(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new Error("Malformed CSV: unterminated quoted field.");
  row.push(field.replace(/\r$/, ""));
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function recordsFromCsv(filePath, { allowEmpty = false } = {}) {
  const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
  if (!rows.length || (!allowEmpty && rows.length < 2)) {
    throw new Error(`${path.basename(filePath)} has no data rows.`);
  }
  const headers = rows[0].map(normalize);
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? "").trim()])),
  );
}

function field(record, candidates, label) {
  for (const candidate of candidates) {
    const value = record[normalize(candidate)];
    if (value !== undefined && value !== "") return value;
  }
  throw new Error(`Search Console export is missing ${label}.`);
}

function count(value, label) {
  const parsed = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
}

function position(value) {
  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid position: ${value}`);
  return parsed;
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function totals(rows) {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const weightedPosition = rows.reduce(
    (sum, row) => sum + row.position * row.impressions,
    0,
  );
  return {
    clicks,
    impressions,
    ctrPercent: impressions ? round((clicks / impressions) * 100) : 0,
    averagePosition: impressions ? round(weightedPosition / impressions) : null,
  };
}

function canonicalPage(rawPage) {
  let parsed;
  try {
    parsed = new URL(rawPage);
  } catch {
    throw new Error(`Invalid Search Console page URL: ${rawPage}`);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(hostname)) {
    throw new Error(`Search Console page is outside thetradescout.com: ${hostname}`);
  }
  if (parsed.username || parsed.password) throw new Error("Search Console page URL contains credentials.");
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported Search Console page protocol: ${parsed.protocol}`);
  }
  const pathname = parsed.pathname.replace(/\/{2,}/g, "/") || "/";
  return { path: pathname, url: `https://thetradescout.com${pathname}` };
}

function requireExports(directory) {
  for (const filename of REQUIRED_EXPORTS) {
    if (!fs.existsSync(path.join(directory, filename))) {
      throw new Error(`Missing Search Console export: ${filename}`);
    }
  }
}

function searchType(filtersPath) {
  const rows = parseCsv(fs.readFileSync(filtersPath, "utf8"));
  for (const row of rows) {
    const index = row.findIndex((value) => /search\s*type/i.test(value));
    if (index >= 0 && row[index + 1]) return row[index + 1].trim();
  }
  return "Web";
}

export function buildSearchConsoleAggregate({ sourceDirectory, property }) {
  const source = path.resolve(sourceDirectory);
  requireExports(source);

  const daily = recordsFromCsv(path.join(source, "Chart.csv"))
    .map((record) => {
      const date = field(record, ["Date"], "chart date");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
        throw new Error(`Invalid Search Console date: ${date}`);
      }
      const row = {
        date,
        clicks: count(field(record, ["Clicks"], "chart clicks"), "clicks"),
        impressions: count(field(record, ["Impressions"], "chart impressions"), "impressions"),
        position: position(field(record, ["Position", "Average position"], "chart position")),
      };
      return {
        ...row,
        ctrPercent: row.impressions ? round((row.clicks / row.impressions) * 100) : 0,
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  const pageMap = new Map();
  for (const record of recordsFromCsv(path.join(source, "Pages.csv"), { allowEmpty: true })) {
    const publicPage = canonicalPage(field(record, ["Top pages", "Page"], "page URL"));
    const next = {
      ...publicPage,
      clicks: count(field(record, ["Clicks"], "page clicks"), "clicks"),
      impressions: count(field(record, ["Impressions"], "page impressions"), "impressions"),
      position: position(field(record, ["Position", "Average position"], "page position")),
    };
    const prior = pageMap.get(next.url);
    if (!prior) pageMap.set(next.url, next);
    else {
      const impressions = prior.impressions + next.impressions;
      pageMap.set(next.url, {
        ...publicPage,
        clicks: prior.clicks + next.clicks,
        impressions,
        position: impressions
          ? round(
              (prior.position * prior.impressions + next.position * next.impressions) / impressions,
            )
          : 0,
      });
    }
  }
  const pages = [...pageMap.values()]
    .map((page) => ({
      ...page,
      ctrPercent: page.impressions ? round((page.clicks / page.impressions) * 100) : 0,
    }))
    .sort((left, right) => right.impressions - left.impressions || left.path.localeCompare(right.path));

  const queryMetrics = recordsFromCsv(path.join(source, "Queries.csv"), { allowEmpty: true }).map(
    (record) => ({
      clicks: count(field(record, ["Clicks"], "query clicks"), "clicks"),
      impressions: count(field(record, ["Impressions"], "query impressions"), "impressions"),
    }),
  );
  const sourceTotals = totals(daily);
  const visibleClicks = queryMetrics.reduce((sum, row) => sum + row.clicks, 0);
  const visibleImpressions = queryMetrics.reduce((sum, row) => sum + row.impressions, 0);

  return {
    schemaVersion: 1,
    source: "google_search_console",
    property,
    searchType: searchType(path.join(source, "Filters.csv")),
    dataRange: { from: daily[0].date, to: daily[daily.length - 1].date },
    totals: sourceTotals,
    daily,
    pages,
    queryCoverage: {
      visibleRows: queryMetrics.length,
      visibleClicks,
      visibleImpressions,
      withheldOrAnonymizedImpressions: Math.max(0, sourceTotals.impressions - visibleImpressions),
      rawQueriesIncluded: false,
    },
    privacy: {
      rawQueriesIncluded: false,
      rawExportPathsIncluded: false,
      queryStringsIncluded: false,
    },
  };
}

export function validateSearchConsoleAggregate(aggregate) {
  if (!aggregate || aggregate.source !== "google_search_console") {
    throw new Error("Invalid Search Console aggregate source.");
  }
  if (!Array.isArray(aggregate.daily) || !Array.isArray(aggregate.pages)) {
    throw new Error("Invalid Search Console aggregate rows.");
  }
  if (aggregate.queryCoverage?.rawQueriesIncluded !== false) {
    throw new Error("Search Console aggregate must explicitly exclude raw queries.");
  }
  if (JSON.stringify(aggregate).includes("entryRequestId")) {
    throw new Error("Search Console aggregate contains a private attribution identifier.");
  }
  return aggregate;
}

export function loadSearchConsoleAggregate(filePath) {
  return validateSearchConsoleAggregate(JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8")));
}

function firstCleanDate(releaseAt) {
  const release = new Date(releaseAt);
  if (Number.isNaN(release.getTime())) throw new Error(`Invalid production activation time: ${releaseAt}`);
  const midnight = Date.UTC(release.getUTCFullYear(), release.getUTCMonth(), release.getUTCDate());
  return new Date(release.getTime() === midnight ? midnight : midnight + DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function summarizeSearchConsoleForReport(
  aggregate,
  { releaseAt, windowFrom = null, windowTo = null } = {},
) {
  validateSearchConsoleAggregate(aggregate);
  const cleanFrom = firstCleanDate(releaseAt);
  const releaseDate = new Date(releaseAt).toISOString().slice(0, 10);
  const from = windowFrom ? new Date(windowFrom).toISOString().slice(0, 10) : null;
  const to = windowTo ? new Date(windowTo).toISOString().slice(0, 10) : null;
  const inWindow = (date) => (!from || date >= from) && (!to || date <= to);
  const cleanDays = aggregate.daily.filter((row) => row.date >= cleanFrom && inWindow(row.date));
  const cleanDates = new Set(cleanDays.map((row) => row.date));
  const excludedDays = aggregate.daily
    .filter((row) => !cleanDates.has(row.date))
    .map((row) => ({
      date: row.date,
      reason:
        row.date === releaseDate && cleanFrom !== releaseDate
          ? "production_activation_boundary_day"
          : row.date < cleanFrom
            ? "pre_release"
            : "outside_report_window",
    }));
  return {
    source: aggregate.source,
    property: aggregate.property,
    searchType: aggregate.searchType,
    sourceRange: aggregate.dataRange,
    sourceTotals: aggregate.totals,
    productionActivatedAt: releaseAt,
    cleanPostReleaseDate: cleanFrom,
    cleanPostReleaseTotals: totals(cleanDays),
    cleanPostReleaseDays: cleanDays,
    excludedDays,
    pages: aggregate.pages,
    pageMetricsScope: "full_source_range",
    queryCoverage: aggregate.queryCoverage,
    status: cleanDays.length ? "measured" : "awaiting_clean_post_release_day",
    limitations: [
      "A partial production activation day is excluded because Search Console reports calendar days.",
      "Search Console measures Google Search only and provides no ChatGPT impression metric.",
      "Raw query values are intentionally omitted; query coverage may exclude anonymized searches.",
    ],
  };
}

function tableCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}

export function renderSearchConsoleMarkdownSection(summary) {
  const clean = summary.cleanPostReleaseTotals;
  const excluded = summary.excludedDays.length
    ? summary.excludedDays.map((row) => `${row.date} (${row.reason})`).join(", ")
    : "none";
  return [
    "## Google Search Console surfaced performance",
    "",
    `- Property: \`${summary.property}\``,
    `- Source range: ${summary.sourceRange.from} through ${summary.sourceRange.to}`,
    `- Production activation: ${summary.productionActivatedAt}`,
    `- First clean post-release Search Console day: ${summary.cleanPostReleaseDate}`,
    `- Excluded days: ${excluded}`,
    `- Clean post-release Google impressions: ${clean.impressions}`,
    `- Clean post-release Google clicks: ${clean.clicks}`,
    `- Clean post-release Google CTR: ${clean.ctrPercent}%`,
    `- Clean post-release average position: ${clean.averagePosition ?? "N/A"}`,
    `- Visible query rows: ${summary.queryCoverage.visibleRows}; visible query impressions: ${summary.queryCoverage.visibleImpressions}; withheld or anonymized impressions: ${summary.queryCoverage.withheldOrAnonymizedImpressions}`,
    "- Raw query values are excluded. These are Google Search metrics, not ChatGPT impressions.",
    "",
    `Page metrics below cover the full exported source range (${summary.pageMetricsScope}).`,
    "",
    "| Public page | Clicks | Impressions | CTR | Position |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...summary.pages.map(
      (page) =>
        `| ${tableCell(page.path)} | ${page.clicks} | ${page.impressions} | ${page.ctrPercent}% | ${page.position} |`,
    ),
  ].join("\n");
}

function parseArgs(args) {
  const options = {};
  for (const argument of args) {
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument.startsWith("--source-dir=")) options.sourceDirectory = argument.slice(13);
    else if (argument.startsWith("--out=")) options.output = argument.slice(6);
    else if (argument.startsWith("--property=")) options.property = argument.slice(11);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(
        "Usage: node scripts/import-search-console-performance.mjs --source-dir=<export> --out=<aggregate.json> --property=sc-domain:thetradescout.com",
      );
    } else {
      if (!options.sourceDirectory || !options.output || !options.property) {
        throw new Error("--source-dir, --out, and --property are required.");
      }
      const aggregate = buildSearchConsoleAggregate(options);
      const outputPath = path.resolve(options.output);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, `${JSON.stringify(aggregate, null, 2)}\n`, "utf8");
      console.log(`Wrote privacy-safe Search Console aggregate: ${outputPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
