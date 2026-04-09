#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();

const REQUIRED_DOCS = [
  "docs/audits/LAW_REALITY_MATRIX.md",
  "docs/audits/LAW_REWRITE_PROPOSAL.md",
  "docs/audits/DRIFT_GUARDS.md",
  "docs/audits/LAW_EXCEPTIONS_LEDGER.md",
];

const REQUIRED_CLASSIFICATION_TERMS = ["enforced", "policy_target", "temporary_exception"];

const LAW_FILES = [
  "AGENTS.md",
  "docs/TRADESCOUT_PRODUCT_AND_COPY_LAW.md",
  "docs/reference/DOCTRINE.md",
];

const FORBIDDEN_BRAND_PATTERNS = [
  /\bMealScout\b/i,
  /\bTrader(?:'|’)s Corner\b/i,
  /\bTraderCorner\b/i,
];

const SEARCH_ROOTS = [
  "client/src",
  "server/publicBusinessHtml.ts",
  "server/publicCityHtml.ts",
  "server/publicCountyHtml.ts",
  "server/publicDatasetsHtml.ts",
  "server/publicLandingHtml.ts",
  "server/publicProfileHtml.ts",
  "server/publicRecentHtml.ts",
  "server/publicTradeCityHtml.ts",
  "server/publicTradeHtml.ts",
];

const SKIP_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".pdf"]);

async function pathExists(rel) {
  try {
    await fs.access(path.join(REPO_ROOT, rel));
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(relPath) {
  const abs = path.join(REPO_ROOT, relPath);
  const stat = await fs.stat(abs);
  if (stat.isFile()) return [relPath];

  const out = [];
  const stack = [relPath];
  while (stack.length) {
    const currentRel = stack.pop();
    const currentAbs = path.join(REPO_ROOT, currentRel);
    const entries = await fs.readdir(currentAbs, { withFileTypes: true });
    for (const entry of entries) {
      const childRel = path.join(currentRel, entry.name);
      if (entry.isDirectory()) {
        stack.push(childRel);
      } else if (entry.isFile()) {
        if (!SKIP_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          out.push(childRel);
        }
      }
    }
  }
  return out;
}

async function main() {
  const failures = [];

  for (const rel of REQUIRED_DOCS) {
    if (!(await pathExists(rel))) {
      failures.push(`Missing required law audit artifact: ${rel}`);
    }
  }

  const agentsPath = path.join(REPO_ROOT, "AGENTS.md");
  try {
    const agentsText = await fs.readFile(agentsPath, "utf8");
    for (const term of REQUIRED_CLASSIFICATION_TERMS) {
      if (!agentsText.includes(term)) {
        failures.push(`AGENTS.md must include law classification term: ${term}`);
      }
    }
  } catch (error) {
    failures.push(`Unable to read AGENTS.md: ${String(error)}`);
  }

  for (const rel of LAW_FILES) {
    try {
      const text = await fs.readFile(path.join(REPO_ROOT, rel), "utf8");
      if (!/Target contract/i.test(text)) {
        failures.push(`${rel} must include explicit "Target contract" language.`);
      }
    } catch (error) {
      failures.push(`Unable to read law file ${rel}: ${String(error)}`);
    }
  }

  const filesToScan = [];
  for (const root of SEARCH_ROOTS) {
    if (await pathExists(root)) {
      filesToScan.push(...(await collectFiles(root)));
    }
  }

  for (const rel of filesToScan) {
    let content = "";
    try {
      content = await fs.readFile(path.join(REPO_ROOT, rel), "utf8");
    } catch {
      continue;
    }

    for (const pattern of FORBIDDEN_BRAND_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        failures.push(`Forbidden cross-brand reference in ${rel}: "${match[0]}"`);
      }
    }
  }

  if (failures.length) {
    console.error("[guard:law-drift] FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("[guard:law-drift] OK");
}

main().catch((error) => {
  console.error("[guard:law-drift] unexpected error", error);
  process.exit(1);
});

