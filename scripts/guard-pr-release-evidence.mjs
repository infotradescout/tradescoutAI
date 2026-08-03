#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const EVIDENCE_START = "<!-- pr-release-evidence:v1 -->";
export const EVIDENCE_END = "<!-- /pr-release-evidence -->";
export const POSTDEPLOY_START = "<!-- postdeploy-evidence:v1 -->";
export const PRODUCTION_HEALTH_URL = "https://www.thetradescout.com/api/health";
export const POSTDEPLOY_END = "<!-- /postdeploy-evidence -->";

const REQUIRED_FIELDS = [
  "Release-Decision",
  "Release-Head-SHA",
  "Release-Base-SHA",
  "Changed-Behavior-Tests",
  "Changed-Behavior-Evidence",
  "Production-Build",
  "Production-Build-Evidence",
  "Standard-Local-Verification",
  "Standard-Local-Verification-Evidence",
  "Law-Authority-Trust-Security",
  "Law-Authority-Trust-Security-Evidence",
  "Database-Proof",
  "Database-Proof-Evidence",
  "Browser-Proof",
  "Browser-Proof-Evidence",
  "Production-Proof",
  "Production-Proof-Evidence",
  "Known-Baseline-Failures",
  "Not-Run-And-Why",
  "Exact-Commit-Attestation",
  "Merge-Deploys-Production-Attestation",
  "Evidence-Digest",
];

const POSTDEPLOY_FIELDS = [
  "Production-Status",
  "Production-Deployed-SHA",
  "Production-Build-Marker",
  "Production-Smoke-Evidence",
];

const PROOF_FIELDS = [
  {
    statusKey: "Changed-Behavior-Tests",
    evidenceKey: "Changed-Behavior-Evidence",
    allowNotApplicable: false,
  },
  {
    statusKey: "Production-Build",
    evidenceKey: "Production-Build-Evidence",
    allowNotApplicable: false,
    requiredCommand: "npm run build",
  },
  {
    statusKey: "Standard-Local-Verification",
    evidenceKey: "Standard-Local-Verification-Evidence",
    allowNotApplicable: false,
    requiredCommand: "npm run verify:local",
  },
  {
    statusKey: "Law-Authority-Trust-Security",
    evidenceKey: "Law-Authority-Trust-Security-Evidence",
    allowNotApplicable: true,
  },
  {
    statusKey: "Database-Proof",
    evidenceKey: "Database-Proof-Evidence",
    allowNotApplicable: true,
  },
  {
    statusKey: "Browser-Proof",
    evidenceKey: "Browser-Proof-Evidence",
    allowNotApplicable: true,
  },
];

const PLACEHOLDER_PATTERN = /(?:\bREPLACE(?:_[A-Z0-9_]+)?\b|\bTODO\b|\bTBD\b|<[^>]+>)/i;
const PASS_OUTCOME_PATTERN = /(?:=>|result\s*[:=])\s*pass(?:ed)?\b/i;
const FAILURE_OUTCOME_PATTERN =
  /(?:=>|result\s*[:=]|exit(?:\s+code)?\s*[:=]?)\s*(?:fail(?:ed|ure)?|error|[1-9]\d*)\b/i;
const NEGATIVE_RESULT_PATTERN =
  /\b(?:fail(?:ed|ure|ures)?|errors?|not[\s-]*run|skipp?ed|blocked|pending|cancel(?:led|ed)?|timed?[\s-]*out)\b/i;
const NONZERO_RESULT_PATTERN =
  /\b(?:(?:exit(?:ed)?|return(?:ed)?)(?:\s+(?:with(?:\s+(?:code|status))?|code|status))?\s*(?:[:=]\s*)?[1-9]\d*|non[- ]?zero)\b/i;

function countOccurrences(value, needle) {
  return value.split(needle).length - 1;
}

function substantive(value, { allowNone = false } = {}) {
  const normalized = value?.trim() ?? "";
  if (!normalized || PLACEHOLDER_PATTERN.test(normalized)) return false;
  if (normalized.toUpperCase() === "NONE") return allowNone;
  return normalized.length >= 8;
}

function parseEvidenceBlock(body, { startMarker, endMarker, requiredFields, label }) {
  const errors = [];
  const source = typeof body === "string" ? body : "";
  const startCount = countOccurrences(source, startMarker);
  const endCount = countOccurrences(source, endMarker);

  if (startCount !== 1) {
    errors.push(`expected exactly one ${startMarker} marker; found ${startCount}`);
  }
  if (endCount !== 1) {
    errors.push(`expected exactly one ${endMarker} marker; found ${endCount}`);
  }
  if (errors.length > 0) return { errors, fields: new Map() };

  const start = source.indexOf(startMarker) + startMarker.length;
  const end = source.indexOf(endMarker);
  if (end <= start) {
    return { errors: [`${label} end marker must follow the start marker`], fields: new Map() };
  }

  const fields = new Map();
  for (const rawLine of source.slice(start, end).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = /^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/.exec(line);
    if (!match) {
      errors.push(`malformed ${label} line: ${line}`);
      continue;
    }

    const [, key, value] = match;
    if (!requiredFields.includes(key)) {
      errors.push(`unknown ${label} field: ${key}`);
      continue;
    }
    if (fields.has(key)) {
      errors.push(`duplicate ${label} field: ${key}`);
      continue;
    }
    fields.set(key, value.trim());
  }

  for (const key of requiredFields) {
    if (!fields.has(key)) errors.push(`missing ${label} field: ${key}`);
  }

  return { errors, fields };
}

export function parseReleaseEvidence(body) {
  return parseEvidenceBlock(body, {
    startMarker: EVIDENCE_START,
    endMarker: EVIDENCE_END,
    requiredFields: REQUIRED_FIELDS,
    label: "release evidence",
  });
}

export function parsePostdeployEvidence(body) {
  return parseEvidenceBlock(body, {
    startMarker: POSTDEPLOY_START,
    endMarker: POSTDEPLOY_END,
    requiredFields: POSTDEPLOY_FIELDS,
    label: "postdeploy evidence",
  });
}

export function createEvidenceDigest(body) {
  let canonical = String(body ?? "").replace(/\r\n?/g, "\n");

  const postdeployStart = canonical.indexOf(POSTDEPLOY_START);
  const postdeployEnd = canonical.indexOf(POSTDEPLOY_END);
  if (postdeployStart >= 0 && postdeployEnd > postdeployStart) {
    canonical = `${canonical.slice(0, postdeployStart)}${canonical.slice(
      postdeployEnd + POSTDEPLOY_END.length
    )}`;
  }

  const releaseStart = canonical.indexOf(EVIDENCE_START);
  const releaseEnd = canonical.indexOf(EVIDENCE_END);
  if (releaseStart >= 0 && releaseEnd > releaseStart) {
    const before = canonical.slice(0, releaseStart + EVIDENCE_START.length);
    const block = canonical
      .slice(releaseStart + EVIDENCE_START.length, releaseEnd)
      .replace(/^Evidence-Digest:.*$/m, "Evidence-Digest:");
    canonical = `${before}${block}${canonical.slice(releaseEnd)}`;
  }

  canonical = canonical
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function normalizedLabel(label) {
  const name = typeof label === "string" ? label : label?.name;
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isBlockingLabel(label) {
  const words = normalizedLabel(label);
  return (
    words === "hold" ||
    words === "blocked" ||
    words === "wip" ||
    words.includes("do not merge") ||
    words.split(" ").some((word) => word === "hold" || word === "blocked" || word === "wip")
  );
}

function isUiPath(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.toLowerCase().startsWith("client/");
}

function isDatabasePath(filePath) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  return (
    normalized.startsWith("migrations/") ||
    normalized.startsWith("drizzle/") ||
    normalized.startsWith("drizzle.config") ||
    normalized.startsWith("shared/schema") ||
    (/^server\/.*\.(?:[cm]?[jt]s|tsx|jsx)$/.test(normalized) &&
      !normalized.startsWith("server/tests/")) ||
    (/^scripts\/.*(?:migrat|database|persistence|(?:^|[-_.])db(?:[-_.]|$))/.test(normalized) &&
      /\.(?:[cm]?[jt]s|tsx|jsx)$/.test(normalized))
  );
}

function isLawSensitivePath(filePath) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const isApplicationCode =
    /^(?:client\/src|server|shared)\//.test(normalized) &&
    /\.(?:[cm]?[jt]s|tsx|jsx)$/.test(normalized) &&
    !/(?:^|\/)tests?\//.test(normalized) &&
    !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalized);
  return (
    isApplicationCode ||
    /(?:direct[-_]?connect|directconnect|trust|cvs|law|authority|county|contact)/.test(normalized)
  );
}

function containsNegativeResult(evidence) {
  const withoutExplicitZeroes = evidence.replace(/\b(?:0|no)\s+(?:errors?|failures?)\b/gi, "");
  return (
    FAILURE_OUTCOME_PATTERN.test(withoutExplicitZeroes) ||
    NEGATIVE_RESULT_PATTERN.test(withoutExplicitZeroes) ||
    NONZERO_RESULT_PATTERN.test(withoutExplicitZeroes)
  );
}

function validateProof(fields, proof, errors) {
  const status = fields.get(proof.statusKey)?.toUpperCase();
  const evidence = fields.get(proof.evidenceKey) ?? "";
  const allowed = proof.allowNotApplicable ? ["PASS", "NOT-APPLICABLE"] : ["PASS"];

  if (!allowed.includes(status)) {
    errors.push(`${proof.statusKey} must be ${allowed.join(" or ")}`);
  }
  if (!substantive(evidence)) {
    errors.push(
      `${proof.evidenceKey} must contain substantive command/result evidence or rationale`
    );
    return;
  }
  if (status === "PASS") {
    if (!PASS_OUTCOME_PATTERN.test(evidence)) {
      errors.push(`${proof.evidenceKey} must contain an explicit => PASS or result: PASS outcome`);
    }
    if (containsNegativeResult(evidence)) {
      errors.push(`${proof.evidenceKey} contradicts its PASS status with a failure outcome`);
    }
  }
  if (proof.requiredCommand && !evidence.includes(proof.requiredCommand)) {
    errors.push(`${proof.evidenceKey} must name ${proof.requiredCommand}`);
  }
}

function reviewerLogin(review) {
  return String(review?.author?.login ?? "").toLowerCase();
}

export function validateReleaseEvidence({ pr, checkout, phase = "premerge" }) {
  const errors = [];
  const isPremerge = phase === "premerge";
  if (!isPremerge && phase !== "postdeploy") errors.push(`unknown validation phase: ${phase}`);

  if (isPremerge) {
    if (!checkout?.clean) errors.push("worktree must be clean, including untracked files");
    if (!checkout?.branch || checkout.branch === "HEAD")
      errors.push("checkout must be on a named branch");
    if (!checkout?.baseIsAncestor) {
      errors.push(
        "the current GitHub main SHA must be an ancestor of the tested pull request head"
      );
    }
  }
  if (!/^[a-f0-9]{40}$/i.test(checkout?.head ?? "")) {
    errors.push("tested head must be a full 40-character commit SHA");
  }

  if (isPremerge) {
    if (pr?.state !== "OPEN") errors.push("pull request must be open");
    if (pr?.isDraft) errors.push("pull request must not be draft");
    if (!/^[a-f0-9]{40}$/i.test(pr?.baseRefOid ?? "")) {
      errors.push("GitHub must report a full current main SHA");
    }
    if (pr?.headRefName !== checkout?.branch) {
      errors.push("local branch must match the pull request head branch");
    }
    if (pr?.mergeable !== "MERGEABLE") errors.push("pull request must be reported mergeable");
    if (pr?.mergeStateStatus !== "CLEAN") {
      errors.push("pull request merge state must be CLEAN against current main");
    }
  }
  if (pr?.baseRefName !== "main") errors.push("pull request must target main");
  if (pr?.headRefOid !== checkout?.head) {
    errors.push("tested head must match the pull request head SHA");
  }
  if (isPremerge && pr?.reviewDecision !== "APPROVED") {
    errors.push("pull request must have independent approving review");
  }

  const blockingLabels = (pr?.labels ?? []).filter(isBlockingLabel).map(normalizedLabel);
  if (isPremerge && blockingLabels.length > 0) {
    errors.push(`pull request has blocking label(s): ${blockingLabels.join(", ")}`);
  }

  const files = Array.isArray(pr?.files) ? pr.files : [];
  if (!Number.isInteger(pr?.changedFiles) || pr.changedFiles !== files.length) {
    errors.push(
      "GitHub file list is incomplete; every changed path must be available for applicability checks"
    );
  }
  const paths = files.flatMap((file) => {
    if (typeof file === "string") return [file];
    return [file?.path ?? "", file?.previousPath ?? ""].filter(Boolean);
  });

  const parsed = parseReleaseEvidence(pr?.body);
  errors.push(...parsed.errors);
  if (parsed.errors.length > 0) return errors;

  if (isPremerge) {
    const pendingPostdeploy = parsePostdeployEvidence(pr?.body);
    errors.push(...pendingPostdeploy.errors);
    if (pendingPostdeploy.errors.length === 0) {
      for (const key of POSTDEPLOY_FIELDS) {
        if (pendingPostdeploy.fields.get(key)?.toUpperCase() !== "PENDING") {
          errors.push(`${key} must remain PENDING before merge`);
        }
      }
    }
  }

  const fields = parsed.fields;
  const bodyHeadSha = fields.get("Release-Head-SHA") ?? "";
  const bodyBaseSha = fields.get("Release-Base-SHA") ?? "";
  if (!/^[a-f0-9]{40}$/i.test(bodyHeadSha)) {
    errors.push("Release-Head-SHA must be a full 40-character commit SHA");
  }
  if (bodyHeadSha !== checkout?.head || bodyHeadSha !== pr?.headRefOid) {
    errors.push("Release-Head-SHA must match both local and pull request heads");
  }
  if (!/^[a-f0-9]{40}$/i.test(bodyBaseSha)) {
    errors.push("Release-Base-SHA must be a full 40-character commit SHA");
  }
  if (isPremerge && bodyBaseSha !== pr?.baseRefOid) {
    errors.push("Release-Base-SHA must match GitHub's current main SHA");
  }
  if (fields.get("Release-Decision")?.toUpperCase() !== "GO") {
    errors.push("Release-Decision must be GO");
  }

  for (const proof of PROOF_FIELDS) validateProof(fields, proof, errors);

  if (paths.some(isUiPath) && fields.get("Browser-Proof")?.toUpperCase() !== "PASS") {
    errors.push("Browser-Proof must be PASS because the pull request changes user-interface paths");
  }
  if (paths.some(isDatabasePath) && fields.get("Database-Proof")?.toUpperCase() !== "PASS") {
    errors.push(
      "Database-Proof must be PASS because the pull request changes data persistence paths"
    );
  }
  if (
    paths.some(isLawSensitivePath) &&
    fields.get("Law-Authority-Trust-Security")?.toUpperCase() !== "PASS"
  ) {
    errors.push(
      "Law-Authority-Trust-Security must be PASS because the pull request changes a law-sensitive path"
    );
  }

  if (fields.get("Production-Proof")?.toUpperCase() !== "POST-MERGE-REQUIRED") {
    errors.push("Production-Proof must be POST-MERGE-REQUIRED before merge");
  }
  const productionPlan = fields.get("Production-Proof-Evidence") ?? "";
  if (!substantive(productionPlan)) {
    errors.push("Production-Proof-Evidence must contain a substantive post-merge plan");
  } else {
    if (!productionPlan.includes("X-TradeScout-Build")) {
      errors.push("Production-Proof-Evidence must name X-TradeScout-Build");
    }
    if (
      !/(?:resulting|deployed|post[- ]merge).*main sha|main sha.*(?:resulting|deployed|post[- ]merge)/i.test(
        productionPlan
      )
    ) {
      errors.push("Production-Proof-Evidence must plan to capture the resulting main SHA");
    }
    if (!/smoke/i.test(productionPlan)) {
      errors.push("Production-Proof-Evidence must name the production smoke plan");
    }
    if (new RegExp(`X-TradeScout-Build\\s*[:=]\\s*${bodyHeadSha}`, "i").test(productionPlan)) {
      errors.push(
        "Production-Proof-Evidence must not assume the PR head is the post-merge build SHA"
      );
    }
  }

  for (const key of ["Known-Baseline-Failures", "Not-Run-And-Why"]) {
    if (!substantive(fields.get(key), { allowNone: true })) {
      errors.push(`${key} must contain details or the exact value NONE`);
    }
  }

  if (fields.get("Exact-Commit-Attestation")?.toUpperCase() !== "CHECKED") {
    errors.push("Exact-Commit-Attestation must be CHECKED");
  }
  if (fields.get("Merge-Deploys-Production-Attestation")?.toUpperCase() !== "CHECKED") {
    errors.push("Merge-Deploys-Production-Attestation must be CHECKED");
  }

  const expectedDigest = createEvidenceDigest(pr?.body);
  const recordedDigest = fields.get("Evidence-Digest")?.toLowerCase() ?? "";
  if (!/^[a-f0-9]{64}$/.test(recordedDigest) || recordedDigest !== expectedDigest) {
    errors.push(`Evidence-Digest must equal ${expectedDigest}`);
  }
  const prAuthor = String(pr?.author?.login ?? "").toLowerCase();
  const digestTokenPattern = new RegExp(`(?:^|[^a-f0-9])${recordedDigest}(?:$|[^a-f0-9])`, "i");
  const boundApproval = (pr?.reviews ?? []).some((review) => {
    const reviewer = reviewerLogin(review);
    const authorized = review?.authorCanPushToRepository === true;
    return (
      review?.state === "APPROVED" &&
      authorized &&
      reviewer &&
      reviewer !== prAuthor &&
      review?.commit?.oid === pr?.headRefOid &&
      typeof review?.body === "string" &&
      digestTokenPattern.test(review.body)
    );
  });
  if (!boundApproval) {
    errors.push(
      "an authorized independent APPROVED review on the current head must cite the final Evidence-Digest"
    );
  }

  return errors;
}

export async function verifyCanonicalProductionHealth({
  expectedSha,
  fetchImpl = globalThis.fetch,
} = {}) {
  const errors = [];
  if (!/^[a-f0-9]{40}$/i.test(expectedSha ?? "")) {
    return ["live production verification requires a full expected main SHA"];
  }
  if (typeof fetchImpl !== "function") {
    return ["live production verification requires a fetch implementation"];
  }

  let response;
  try {
    response = await fetchImpl(PRODUCTION_HEALTH_URL, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    return [
      `canonical production health request failed: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }

  if (response?.url !== PRODUCTION_HEALTH_URL) {
    errors.push(`canonical production health response must come from ${PRODUCTION_HEALTH_URL}`);
  }
  if (response?.status !== 200) {
    errors.push(
      `canonical production health endpoint must return HTTP 200; got ${response?.status}`
    );
  }

  const liveBuildMarker = String(response?.headers?.get?.("x-tradescout-build") ?? "").trim();
  if (liveBuildMarker !== expectedSha) {
    errors.push("live X-TradeScout-Build must equal GitHub's resulting main commit SHA");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    errors.push("canonical production health endpoint must return valid JSON");
    return errors;
  }
  if (payload?.status !== "healthy") {
    errors.push("canonical production health status must be healthy");
  }
  if (payload?.database !== "connected") {
    errors.push("canonical production database status must be connected");
  }

  return errors;
}

export async function validatePostdeployEvidence({ pr, fetchImpl = globalThis.fetch }) {
  const errors = validateReleaseEvidence({
    pr,
    checkout: { head: pr?.headRefOid },
    phase: "postdeploy",
  });
  if (pr?.state !== "MERGED") errors.push("pull request must be merged for postdeploy validation");

  const mergeSha = pr?.mergeCommit?.oid ?? "";
  if (!/^[a-f0-9]{40}$/i.test(mergeSha)) {
    errors.push("GitHub must report the full resulting main commit SHA");
  }

  const parsed = parsePostdeployEvidence(pr?.body);
  errors.push(...parsed.errors);
  if (parsed.errors.length > 0) return errors;

  const fields = parsed.fields;
  const deployedSha = fields.get("Production-Deployed-SHA") ?? "";
  const buildMarker = fields.get("Production-Build-Marker") ?? "";
  const smokeEvidence = fields.get("Production-Smoke-Evidence") ?? "";

  if (fields.get("Production-Status")?.toUpperCase() !== "PASS") {
    errors.push("Production-Status must be PASS");
  }
  if (!/^[a-f0-9]{40}$/i.test(deployedSha) || deployedSha !== mergeSha) {
    errors.push("Production-Deployed-SHA must equal GitHub's resulting main commit SHA");
  }
  if (!/^[a-f0-9]{40}$/i.test(buildMarker) || buildMarker !== deployedSha) {
    errors.push("Production-Build-Marker must equal the deployed main SHA");
  }
  if (!substantive(smokeEvidence) || !PASS_OUTCOME_PATTERN.test(smokeEvidence)) {
    errors.push("Production-Smoke-Evidence must contain a substantive explicit PASS result");
  }
  if (containsNegativeResult(smokeEvidence)) {
    errors.push("Production-Smoke-Evidence contains a negative or unexecuted outcome");
  }

  if (errors.length > 0) return errors;
  errors.push(...(await verifyCanonicalProductionHealth({ expectedSha: mergeSha, fetchImpl })));
  return errors;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
    throw new Error(`${command} ${args.join(" ")} failed: ${detail}`);
  }
  return result.stdout.trim();
}

function gitBaseIsAncestor(baseSha, headSha) {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", baseSha, headSha], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
  throw new Error(`git merge-base --is-ancestor failed: ${detail}`);
}

function readArguments(argv) {
  let prNumber = "";
  let mode = "premerge";
  let printDigest = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--pr" && /^[1-9]\d*$/.test(argv[index + 1] ?? "")) {
      prNumber = argv[index + 1];
      index += 1;
    } else if (argument === "--postdeploy") {
      mode = "postdeploy";
    } else if (argument === "--print-digest") {
      printDigest = true;
    } else {
      throw new Error(
        "usage: npm run guard:pr-release-evidence -- --pr <number> [--print-digest|--postdeploy]"
      );
    }
  }

  if (!prNumber || (printDigest && mode === "postdeploy")) {
    throw new Error(
      "usage: npm run guard:pr-release-evidence -- --pr <number> [--print-digest|--postdeploy]"
    );
  }
  return { mode, prNumber, printDigest };
}

function fetchRestCollection(endpoint) {
  const pages = JSON.parse(run("gh", ["api", "--paginate", "--slurp", endpoint]));
  if (!Array.isArray(pages) || pages.some((page) => !Array.isArray(page))) {
    throw new Error(`GitHub returned an invalid paginated response for ${endpoint}`);
  }
  return pages.flat();
}

function fetchPullRequestReviews(pullRequestId) {
  const query = [
    "query($id: ID!, $endCursor: String) {",
    "  node(id: $id) {",
    "    ... on PullRequest {",
    "      reviews(first: 100, after: $endCursor) {",
    "        nodes {",
    "          author { login }",
    "          authorCanPushToRepository",
    "          body",
    "          commit { oid }",
    "          state",
    "        }",
    "        pageInfo { hasNextPage endCursor }",
    "      }",
    "    }",
    "  }",
    "}",
  ].join("\n");
  const pages = JSON.parse(
    run("gh", [
      "api",
      "graphql",
      "--paginate",
      "--slurp",
      "-f",
      `query=${query}`,
      "-f",
      `id=${pullRequestId}`,
    ])
  );
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error("GitHub returned no paginated pull request review data");
  }

  const reviews = [];
  for (const page of pages) {
    const connection = page?.data?.node?.reviews;
    if (!connection || !Array.isArray(connection.nodes)) {
      throw new Error("GitHub returned incomplete pull request review authority data");
    }
    reviews.push(...connection.nodes);
  }
  if (pages.at(-1)?.data?.node?.reviews?.pageInfo?.hasNextPage !== false) {
    throw new Error("GitHub pull request review pagination did not reach the final page");
  }
  return reviews;
}

function fetchPullRequest(prNumber) {
  const pr = JSON.parse(
    run("gh", [
      "pr",
      "view",
      prNumber,
      "--json",
      "author,baseRefName,baseRefOid,body,changedFiles,headRefName,headRefOid,id,isDraft,labels,mergeCommit,mergeStateStatus,mergeable,reviewDecision,state,url",
    ])
  );
  const files = fetchRestCollection(`repos/{owner}/{repo}/pulls/${prNumber}/files?per_page=100`);
  const reviews = fetchPullRequestReviews(pr.id);
  pr.files = files.map((file) => ({
    path: file?.filename ?? "",
    previousPath: file?.previous_filename ?? "",
    status: file?.status ?? "",
  }));
  pr.reviews = reviews.map((review) => ({
    author: { login: review?.author?.login ?? "" },
    authorCanPushToRepository: review?.authorCanPushToRepository === true,
    body: review?.body ?? "",
    commit: { oid: review?.commit?.oid ?? "" },
    state: String(review?.state ?? "").toUpperCase(),
  }));
  return pr;
}

async function main() {
  try {
    const { mode, prNumber, printDigest } = readArguments(process.argv.slice(2));
    const pr = fetchPullRequest(prNumber);

    if (printDigest) {
      const parsed = parseReleaseEvidence(pr.body);
      if (parsed.errors.length > 0) throw new Error(parsed.errors.join("; "));
      const pendingPostdeploy = parsePostdeployEvidence(pr.body);
      if (pendingPostdeploy.errors.length > 0) {
        throw new Error(pendingPostdeploy.errors.join("; "));
      }
      console.log(createEvidenceDigest(pr.body));
      return;
    }

    if (mode === "postdeploy") {
      const errors = await validatePostdeployEvidence({ pr });
      if (errors.length > 0) {
        console.error("[guard:pr-release-evidence:postdeploy] FAIL");
        for (const error of errors) console.error(`- ${error}`);
        process.exitCode = 1;
        return;
      }
      console.log(`[guard:pr-release-evidence:postdeploy] OK ${pr.url}`);
      return;
    }

    const checkout = {
      branch: run("git", ["symbolic-ref", "--quiet", "--short", "HEAD"]),
      head: run("git", ["rev-parse", "HEAD"]),
      clean: run("git", ["status", "--porcelain=v1", "--untracked-files=all"]) === "",
      baseIsAncestor: gitBaseIsAncestor(pr.baseRefOid, pr.headRefOid),
    };
    const errors = validateReleaseEvidence({ pr, checkout });
    if (errors.length > 0) {
      console.error("[guard:pr-release-evidence] FAIL");
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
      return;
    }
    console.log(`[guard:pr-release-evidence] OK ${pr.url} @ ${checkout.head}`);
  } catch (error) {
    console.error("[guard:pr-release-evidence] FAIL");
    console.error(`- ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) await main();
