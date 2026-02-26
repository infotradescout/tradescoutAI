import fs from "fs";
import path from "path";

const root = process.cwd();

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

function rel(p) {
  return path.relative(root, p).replace(/\\/g, "/");
}

function collectMatches(text, regex) {
  const results = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    results.push(m[0]);
  }
  return results;
}

const scoutClientPath = path.join(root, "client", "src", "scout", "ScoutOS.tsx");
const scoutServerPath = path.join(root, "server", "routes", "scout.ts");

const scoutClient = read(scoutClientPath);
const scoutServer = read(scoutServerPath);

const clientIntentHeaders = collectMatches(
  scoutClient,
  /\/\/\s*(?:[A-Z][A-Z\s\-:'"()]*INTENT.*|EXPLANATION:.*|FALLBACK:.*)/g
).map((s) => s.trim());

const serverBehaviorHeaders = collectMatches(
  scoutServer,
  /\/\/\s*(?:SPECIAL HANDLING:.*|GOVERNOR MODE:.*|SMART SYNTHESIS.*|Deterministic early-exit.*|LAYER RESOLUTION:.*|Brand identity firewall.*|Handle auth-required intent.*|fallback.*)/gi
).map((s) => s.trim());

const clientScoutTests = walk(path.join(root, "client", "src", "scout")).filter((p) =>
  /\.test\.(ts|tsx)$/.test(p)
);
const serverScoutTests = walk(path.join(root, "server", "tests")).filter((p) =>
  /scout.*\.test\.(ts|tsx)$/.test(path.basename(p))
);

const testCaseCount = [...clientScoutTests, ...serverScoutTests].reduce((count, testFile) => {
  const c = read(testFile);
  return count + collectMatches(c, /\bit\s*\(/g).length;
}, 0);

const reportLines = [];
reportLines.push("# Scout Behavior Coverage Audit");
reportLines.push("");
reportLines.push(`Generated: ${new Date().toISOString()}`);
reportLines.push("");
reportLines.push("## Coverage Snapshot");
reportLines.push("");
reportLines.push(`- Client behavior headers detected: ${clientIntentHeaders.length}`);
reportLines.push(`- Server behavior headers detected: ${serverBehaviorHeaders.length}`);
reportLines.push(`- Client Scout test files: ${clientScoutTests.length}`);
reportLines.push(`- Server Scout test files: ${serverScoutTests.length}`);
reportLines.push(`- Total Scout-related test cases detected: ${testCaseCount}`);
reportLines.push("");
reportLines.push("## Client Behavior Branches (ScoutOS)");
reportLines.push("");
if (clientIntentHeaders.length) {
  for (const h of clientIntentHeaders) {
    reportLines.push(`- ${h.replace(/^\/\/\s*/, "")}`);
  }
} else {
  reportLines.push("- None detected");
}
reportLines.push("");
reportLines.push("## Server Behavior Branches (scout route)");
reportLines.push("");
if (serverBehaviorHeaders.length) {
  for (const h of serverBehaviorHeaders) {
    reportLines.push(`- ${h.replace(/^\/\/\s*/i, "")}`);
  }
} else {
  reportLines.push("- None detected");
}
reportLines.push("");
reportLines.push("## Scout Test Surfaces");
reportLines.push("");
for (const t of clientScoutTests) {
  reportLines.push(`- ${rel(t)}`);
}
for (const t of serverScoutTests) {
  reportLines.push(`- ${rel(t)}`);
}
reportLines.push("");
reportLines.push("## Immediate Gap Signals");
reportLines.push("");
reportLines.push("- Large number of behavior branches with comparatively sparse server route-level Scout tests.");
reportLines.push("- Behavior discovery is comment/branch driven rather than contract-driven cataloging.");
reportLines.push("- No unified behavior registry tying intent branches to expected action contracts and tests.");
reportLines.push("");
reportLines.push("## Recommended Next Recovery Steps");
reportLines.push("");
reportLines.push("1. Create a canonical Scout Behavior Registry (intent key, trigger, authority gate, expected action shape).");
reportLines.push("2. Add contract tests for each registry entry (trigger -> response metadata -> allowed action types).");
reportLines.push("3. Enforce a CI guard that fails when new behavior branches are added without registry plus tests.");

const outPath = path.join(root, "SCOUT_BEHAVIOR_COVERAGE_AUDIT.md");
fs.writeFileSync(outPath, reportLines.join("\n"), "utf8");

console.log(`[scout-audit] wrote ${rel(outPath)}`);
console.log(
  `[scout-audit] headers(client/server): ${clientIntentHeaders.length}/${serverBehaviorHeaders.length} | tests: ${testCaseCount}`
);
