#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const ABOUT_OPERATING_CONTRACT_PATH = "config/tradescout-about-operating-contract.json";
export const ABOUT_COPY_PATH = "client/src/pages/about-explainer-content.tsx";
export const ALLOWED_STATUSES = new Set(["PROVEN", "PARTIAL", "PLANNED", "BLOCKED"]);

const EXPECTED_CHAPTER_IDS = ["01", "02", "03", "04", "05", "06", "07", "08", "09"];

const EXPECTED_ACTION_COUNTS = {
  "01": 18,
  "02": 18,
  "03": 9,
  "04": 24,
};

function cleanJsxText(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function addError(errors, condition, message) {
  if (!condition) errors.push(message);
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function expectedActionIds() {
  return Object.entries(EXPECTED_ACTION_COUNTS).flatMap(([groupId, count]) =>
    Array.from({ length: count }, (_, index) => `${groupId}.${String(index + 1).padStart(2, "0")}`)
  );
}

function parseChapters(source) {
  const chapters = [];
  const chapterPattern =
    /<span className="stack-number">(\d{2})<\/span>[\s\S]*?<span className="stack-label">\s*<strong>([\s\S]*?)<\/strong>\s*<small>([\s\S]*?)<\/small>/g;

  for (const match of source.matchAll(chapterPattern)) {
    chapters.push({
      displayId: match[1],
      name: cleanJsxText(match[2]),
      summary: cleanJsxText(match[3]),
    });
  }

  return chapters;
}

function parseFeatureActions(source) {
  const start = source.indexOf("const featureGroups = [");
  const end = source.indexOf("\n];", start);
  if (start < 0 || end < 0) {
    throw new Error("Unable to locate the canonical featureGroups declaration.");
  }

  const actions = [];
  const groupCounts = {};
  const lines = source.slice(start, end).split(/\r?\n/);
  let currentGroupId = null;
  let currentGroupTitle = null;
  let pendingAction = null;

  for (const line of lines) {
    const groupIdMatch = line.match(/^\s{4}number:\s*"(\d{2})",\s*$/);
    if (groupIdMatch) {
      currentGroupId = groupIdMatch[1];
      currentGroupTitle = null;
      groupCounts[currentGroupId] = 0;
      continue;
    }

    const groupTitleMatch = line.match(/^\s{4}title:\s*"([^"]+)",\s*$/);
    if (groupTitleMatch && currentGroupId) {
      currentGroupTitle = groupTitleMatch[1];
      continue;
    }

    const actionMatch = line.match(/^\s{8}action:\s*"([^"]+)",\s*$/);
    if (actionMatch) {
      if (!currentGroupId || !currentGroupTitle) {
        throw new Error(`Feature action appears outside a parsed group: ${actionMatch[1]}`);
      }
      if (pendingAction) {
        throw new Error(`Feature action is missing its name: ${pendingAction}`);
      }
      pendingAction = actionMatch[1];
      continue;
    }

    const nameMatch = line.match(/^\s{8}name:\s*"([^"]+)",\s*$/);
    if (nameMatch && pendingAction) {
      groupCounts[currentGroupId] += 1;
      actions.push({
        displayId: `${currentGroupId}.${String(groupCounts[currentGroupId]).padStart(2, "0")}`,
        groupId: currentGroupId,
        groupTitle: currentGroupTitle,
        action: pendingAction,
        featureName: nameMatch[1],
      });
      pendingAction = null;
    }
  }

  if (pendingAction) {
    throw new Error(`Feature action is missing its name: ${pendingAction}`);
  }

  return { actions, groupCounts };
}

export function deriveAboutOperatingContract(source) {
  const chapters = parseChapters(source);
  const { actions, groupCounts } = parseFeatureActions(source);
  return { chapters, actions, groupCounts };
}

function commitTimestamp(repoRoot, commit) {
  try {
    const verifiedCommit = execFileSync(
      "git",
      ["show", "-s", "--format=%cI", `${commit}^{commit}`],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    ).trim();
    const timestamp = Date.parse(verifiedCommit);
    return Number.isNaN(timestamp) ? null : timestamp;
  } catch {
    return null;
  }
}

function isValidProductionProof(proof, repoRoot, subject) {
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) return false;
  if (proof.environment !== "production") return false;
  if (
    typeof proof.verifiedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      proof.verifiedAt
    ) ||
    Number.isNaN(Date.parse(proof.verifiedAt))
  ) {
    return false;
  }
  const verifiedAt = Date.parse(proof.verifiedAt);
  if (verifiedAt > Date.now() + 5 * 60 * 1000) return false;
  if (typeof proof.commit !== "string" || !/^[0-9a-f]{40}$/i.test(proof.commit)) {
    return false;
  }
  const committedAt = commitTimestamp(repoRoot, proof.commit);
  if (committedAt == null || verifiedAt < committedAt) return false;
  if (typeof proof.artifact !== "string" || proof.artifact.trim().length === 0) {
    return false;
  }
  const artifact = proof.artifact.trim();
  if (path.isAbsolute(artifact) || artifact.split(/[\\/]/).includes("..")) return false;
  if (path.extname(artifact).toLowerCase() !== ".json") return false;

  try {
    const payload = JSON.parse(fs.readFileSync(path.resolve(repoRoot, artifact), "utf8"));
    return Boolean(
      payload?.schemaVersion === 1 &&
        payload?.kind === "tradescout-production-verification" &&
        payload?.environment === "production" &&
        payload?.verifiedAt === proof.verifiedAt &&
        payload?.commit === proof.commit &&
        payload?.subject === subject &&
        payload?.status === "PROVEN" &&
        Array.isArray(payload?.checks) &&
        payload.checks.length > 0 &&
        payload.checks.every(
          (check) =>
            check &&
            typeof check.name === "string" &&
            check.name.trim().length > 0 &&
            check.status === "PASS"
        )
    );
  } catch {
    return false;
  }
}

function validateEvidenceCatalog(contract, repoRoot, errors) {
  const catalog = contract?.evidenceCatalog;
  addError(
    errors,
    catalog && typeof catalog === "object" && !Array.isArray(catalog),
    "evidenceCatalog must be an object."
  );
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) return;

  for (const [evidenceId, evidence] of Object.entries(catalog)) {
    addError(errors, evidenceId.trim().length > 0, "Evidence IDs must be non-empty.");
    addError(
      errors,
      evidence && typeof evidence === "object" && !Array.isArray(evidence),
      `Evidence ${evidenceId} must be an object.`
    );
    if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) continue;

    addError(
      errors,
      typeof evidence.kind === "string" && evidence.kind.trim().length > 0,
      `Evidence ${evidenceId} must declare kind.`
    );
    addError(
      errors,
      typeof evidence.path === "string" && evidence.path.trim().length > 0,
      `Evidence ${evidenceId} must declare path.`
    );
    if (typeof evidence.path === "string" && evidence.path.trim()) {
      addError(
        errors,
        fs.existsSync(path.resolve(repoRoot, evidence.path)),
        `Evidence ${evidenceId} references a missing path: ${evidence.path}`
      );
    }
  }
}

function validateChapterRegistry(contract, derived, errors) {
  const chapters = Array.isArray(contract?.chapters) ? contract.chapters : [];
  addError(
    errors,
    chapters.length === 9,
    `Registry must contain exactly 9 chapters; found ${chapters.length}.`
  );
  addError(
    errors,
    derived.chapters.length === 9,
    `Canonical About JSX must contain exactly 9 chapters; found ${derived.chapters.length}.`
  );

  const registryIds = chapters.map((chapter) => chapter?.displayId);
  const sourceIds = derived.chapters.map((chapter) => chapter.displayId);
  addError(
    errors,
    duplicateValues(registryIds).length === 0,
    `Registry chapter IDs must be unique; duplicates: ${duplicateValues(registryIds).join(", ")}`
  );
  addError(
    errors,
    duplicateValues(sourceIds).length === 0,
    `Canonical About chapter IDs must be unique; duplicates: ${duplicateValues(sourceIds).join(", ")}`
  );
  addError(
    errors,
    JSON.stringify(registryIds) === JSON.stringify(EXPECTED_CHAPTER_IDS),
    `Registry chapter IDs must remain ${EXPECTED_CHAPTER_IDS.join(", ")}.`
  );
  addError(
    errors,
    JSON.stringify(sourceIds) === JSON.stringify(EXPECTED_CHAPTER_IDS),
    `Canonical About chapter IDs must remain ${EXPECTED_CHAPTER_IDS.join(", ")}.`
  );

  const sourceById = new Map(derived.chapters.map((chapter) => [chapter.displayId, chapter]));
  for (const chapter of chapters) {
    const sourceChapter = sourceById.get(chapter?.displayId);
    if (!sourceChapter) continue;
    addError(
      errors,
      chapter.name === sourceChapter.name,
      `Chapter ${chapter.displayId} name drift: registry="${chapter.name}" source="${sourceChapter.name}".`
    );
    addError(
      errors,
      chapter.summary === sourceChapter.summary,
      `Chapter ${chapter.displayId} summary drift: registry="${chapter.summary}" source="${sourceChapter.summary}".`
    );
  }
}

function validateActionRegistry(contract, derived, repoRoot, errors) {
  const actions = Array.isArray(contract?.actions) ? contract.actions : [];
  const expectedIds = expectedActionIds();

  addError(
    errors,
    actions.length === 69,
    `Registry must contain exactly 69 actions; found ${actions.length}.`
  );
  addError(
    errors,
    derived.actions.length === 69,
    `Canonical About JSX must contain exactly 69 actions; found ${derived.actions.length}.`
  );

  for (const [groupId, expectedCount] of Object.entries(EXPECTED_ACTION_COUNTS)) {
    addError(
      errors,
      derived.groupCounts[groupId] === expectedCount,
      `Canonical About group ${groupId} must contain ${expectedCount} actions; found ${derived.groupCounts[groupId] ?? 0}.`
    );
  }

  const registryIds = actions.map((action) => action?.displayId);
  const sourceIds = derived.actions.map((action) => action.displayId);
  const registryDuplicates = duplicateValues(registryIds);
  const sourceDuplicates = duplicateValues(sourceIds);

  addError(
    errors,
    registryDuplicates.length === 0,
    `Registry action IDs must be unique; duplicates: ${registryDuplicates.join(", ")}`
  );
  addError(
    errors,
    sourceDuplicates.length === 0,
    `Canonical About action IDs must be unique; duplicates: ${sourceDuplicates.join(", ")}`
  );
  addError(
    errors,
    JSON.stringify(registryIds) === JSON.stringify(expectedIds),
    "Registry action IDs or order drifted from immutable display IDs 01.01–04.24."
  );
  addError(
    errors,
    JSON.stringify(sourceIds) === JSON.stringify(expectedIds),
    "Canonical About action IDs or order drifted from immutable display IDs 01.01–04.24."
  );

  const sourceById = new Map(derived.actions.map((action) => [action.displayId, action]));
  const owners = contract?.owners && typeof contract.owners === "object" ? contract.owners : {};
  const evidenceCatalog =
    contract?.evidenceCatalog && typeof contract.evidenceCatalog === "object"
      ? contract.evidenceCatalog
      : {};

  for (const action of actions) {
    const id = action?.displayId || "<missing>";
    const sourceAction = sourceById.get(action?.displayId);
    if (sourceAction) {
      addError(
        errors,
        action.action === sourceAction.action,
        `Action ${id} copy drift: registry="${action.action}" source="${sourceAction.action}".`
      );
      addError(
        errors,
        action.featureName === sourceAction.featureName,
        `Action ${id} feature-name drift: registry="${action.featureName}" source="${sourceAction.featureName}".`
      );
    }

    addError(
      errors,
      ALLOWED_STATUSES.has(action?.status),
      `Action ${id} has invalid status: ${action?.status}`
    );
    addError(
      errors,
      typeof action?.ownerId === "string" && Boolean(owners[action.ownerId]),
      `Action ${id} references an unknown owner: ${action?.ownerId}`
    );
    addError(
      errors,
      Array.isArray(action?.evidenceRefs) && action.evidenceRefs.length > 0,
      `Action ${id} must reference at least one evidence item.`
    );
    for (const evidenceRef of Array.isArray(action?.evidenceRefs) ? action.evidenceRefs : []) {
      addError(
        errors,
        Boolean(evidenceCatalog[evidenceRef]),
        `Action ${id} references unknown evidence: ${evidenceRef}`
      );
    }

    addError(
      errors,
      Array.isArray(action?.productionProof),
      `Action ${id} productionProof must be an array.`
    );
    const productionProof = Array.isArray(action?.productionProof) ? action.productionProof : [];
    for (const proof of productionProof) {
      addError(
        errors,
        isValidProductionProof(proof, repoRoot, `action:${id}`),
        `Action ${id} contains invalid production proof; production proof requires production environment, an ISO instant, a full commit SHA, and an existing repository artifact.`
      );
    }
    if (action?.status === "PROVEN") {
      addError(
        errors,
        productionProof.some((proof) =>
          isValidProductionProof(proof, repoRoot, `action:${id}`)
        ),
        `Action ${id} cannot be PROVEN without timestamped production proof.`
      );
    }

    addError(
      errors,
      typeof action?.statusReason === "string" && action.statusReason.trim().length > 0,
      `Action ${id} must include statusReason.`
    );
    addError(
      errors,
      typeof action?.gap === "string" && action.gap.trim().length > 0,
      `Action ${id} must include an explicit gap or next closure.`
    );
  }
}

function validateGoldenJourneys(contract, repoRoot, errors) {
  const journeys = Array.isArray(contract?.goldenJourneys) ? contract.goldenJourneys : [];
  const expectedJourneyIds = ["jw-stone-catalog-inquiry", "service-business-lifecycle"];
  const actionIds = new Set(
    Array.isArray(contract?.actions) ? contract.actions.map((action) => action.displayId) : []
  );
  const evidenceCatalog =
    contract?.evidenceCatalog && typeof contract.evidenceCatalog === "object"
      ? contract.evidenceCatalog
      : {};

  addError(
    errors,
    journeys.length === 2,
    `Registry must define exactly two golden journeys; found ${journeys.length}.`
  );
  addError(
    errors,
    JSON.stringify(journeys.map((journey) => journey?.journeyId)) ===
      JSON.stringify(expectedJourneyIds),
    `Golden journeys must remain ${expectedJourneyIds.join(", ")}.`
  );

  for (const journey of journeys) {
    const journeyId = journey?.journeyId || "<missing>";
    addError(
      errors,
      typeof journey?.purpose === "string" && journey.purpose.trim().length > 0,
      `Golden journey ${journeyId} must include purpose.`
    );

    const stages = Array.isArray(journey?.stages) ? journey.stages : [];
    addError(errors, stages.length > 0, `Golden journey ${journeyId} must include stages.`);
    const duplicateStageIds = duplicateValues(stages.map((stage) => stage?.stageId));
    addError(
      errors,
      duplicateStageIds.length === 0,
      `Golden journey ${journeyId} has duplicate stage IDs: ${duplicateStageIds.join(", ")}`
    );

    for (const stage of stages) {
      const stageId = `${journeyId}/${stage?.stageId || "<missing>"}`;
      addError(
        errors,
        stage?.status === "PROVEN" || stage?.status === "PARTIAL" || stage?.status === "BLOCKED",
        `Golden stage ${stageId} must be classified as PROVEN, PARTIAL, or BLOCKED.`
      );
      addError(
        errors,
        Array.isArray(stage?.actionIds) && stage.actionIds.length > 0,
        `Golden stage ${stageId} must reference at least one About action.`
      );
      for (const actionId of Array.isArray(stage?.actionIds) ? stage.actionIds : []) {
        addError(
          errors,
          actionIds.has(actionId),
          `Golden stage ${stageId} references unknown About action ${actionId}.`
        );
      }
      addError(
        errors,
        Array.isArray(stage?.evidenceRefs) && stage.evidenceRefs.length > 0,
        `Golden stage ${stageId} must reference evidence.`
      );
      for (const evidenceRef of Array.isArray(stage?.evidenceRefs) ? stage.evidenceRefs : []) {
        addError(
          errors,
          Boolean(evidenceCatalog[evidenceRef]),
          `Golden stage ${stageId} references unknown evidence ${evidenceRef}.`
        );
      }
      addError(
        errors,
        Array.isArray(stage?.productionProof),
        `Golden stage ${stageId} productionProof must be an array.`
      );
      const productionProof = Array.isArray(stage?.productionProof) ? stage.productionProof : [];
      for (const proof of productionProof) {
        addError(
          errors,
          isValidProductionProof(proof, repoRoot, `golden-stage:${stageId}`),
          `Golden stage ${stageId} contains invalid production proof; production proof requires production environment, an ISO instant, a full commit SHA, and an existing repository artifact.`
        );
      }
      if (stage?.status === "PROVEN") {
        addError(
          errors,
          productionProof.some((proof) =>
            isValidProductionProof(proof, repoRoot, `golden-stage:${stageId}`)
          ),
          `Golden stage ${stageId} cannot be PROVEN without timestamped production proof.`
        );
      }
      addError(
        errors,
        typeof stage?.statusReason === "string" && stage.statusReason.trim().length > 0,
        `Golden stage ${stageId} must include statusReason.`
      );
      addError(
        errors,
        typeof stage?.gap === "string" && stage.gap.trim().length > 0,
        `Golden stage ${stageId} must include gap.`
      );
    }
  }
}

export function validateAboutOperatingContractData({ contract, source, repoRoot }) {
  const errors = [];
  const derived = deriveAboutOperatingContract(source);

  addError(errors, contract?.schemaVersion === 1, "schemaVersion must be 1.");
  addError(
    errors,
    contract?.canonicalCopy?.path === ABOUT_COPY_PATH,
    `canonicalCopy.path must remain ${ABOUT_COPY_PATH}.`
  );

  const configuredStatuses = Array.isArray(contract?.allowedStatuses)
    ? [...contract.allowedStatuses].sort()
    : [];
  const expectedStatuses = [...ALLOWED_STATUSES].sort();
  addError(
    errors,
    JSON.stringify(configuredStatuses) === JSON.stringify(expectedStatuses),
    `allowedStatuses must contain only ${expectedStatuses.join(", ")}.`
  );

  validateEvidenceCatalog(contract, repoRoot, errors);
  validateChapterRegistry(contract, derived, errors);
  validateActionRegistry(contract, derived, repoRoot, errors);
  validateGoldenJourneys(contract, repoRoot, errors);

  if (errors.length > 0) {
    throw new Error(
      `[guard:about-operating-contract] FAIL\n${errors.map((error) => `- ${error}`).join("\n")}`
    );
  }

  const statusCounts = {};
  for (const action of contract.actions) {
    statusCounts[action.status] = (statusCounts[action.status] || 0) + 1;
  }
  const goldenStageCount = contract.goldenJourneys.reduce(
    (total, journey) => total + journey.stages.length,
    0
  );

  return {
    contract,
    chapters: derived.chapters,
    actions: derived.actions,
    journeys: contract.goldenJourneys,
    statusCounts,
    goldenStageCount,
  };
}

export function loadAboutOperatingContract(repoRoot = process.cwd()) {
  const contractPath = path.resolve(repoRoot, ABOUT_OPERATING_CONTRACT_PATH);
  const sourcePath = path.resolve(repoRoot, ABOUT_COPY_PATH);
  return {
    contract: JSON.parse(fs.readFileSync(contractPath, "utf8")),
    source: fs.readFileSync(sourcePath, "utf8"),
  };
}

export function validateAboutOperatingContract({ repoRoot = process.cwd() } = {}) {
  const { contract, source } = loadAboutOperatingContract(repoRoot);
  return validateAboutOperatingContractData({ contract, source, repoRoot });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  try {
    const result = validateAboutOperatingContract();
    const statusSummary = Object.entries(result.statusCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([status, count]) => `${status}=${count}`)
      .join(" ");
    console.log(
      `[guard:about-operating-contract] OK chapters=${result.chapters.length} actions=${result.actions.length} journeys=${result.journeys.length} goldenStages=${result.goldenStageCount} ${statusSummary}`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
