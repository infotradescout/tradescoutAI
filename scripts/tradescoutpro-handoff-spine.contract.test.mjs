import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const spinePath = path.join(root, "TradeScoutPro_HANDOFF_SPINE.md");

function fail(message) {
  console.error(`[handoff-spine-contract] ${message}`);
  process.exitCode = 1;
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function section(markdown, title) {
  const heading = `## ${title}`;
  const start = markdown.indexOf(heading);
  if (start < 0) return "";
  const bodyStart = start + heading.length;
  const next = markdown.indexOf("\n## ", bodyStart);
  return markdown.slice(bodyStart, next < 0 ? markdown.length : next).trim();
}

assert(fs.existsSync(spinePath), "TradeScoutPro_HANDOFF_SPINE.md must exist");

const markdown = fs.existsSync(spinePath) ? fs.readFileSync(spinePath, "utf8") : "";

const requiredSections = [
  "App Identity",
  "What This App Is",
  "What This App Is Not",
  "Core User Flows",
  "Entry Routes / Pages",
  "Server Route Groups / API Groups",
  "Main Data / Storage Model",
  "External Integrations",
  "Deployment / Runtime Assumptions",
  "Known Danger Zones",
  "Validation Commands",
  "Developer Onboarding Checklist",
  "Next Cleanup Tickets",
];

for (const title of requiredSections) {
  assert(section(markdown, title).length > 80, `Missing or thin section: ${title}`);
}

assert(/App name:\s*TradeScoutPro/i.test(markdown), "app identity must define TradeScoutPro");
assert(/Product brand:\s*TradeScout/i.test(markdown), "app identity must define TradeScout");
assert(/not a lead-selling system/i.test(markdown), '"what it is not" must include lead-selling boundary');
assert(/not an ungated contact directory/i.test(markdown), '"what it is not" must include contact boundary');
assert(/Scout-first landing/i.test(markdown), "core flows must list Scout-first landing");
assert(/Direct Connect request/i.test(markdown), "core flows must list Direct Connect request");
assert(/\/scout/i.test(markdown), "entry routes must include /scout");
assert(/\/api\/direct-connect/i.test(markdown), "API groups must include Direct Connect");
assert(/Postgres\/Neon/i.test(markdown), "data/storage model must include Postgres/Neon");
assert(/R2/i.test(markdown), "external integrations must include R2/object storage");
assert(/Google Drive client usage was found/i.test(markdown) === false, "must not claim Google Drive usage exists");
assert(/No Google Drive API client usage found/i.test(markdown) || /not currently a Google Drive archival app/i.test(markdown), "Drive usage must be accurately bounded");
assert(/Contact gating/i.test(markdown), "danger zones must include contact gating");
assert(/npm run verify/i.test(markdown), "validation commands must include npm run verify");
assert(/npm run check/i.test(markdown), "validation commands must include npm run check");
assert(/git status --short/i.test(markdown), "developer onboarding checklist must include working tree check");

const tickets = section(markdown, "Next Cleanup Tickets")
  .split(/\r?\n/)
  .filter((line) => /^\d+\.\s+/.test(line.trim()));
assert(tickets.length >= 5 && tickets.length <= 10, "cleanup tickets must contain 5-10 numbered tickets");

const forbiddenFeatureSignals = [
  /\badd new feature\b/i,
  /\bbuild new feature\b/i,
  /\bnew product surface\b/i,
  /\benable live connector\b/i,
  /\benable live execution\b/i,
  /\badd payout behavior\b/i,
  /\bverification shortcut\b/i,
  /\bfake contractor\b/i,
  /\bfake analytics\b/i,
  /\bsample data\b/i,
];

for (const pattern of forbiddenFeatureSignals) {
  assert(!pattern.test(section(markdown, "Next Cleanup Tickets")), `cleanup tickets propose forbidden work: ${pattern}`);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[handoff-spine-contract] PASS");
