import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  LOCAL_DEVELOPMENT_MODE,
  RELEASE_MODE,
  REQUIRED_RELEASE_ATTESTATION_STEPS,
  classifyEvidenceResult,
  hasCompleteReleaseEvidence,
  parseArgs,
  resolveDatabaseEvidence,
  validateGateConfiguration,
} from "./run-minimum-release-contract.mjs";
import {
  PRODUCTION_PREDEPLOY_STEPS,
  executeProductionPredeploy,
} from "./run-production-predeploy.mjs";
import { validateAttestationEvidence } from "./attest-minimum-release-contract.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("release mode rejects skipped dependency and database evidence", () => {
  const args = parseArgs(["--release", "--skip-ci", "--allow-db-skip"], {});

  assert.equal(args.mode, RELEASE_MODE);
  assert.deepEqual(validateGateConfiguration(args, {}), [
    "release mode forbids skipping npm ci",
    "release mode forbids skipping disposable database proof",
  ]);
  assert.deepEqual(resolveDatabaseEvidence(args, {}), {
    disposition: "fail",
    detail: "TEST_DATABASE_URL required for disposable migration proof",
  });
  assert.equal(
    classifyEvidenceResult([{ id: "2-npm-ci", status: "skipped" }], RELEASE_MODE),
    "fail"
  );
  assert.equal(classifyEvidenceResult([{ id: "2-npm-ci", status: "pass" }], RELEASE_MODE), "fail");
  const environmentSkip = parseArgs([], { SKIP_NPM_CI: "1" });
  assert.deepEqual(validateGateConfiguration(environmentSkip, {}), [
    "release mode forbids skipping npm ci",
  ]);
});

test("local-development skips are explicit non-attestation and forbidden in CI", () => {
  const args = parseArgs(["--local-development", "--skip-ci", "--allow-db-skip"], {});

  assert.equal(args.mode, LOCAL_DEVELOPMENT_MODE);
  assert.deepEqual(validateGateConfiguration(args, {}), []);
  assert.deepEqual(resolveDatabaseEvidence(args, {}), {
    disposition: "skip",
    detail: "TEST_DATABASE_URL missing in explicit local-development mode",
  });
  assert.equal(
    classifyEvidenceResult(
      [
        { id: "2-npm-ci", status: "skipped" },
        { id: "5-database-compatibility", status: "skipped" },
      ],
      LOCAL_DEVELOPMENT_MODE
    ),
    "non-attestation"
  );
  assert.deepEqual(validateGateConfiguration(args, { CI: "true" }), [
    "CI execution forbids local-development mode",
  ]);
  assert.deepEqual(validateGateConfiguration({ ...args, attest: true }, {}), [
    "local-development evidence cannot be attested",
  ]);
});

test("production predeploy orders schema proof before every media mutation", () => {
  assert.deepEqual(
    PRODUCTION_PREDEPLOY_STEPS.map(({ id, phase }) => ({ id, phase })),
    [
      { id: "database-migrate", phase: "schema" },
      { id: "required-schema", phase: "schema" },
      { id: "red-graniti-public-media", phase: "media" },
      { id: "jw-stone-public-media", phase: "media" },
      { id: "profile-public-media", phase: "media" },
    ]
  );

  const schemaFailure = executeProductionPredeploy({
    runStep(step) {
      return step.id === "required-schema" ? { ok: false, status: 23 } : { ok: true };
    },
  });
  assert.deepEqual(schemaFailure, {
    ok: false,
    status: 23,
    failedStep: "required-schema",
    detail: "",
    executed: ["database-migrate", "required-schema"],
  });
  assert.ok(schemaFailure.executed.every((id) => !id.includes("media")));
});

test("Render and container startup use the fail-closed schema-first gates", () => {
  const blueprint = read("render.yaml");
  const dockerfile = read("Dockerfile");
  const build = read("build-server.mjs");

  assert.match(
    blueprint,
    /preDeployCommand: node runtime\/run-release\.mjs run-production-predeploy scripts\/run-production-predeploy\.mjs/
  );
  assert.match(build, /['"]run-production-predeploy['"]\s*:/);
  assert.match(
    read("runtime/verify-built-runtime.mjs"),
    /dist\/release\/run-production-predeploy\.mjs/
  );

  const startupSchema = dockerfile.indexOf("run-release.mjs check-required-production-schema");
  const startupMedia = dockerfile.indexOf("run-release.mjs ensure-public-media-ready");
  const startupServer = dockerfile.indexOf("exec node dist/index.js");
  assert.ok(startupSchema >= 0);
  assert.ok(startupMedia > startupSchema);
  assert.ok(startupServer > startupMedia);
});

test("the canonical minimum gate runs its hardening contracts before validation", () => {
  const source = read("scripts/run-minimum-release-contract.mjs");
  const contracts = source.indexOf('"test:minimum-release-contract"');
  const typecheck = source.indexOf('label: "npm run check"');
  assert.ok(contracts >= 0);
  assert.ok(typecheck > contracts);
});

test("the status attester refuses local, skipped, or legacy evidence", () => {
  const complete = {
    contract: "tradescout-minimum-release-v2",
    commit: "a".repeat(40),
    dirtyTree: false,
    mode: "release",
    result: "pass",
    attestable: true,
    steps: REQUIRED_RELEASE_ATTESTATION_STEPS.map((id) => ({ id, status: "pass" })),
  };
  assert.equal(hasCompleteReleaseEvidence(complete.steps), true);
  assert.equal(classifyEvidenceResult(complete.steps, RELEASE_MODE), "pass");
  assert.deepEqual(validateAttestationEvidence(complete), []);
  assert.deepEqual(
    validateAttestationEvidence({
      ...complete,
      contract: "tradescout-minimum-release-v1",
      mode: "local-development",
      result: "non-attestation",
      attestable: false,
      steps: [{ id: "database", status: "skipped" }],
    }),
    [
      "evidence contract is not the fail-closed v2 contract",
      "evidence mode is not release",
      "evidence result is not pass",
      "evidence is marked non-attestable",
      "evidence contains skipped steps",
      "required release evidence steps are incomplete",
    ]
  );
  assert.equal(hasCompleteReleaseEvidence([]), false);
});
