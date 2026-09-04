#!/usr/bin/env node
/**
 * TradeScout minimum release contract (items 1–6 locally; item 7 shape via tests).
 * Merge to main deploys production — run against the exact proposed commit.
 *
 * Usage:
 *   npm run gate:minimum-release
 *   npm run gate:minimum-release:local
 *   npm run gate:minimum-release -- --browser-proof=manual --browser-note="desktop+mobile /direct-connect OK"
 *
 * Env:
 *   TEST_DATABASE_URL  disposable DB for migration compatibility proof (required in release mode)
 *   SKIP_NPM_CI=1      same as --skip-ci; accepted only with --local-development
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const CONTEXT = "tradescout/minimum-release-contract";
export const RELEASE_MODE = "release";
export const LOCAL_DEVELOPMENT_MODE = "local-development";
export const REQUIRED_RELEASE_ATTESTATION_STEPS = Object.freeze([
  "0-execution-mode",
  "1-exact-commit",
  "1-exact-commit-clean-tree",
  "1-exact-commit-final-tree",
  "2-npm-ci",
  "2-production-readiness-registry",
  "2-production-readiness-registry-contracts",
  "2-minimum-release-contracts",
  "3-typecheck",
  "3-build",
  "4-contract-tests",
  "4-discovery-performance-tests",
  "5-database-migrate",
  "5-database-compatibility",
  "6-browser-proof",
  "7-health-shape",
]);

function enabledEnvironmentFlag(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized !== "" && !["0", "false", "no", "off"].includes(normalized);
}

export function isCiEnvironment(environment = process.env) {
  return [
    "CI",
    "GITHUB_ACTIONS",
    "GITLAB_CI",
    "CIRCLECI",
    "BUILDKITE",
    "JENKINS_URL",
    "TF_BUILD",
  ].some((name) => enabledEnvironmentFlag(environment[name]));
}

export function parseArgs(argv, environment = process.env) {
  const args = {
    mode: RELEASE_MODE,
    skipCi: environment.SKIP_NPM_CI === "1",
    allowDbSkip: false,
    browserProof: "auto",
    browserNote: "",
    attest: false,
  };
  for (const raw of argv) {
    if (raw === "--local-development") args.mode = LOCAL_DEVELOPMENT_MODE;
    else if (raw === "--release") args.mode = RELEASE_MODE;
    else if (raw === "--skip-ci") args.skipCi = true;
    else if (raw === "--allow-db-skip") args.allowDbSkip = true;
    else if (raw === "--attest") args.attest = true;
    else if (raw.startsWith("--browser-proof=")) {
      args.browserProof = raw.slice("--browser-proof=".length);
    } else if (raw.startsWith("--browser-note=")) {
      args.browserNote = raw.slice("--browser-note=".length);
    } else {
      throw new Error(`Unknown minimum-release option: ${raw}`);
    }
  }
  return args;
}

export function validateGateConfiguration(args, environment = process.env) {
  const failures = [];
  if (args.mode === RELEASE_MODE && args.skipCi) {
    failures.push("release mode forbids skipping npm ci");
  }
  if (args.mode === RELEASE_MODE && args.allowDbSkip) {
    failures.push("release mode forbids skipping disposable database proof");
  }
  if (args.mode === LOCAL_DEVELOPMENT_MODE && args.attest) {
    failures.push("local-development evidence cannot be attested");
  }
  if (args.mode === LOCAL_DEVELOPMENT_MODE && isCiEnvironment(environment)) {
    failures.push("CI execution forbids local-development mode");
  }
  if (!["auto", "manual", "skip"].includes(args.browserProof)) {
    failures.push(`unsupported browser proof mode: ${args.browserProof}`);
  }
  return failures;
}

export function resolveDatabaseEvidence(args, environment = process.env) {
  const url = String(environment.TEST_DATABASE_URL || "").trim();
  if (url) return { disposition: "run", url };
  if (args.mode === LOCAL_DEVELOPMENT_MODE && args.allowDbSkip) {
    return {
      disposition: "skip",
      detail: "TEST_DATABASE_URL missing in explicit local-development mode",
    };
  }
  return {
    disposition: "fail",
    detail: "TEST_DATABASE_URL required for disposable migration proof",
  };
}

export function classifyEvidenceResult(steps, mode) {
  if (steps.some((step) => step.status === "fail")) return "fail";
  if (mode === LOCAL_DEVELOPMENT_MODE) return "non-attestation";
  return hasCompleteReleaseEvidence(steps) ? "pass" : "fail";
}

export function hasCompleteReleaseEvidence(steps) {
  if (!Array.isArray(steps)) return false;
  const statuses = new Map(steps.map((step) => [step.id, step.status]));
  return (
    steps.every((step) => step.status !== "skipped") &&
    REQUIRED_RELEASE_ATTESTATION_STEPS.every((id) => statuses.get(id) === "pass")
  );
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
    `- Mode: \`${evidence.mode}\``,
    `- Result: **${evidence.result}**`,
    `- Attestable: **${evidence.attestable ? "yes" : "no"}**`,
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
    contract: "tradescout-minimum-release-v2",
    context: CONTEXT,
    mode: args.mode,
    commit,
    initialDirtyTree: Boolean(dirty),
    dirtyTree: Boolean(dirty),
    generatedAt: new Date().toISOString(),
    result: "pending",
    attestable: false,
    steps,
  };

  const record = (id, status, detail = "") => {
    steps.push({ id, status, detail });
    console.log(`[gate] ${id}: ${status}${detail ? ` (${detail})` : ""}`);
  };

  const configurationFailures = validateGateConfiguration(args);
  if (configurationFailures.length > 0) {
    record("0-execution-mode", "fail", configurationFailures.join("; "));
    evidence.result = "fail";
    const paths = writeEvidence(evidence);
    console.error(`[gate] FAILED — evidence: ${paths.jsonPath}`);
    process.exit(2);
  }
  record(
    "0-execution-mode",
    "pass",
    args.mode === RELEASE_MODE
      ? "release attestation; required evidence cannot be skipped"
      : "local development; any skips produce non-attestation evidence"
  );

  record("1-exact-commit", "pass", commit);
  if (dirty) {
    if (args.mode === RELEASE_MODE) {
      record(
        "1-exact-commit-clean-tree",
        "fail",
        "release evidence cannot represent uncommitted changes"
      );
      evidence.result = "fail";
      const paths = writeEvidence(evidence);
      console.error(`[gate] FAILED — evidence: ${paths.jsonPath}`);
      process.exit(2);
    }
    record(
      "1-exact-commit-clean-tree",
      "warn",
      "working tree dirty; local evidence is not an attestation"
    );
  } else {
    record("1-exact-commit-clean-tree", "pass", "clean");
  }

  // 2. Clean dependency installation
  if (args.skipCi) {
    record("2-npm-ci", "skipped", "explicit local-development mode via SKIP_NPM_CI or --skip-ci");
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

  const readinessRegistry = run("npm", ["run", "guard:production-readiness-registry"], {
    label: "production readiness registry guard",
  });
  record(
    "2-production-readiness-registry",
    readinessRegistry.ok ? "pass" : "fail",
    `exit ${readinessRegistry.status}`
  );
  if (!readinessRegistry.ok) {
    evidence.result = "fail";
    writeEvidence(evidence);
    process.exit(readinessRegistry.status);
  }

  const readinessRegistryContracts = run("npm", ["run", "test:production-readiness-registry"], {
    label: "production readiness registry contract tests",
  });
  record(
    "2-production-readiness-registry-contracts",
    readinessRegistryContracts.ok ? "pass" : "fail",
    `exit ${readinessRegistryContracts.status}`
  );
  if (!readinessRegistryContracts.ok) {
    evidence.result = "fail";
    writeEvidence(evidence);
    process.exit(readinessRegistryContracts.status);
  }

  const releaseGateContracts = run("npm", ["run", "test:minimum-release-contract"], {
    label: "minimum release and predeploy contract tests",
  });
  record(
    "2-minimum-release-contracts",
    releaseGateContracts.ok ? "pass" : "fail",
    `exit ${releaseGateContracts.status}`
  );
  if (!releaseGateContracts.ok) {
    evidence.result = "fail";
    writeEvidence(evidence);
    process.exit(releaseGateContracts.status);
  }

  // 3. Type and build validation
  const check = run("npm", ["run", "check"], { label: "npm run check" });
  record("3-typecheck", check.ok ? "pass" : "fail", `exit ${check.status}`);
  if (!check.ok) {
    evidence.result = "fail";
    writeEvidence(evidence);
    process.exit(check.status);
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

  const discoveryPerformanceTests = run("npm", ["run", "test:discovery-performance"], {
    label: "discovery performance report contract tests",
  });
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
  const databaseEvidence = resolveDatabaseEvidence(args);
  if (databaseEvidence.disposition === "skip") {
    record("5-database-compatibility", "skipped", databaseEvidence.detail);
  } else if (databaseEvidence.disposition === "fail") {
    record("5-database-compatibility", "fail", databaseEvidence.detail);
    evidence.result = "fail";
    writeEvidence(evidence);
    process.exit(2);
  } else {
    const migrate = run("npm", ["run", "db:migrate"], {
      env: { ...process.env, DATABASE_URL: databaseEvidence.url },
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
      env: { ...process.env, DATABASE_URL: databaseEvidence.url },
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

  const finalDirty = gitStatusPorcelain();
  evidence.dirtyTree = Boolean(finalDirty);
  if (finalDirty) {
    record(
      "1-exact-commit-final-tree",
      args.mode === RELEASE_MODE ? "fail" : "warn",
      args.mode === RELEASE_MODE
        ? "validation changed tracked release inputs; evidence no longer matches HEAD"
        : "working tree remains dirty; local evidence is not an attestation"
    );
  } else {
    record("1-exact-commit-final-tree", "pass", "clean after validation");
  }

  // Shape proof for item 7 (health payload contract) already covered in step 4 tests.
  record("7-health-shape", "pass", "asserted by health-release-contract tests");

  evidence.result = classifyEvidenceResult(steps, args.mode);
  evidence.attestable =
    evidence.result === "pass" &&
    args.mode === RELEASE_MODE &&
    !evidence.dirtyTree &&
    hasCompleteReleaseEvidence(steps);
  const paths = writeEvidence(evidence);
  console.log(`\n[gate] ${evidence.result.toUpperCase()} — ${paths.jsonPath}`);
  console.log(`[gate] Markdown: ${paths.mdPath}`);
  console.log(`[gate] Status context for rulesets: ${CONTEXT}`);
  if (evidence.result === "non-attestation") {
    console.log(
      "[gate] Local checks completed, but skipped/local evidence is NOT a release attestation."
    );
  }

  if (args.attest) {
    if (!evidence.attestable) {
      console.error("[gate] Refusing to attest incomplete or local-development evidence");
      process.exit(2);
    }
    const attest = run("node", ["scripts/attest-minimum-release-contract.mjs", paths.jsonPath], {
      label: "attest GitHub commit status",
    });
    if (!attest.ok) process.exit(attest.status);
  }

  process.exit(evidence.result === "fail" ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("[gate] Fatal:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
