import fs from "fs";
import path from "path";
import { runtimePaths } from "../runtimePaths";

const MANUAL_CACHE_DIR = runtimePaths.scoutManualCache;
const COUNTY_DIR = path.join(MANUAL_CACHE_DIR, "county_overrides");
const LOCAL_GUIDES_DIR = path.join(MANUAL_CACHE_DIR, "local_guides");
const BULK_DIR = path.join(MANUAL_CACHE_DIR, "bulk_uploads");
const OVERRIDES_FILE = path.join(MANUAL_CACHE_DIR, "overrides.json");

interface IngestSummary {
  processed: number;
  skipped: number;
  overridesMerged: number;
  countyFiles: number;
  guides: number;
  bulkStored: number;
  errors: { file: string; error: string }[];
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function safeCountyKey(stateCode: string, countyCode: string | number): string {
  const state = String(stateCode || "").toUpperCase().trim();
  const county = String(countyCode || "").replace(/\s+/g, "_").toUpperCase();
  return `${state}_${county || "UNKNOWN"}`;
}

function mergeOverrides(data: any): number {
  const hasOverrides = data && (data.responseOverrides || data.forcedFacts);
  if (!hasOverrides) return 0;

  ensureDir(MANUAL_CACHE_DIR);
  let existing: any = { responseOverrides: {}, forcedFacts: {} };
  if (fs.existsSync(OVERRIDES_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(OVERRIDES_FILE, "utf-8"));
    } catch {
      existing = { responseOverrides: {}, forcedFacts: {} };
    }
  }

  existing.responseOverrides = {
    ...(existing.responseOverrides || {}),
    ...(data.responseOverrides || {}),
  };
  existing.forcedFacts = {
    ...(existing.forcedFacts || {}),
    ...(data.forcedFacts || {}),
  };

  fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(existing, null, 2), "utf-8");
  return 1;
}

function writeJson(targetPath: string, data: any) {
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), "utf-8");
}

function copyFileTo(targetDir: string, filename: string, sourcePath: string) {
  ensureDir(targetDir);
  const dest = path.join(targetDir, filename);
  fs.copyFileSync(sourcePath, dest);
  return dest;
}

function processFile(filePath: string, relPath: string, summary: IngestSummary) {
  try {
    const ext = path.extname(filePath).toLowerCase();

    // Markdown guides
    if (ext === ".md") {
      const filename = path.basename(filePath);
      copyFileTo(LOCAL_GUIDES_DIR, filename, filePath);
      summary.guides += 1;
      summary.processed += 1;
      return;
    }

    // JSON processing paths
    if (ext === ".json") {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);

      // 1) Overrides merge
      const merged = mergeOverrides(data);
      if (merged) {
        summary.overridesMerged += merged;
        summary.processed += 1;
        return;
      }

      // 2) County-specific (stateCode + countyCode)
      const stateCode = data.stateCode || data.state || data.state_code;
      const countyCode = data.countyCode || data.county || data.fips || data.county_code;
      if (stateCode && countyCode) {
        const key = safeCountyKey(stateCode, countyCode);
        const target = path.join(COUNTY_DIR, `${key}.json`);
        writeJson(target, data);
        summary.countyFiles += 1;
        summary.processed += 1;
        return;
      }

      // 3) Local guide JSON (by folder name)
      const lowerRel = relPath.toLowerCase();
      if (lowerRel.includes("guide") || lowerRel.includes("local")) {
        const filename = path.basename(filePath);
        const target = path.join(LOCAL_GUIDES_DIR, filename);
        writeJson(target, data);
        summary.guides += 1;
        summary.processed += 1;
        return;
      }
    }

    // 4) Fallback: bulk storage
    const target = path.join(BULK_DIR, relPath);
    ensureDir(path.dirname(target));
    fs.copyFileSync(filePath, target);
    summary.bulkStored += 1;
    summary.processed += 1;
  } catch (error: any) {
    summary.errors.push({ file: filePath, error: error?.message || String(error) });
  }
}

function walkDir(root: string, summary: IngestSummary, prefix = "") {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    const relPath = prefix ? path.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      walkDir(fullPath, summary, relPath);
    } else if (entry.isFile()) {
      processFile(fullPath, relPath, summary);
    }
  }
}

export function ingestKnowledgeFolder(sourceDir: string): IngestSummary {
  const summary: IngestSummary = {
    processed: 0,
    skipped: 0,
    overridesMerged: 0,
    countyFiles: 0,
    guides: 0,
    bulkStored: 0,
    errors: [],
  };

  if (!sourceDir || !fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  walkDir(sourceDir, summary);
  return summary;
}
