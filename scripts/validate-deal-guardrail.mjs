#!/usr/bin/env node
/*
 * TradeScout - TradeDeal guardrail validation harness
 * Usage:
 *   node scripts/validate-deal-guardrail.mjs --base http://localhost:5000 --county 53033 --state WA [--strict]
 *
 * Runs three prompts against /api/scout and reports whether trade_deal CTA hints
 * and assistive labels behave as expected. Defaults to localhost:5000.
 */

const args = process.argv.slice(2);

function getArg(name, fallback = "") {
  const flag = `--${name}`;
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

async function ensureFetch() {
  if (typeof fetch !== "function") {
    const mod = await import("node-fetch");
    globalThis.fetch = mod.default;
  }
}

function summarizeHints(ctaHints) {
  const tradeHints = Array.isArray(ctaHints)
    ? ctaHints.filter((h) => h && h.type === "trade_deal")
    : [];
  return {
    count: tradeHints.length,
    hasLabel: tradeHints.some((h) => typeof h.label === "string" && h.label.trim().length > 0),
  };
}

async function postScout({ baseUrl, message, countyCode, stateCode }) {
  const body = {
    message,
    countyCode: countyCode || undefined,
    stateCode: stateCode || undefined,
    roles: [],
    history: [],
  };

  const res = await fetch(`${baseUrl}/api/scout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${err.message}`);
  }

  if (!res.ok) {
    const msg = typeof json?.message === "string" ? json.message : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json;
}

function formatResult({ key, expectDeals, expectLabel, gotCount, gotLabel, error }) {
  if (error) return `❌ ${key} failed: ${error}`;
  if (expectDeals) {
    if (gotCount === 0) return `❌ ${key} expected deals but none returned`;
    if (expectLabel && !gotLabel) return `❌ ${key} deals returned without assistive label`;
    return `✅ ${key} deals attached${expectLabel ? " with label" : ""}`;
  }
  // expect no deals
  if (gotCount > 0) return `❌ ${key} expected no deals but got ${gotCount}`;
  return `✅ ${key} no deals as expected`;
}

async function main() {
  await ensureFetch();

  const baseUrl = getArg("base", process.env.SCOUT_BASE_URL || "http://localhost:5000");
  const countyCode = getArg("county", process.env.SCOUT_COUNTY_CODE || "");
  const stateCode = getArg("state", process.env.SCOUT_STATE_CODE || "");
  const strict = args.includes("--strict");

  const scenarios = [
    {
      key: "A",
      message: "Where can I buy cheaper roofing materials?",
      expectDeals: true,
      expectLabel: true,
    },
    {
      key: "B",
      message: "Is $12k fair for a roof?",
      expectDeals: false,
      expectLabel: false,
    },
    {
      key: "C",
      message: "Best roofer near me?",
      expectDeals: false,
      expectLabel: false,
    },
  ];

  const results = [];

  for (const scenario of scenarios) {
    try {
      const res = await postScout({ baseUrl, message: scenario.message, countyCode, stateCode });
      const { count, hasLabel } = summarizeHints(res.ctaHints);
      results.push({
        ...scenario,
        gotCount: count,
        gotLabel: hasLabel,
        error: null,
      });
    } catch (err) {
      results.push({
        ...scenario,
        gotCount: 0,
        gotLabel: false,
        error: err?.message || String(err),
      });
    }
  }

  const lines = results.map((r) => formatResult(r));
  for (const line of lines) {
    console.log(line);
  }

  const failed = results.filter((r) => {
    if (r.error) return true;
    if (r.expectDeals) {
      if (r.gotCount === 0) return true;
      if (r.expectLabel && !r.gotLabel) return true;
      return false;
    }
    return r.gotCount > 0;
  });

  if (failed.length && strict) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal harness error", err);
  process.exitCode = 1;
});
