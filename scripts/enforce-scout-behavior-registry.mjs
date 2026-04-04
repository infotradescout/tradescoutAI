import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, "scout-behavior-registry.json");
const SCOUT_CLIENT_PATH = path.join(ROOT, "client", "src", "scout", "ScoutOS.tsx");
const SCOUT_SERVER_PATH = path.join(ROOT, "server", "routes", "scout.ts");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function normalizeLabel(value) {
  return String(value || "")
    .replace(/^\/\/\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function collectMatches(text, regex) {
  const results = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    results.push(m[0]);
  }
  return results;
}

if (!fs.existsSync(REGISTRY_PATH)) {
  console.error("❌ Missing scout-behavior-registry.json");
  process.exit(1);
}

const registry = JSON.parse(read(REGISTRY_PATH));
const entries = Array.isArray(registry?.entries) ? registry.entries : [];

if (entries.length === 0) {
  console.error("❌ scout-behavior-registry.json has no entries");
  process.exit(1);
}

const clientSource = read(SCOUT_CLIENT_PATH);
const serverSource = read(SCOUT_SERVER_PATH);

const detectedClient = collectMatches(
  clientSource,
  /\/\/\s*(?:[A-Z][A-Z\s\-:'"()]*INTENT.*|EXPLANATION:.*|FALLBACK:.*)/g
).map((s) => ({ surface: "client", label: s.replace(/^\/\/\s*/, "").trim() }));

const detectedServer = collectMatches(
  serverSource,
  /\/\/\s*(?:SPECIAL HANDLING:.*|GOVERNOR MODE:.*|SMART SYNTHESIS.*|Deterministic early-exit.*|LAYER RESOLUTION:.*|Brand identity firewall.*|Handle auth-required intent.*|fallback.*)/gi
).map((s) => ({ surface: "server", label: s.replace(/^\/\/\s*/i, "").trim() }));

const detected = [...detectedClient, ...detectedServer];

const registryKeySet = new Set(
  entries.map((entry) => `${entry.surface}:${normalizeLabel(entry.label)}`)
);

const missingInRegistry = detected.filter(
  (item) => !registryKeySet.has(`${item.surface}:${normalizeLabel(item.label)}`)
);

const invalidEntries = [];
for (const entry of entries) {
  const tests = Array.isArray(entry.tests) ? entry.tests : [];
  const precedence = Number(entry.precedence);
  if (!entry.id || !entry.surface || !entry.label) {
    invalidEntries.push(`Entry missing required fields: ${JSON.stringify(entry)}`);
    continue;
  }
  if (!entry.owner || typeof entry.owner !== "string") {
    invalidEntries.push(`Entry ${entry.id} missing owner`);
  }
  if (entry.authoritySide !== "server" && entry.authoritySide !== "client") {
    invalidEntries.push(`Entry ${entry.id} has invalid authoritySide: ${entry.authoritySide}`);
  }
  if (!Number.isFinite(precedence)) {
    invalidEntries.push(`Entry ${entry.id} has invalid precedence: ${entry.precedence}`);
  }
  if (typeof entry.requiresAuth !== "boolean") {
    invalidEntries.push(`Entry ${entry.id} requiresAuth must be boolean`);
  }
  if (!entry.messageContract || typeof entry.messageContract !== "string") {
    invalidEntries.push(`Entry ${entry.id} missing messageContract`);
  }
  if (!entry.actionContract || typeof entry.actionContract !== "string") {
    invalidEntries.push(`Entry ${entry.id} missing actionContract`);
  }
  if (tests.length === 0) {
    invalidEntries.push(`Entry ${entry.id} has no test mappings`);
    continue;
  }
  for (const testPath of tests) {
    const abs = path.join(ROOT, testPath);
    if (!fs.existsSync(abs)) {
      invalidEntries.push(`Entry ${entry.id} references missing test file: ${testPath}`);
    }
  }
}

if (missingInRegistry.length || invalidEntries.length) {
  if (missingInRegistry.length) {
    console.error("❌ Unregistered Scout behavior branches detected:");
    for (const item of missingInRegistry) {
      console.error(`- [${item.surface}] ${item.label}`);
    }
  }

  if (invalidEntries.length) {
    console.error("❌ Invalid registry entries:");
    for (const issue of invalidEntries) {
      console.error(`- ${issue}`);
    }
  }

  console.error("\nAdd or fix entries in scout-behavior-registry.json before merging.");
  process.exit(1);
}

console.log(
  `✅ Scout behavior registry enforced. detected=${detected.length}, entries=${entries.length}`
);
