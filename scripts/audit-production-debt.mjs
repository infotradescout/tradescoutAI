import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const SCAN_TARGETS = [
  "server/services",
  "server/routes.ts",
  "server/story-generation-service.ts",
];
const SOURCE_EXTENSION = /\.(?:c|m)?(?:j|t)sx?$/i;
const EXCLUDED_PATH = /(?:^|\/)(?:archive|archives|exports|fixtures|__tests__|tests?)(?:\/|$)|\.(?:spec|test)\.[^.]+$/i;

const RULE_MESSAGES = {
  "explicit-runtime-placeholder":
    "Runtime code contains an explicit placeholder or simulated implementation marker.",
  "random-backed-runtime-data":
    "Runtime domain or health data is generated from Math.random().",
  "log-only-operational-claim":
    "An operational success claim is backed only by logging.",
  "in-memory-success-state":
    "Process-local mutable state is used to report operational success.",
};

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/");
}
function sourceLines(content) {
  return String(content).replace(/\r\n/g, "\n").split("\n");
}
function matchLines(lines, predicate) {
  const matches = [];
  lines.forEach((text, index) => {
    if (predicate(text, index)) matches.push({ line: index + 1, excerpt: text.trim() });
  });
  return matches;
}
function hasDurableDependency(content) {
  return /\bdb\s*\.\s*(?:insert|update|delete)|\brepository\s*\.|\bstorage\s*\.|\bqueue\s*\.\s*(?:add|publish|send)|\bfetch\s*\(|\baxios\s*\.|\bdrizzle\b|\bresend\b|\btwilio\b|\bsendgrid\b/i.test(content);
}
function explicitlyProcessLocal(content) {
  return /(?:scope|history_scope)\s*:\s*["']process[_-]local["']/i.test(content) &&
    /durable\s*:\s*false/i.test(content);
}
function explicitPlaceholderMatches(lines) {
  const pattern = /\b(?:for now,?\s+(?:we(?:'ll| will)\s+)?(?:just\s+)?(?:log|return|simulate|use)|in a real implementation|replace with (?:a )?(?:db|database)|structured template|in-memory (?:storage|analytics|queue|state)|simulate(?:d|s|ing)? (?:a )?successful response)\b/i;
  return matchLines(lines, (line) => pattern.test(line));
}
function randomRuntimeMatches(lines) {
  const domainSignal = /(?:current_value|building|pricing|trade|report|total|active|homeowner|contractor|activity|opportunity|completeness|trend|competition|rating|review|availability|uploaded|size|cpu|memory|disk|latency|response|request|error|health|score|count)/i;
  const entropyOnly = /(?:token|nonce|salt|slug|jitter|chaos|probability|randomBytes|toString\s*\(\s*["']36["']\s*\))/i;
  return matchLines(lines, (line) =>
    /Math\.random\s*\(/.test(line) && domainSignal.test(line) && !entropyOnly.test(line)
  );
}
function logOnlyMatches(lines, content) {
  if (hasDurableDependency(content)) return [];
  const operation = /\b(?:sent|queued|assigned|notified|approved|completed|executed successfully|registered|indexed|purged|cleared|marked as opened)\b/i;
  return matchLines(lines, (line) =>
    /console\.(?:log|info)\s*\(/.test(line) && operation.test(line)
  );
}
function inMemorySuccessMatches(lines, content) {
  if (hasDurableDependency(content) || explicitlyProcessLocal(content)) return [];
  const state = matchLines(lines, (line) => {
    const mutableContainer = /(?:private\s+)?[A-Za-z_$][\w$]*(?:\s*:[^=]+)?\s*=\s*(?:new\s+(?:Map|Set)\b|\[\s*\])/i;
    const operationalName = /(?:action|assignment|brief|brandKnowledge|countyData|updateQueue|dispatch|eventQueue|batch|organization|sent)/i;
    return mutableContainer.test(line) && operationalName.test(line);
  });
  const successClaim = /success\s*:\s*true|return\s+true\b|status\s*:\s*["'](?:queued|sent|approved|completed|processing|success)["']|sentAt\b|approvedAt\b|completedAt\b/i.test(content);
  return successClaim ? state : [];
}

export function scanProductionDebtSource(file, content) {
  const normalizedFile = normalizePath(file);
  const lines = sourceLines(content);
  const matchers = [
    ["explicit-runtime-placeholder", explicitPlaceholderMatches(lines)],
    ["random-backed-runtime-data", randomRuntimeMatches(lines)],
    ["log-only-operational-claim", logOnlyMatches(lines, content)],
    ["in-memory-success-state", inMemorySuccessMatches(lines, content)],
  ];
  return matchers.filter(([, matches]) => matches.length > 0).map(([rule, matches]) => ({
    file: normalizedFile,
    rule,
    line: matches[0].line,
    message: RULE_MESSAGES[rule],
    matches,
  }));
}
function collectSources(root, relativeTarget, output) {
  const fullTarget = path.resolve(root, relativeTarget);
  if (!fs.existsSync(fullTarget)) return;
  const stat = fs.statSync(fullTarget);
  if (stat.isFile()) {
    const normalized = normalizePath(relativeTarget);
    if (SOURCE_EXTENSION.test(normalized) && !EXCLUDED_PATH.test(normalized)) output.push(normalized);
    return;
  }
  for (const name of fs.readdirSync(fullTarget).sort()) {
    const relative = normalizePath(path.join(relativeTarget, name));
    if (!EXCLUDED_PATH.test(relative)) collectSources(root, relative, output);
  }
}
export function auditProductionDebt(root = REPO_ROOT) {
  const resolvedRoot = path.resolve(root);
  const files = [];
  for (const target of SCAN_TARGETS) collectSources(resolvedRoot, target, files);
  const findings = [];
  for (const file of files) {
    const content = fs.readFileSync(path.resolve(resolvedRoot, file), "utf8");
    findings.push(...scanProductionDebtSource(file, content));
  }
  return {
    root: resolvedRoot,
    scope: [...SCAN_TARGETS],
    filesScanned: files.length,
    findings,
    semanticCoverage: "bounded_static_signatures_only",
  };
}
function runCli() {
  const result = auditProductionDebt();
  console.log("[production-debt] bounded static scope: " + result.scope.join(", "));
  console.log("[production-debt] this gate detects known signatures; it is not complete semantic coverage.");
  if (result.findings.length > 0) {
    console.error("[production-debt] blocking findings:");
    for (const finding of result.findings) {
      console.error("  - " + finding.file + ":" + finding.line + " [" + finding.rule + "] " +
        finding.message + " (" + finding.matches.length + " match" +
        (finding.matches.length === 1 ? "" : "es") + ")");
    }
    process.exitCode = 1;
    return;
  }
  console.log("[production-debt] no blocking findings in the bounded static scope.");
}
if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) runCli();
