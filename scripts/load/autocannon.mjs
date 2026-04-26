import autocannon from "autocannon";

function getBaseUrl() {
  const raw = process.env.BASE_URL || "http://localhost:5000";
  return raw.replace(/\/$/, "");
}

async function preflightHealth(baseUrl) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function getScenario() {
  return (process.env.SCENARIO || "public").trim();
}

function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

async function run() {
  const baseUrl = getBaseUrl();
  const scenario = getScenario();

  const ok = await preflightHealth(baseUrl);
  if (!ok) {
    console.error(
      `[load] Server not reachable at BASE_URL=${baseUrl}. Start the server (e.g. npm run dev or npm run start) and retry.`
    );
    process.exitCode = 1;
    return;
  }

  const duration = numberEnv("DURATION_SEC", 20);
  const connections = numberEnv("CONNECTIONS", 25);
  const pipelining = numberEnv("PIPELINING", 1);

  const endpointsByScenario = {
    public: [
      { method: "GET", path: "/api/health" },
      { method: "GET", path: "/api/public/proof-metrics" },
    ],
    search: [
      { method: "GET", path: "/api/contractors/search?trade=general&county=Test&state=TS&limit=20" },
      { method: "GET", path: "/api/marketplace/search?query=test&location=TS&limit=20" },
    ],
    maps: [
      {
        method: "GET",
        path: "/api/map/entities?bbox=-97.30,32.70,-96.50,33.10&types=provider,business&limit=200",
      },
      {
        method: "GET",
        path: "/api/map/providers?bbox=-97.30,32.70,-96.50,33.10&verified=true&limit=200",
      },
      { method: "GET", path: "/api/public-config" },
    ],
  };

  const requests = endpointsByScenario[scenario];
  if (!requests) {
    throw new Error(`Unknown SCENARIO '${scenario}'. Use: ${Object.keys(endpointsByScenario).join(", ")}`);
  }

  const result = await autocannon({
    url: baseUrl,
    connections,
    duration,
    pipelining,
    requests,
    headers: {
      Accept: "application/json",
      "User-Agent": "tradescout-loadtest/autocannon",
    },
  });

  // Make this usable in CI or local gates.
  const maxErrorPct = numberEnv("MAX_ERROR_PCT", 1);
  const errorPct = result.errors + result.timeouts > 0
    ? ((result.errors + result.timeouts) / Math.max(1, result.requests.sent)) * 100
    : 0;

  // Print a concise summary; autocannon's default output is a bit noisy for logs.
  // See raw numbers in result if needed.
  console.log(
    JSON.stringify(
      {
        baseUrl,
        scenario,
        durationSec: duration,
        connections,
        pipelining,
        sent: result.requests.sent,
        completed: result.requests.completed,
        errors: result.errors,
        timeouts: result.timeouts,
        errorPct: Number(errorPct.toFixed(3)),
        p99Ms: result.latency?.p99,
        rpsAvg: result.requests?.average,
      },
      null,
      2
    )
  );

  if (errorPct > maxErrorPct) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
