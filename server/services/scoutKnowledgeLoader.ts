import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";

export type ScoutKnowledgeStatus = "ready" | "not_yet_indexed";

export interface ScoutKnowledgeEntry {
  filePath: string;
  title: string;
  excerpt: string;
  score: number;
}

export interface ScoutKnowledgeLoadInput {
  query: string;
  countyFips?: string;
  stateCode?: string;
  trade?: string;
  limit?: number;
}

export interface ScoutKnowledgeLoadResult {
  status: ScoutKnowledgeStatus;
  root: string;
  fileCount: number;
  matchedCount: number;
  entries: ScoutKnowledgeEntry[];
  note: string;
}

const FILE_EXTENSIONS = new Set([".docx", ".md", ".txt"]);
const knowledgeTextCache = new Map<string, { mtimeMs: number; text: string }>();

function resolveRepoRoot(): string {
  let current = process.cwd();
  for (let i = 0; i < 10; i += 1) {
    const packageJson = path.join(current, "package.json");
    if (fs.existsSync(packageJson)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return path.resolve(process.cwd());
}

const REPO_ROOT = resolveRepoRoot();
export const SCOUT_KNOWLEDGE_ROOT = path.join(
  REPO_ROOT,
  "data",
  "TradeScout Brain",
  "40_KNOWLEDGE"
);

function existsSafe(target: string): boolean {
  try {
    return fs.existsSync(target);
  } catch {
    return false;
  }
}

function walkKnowledgeFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSafe(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkKnowledgeFiles(fullPath));
      continue;
    }
    if (FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function readKnowledgeFile(filePath: string): Promise<string | null> {
  try {
    const stats = fs.statSync(filePath);
    const cached = knowledgeTextCache.get(filePath);
    if (cached && cached.mtimeMs === stats.mtimeMs) {
      return cached.text;
    }

    const ext = path.extname(filePath).toLowerCase();
    let text = "";
    if (ext === ".docx") {
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value || "";
    } else {
      text = fs.readFileSync(filePath, "utf8");
    }

    const clean = text.trim();
    if (!clean) {
      return null;
    }

    knowledgeTextCache.set(filePath, { mtimeMs: stats.mtimeMs, text: clean });
    return clean;
  } catch {
    return null;
  }
}

function normalizeTerms(input: ScoutKnowledgeLoadInput): string[] {
  const raw = [input.query, input.trade, input.countyFips, input.stateCode]
    .filter((value) => typeof value === "string")
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  return raw
    .split(/[^a-z0-9]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);
}

function scorePath(filePath: string, terms: string[]): number {
  const lower = filePath.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term) ? 2 : 0), 0);
}

function scoreText(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
}

function buildExcerpt(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  const term = terms.find((value) => lower.includes(value));
  if (!term) {
    return text.slice(0, 500);
  }

  const index = lower.indexOf(term);
  const start = Math.max(0, index - 180);
  const end = Math.min(text.length, index + 620);
  return text.slice(start, end);
}

export async function loadScoutKnowledgeBase(
  input: ScoutKnowledgeLoadInput
): Promise<ScoutKnowledgeLoadResult> {
  const root = SCOUT_KNOWLEDGE_ROOT;
  const terms = normalizeTerms(input);
  const limit = Math.max(1, Math.min(Number(input.limit || 5), 8));

  if (!existsSafe(root)) {
    return {
      status: "not_yet_indexed",
      root,
      fileCount: 0,
      matchedCount: 0,
      entries: [],
      note: "Scout Knowledge Base is not yet indexed at data/TradeScout Brain/40_KNOWLEDGE.",
    };
  }

  const files = walkKnowledgeFiles(root);
  if (!files.length) {
    return {
      status: "not_yet_indexed",
      root,
      fileCount: 0,
      matchedCount: 0,
      entries: [],
      note: "TradeScout Brain is present, but the 40_KNOWLEDGE corpus is not yet indexed.",
    };
  }

  if (!terms.length) {
    return {
      status: "not_yet_indexed",
      root,
      fileCount: files.length,
      matchedCount: 0,
      entries: [],
      note: "Scout Knowledge Base is available, but this mission did not include enough search terms to index it safely.",
    };
  }

  const ranked = files
    .map((filePath) => ({
      filePath,
      pathScore: scorePath(filePath, terms),
    }))
    .filter((entry) => entry.pathScore > 0)
    .sort((a, b) => b.pathScore - a.pathScore)
    .slice(0, 24);

  const entries: ScoutKnowledgeEntry[] = [];

  for (const candidate of ranked) {
    const text = await readKnowledgeFile(candidate.filePath);
    if (!text) {
      continue;
    }

    const score = candidate.pathScore + scoreText(text, terms);
    if (score <= 0) {
      continue;
    }

    entries.push({
      filePath: path.relative(root, candidate.filePath),
      title: path.basename(candidate.filePath, path.extname(candidate.filePath)),
      excerpt: buildExcerpt(text, terms),
      score,
    });
  }

  entries.sort((a, b) => b.score - a.score);

  if (!entries.length) {
    return {
      status: "not_yet_indexed",
      root,
      fileCount: files.length,
      matchedCount: 0,
      entries: [],
      note: "Scout Knowledge Base exists, but this mission is not yet indexed in the TradeScout Brain corpus.",
    };
  }

  return {
    status: "ready",
    root,
    fileCount: files.length,
    matchedCount: entries.length,
    entries: entries.slice(0, limit),
    note: `Found ${Math.min(entries.length, limit)} indexed TradeScout Brain match${entries.length === 1 ? "" : "es"}.`,
  };
}

function getKnowledgeFilesByPattern(pattern: RegExp): string[] {
  if (!existsSafe(SCOUT_KNOWLEDGE_ROOT)) {
    return [];
  }

  return walkKnowledgeFiles(SCOUT_KNOWLEDGE_ROOT)
    .filter((filePath) => pattern.test(filePath))
    .map((filePath) => path.relative(SCOUT_KNOWLEDGE_ROOT, filePath));
}

export function getBuildingCodeFiles(): string[] {
  return getKnowledgeFilesByPattern(/\b(code|codes|permit|inspection|jurisdiction|building)\b/i);
}

export function getTradeGuideFiles(): string[] {
  return getKnowledgeFilesByPattern(
    /\b(trade|guide|electrical|plumbing|hvac|roof|framing|deck)\b/i
  );
}

export function getPricingFiles(): string[] {
  return getKnowledgeFilesByPattern(/\b(price|pricing|cost|material|estimate|market)\b/i);
}

export function getNotIndexedResponse(topic: string, context?: string): string {
  const suffix = context ? ` ${context}` : "";
  return `${topic}${suffix} is present only when indexed in data/TradeScout Brain/40_KNOWLEDGE; Scout has not indexed a verified match yet.`;
}

export function getKnowledgeBaseStatus(): {
  available: boolean;
  root: string;
  fileCount: number;
} {
  const files = existsSafe(SCOUT_KNOWLEDGE_ROOT) ? walkKnowledgeFiles(SCOUT_KNOWLEDGE_ROOT) : [];
  return {
    available: files.length > 0,
    root: SCOUT_KNOWLEDGE_ROOT,
    fileCount: files.length,
  };
}
