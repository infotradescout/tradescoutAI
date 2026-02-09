import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  const filePath = path.join(root, relPath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${relPath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function assertTrue(condition, message, failures) {
  if (!condition) failures.push(message);
}

function findFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      findFiles(full, out);
      continue;
    }
    out.push(full);
  }
  return out;
}

const failures = [];

const routesContent = read(path.join("server", "routes.ts"));
assertTrue(
  routesContent.includes("MISSING_AUTHORITY_GATE"),
  "server/routes.ts must enforce MISSING_AUTHORITY_GATE on legacy direct conversation endpoints",
  failures
);
assertTrue(
  routesContent.includes("/api/social/conversations/start"),
  "server/routes.ts should direct callers to /api/social/conversations/start",
  failures
);

const clientFiles = findFiles(path.join(root, "client", "src")).filter((p) =>
  p.endsWith(".ts") || p.endsWith(".tsx")
);

let contactButtonCount = 0;
let startEndpointRefs = 0;
let startEndpointOutsideAllowed = 0;
let contactRouteBypassRefs = 0;
const allowedStartRefs = [
  path.join("client", "src", "components", "community", "ContactOutcomeModal.tsx"),
];

for (const filePath of clientFiles) {
  const content = fs.readFileSync(filePath, "utf8");
  const rel = path.relative(root, filePath);

  if (content.includes("button-contact-")) {
    contactButtonCount += 1;
    failures.push(`Forbidden contact button test id in ${rel}`);
  }

  const hasContactBypass =
    /\bhref\s*=\s*["']\/contact["']/.test(content) ||
    /\bto\s*=\s*["']\/contact["']/.test(content) ||
    /\b(navigate|setLocation)\(\s*["']\/contact["']/.test(content) ||
    /\bwindow\.location\.(href|assign)\s*=\s*["']\/contact["']/.test(content);
  if (hasContactBypass) {
    contactRouteBypassRefs += 1;
    failures.push(`Forbidden /contact bypass reference in ${rel}`);
  }

  if (content.includes('"/api/social/conversations/start"') || content.includes("'/api/social/conversations/start'")) {
    startEndpointRefs += 1;
    const normalizedRel = rel.replaceAll("\\", "/");
    const isAllowed = allowedStartRefs.some((allowed) =>
      normalizedRel === allowed.replaceAll("\\", "/")
    );
    if (!isAllowed) {
      startEndpointOutsideAllowed += 1;
      failures.push(`Unexpected /api/social/conversations/start reference in ${rel}`);
    }
  }
}

assertTrue(
  startEndpointRefs >= 1,
  "No /api/social/conversations/start reference found in client",
  failures
);

if (failures.length > 0) {
  console.error("[authority-gates] blocking findings:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `[authority-gates] pass (contactButtons=${contactButtonCount}, startRefs=${startEndpointRefs}, outsideAllowed=${startEndpointOutsideAllowed}, contactBypassRefs=${contactRouteBypassRefs})`
);
