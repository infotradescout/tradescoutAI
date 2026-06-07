#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_ORIGIN = "https://www.thetradescout.com";
const ARTIFACT_PATH = path.resolve(
  process.cwd(),
  "artifacts/direct-connect-production-smoke-latest.json"
);

const origin = String(process.env.TRADESCOUT_PRODUCTION_ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, "");
const requesterCookie = cleanCookie(process.env.TRADESCOUT_REQUESTER_COOKIE);
const providerCookie = cleanCookie(process.env.TRADESCOUT_PROVIDER_COOKIE);
const staffCookie = cleanCookie(process.env.TRADESCOUT_STAFF_COOKIE);
const shouldRun = process.env.RUN_DIRECT_CONNECT_PRODUCTION_SMOKE === "1";
const shouldProbe429 = process.env.RUN_DIRECT_CONNECT_RATE_LIMIT_429 === "1";
const smokeCountyFips = String(process.env.TRADESCOUT_SMOKE_COUNTY_FIPS || "").trim();
const smokeStateCode = String(process.env.TRADESCOUT_SMOKE_STATE_CODE || "").trim().toUpperCase();
const productionDatabaseUrl = String(process.env.TRADESCOUT_PRODUCTION_DATABASE_URL || "").trim();

const results = [];

function cleanCookie(value) {
  return String(value || "")
    .replace(/^cookie:\s*/i, "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function safeBodyPreview(body) {
  if (!body) return "";
  return String(body).replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

async function requestJson(label, method, urlPath, { cookie, data, expect } = {}) {
  const headers = { Accept: "application/json" };
  if (cookie) headers.Cookie = cookie;
  if (data !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${origin}${urlPath}`, {
    method,
    headers,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const record = {
    label,
    method,
    path: urlPath,
    status: response.status,
    ok: expect ? expect.includes(response.status) : response.ok,
    build: response.headers.get("x-tradescout-build") || "",
    contentType: response.headers.get("content-type") || "",
    bodyPreview: safeBodyPreview(text),
  };
  results.push(record);
  return { response, text, json, record };
}

function requireBlockedPreconditions() {
  const missing = [];
  if (!shouldRun) missing.push("RUN_DIRECT_CONNECT_PRODUCTION_SMOKE=1");
  if (!requesterCookie) missing.push("TRADESCOUT_REQUESTER_COOKIE");
  if (!providerCookie) missing.push("TRADESCOUT_PROVIDER_COOKIE");
  return missing;
}

async function queryRateLimitBuckets() {
  if (!productionDatabaseUrl) {
    results.push({
      label: "rate_limit_buckets_db_evidence",
      status: "SKIPPED",
      ok: false,
      bodyPreview: "Set TRADESCOUT_PRODUCTION_DATABASE_URL to verify live Postgres bucket writes.",
    });
    return null;
  }

  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: productionDatabaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });
  try {
    const response = await pool.query(`
      SELECT bucket_key, hits, reset_at, updated_at
      FROM rate_limit_buckets
      WHERE bucket_key LIKE 'rl:direct_connect:%'
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    const rows = response.rows || [];
    results.push({
      label: "rate_limit_buckets_db_evidence",
      status: rows.length > 0 ? 200 : 404,
      ok: rows.length > 0,
      bodyPreview: JSON.stringify(
        rows.map((row) => ({
          bucketKeyPrefix: String(row.bucket_key || "").split(":").slice(0, 3).join(":"),
          hits: Number(row.hits || 0),
          resetAt: row.reset_at,
          updatedAt: row.updated_at,
        }))
      ),
    });
    return rows;
  } finally {
    await pool.end();
  }
}

async function runRateLimitProbe(requestId) {
  if (!shouldProbe429) {
    results.push({
      label: "rate_limit_429_probe",
      status: "SKIPPED",
      ok: false,
      bodyPreview:
        "Set RUN_DIRECT_CONNECT_RATE_LIMIT_429=1 to run the high-volume 429 probe against the smoke-owned route endpoint.",
    });
    return null;
  }

  const maxAttempts = Math.max(
    1,
    Math.min(140, Number.parseInt(process.env.DIRECT_CONNECT_SMOKE_429_MAX_ATTEMPTS || "100", 10))
  );
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await requestJson(
      `rate_limit_429_probe_attempt_${attempt}`,
      "POST",
      `/api/direct-connect/requests/${encodeURIComponent(requestId)}/route`,
      { cookie: requesterCookie, data: { autoRoute: false }, expect: [200, 409, 429] }
    );
    if (result.response.status === 429) {
      const code = String(result.json?.code || "");
      const message = String(result.json?.message || "");
      results.push({
        label: "rate_limit_429_probe_summary",
        status: 429,
        ok: code === "DIRECT_CONNECT_RATE_LIMITED" && message.length > 0,
        bodyPreview: JSON.stringify({ attempt, code, message }),
      });
      return result;
    }
  }
  results.push({
    label: "rate_limit_429_probe_summary",
    status: "NOT_REACHED",
    ok: false,
    bodyPreview: `No 429 observed within ${maxAttempts} attempts.`,
  });
  return null;
}

async function main() {
  const missing = requireBlockedPreconditions();
  if (missing.length) {
    const artifact = {
      generatedAt: new Date().toISOString(),
      origin,
      status: "BLOCKED",
      results: [
        {
          label: "preconditions",
          status: "BLOCKED",
          ok: false,
          bodyPreview: `Missing ${missing.join(", ")}`,
        },
      ],
    };
    await fs.mkdir(path.dirname(ARTIFACT_PATH), { recursive: true });
    await fs.writeFile(ARTIFACT_PATH, JSON.stringify(artifact, null, 2));
    console.error(`Artifact written: ${ARTIFACT_PATH}`);
    console.error(`BLOCKED: missing ${missing.join(", ")}`);
    process.exitCode = 2;
    return;
  }

  const health = await requestJson("health", "GET", "/api/health", { expect: [200] });
  const deployedBuild = health.record.build;

  await requestJson("direct_connect_render", "GET", "/direct-connect", { expect: [200] });
  await requestJson("unauthenticated_create_blocked", "POST", "/api/direct-connect/requests", {
    data: {
      title: "Unauthenticated Direct Connect production smoke should be blocked",
      description: "This unauthenticated request must not create production data.",
      category: "service_request",
    },
    expect: [401, 403],
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const createPayload = {
    title: `[smoke] Direct Connect rate-limit production smoke ${stamp}`,
    description:
      "Production smoke request created by approved TradeScout smoke account to verify Direct Connect rate-limit hardening.",
    category: "service_request",
    autoRoute: false,
  };
  if (smokeCountyFips) createPayload.countyFips = smokeCountyFips;
  if (smokeStateCode) createPayload.stateCode = smokeStateCode;

  const created = await requestJson("requester_create_request", "POST", "/api/direct-connect/requests", {
    cookie: requesterCookie,
    data: createPayload,
    expect: [201],
  });
  const requestId = String(created.json?.id || "");
  if (!requestId) throw new Error("Requester create did not return a request id.");

  await requestJson("requester_route_request", "POST", `/api/direct-connect/requests/${requestId}/route`, {
    cookie: requesterCookie,
    data: { autoRoute: false },
    expect: [200],
  });

  await requestJson("requester_share_link", "POST", `/api/direct-connect/requests/${requestId}/share`, {
    cookie: requesterCookie,
    expect: [200],
  });

  const expressed = await requestJson(
    "provider_express_interest",
    "POST",
    `/api/direct-connect/requests/${requestId}/express-interest`,
    { cookie: providerCookie, data: {}, expect: [200, 201] }
  );
  const assignmentId = String(expressed.json?.assignment?.id || "");
  if (!assignmentId) throw new Error("Provider express-interest did not return an assignment id.");

  await requestJson(
    "provider_assignment_response",
    "POST",
    `/api/direct-connect/assignments/${assignmentId}/respond`,
    {
      cookie: providerCookie,
      data: {
        decision: "accept",
        availabilityWindow: "Smoke window",
        priceBand: "standard",
        scopeNote: "Production smoke provider can review this controlled test request.",
      },
      expect: [200, 201],
    }
  );

  await requestJson(
    "provider_contractor_response",
    "POST",
    `/api/direct-connect/contractor/requests/${requestId}/respond`,
    {
      cookie: providerCookie,
      data: {
        responseType: "interested",
        message: "Production smoke provider response.",
        availability: "Smoke window",
        estimatedTiming: "Smoke window",
      },
      expect: [200, 201, 403, 409],
    }
  );

  await requestJson(
    "provider_request_contact",
    "POST",
    `/api/direct-connect/contractor/requests/${requestId}/request-contact`,
    { cookie: providerCookie, data: {}, expect: [200] }
  );

  await requestJson(
    "requester_contact_gate_user_approved",
    "POST",
    `/api/direct-connect/requests/${requestId}/contact-gate`,
    { cookie: requesterCookie, data: { nextState: "user_approved" }, expect: [200] }
  );

  await queryRateLimitBuckets();
  await runRateLimitProbe(requestId);

  const failed = results.filter((result) => result.ok === false && result.status !== "SKIPPED");
  const blocked = results.filter(
    (result) =>
      result.status === "SKIPPED" &&
      ["rate_limit_buckets_db_evidence", "rate_limit_429_probe"].includes(result.label)
  );
  const status = failed.length > 0 ? "FAIL" : blocked.length > 0 ? "BLOCKED" : "LAUNCH_READY";
  const artifact = {
    generatedAt: new Date().toISOString(),
    origin,
    deployedBuild,
    smokeRequestId: requestId,
    status,
    results,
  };
  await fs.mkdir(path.dirname(ARTIFACT_PATH), { recursive: true });
  await fs.writeFile(ARTIFACT_PATH, JSON.stringify(artifact, null, 2));
  console.log(`Artifact written: ${ARTIFACT_PATH}`);
  console.log(`Status: ${artifact.status}`);
  if (failed.length) {
    console.error(`Failed checks: ${failed.map((item) => item.label).join(", ")}`);
    process.exitCode = 1;
  } else if (blocked.length) {
    console.error(`Blocked checks: ${blocked.map((item) => item.label).join(", ")}`);
    process.exitCode = 2;
  }
}

main().catch(async (error) => {
  results.push({
    label: "fatal_error",
    status: "ERROR",
    ok: false,
    bodyPreview: error instanceof Error ? error.message : String(error),
  });
  await fs.mkdir(path.dirname(ARTIFACT_PATH), { recursive: true });
  await fs.writeFile(
    ARTIFACT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        origin,
        status: "FAIL",
        results,
      },
      null,
      2
    )
  );
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
