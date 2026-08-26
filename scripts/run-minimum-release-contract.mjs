#!/usr/bin/env node
/**
 * TradeScout minimum release contract (items 1–6 locally; item 7 shape via tests).
 * Merge to main deploys production — run against the exact proposed commit.
 *
 * Usage:
 *   npm run gate:minimum-release
 *   npm run gate:minimum-release -- --skip-ci
 *   npm run gate:minimum-release -- --browser-proof=manual --browser-note="desktop+mobile /direct-connect OK"
 *
 * Env:
 *   TEST_DATABASE_URL  disposable DB for migration compatibility proof (required unless --allow-db-skip)
 *   SKIP_NPM_CI=1      same as --skip-ci
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const CONTEXT = "tradescout/minimum-release-contract";

function parseArgs(argv) {
  const args = {
    skipCi: process.env.SKIP_NPM_CI === "1",
    allowDbSkip: false,
    browserProof: "auto",
    browserNote: "",
    attest: false,
  };
  for (const raw of argv) {
    if (raw === "--skip-ci") args.skipCi = true;
    else if (raw === "--allow-db-skip") args.allowDbSkip = true;
    else if (raw === "--attest") args.attest = true;
    else if (raw.startsWith("--browser-proof=")) {
      args.browserProof = raw.slice("--browser-proof=".length);
    } else if (raw.startsWith("--browser-note=")) {
      args.browserNote = raw.slice("--browser-note=".length);
    }
  }
  return args;
}

function run(command, commandArgs, { env = process.env, label } = {}) {
  console.log(`\n[gate] ${label || `${command} ${commandArgs.join(" ")}`}`);
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    label: label || `${command} ${commandArgs.join(" ")}`,
  };
}

function gitHead() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error("Unable to resolve git HEAD");
  return result.stdout.trim();
}

function gitStatusPorcelain() {
  const result = spawnSync("git", ["status", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return (result.stdout || "").trim();
}

function writeEvidence(evidence) {
  const dir = path.join(repoRoot, "artifacts", "release-contract", evidence.commit.slice(0, 12));
  fs.mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, "evidence.json");
  const mdPath = path.join(dir, "evidence.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  const lines = [
    `# Minimum release contract evidence`,
    ``,
    `- Commit: \`${evidence.commit}\``,
    `- Result: **${evidence.result}**`,
    `- Generated: ${evidence.generatedAt}`,
    `- Gate context: \`${CONTEXT}\``,
    ``,
    `## Steps`,
    ...evidence.steps.map(
      (step) => `- ${step.id}: ${step.status}${step.detail ? ` — ${step.detail}` : ""}`
    ),
    ``,
  ];
  fs.writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");
  return { jsonPath, mdPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const commit = gitHead();
  const dirty = gitStatusPorcelain();
  const steps = [];
  const evidence = {
    contract: "tradescout-minimum-release-v1",
    context: CONTEXT,
    commit,
    dirtyTree: Boolean(dirty),
    generatedAt: new Date().toISOString(),
    result: "pending",
    steps,
  };

  const record = (id, status, detail = "") => {
    steps.push({ id, status, detail });
    console.log(`[gate] ${id}: ${status}${detail ? ` (${detail})` : ""}`);
  };

  record("1-exact-commit", "pass", commit);
  if (dirty) {
    record("1-exact-commit-clean-tree", "warn", "working tree dirty; attest only after commit");
  } else {
    record("1-exact-commit-clean-tree", "pass", "clean");
  }

  // 2. Clean dependency installation
  if (args.skipCi) {
    record("2-npm-ci", "skipped", "SKIP_NPM_CI or --skip-ci");
  } else {
    const ci = run("npm", ["ci"], { label: "npm ci" });
    record("2-npm-ci", ci.ok ? "pass" : "fail", `exit ${ci.status}`);
    if (!ci.ok) {
      evidence.result = "fail";
      const paths = writeEvidence(evidence);
      console.error(`[gate] FAILED — evidence: ${paths.jsonPath}`);
      process.exit(ci.status);
    }
  }

  // 3. Type, production-debt, and build validation
  const check = run("npm", ["run", "check"], { label: "npm run check" });
  record("3-typecheck", check.ok ? "pass" : "fail", `exit ${check.status}`);
  if (!check.ok) {
    evidence.result = "fail";
    writeEvidence(evidence);
    process.exit(check.status);
  }

  const productionDebtAudit = run(
    "npm",
    ["run", "audit:production-debt"],
    { label: "npm run audit:production-debt" }
  );
  record(
    "3-production-debt-audit",
    productionDebtAudit.ok ? "pass" : "fail",
    "exit " + productionDebtAudit.status
  );
  if (!productionDebtAudit.ok) {
    evidence.result = "fail";
    writeEvidence(evidence);
    process.exit(productionDebtAudit.status);
  }

  const build = run("npm", ["run", "build"], { label: "npm run build" });
  record("3-build", build.ok ? "pass" : "fail", `exit ${build.status}`);
  if (!build.ok) {
    evidence.result = "fail";
    writeEvidence(evidence);
    process.exit(build.status);
  }

  // 4. Relevant contract tests
  const contractTests = [
    "server/tests/required-production-schema.test.ts",
    "server/tests/apply-sql-migration-record.test.ts",
    "server/tests/build-identity-headers.test.ts",
    "server/tests/historical-migration-chain.contract.test.ts",
    "server/tests/migrationCompatibilityStatus.contract.test.ts",
    "server/tests/health-release-contract.contract.test.ts",
    "server/tests/solo-dev-ruleset.contract.test.ts",
    "server/tests/landing-seo-contracts.test.ts",
    "server/tests/profile-account-foundation.contract.test.ts",
    "server/tests/admin-production-acceptance.contract.test.ts",
    "server/tests/admin-live-stream.contract.test.ts",
    "server/tests/direct-connect-gates.regression.test.ts",
    "server/tests/directory-navigation-cache.contract.test.ts",
    "server/tests/discovery-attribution-html.test.ts",
    "server/tests/discovery-landing.contract.test.ts",
    "server/tests/discovery-observatory.contract.test.ts",
    "client/src/lib/discoveryLanding.test.ts",
    "client/src/admin/admin-production-acceptance.contract.test.ts",
    "client/src/pages/profile-sites/ExpressDirectConnectPanel.test.tsx",
  ];
  const testRun = run("npm", ["run", "test:run", "--", ...contractTests], {
    label: "relevant contract tests",
  });
  record("4-contract-tests", testRun.ok ? "pass" : "fail", `exit ${testRun.status}`);
  if (!testRun.ok) {
    evidence.result = "fail";
    writeEvidence(evidence);
    process.exit(testRun.status);
  }

  const discoveryPerformanceTests = run(
    "npm",
    ["run", "test:discovery-performance"],
    { label: "discovery performance report contract tests" }
  );
  record(
    "4-discovery-performance-tests",
    discoveryPerformanceTests.ok ? "pass" : "fail",
    `exit ${discoveryPerformanceTests.status}`
  );
  if (!discoveryPerformanceTests.ok) {
    evidence.result = "fail";
    writeEvidence(evidence);
    process.exit(discoveryPerformanceTests.status);
  }

  // 5. Database compatibility proof
  const testDbUrl = String(process.env.TEST_DATABASE_URL || "").trim();
  if (!testDbUrl) {
    if (args.allowDbSkip) {
      record("5-database-compatibility", "skipped", "TEST_DATABASE_URL missing; --allow-db-skip");
    } else {
      record(
        "5-database-compatibility",
        "fail",
        "TEST_DATABASE_URL required for disposable migration proof"
      );
      evidence.result = "fail";
      writeEvidence(evidence);
      process.exit(2);
    }
  } else {
    const migrate = run("npm", ["run", "db:migrate"], {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      label: "db:migrate (TEST_DATABASE_URL)",
    });
    if (!migrate.ok) {
      record("5-database-migrate", "fail", `exit ${migrate.status}`);
      evidence.result = "fail";
      writeEvidence(evidence);
      process.exit(migrate.status);
    }
    record("5-database-migrate", "pass");

    const verify = run("npm", ["run", "db:verify:required"], {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      label: "db:verify:required (TEST_DATABASE_URL)",
    });
    record("5-database-compatibility", verify.ok ? "pass" : "fail", `exit ${verify.status}`);
    if (!verify.ok) {
      evidence.result = "fail";
      writeEvidence(evidence);
      process.exit(verify.status);
    }
  }

  // 6. Browser proof for changed user paths
  if (args.browserProof === "manual") {
    if (!args.browserNote || args.browserNote.length < 8) {
      record(
        "6-browser-proof",
        "fail",
        "manual browser proof requires --browser-note=... (>=8 chars)"
      );
      evidence.result = "fail";
      writeEvidence(evidence);
      process.exit(2);
    }
    record("6-browser-proof", "pass", `manual: ${args.browserNote}`);
  } else if (args.browserProof === "skip") {
    record("6-browser-proof", "fail", "browser proof cannot be silently skipped");
    evidence.result = "fail";
    writeEvidence(evidence);
    process.exit(2);
  } else {
    // auto: require an explicit local public-entry smoke against BASE_URL if set,
    // otherwise require manual attestation note via env.
    const baseUrl = String(process.env.BASE_URL || process.env.APP_URL || "").trim();
    const manualNote = String(process.env.BROWSER_PROOF_NOTE || "").trim();
    if (baseUrl) {
      const smoke = run("node", ["scripts/tradescout-production-public-entry-smoke.mjs"], {
        env: {
          ...process.env,
          RUN_TRADESCOUT_PRODUCTION_PUBLIC_ENTRY_SMOKE: "1",
          TRADESCOUT_PUBLIC_BASE_URL: baseUrl,
          TRADESCOUT_EXPECTED_COMMIT: commit,
        },
        label: `public-entry smoke @ ${baseUrl}`,
      });
      record("6-browser-proof", smoke.ok ? "pass" : "fail", `BASE_URL smoke exit ${smoke.status}`);
      if (!smoke.ok) {
        evidence.result = "fail";
        writeEvidence(evidence);
        process.exit(smoke.status);
      }
    } else if (manualNote.length >= 8) {
      record("6-browser-proof", "pass", `manual via BROWSER_PROOF_NOTE: ${manualNote}`);
    } else {
      record(
        "6-browser-proof",
        "fail",
        "set BASE_URL for smoke, or --browser-proof=manual --browser-note=..., or BROWSER_PROOF_NOTE"
      );
      evidence.result = "fail";
      writeEvidence(evidence);
      process.exit(2);
    }
  }

  // Shape proof for item 7 (health payload contract) already covered in step 4 tests.
  record("7-health-shape", "pass", "asserted by health-release-contract tests");

  evidence.result = steps.some((s) => s.status === "fail") ? "fail" : "pass";
  const paths = writeEvidence(evidence);
  console.log(`\n[gate] ${evidence.result.toUpperCase()} — ${paths.jsonPath}`);
  console.log(`[gate] Markdown: ${paths.mdPath}`);
  console.log(`[gate] Status context for rulesets: ${CONTEXT}`);

  if (args.attest) {
    const attest = run("node", ["scripts/attest-minimum-release-contract.mjs", paths.jsonPath], {
      label: "attest GitHub commit status",
    });
    if (!attest.ok) process.exit(attest.status);
  }

  process.exit(evidence.result === "pass" ? 0 : 1);
}

main().catch((error) => {
  console.error("[gate] Fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
