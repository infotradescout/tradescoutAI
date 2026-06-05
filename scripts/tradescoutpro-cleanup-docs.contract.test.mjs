import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const docs = {
  workflow: "WORKFLOW.md",
  cleanupMap: "CLEANUP_MAP.md",
  patterns: "CODEBASE_PATTERNS_OVERVIEW.md",
};

function fail(message) {
  console.error(`[cleanup-docs-contract] ${message}`);
  process.exitCode = 1;
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  assert(fs.existsSync(fullPath), `${relativePath} must exist`);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

const workflow = read(docs.workflow);
const cleanupMap = read(docs.cleanupMap);
const patterns = read(docs.patterns);
const allDocs = [
  [docs.workflow, workflow],
  [docs.cleanupMap, cleanupMap],
  [docs.patterns, patterns],
];

for (const [name, content] of allDocs) {
  assert(
    content.includes("TradeScoutPro_HANDOFF_SPINE.md"),
    `${name} must reference TradeScoutPro_HANDOFF_SPINE.md`
  );
}

assert(/production cleanup \/ handoff mode/i.test(workflow), "WORKFLOW.md must include production cleanup mode");
assert(/Standard Codex Prompt Rule/i.test(workflow), "WORKFLOW.md must include standard Codex prompt rule");
assert(/Do not add features/i.test(workflow), "WORKFLOW.md must include no-feature rule");
assert(/Validation Order/i.test(workflow), "WORKFLOW.md must include validation order");
assert(/npm run check/i.test(workflow), "WORKFLOW.md must include npm run check");
assert(/npm run verify/i.test(workflow), "WORKFLOW.md must include npm run verify");
assert(/Sitemap Drift Rule/i.test(workflow), "WORKFLOW.md must include sitemap drift rule");
assert(/When To Stop Before Editing/i.test(workflow), "WORKFLOW.md must include stop-before-editing rule");
assert(/Return Format After Each Task/i.test(workflow), "WORKFLOW.md must include return format");

assert(/Allowed Cleanup Lanes/i.test(cleanupMap), "CLEANUP_MAP.md must include allowed cleanup lanes");
assert(/Docs Cleanup Lane/i.test(cleanupMap), "CLEANUP_MAP.md must include docs cleanup lane");
assert(/Validation Cleanup Lane/i.test(cleanupMap), "CLEANUP_MAP.md must include validation cleanup lane");
assert(/Route Ownership Cleanup Lane/i.test(cleanupMap), "CLEANUP_MAP.md must include route ownership lane");
assert(/Admin Surface Mapping Lane/i.test(cleanupMap), "CLEANUP_MAP.md must include admin surface mapping lane");
assert(/Upload \/ Storage Audit Lane/i.test(cleanupMap), "CLEANUP_MAP.md must include upload/storage audit lane");
assert(/Migration \/ Deploy Checklist Lane/i.test(cleanupMap), "CLEANUP_MAP.md must include migration/deploy lane");
assert(/Blocked Areas During Cleanup/i.test(cleanupMap), "CLEANUP_MAP.md must include blocked areas");
assert(/Do not touch during cleanup/i.test(cleanupMap), "CLEANUP_MAP.md must include no-touch boundary");
assert(/Product Polish Audit Lane/i.test(cleanupMap), "CLEANUP_MAP.md must keep product polish audit-only first");

const requiredPatternSections = [
  "Current Stack",
  "Client Entry Pattern",
  "Server Entry Pattern",
  "Route / API Organization Pattern",
  "Schema / Data Pattern",
  "Test / Validation Pattern",
  "Deployment Pattern",
  "Danger Zones",
  "Known Inconsistencies To Verify Before Changing",
];

for (const title of requiredPatternSections) {
  assert(patterns.includes(`## ${title}`), `CODEBASE_PATTERNS_OVERVIEW.md missing ${title}`);
}

assert(/React/i.test(patterns), "patterns doc must include stack");
assert(/client\/src\/AppRoutes\.tsx/i.test(patterns), "patterns doc must include client entry");
assert(/server\/index\.ts/i.test(patterns), "patterns doc must include server entry");
assert(/server\/routes\.ts/i.test(patterns), "patterns doc must include route organization");
assert(/shared\/schema\.ts/i.test(patterns), "patterns doc must include schema pattern");
assert(/npm run verify/i.test(patterns), "patterns doc must include validation pattern");
assert(/render\.yaml/i.test(patterns), "patterns doc must include deploy pattern");

const forbiddenSignals = [
  /\badd new feature\b/i,
  /\bbuild new feature\b/i,
  /\bnew product surface\b/i,
  /\bfake contractor/i,
  /\bfake provider/i,
  /\bfake analytics/i,
  /\bplaceholder traction/i,
  /\bsample provider/i,
  /\bsample analytics/i,
  /\bsample traction/i,
  /\binvent data/i,
];

for (const [name, content] of allDocs) {
  for (const pattern of forbiddenSignals) {
    assert(!pattern.test(content), `${name} includes forbidden signal: ${pattern}`);
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[cleanup-docs-contract] PASS");
