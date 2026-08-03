import assert from "node:assert/strict";
import {
  createEvidenceDigest,
  EVIDENCE_END,
  EVIDENCE_START,
  parseReleaseEvidence,
  PRODUCTION_HEALTH_URL,
  POSTDEPLOY_END,
  POSTDEPLOY_START,
  validatePostdeployEvidence,
  validateReleaseEvidence,
} from "./guard-pr-release-evidence.mjs";

const HEAD_SHA = "a".repeat(40);
const BASE_SHA = "b".repeat(40);
const MERGE_SHA = "c".repeat(40);

function releaseBlock() {
  const lines = [
    EVIDENCE_START,
    "Release-Decision: GO",
    `Release-Head-SHA: ${HEAD_SHA}`,
    `Release-Base-SHA: ${BASE_SHA}`,
    "Changed-Behavior-Tests: PASS",
    "Changed-Behavior-Evidence: npm run test:run -- focused.test.ts => PASS",
    "Production-Build: PASS",
    "Production-Build-Evidence: npm run build => PASS",
    "Standard-Local-Verification: PASS",
    "Standard-Local-Verification-Evidence: npm run verify:local => PASS",
    "Law-Authority-Trust-Security: NOT-APPLICABLE",
    "Law-Authority-Trust-Security-Evidence: No law-sensitive path changed in this pull request.",
    "Database-Proof: NOT-APPLICABLE",
    "Database-Proof-Evidence: No schema or persistence path changed in this pull request.",
    "Browser-Proof: NOT-APPLICABLE",
    "Browser-Proof-Evidence: No user-interface path changed in this pull request.",
    "Production-Proof: POST-MERGE-REQUIRED",
    "Production-Proof-Evidence: Capture the resulting main SHA after merge; verify X-TradeScout-Build matches the deployed main SHA; smoke: /api/health.",
    "Known-Baseline-Failures: NONE",
    "Not-Run-And-Why: NONE",
    "Exact-Commit-Attestation: CHECKED",
    "Merge-Deploys-Production-Attestation: CHECKED",
    "Evidence-Digest: PENDING",
    EVIDENCE_END,
  ];
  return lines.join("\n");
}

function pendingPostdeployBlock() {
  return [
    POSTDEPLOY_START,
    "Production-Status: PENDING",
    "Production-Deployed-SHA: PENDING",
    "Production-Build-Marker: PENDING",
    "Production-Smoke-Evidence: PENDING",
    POSTDEPLOY_END,
  ].join("\n");
}

function passedPostdeployBlock() {
  return [
    POSTDEPLOY_START,
    "Production-Status: PASS",
    `Production-Deployed-SHA: ${MERGE_SHA}`,
    `Production-Build-Marker: ${MERGE_SHA}`,
    "Production-Smoke-Evidence: /api/health and changed route => PASS",
    POSTDEPLOY_END,
  ].join("\n");
}

function body({
  postdeploy = pendingPostdeployBlock(),
  narrative = "Initial release evidence.",
} = {}) {
  const pending = `${releaseBlock()}\n\n## Changed behavior\n\n${narrative}\n\n${postdeploy}`;
  return pending.replace(
    "Evidence-Digest: PENDING",
    `Evidence-Digest: ${createEvidenceDigest(pending)}`
  );
}

function healthyFetch({
  marker = MERGE_SHA,
  status = 200,
  payload = { status: "healthy", database: "connected" },
} = {}) {
  return async (url) => ({
    url,
    status,
    headers: {
      get: (name) => (name.toLowerCase() === "x-tradescout-build" ? marker : null),
    },
    json: async () => payload,
  });
}

function fixture() {
  const prBody = body();
  const digest = parseReleaseEvidence(prBody).fields.get("Evidence-Digest");
  return {
    checkout: {
      baseIsAncestor: true,
      branch: "feature/release-proof",
      clean: true,
      head: HEAD_SHA,
    },
    pr: {
      author: { login: "author" },
      baseRefName: "main",
      baseRefOid: BASE_SHA,
      body: prBody,
      changedFiles: 1,
      files: [{ path: "docs/release-note.md" }],
      headRefName: "feature/release-proof",
      headRefOid: HEAD_SHA,
      isDraft: false,
      labels: [],
      mergeCommit: null,
      mergeStateStatus: "CLEAN",
      mergeable: "MERGEABLE",
      reviewDecision: "APPROVED",
      reviews: [
        {
          author: { login: "reviewer" },
          authorAssociation: "COLLABORATOR",
          authorCanPushToRepository: true,
          body: `Approved release evidence ${digest}`,
          commit: { oid: HEAD_SHA },
          state: "APPROVED",
        },
      ],
      state: "OPEN",
      url: "https://github.test/example/pull/1",
    },
  };
}

function setField(context, key, value) {
  context.pr.body = context.pr.body.replace(new RegExp(`^${key}:.*$`, "m"), `${key}: ${value}`);
}

function refreshDigest(context, { refreshReview = true } = {}) {
  const parsed = parseReleaseEvidence(context.pr.body);
  assert.deepEqual(parsed.errors, []);
  const digest = createEvidenceDigest(context.pr.body);
  setField(context, "Evidence-Digest", digest);
  if (refreshReview) context.pr.reviews[0].body = `Approved release evidence ${digest}`;
}

function assertInvalid(name, mutate, pattern) {
  const context = fixture();
  mutate(context);
  const errors = validateReleaseEvidence(context);
  assert.notEqual(errors.length, 0, `${name}: expected validation failure`);
  assert.match(errors.join("\n"), pattern, `${name}: unexpected errors\n${errors.join("\n")}`);
}

assert.deepEqual(validateReleaseEvidence(fixture()), []);

assertInvalid(
  "hold decision",
  (context) => setField(context, "Release-Decision", "HOLD"),
  /must be GO/
);
assertInvalid("draft", (context) => (context.pr.isDraft = true), /must not be draft/);
assertInvalid("closed", (context) => (context.pr.state = "CLOSED"), /must be open/);
assertInvalid("wrong base", (context) => (context.pr.baseRefName = "develop"), /must target main/);
assertInvalid(
  "dirty checkout",
  (context) => (context.checkout.clean = false),
  /worktree must be clean/
);
assertInvalid("detached checkout", (context) => (context.checkout.branch = "HEAD"), /named branch/);
assertInvalid(
  "base is not in tested head",
  (context) => (context.checkout.baseIsAncestor = false),
  /current GitHub main SHA must be an ancestor/
);
assertInvalid(
  "behind merge state",
  (context) => (context.pr.mergeStateStatus = "BEHIND"),
  /merge state must be CLEAN/
);
assertInvalid(
  "head mismatch",
  (context) => (context.pr.headRefOid = "d".repeat(40)),
  /tested head must match the pull request head SHA/
);
assertInvalid(
  "base evidence mismatch",
  (context) => setField(context, "Release-Base-SHA", "d".repeat(40)),
  /must match GitHub's current main SHA/
);
assertInvalid(
  "short body sha",
  (context) => setField(context, "Release-Head-SHA", HEAD_SHA.slice(0, 8)),
  /full 40-character commit SHA/
);
assertInvalid(
  "duplicate marker",
  (context) => (context.pr.body += `\n${EVIDENCE_START}`),
  /expected exactly one/
);
assertInvalid(
  "missing field",
  (context) => (context.pr.body = context.pr.body.replace(/^Browser-Proof:.*\n/m, "")),
  /missing release evidence field: Browser-Proof/
);
assertInvalid(
  "placeholder evidence",
  (context) => setField(context, "Changed-Behavior-Evidence", "REPLACE_WITH_RESULT"),
  /must contain substantive/
);
assertInvalid(
  "required proof not run",
  (context) => setField(context, "Database-Proof", "NOT-RUN"),
  /Database-Proof must be PASS or NOT-APPLICABLE/
);
assertInvalid(
  "not applicable without rationale",
  (context) => setField(context, "Database-Proof-Evidence", "NONE"),
  /Database-Proof-Evidence must contain substantive/
);
assertInvalid(
  "failed evidence labeled pass",
  (context) => setField(context, "Production-Build-Evidence", "npm run build => FAIL"),
  /contradicts its PASS status/
);
assertInvalid(
  "missing standard local verification",
  (context) => setField(context, "Standard-Local-Verification", "NOT-RUN"),
  /Standard-Local-Verification must be PASS/
);
assertInvalid(
  "missing approval",
  (context) => (context.pr.reviewDecision = "REVIEW_REQUIRED"),
  /independent approving review/
);
assertInvalid(
  "conflict",
  (context) => (context.pr.mergeable = "CONFLICTING"),
  /reported mergeable/
);
assertInvalid(
  "blocking label",
  (context) => (context.pr.labels = [{ name: "do-not-merge" }]),
  /blocking label/
);
assertInvalid(
  "incomplete file list",
  (context) => (context.pr.changedFiles = 2),
  /file list is incomplete/
);
assertInvalid(
  "ui applicability",
  (context) => {
    context.pr.files = [{ path: "client/src/pages/settings.tsx" }];
  },
  /Browser-Proof must be PASS because/
);
assertInvalid(
  "database applicability",
  (context) => {
    context.pr.files = [{ path: "migrations/9999_example.sql" }];
  },
  /Database-Proof must be PASS because/
);
assertInvalid(
  "law applicability",
  (context) => {
    context.pr.files = [{ path: "server/routes/direct-connect.ts" }];
  },
  /Law-Authority-Trust-Security must be PASS because/
);
assertInvalid(
  "unchecked attestation",
  (context) => setField(context, "Exact-Commit-Attestation", "UNCHECKED"),
  /must be CHECKED/
);
assertInvalid(
  "stale evidence digest",
  (context) => setField(context, "Known-Baseline-Failures", "One documented baseline"),
  /Evidence-Digest must equal/
);
assertInvalid(
  "approval not bound to final evidence",
  (context) => {
    setField(context, "Known-Baseline-Failures", "One documented baseline");
    refreshDigest(context, { refreshReview: false });
  },
  /current head must cite the final Evidence-Digest/
);
assertInvalid(
  "assumes PR head is production marker",
  (context) => {
    setField(
      context,
      "Production-Proof-Evidence",
      `Capture the resulting main SHA after merge; X-TradeScout-Build=${HEAD_SHA}; smoke: /api/health.`
    );
    refreshDigest(context);
  },
  /must not assume the PR head/
);
assertInvalid(
  "pass evidence with later failure",
  (context) =>
    setField(context, "Production-Build-Evidence", "npm run build => PASS; packaging failed later"),
  /contradicts its PASS status/
);
assertInvalid(
  "pass evidence with nonzero exit status",
  (context) =>
    setField(context, "Production-Build-Evidence", "npm run build => PASS; exit status: 1"),
  /contradicts its PASS status/
);
assertInvalid(
  "pass evidence with nonzero returned value",
  (context) => setField(context, "Production-Build-Evidence", "npm run build => PASS; returned 1"),
  /contradicts its PASS status/
);
assertInvalid(
  "pass evidence with equivalent non-zero outcome",
  (context) =>
    setField(context, "Production-Build-Evidence", "npm run build => PASS; non-zero result"),
  /contradicts its PASS status/
);
assertInvalid(
  "ui TypeScript applicability",
  (context) => {
    context.pr.files = [{ path: "client/src/lib/profilePresentation.ts" }];
  },
  /Browser-Proof must be PASS because/
);
assertInvalid(
  "public SVG applicability",
  (context) => {
    context.pr.files = [{ path: "client/public/images/profile-hero.svg" }];
  },
  /Browser-Proof must be PASS because/
);
assertInvalid(
  "renamed UI path applicability",
  (context) => {
    context.pr.files = [
      { path: "docs/retired-hero.md", previousPath: "client/public/images/profile-hero.svg" },
    ];
  },
  /Browser-Proof must be PASS because/
);
assertInvalid(
  "generic server database applicability",
  (context) => {
    context.pr.files = [{ path: "server/routes/widgets.ts" }];
  },
  /Database-Proof must be PASS because/
);
assertInvalid(
  "generic server law applicability",
  (context) => {
    context.pr.files = [{ path: "server/routes/widgets.ts" }];
  },
  /Law-Authority-Trust-Security must be PASS because/
);
assertInvalid(
  "collaborator association without push authority",
  (context) => {
    context.pr.reviews[0].authorAssociation = "COLLABORATOR";
    context.pr.reviews[0].authorCanPushToRepository = false;
  },
  /authorized independent APPROVED review/
);
assertInvalid(
  "digest reviewer approved a different head",
  (context) => {
    context.pr.reviews[0].commit.oid = "d".repeat(40);
  },
  /current head must cite/
);
assertInvalid(
  "full-body narrative mutation",
  (context) => {
    context.pr.body = context.pr.body.replace("Initial release evidence.", "Changed after review.");
  },
  /Evidence-Digest must equal/
);
assertInvalid(
  "full-body mutation recomputed without renewed approval",
  (context) => {
    context.pr.body = context.pr.body.replace("Initial release evidence.", "Changed after review.");
    refreshDigest(context, { refreshReview: false });
  },
  /current head must cite the final Evidence-Digest/
);
assertInvalid(
  "postdeploy block must remain pending before merge",
  (context) => setField(context, "Production-Status", "PASS"),
  /must remain PENDING before merge/
);

assert.equal(
  createEvidenceDigest(body({ postdeploy: pendingPostdeployBlock() })),
  createEvidenceDigest(body({ postdeploy: passedPostdeployBlock() })),
  "postdeploy updates must not invalidate the approved premerge digest"
);

const crlf = fixture();
setField(crlf, "Changed-Behavior-Evidence", "npm run test:run => PASS: 57 focused tests");
refreshDigest(crlf);
crlf.pr.body = crlf.pr.body.replace(/\n/g, "\r\n");
assert.deepEqual(validateReleaseEvidence(crlf), []);

const deployed = fixture();
deployed.pr.state = "MERGED";
deployed.pr.mergeCommit = { oid: MERGE_SHA };
deployed.pr.reviewDecision = null;
deployed.pr.body = body({ postdeploy: passedPostdeployBlock() });
assert.deepEqual(
  await validatePostdeployEvidence({ pr: deployed.pr, fetchImpl: healthyFetch() }),
  []
);

const wrongDeployedSha = structuredClone(deployed);
wrongDeployedSha.pr.body = wrongDeployedSha.pr.body.replace(
  `Production-Deployed-SHA: ${MERGE_SHA}`,
  `Production-Deployed-SHA: ${"d".repeat(40)}`
);
assert.match(
  (await validatePostdeployEvidence({ pr: wrongDeployedSha.pr, fetchImpl: healthyFetch() })).join(
    "\n"
  ),
  /must equal GitHub's resulting main commit SHA/
);

const failedSmoke = structuredClone(deployed);
failedSmoke.pr.body = failedSmoke.pr.body.replace(
  "Production-Smoke-Evidence: /api/health and changed route => PASS",
  "Production-Smoke-Evidence: /api/health and changed route => FAIL"
);
assert.match(
  (await validatePostdeployEvidence({ pr: failedSmoke.pr, fetchImpl: healthyFetch() })).join("\n"),
  /negative or unexecuted outcome/
);

const nonzeroExitSmoke = structuredClone(deployed);
nonzeroExitSmoke.pr.body = nonzeroExitSmoke.pr.body.replace(
  "Production-Smoke-Evidence: /api/health and changed route => PASS",
  "Production-Smoke-Evidence: /api/health => PASS; changed route exit status: 1"
);
assert.match(
  (
    await validatePostdeployEvidence({
      pr: nonzeroExitSmoke.pr,
      fetchImpl: healthyFetch(),
    })
  ).join("\n"),
  /negative or unexecuted outcome/
);

const nonzeroReturnSmoke = structuredClone(deployed);
nonzeroReturnSmoke.pr.body = nonzeroReturnSmoke.pr.body.replace(
  "Production-Smoke-Evidence: /api/health and changed route => PASS",
  "Production-Smoke-Evidence: /api/health => PASS; changed route returned 1"
);
assert.match(
  (
    await validatePostdeployEvidence({
      pr: nonzeroReturnSmoke.pr,
      fetchImpl: healthyFetch(),
    })
  ).join("\n"),
  /negative or unexecuted outcome/
);

const skippedSmoke = structuredClone(deployed);
skippedSmoke.pr.body = skippedSmoke.pr.body.replace(
  "Production-Smoke-Evidence: /api/health and changed route => PASS",
  "Production-Smoke-Evidence: /api/health => PASS; changed route => NOT RUN"
);
let skippedFetchCalls = 0;
assert.match(
  (
    await validatePostdeployEvidence({
      pr: skippedSmoke.pr,
      fetchImpl: async () => {
        skippedFetchCalls += 1;
        return healthyFetch()();
      },
    })
  ).join("\n"),
  /negative or unexecuted outcome/
);
assert.equal(skippedFetchCalls, 0, "invalid records must fail before live network I/O");

const missingRelease = structuredClone(deployed);
missingRelease.pr.body = passedPostdeployBlock();
let missingReleaseFetchCalls = 0;
assert.match(
  (
    await validatePostdeployEvidence({
      pr: missingRelease.pr,
      fetchImpl: async () => {
        missingReleaseFetchCalls += 1;
        return healthyFetch()();
      },
    })
  ).join("\n"),
  /expected exactly one.*pr-release-evidence:v1/
);
assert.equal(missingReleaseFetchCalls, 0, "missing premerge evidence must prevent live checks");

assert.match(
  (
    await validatePostdeployEvidence({
      pr: deployed.pr,
      fetchImpl: healthyFetch({ marker: "" }),
    })
  ).join("\n"),
  /live X-TradeScout-Build/
);
assert.match(
  (
    await validatePostdeployEvidence({
      pr: deployed.pr,
      fetchImpl: healthyFetch({ status: 503 }),
    })
  ).join("\n"),
  /HTTP 200/
);
assert.match(
  (
    await validatePostdeployEvidence({
      pr: deployed.pr,
      fetchImpl: async (url) => ({
        url,
        status: 200,
        headers: { get: () => MERGE_SHA },
        json: async () => {
          throw new Error("invalid json");
        },
      }),
    })
  ).join("\n"),
  /valid JSON/
);
assert.match(
  (
    await validatePostdeployEvidence({
      pr: deployed.pr,
      fetchImpl: healthyFetch({ payload: { status: "unhealthy", database: "connected" } }),
    })
  ).join("\n"),
  /status must be healthy/
);
assert.match(
  (
    await validatePostdeployEvidence({
      pr: deployed.pr,
      fetchImpl: healthyFetch({ payload: { status: "healthy", database: "disconnected" } }),
    })
  ).join("\n"),
  /database status must be connected/
);
assert.match(
  (
    await validatePostdeployEvidence({
      pr: deployed.pr,
      fetchImpl: async () => {
        throw new Error("network unavailable");
      },
    })
  ).join("\n"),
  /health request failed: network unavailable/
);

assert.equal(PRODUCTION_HEALTH_URL, "https://www.thetradescout.com/api/health");
console.log("[guard:pr-release-evidence:test] OK (adversarial premerge and postdeploy contracts)");
