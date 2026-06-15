import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const docs = {
  workflow: "WORKFLOW.md",
  cleanupMap: "CLEANUP_MAP.md",
  gate: "docs/ZACHARY_QA_DRY_RELEASE_GATE.md",
};

function fail(message) {
  console.error(`[zachary-qa-dry-release-gate-contract] ${message}`);
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

function section(markdown, title) {
  const heading = `## ${title}`;
  const start = markdown.indexOf(heading);
  if (start < 0) return "";
  const bodyStart = start + heading.length;
  const next = markdown.indexOf("\n## ", bodyStart);
  return markdown.slice(bodyStart, next < 0 ? markdown.length : next).trim();
}

const workflow = read(docs.workflow);
const cleanupMap = read(docs.cleanupMap);
const gate = read(docs.gate);

assert(
  workflow.includes("docs/ZACHARY_QA_DRY_RELEASE_GATE.md"),
  "WORKFLOW.md must reference the Zachary QA/DRY gate doc"
);
assert(
  cleanupMap.includes("Zachary QA + DRY/SRP Release Gate Foundation"),
  "CLEANUP_MAP.md must list the Zachary QA/DRY lane"
);

const requiredSections = [
  "Operating Order",
  "Release Gate Rules",
  "Front End UI QA Guide",
  "Feature QA Checklist",
  "Bug Report Template",
  "Bug Priority Guide",
  "Release Evidence Checklist",
  "DRY Refactor Intake Checklist",
  "DRY/SRP Rule",
  "Validation For This Docs Lane",
];

for (const title of requiredSections) {
  assert(section(gate, title).length > 80, `${docs.gate} missing or thin section: ${title}`);
}

const requiredOrder = [
  "QA the current user experience",
  "Fix what is broken or confusing",
  "Clean up duplicated/oversized code safely",
  "Re-QA after cleanup",
  "Only then introduce new features",
];

let cursor = -1;
for (const phrase of requiredOrder) {
  const next = gate.indexOf(phrase);
  assert(next > cursor, `Operating order missing or out of sequence: ${phrase}`);
  cursor = next;
}

const qaGuideTerms = [
  "Start with user flow, not code",
  "Screen inventory",
  "Test every clickable element",
  "Forms and validation",
  "Loading, empty, error, and success states",
  "Responsive testing",
  "Visual consistency",
  "Navigation, deep links, refresh behavior",
  "Permissions and roles",
  "Realistic messy data",
  "Accessibility basics",
  "Browser compatibility",
  "Refresh/session behavior",
  "API error handling",
  "AI sloppiness checks",
  "Console/network checks",
  "Per-feature QA checklist",
  "Bug report format",
  "Bug priority levels",
  "Final release check",
];

for (const phrase of qaGuideTerms) {
  assert(gate.includes(phrase), `Front End UI QA Guide missing: ${phrase}`);
}

const bugTemplateTerms = [
  "Title",
  "Steps to reproduce",
  "Expected result",
  "Actual result",
  "Device/browser",
  "Screenshot/recording",
  "Priority",
  "Affected route/screen",
  "Console/network evidence if relevant",
];

for (const phrase of bugTemplateTerms) {
  assert(section(gate, "Bug Report Template").includes(phrase), `Bug Report Template missing: ${phrase}`);
}

const priorityDefinitions = [
  "Critical: user cannot complete the main purpose of the app",
  "High: major feature broken but workaround exists",
  "Medium: feature works but experience is confusing/messy",
  "Low: polish issue",
];

for (const phrase of priorityDefinitions) {
  assert(gate.includes(phrase), `Bug Priority Guide missing definition: ${phrase}`);
}

const requiredRules = [
  "No user-facing merge without QA evidence",
  "No pure refactor merge without behavior-parity evidence and re-QA",
  "No refactor lane may merge unless it proves behavior parity and includes re-QA evidence",
];

for (const phrase of requiredRules) {
  assert(gate.includes(phrase), `Release gate rule missing: ${phrase}`);
}

const dryTargets = [
  "admin-dashboard.tsx - 11,094 lines",
  "parking-pass.tsx - 8,578 lines",
  "shared/schema/legacy.ts - 6,554 lines",
  "server/storage.ts - 5,529 lines",
  "631 repeated server try/catch blocks in route files",
  "~358 raw fetch() calls versus 153 existing apiRequest() uses",
  "duplicated formatCurrency / formatDate helpers in 6+ pages",
];

for (const phrase of dryTargets) {
  assert(gate.includes(phrase), `DRY Refactor Intake Checklist missing target: ${phrase}`);
}

const forbiddenRuntimeSignals = [
  /\bthis lane authorizes runtime refactors\b/i,
  /\bchange runtime app behavior\b/i,
  /\bmodify routes\b/i,
  /\bmodify roles\b/i,
  /\bmodify Direct Connect\b/i,
  /\bmodify trust\/CVS\b/i,
  /\bmodify DB schema\b/i,
  /\bmodify migrations\b/i,
  /\bmodify deployment\b/i,
];

for (const pattern of forbiddenRuntimeSignals) {
  assert(!pattern.test(gate), `${docs.gate} includes forbidden runtime authorization: ${pattern}`);
}

const requiredValidation = [
  "node scripts/zachary-qa-dry-release-gate.contract.test.mjs",
  "node scripts/tradescoutpro-cleanup-docs.contract.test.mjs",
  "node scripts/tradescoutpro-handoff-spine.contract.test.mjs",
  "npm run check",
  "Do not require full `npm run verify` for this docs-only lane",
];

for (const phrase of requiredValidation) {
  assert(gate.includes(phrase), `Validation section missing: ${phrase}`);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[zachary-qa-dry-release-gate-contract] PASS");
