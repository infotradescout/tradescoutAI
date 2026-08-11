import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildSearchConsoleAggregate,
  renderSearchConsoleMarkdownSection,
  summarizeSearchConsoleForReport,
} from "./import-search-console-performance.mjs";

function fixture(overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tradescout-gsc-contract-"));
  const files = {
    "Chart.csv":
      "Date,Clicks,Impressions,CTR,Position\n2026-08-08,0,8,0%,72.1\n2026-08-09,0,14,0%,60.6\n",
    "Pages.csv":
      "Top pages,Clicks,Impressions,CTR,Position\nhttps://www.thetradescout.com/business/jw-stone?utm_source=private#contact,0,12,0%,55.5\nhttps://thetradescout.com/,0,10,0%,73.2\n",
    "Queries.csv":
      "Top queries,Clicks,Impressions,CTR,Position\nprivate customer query,0,17,0%,60.0\n",
    "Filters.csv": "Filter,Value\nSearch type,Web\nDate,2026-08-08 - 2026-08-09\n",
    ...overrides,
  };
  for (const [filename, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, filename), contents, "utf8");
  }
  return directory;
}

test("sanitizes queries, page query strings, and fragments", () => {
  const aggregate = buildSearchConsoleAggregate({
    sourceDirectory: fixture(),
    property: "sc-domain:thetradescout.com",
  });
  const serialized = JSON.stringify(aggregate);
  assert.equal(aggregate.totals.impressions, 22);
  assert.equal(aggregate.pages[0].url, "https://thetradescout.com/business/jw-stone");
  assert.equal(aggregate.queryCoverage.visibleImpressions, 17);
  assert.equal(aggregate.queryCoverage.withheldOrAnonymizedImpressions, 5);
  assert.doesNotMatch(serialized, /private customer query|utm_source|#contact/);
});

test("excludes the partial activation date from clean post-release totals", () => {
  const aggregate = buildSearchConsoleAggregate({
    sourceDirectory: fixture(),
    property: "sc-domain:thetradescout.com",
  });
  const summary = summarizeSearchConsoleForReport(aggregate, {
    releaseAt: "2026-08-08T17:36:32.672607Z",
    windowFrom: "2026-08-08T17:36:32.672607Z",
    windowTo: "2026-08-11T15:37:00Z",
  });
  assert.equal(summary.cleanPostReleaseDate, "2026-08-09");
  assert.equal(summary.cleanPostReleaseTotals.impressions, 14);
  assert.deepEqual(summary.excludedDays, [
    { date: "2026-08-08", reason: "production_activation_boundary_day" },
  ]);
  assert.match(renderSearchConsoleMarkdownSection(summary), /not ChatGPT impressions/);
});

test("rejects pages outside the public TradeScout host", () => {
  const sourceDirectory = fixture({
    "Pages.csv":
      "Top pages,Clicks,Impressions,CTR,Position\nhttps://attacker.example/business/jw-stone,0,1,0%,1\n",
  });
  assert.throws(
    () =>
      buildSearchConsoleAggregate({
        sourceDirectory,
        property: "sc-domain:thetradescout.com",
      }),
    /outside thetradescout\.com/,
  );
});

test("requires each expected export", () => {
  const sourceDirectory = fixture();
  fs.rmSync(path.join(sourceDirectory, "Queries.csv"));
  assert.throws(
    () =>
      buildSearchConsoleAggregate({
        sourceDirectory,
        property: "sc-domain:thetradescout.com",
      }),
    /Missing Search Console export: Queries\.csv/,
  );
});

test("package and ignore contracts expose only the safe import path", () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const gitignore = fs.readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
  assert.equal(
    packageJson.scripts["import:search-console-performance"],
    "node scripts/import-search-console-performance.mjs",
  );
  assert.match(packageJson.scripts["test:discovery-performance"], /search-console-performance\.contract\.test\.mjs/);
  assert.match(gitignore, /search-console-exports\//);
  assert.match(gitignore, /artifacts\/search-console\/raw\//);
});
