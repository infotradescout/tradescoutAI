import fs from "node:fs";
import path from "node:path";
import {
  CANONICAL_OBJECTS,
  CLIENT_ROUTE_FAMILIES,
  OPEN_PR_DISPOSITIONS,
  PR_DISPOSITIONS,
  READINESS_STATES,
  resolveClientRoute,
} from "../config/production-readiness-registry.mjs";

const root = process.cwd();
const appRoutesPath = path.join(root, "client", "src", "AppRoutes.tsx");
const appRoutes = fs.readFileSync(appRoutesPath, "utf8");
const routes = [...appRoutes.matchAll(/<Route\s+path="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((route) => route.startsWith("/"));
const uniqueRoutes = [...new Set(routes)].sort();

const failures = [];
const prNumbers = new Set();
for (const pr of OPEN_PR_DISPOSITIONS) {
  if (prNumbers.has(pr.number)) failures.push(`Duplicate PR disposition for #${pr.number}`);
  prNumbers.add(pr.number);
  if (!PR_DISPOSITIONS.includes(pr.disposition)) {
    failures.push(`PR #${pr.number} has invalid disposition ${pr.disposition}`);
  }
  if (!pr.owner || !pr.reason) failures.push(`PR #${pr.number} lacks an owner or reason`);
}
for (const [id, object] of Object.entries(CANONICAL_OBJECTS)) {
  if (!object.owner || !object.source || object.authority !== "server") {
    failures.push(`Canonical object ${id} lacks a server owner or source`);
  }
}

for (const family of CLIENT_ROUTE_FAMILIES) {
  if (!READINESS_STATES.includes(family.readiness)) {
    failures.push(`Route family ${family.id} has invalid readiness state ${family.readiness}`);
  }
  if (!CANONICAL_OBJECTS[family.canonicalObject]) {
    failures.push(`Route family ${family.id} references unknown object ${family.canonicalObject}`);
  }
  for (const field of ["owner", "audience", "job"]) {
    if (!family[field]) failures.push(`Route family ${family.id} lacks ${field}`);
  }
}

const unresolved = uniqueRoutes.filter((route) => !resolveClientRoute(route));
if (unresolved.length) {
  failures.push(`Unowned client routes (${unresolved.length}):\n${unresolved.join("\n")}`);
}

const ambiguous = uniqueRoutes.flatMap((route) => {
  const matches = CLIENT_ROUTE_FAMILIES.filter((family) => family.match.test(route));
  return matches.length > 1 ? [`${route}: ${matches.map((item) => item.id).join(", ")}`] : [];
});
if (ambiguous.length) {
  failures.push(`Multiply-owned client routes (${ambiguous.length}):\n${ambiguous.join("\n")}`);
}

if (failures.length) {
  console.error(`[production-readiness-registry] FAIL\n\n${failures.join("\n\n")}`);
  process.exit(1);
}

const counts = new Map();
for (const route of uniqueRoutes) {
  const owner = resolveClientRoute(route).id;
  counts.set(owner, (counts.get(owner) ?? 0) + 1);
}

console.log(`[production-readiness-registry] PASS`);
console.log(`Canonical objects: ${Object.keys(CANONICAL_OBJECTS).length}`);
console.log(`Open PR dispositions: ${OPEN_PR_DISPOSITIONS.length}`);
console.log(`Literal client routes: ${uniqueRoutes.length}`);
for (const [owner, count] of [...counts].sort()) console.log(`${owner}: ${count}`);
