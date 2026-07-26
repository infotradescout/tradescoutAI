#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAboutOperatingContract } from "./guard-about-operating-contract.mjs";

const STATUS_WEIGHT = {
  PROVEN: 0,
  PARTIAL: 1,
  BLOCKED: 2,
};

function overallStatus(stages) {
  return stages.reduce(
    (current, stage) =>
      (STATUS_WEIGHT[stage.status] ?? Number.POSITIVE_INFINITY) >
      (STATUS_WEIGHT[current] ?? Number.POSITIVE_INFINITY)
        ? stage.status
        : current,
    "PROVEN"
  );
}

function countStatuses(stages) {
  return stages.reduce(
    (counts, stage) => {
      counts[stage.status] = (counts[stage.status] || 0) + 1;
      return counts;
    },
    { PROVEN: 0, PARTIAL: 0, BLOCKED: 0 }
  );
}

export function buildGoldenCaseReport(repoRoot) {
  const { contract } = validateAboutOperatingContract({ repoRoot });
  const journeys = contract.goldenJourneys.map((journey) => {
    const stages = journey.stages.map((stage) => ({
      stageId: stage.stageId,
      name: stage.name,
      status: stage.status,
      actionIds: stage.actionIds,
      evidenceRefs: stage.evidenceRefs,
      productionProofCount: Array.isArray(stage.productionProof) ? stage.productionProof.length : 0,
      statusReason: stage.statusReason,
      gap: stage.gap,
    }));

    return {
      journeyId: journey.journeyId,
      name: journey.name,
      status: overallStatus(stages),
      counts: countStatuses(stages),
      stages,
    };
  });
  const allStages = journeys.flatMap((journey) => journey.stages);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    contractId: contract.contractId,
    status: overallStatus(allStages),
    counts: countStatuses(allStages),
    productionProofCount: allStages.reduce((count, stage) => count + stage.productionProofCount, 0),
    journeys,
  };
}

function renderText(report) {
  const lines = [
    `TradeScout golden cases: ${report.status}`,
    `Stages: PROVEN=${report.counts.PROVEN} PARTIAL=${report.counts.PARTIAL} BLOCKED=${report.counts.BLOCKED}`,
  ];

  for (const journey of report.journeys) {
    lines.push("", `${journey.name}: ${journey.status}`);
    for (const stage of journey.stages) {
      lines.push(`- [${stage.status}] ${stage.name} — ${stage.gap}`);
    }
  }

  return lines.join("\n");
}

function parseArgs(argv) {
  const args = { strict: false, jsonPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--strict") args.strict = true;
    if (value === "--json") {
      args.jsonPath = String(argv[index + 1] || "").trim();
      index += 1;
    }
  }
  return args;
}

function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..");
  const args = parseArgs(process.argv.slice(2));
  const report = buildGoldenCaseReport(repoRoot);

  if (args.jsonPath) {
    const outputPath = path.resolve(repoRoot, args.jsonPath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  console.log(renderText(report));
  if (args.strict && report.status !== "PROVEN") process.exitCode = 2;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
