#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_ORIGIN = "https://www.thetradescout.com";
const ARTIFACT_PATH = path.resolve(
  process.cwd(),
  "artifacts/universal-attribution-ref-smoke-latest.json"
);

const origin = String(process.env.TRADESCOUT_PRODUCTION_ORIGIN || DEFAULT_ORIGIN).replace(
  /\/+$/,
  ""
);
const shouldRun = process.env.RUN_UNIVERSAL_ATTRIBUTION_REF_SMOKE === "1";
const refTag = String(process.env.TRADESCOUT_REF_TAG || "").trim();
const validTarget = String(process.env.TRADESCOUT_REF_TARGET || "/scout").trim();

const checks = [];

function statusResult(label, ok, details) {
  checks.push({ label, ok, details });
}

async function request(pathname) {
  const response = await fetch(`${origin}${pathname}`, {
    method: "GET",
    redirect: "manual",
    headers: {
      Accept: "application/json,text/html",
    },
  });
  const bodyText = await response.text();
  return {
    status: response.status,
    location: response.headers.get("location") || "",
    setCookie: response.headers.get("set-cookie") || "",
    bodyPreview: String(bodyText || "").slice(0, 280),
  };
}

async function main() {
  if (!shouldRun) {
    const artifact = {
      generatedAt: new Date().toISOString(),
      origin,
      status: "valid-ref blocked",
      checks: [
        {
          label: "preconditions",
          ok: false,
          details: "Set RUN_UNIVERSAL_ATTRIBUTION_REF_SMOKE=1 to run this smoke script.",
        },
      ],
    };
    await fs.mkdir(path.dirname(ARTIFACT_PATH), { recursive: true });
    await fs.writeFile(ARTIFACT_PATH, JSON.stringify(artifact, null, 2));
    console.log(`Artifact written: ${ARTIFACT_PATH}`);
    process.exitCode = 2;
    return;
  }

  if (!refTag) {
    const artifact = {
      generatedAt: new Date().toISOString(),
      origin,
      status: "valid-ref blocked",
      checks: [
        {
          label: "missing_ref_tag",
          ok: false,
          details: "Set TRADESCOUT_REF_TAG to a valid production affiliate tag.",
        },
      ],
    };
    await fs.mkdir(path.dirname(ARTIFACT_PATH), { recursive: true });
    await fs.writeFile(ARTIFACT_PATH, JSON.stringify(artifact, null, 2));
    console.log(`Artifact written: ${ARTIFACT_PATH}`);
    process.exitCode = 2;
    return;
  }

  const failClosedProbe = await request(
    `/ref/${encodeURIComponent(refTag)}?to=${encodeURIComponent("https://evil.example/steal")}`
  );
  const failClosedPass = failClosedProbe.status === 400;
  statusResult("fail_closed_external_target", failClosedPass, `status=${failClosedProbe.status}`);

  const validProbe = await request(
    `/ref/${encodeURIComponent(refTag)}?to=${encodeURIComponent(validTarget)}`
  );
  const validRefComplete =
    validProbe.status === 302 &&
    validProbe.location === validTarget &&
    validProbe.setCookie.includes("ts_ref=");
  statusResult(
    "valid_ref_redirect_and_cookie",
    validRefComplete,
    `status=${validProbe.status} location=${validProbe.location} cookie=${Boolean(validProbe.setCookie)}`
  );

  let overallStatus = "valid-ref blocked";
  if (failClosedPass && validRefComplete) {
    overallStatus = "valid-ref complete";
  } else if (failClosedPass) {
    overallStatus = "fail-closed production pass";
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    origin,
    refTag,
    validTarget,
    status: overallStatus,
    checks,
    probes: {
      failClosedProbe,
      validProbe,
    },
  };

  await fs.mkdir(path.dirname(ARTIFACT_PATH), { recursive: true });
  await fs.writeFile(ARTIFACT_PATH, JSON.stringify(artifact, null, 2));

  console.log(`Artifact written: ${ARTIFACT_PATH}`);
  console.log(`universal-attribution-ref-smoke status: ${overallStatus}`);

  if (overallStatus === "valid-ref complete") {
    process.exitCode = 0;
    return;
  }

  process.exitCode = 1;
}

main().catch(async (error) => {
  const artifact = {
    generatedAt: new Date().toISOString(),
    origin,
    status: "valid-ref blocked",
    checks,
    error: String(error?.message || error),
  };
  await fs.mkdir(path.dirname(ARTIFACT_PATH), { recursive: true });
  await fs.writeFile(ARTIFACT_PATH, JSON.stringify(artifact, null, 2));
  console.error(error);
  process.exitCode = 1;
});
