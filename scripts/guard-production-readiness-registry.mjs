import fs from "node:fs";
import path from "node:path";
import {
  API_ROUTE_FAMILIES,
  CANONICAL_OBJECTS,
  CLIENT_ROUTE_FAMILIES,
  OPEN_PR_DISPOSITIONS,
  PR_DISPOSITIONS,
  READINESS_STATES,
  resolveApiRoute,
  resolveClientRoute,
} from "../config/production-readiness-registry.mjs";

const root = process.cwd();
const appRoutesPath = path.join(root, "client", "src", "AppRoutes.tsx");
const appRoutes = fs.readFileSync(appRoutesPath, "utf8");
const routes = [...appRoutes.matchAll(/<Route\s+path="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((route) => route.startsWith("/"));
const uniqueRoutes = [...new Set(routes)].sort();

function walkServer(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!["_archive", "tests"].includes(entry.name)) walkServer(entryPath, files);
    } else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
      files.push(entryPath);
    }
  }
  return files;
}

const apiRegistrations = [];
for (const file of walkServer(path.join(root, "server"))) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/\.(get|post|put|patch|delete|use)\(\s*["'`]([^"'`]+)["'`]/g)) {
    if (match[2].startsWith("/api")) apiRegistrations.push(match[2]);
  }
}
const uniqueApiRoutes = [...new Set(apiRegistrations)].sort();

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

for (const family of API_ROUTE_FAMILIES) {
  if (!READINESS_STATES.includes(family.readiness)) {
    failures.push(`API route family ${family.id} has invalid readiness state ${family.readiness}`);
  }
  if (!CANONICAL_OBJECTS[family.canonicalObject]) {
    failures.push(`API route family ${family.id} references unknown object ${family.canonicalObject}`);
  }
  for (const field of ["owner", "audience", "job"]) {
    if (!family[field]) failures.push(`API route family ${family.id} lacks ${field}`);
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


const unresolvedApi = uniqueApiRoutes.filter((route) => !resolveApiRoute(route));
if (unresolvedApi.length) {
  failures.push(`Unowned API routes (${unresolvedApi.length}):\n${unresolvedApi.join("\n")}`);
}

const ambiguousApi = uniqueApiRoutes.flatMap((route) => {
  const matches = API_ROUTE_FAMILIES.filter((family) => family.match.test(route));
  return matches.length > 1 ? [`${route}: ${matches.map((item) => item.id).join(", ")}`] : [];
});
if (ambiguousApi.length) {
  failures.push(`Multiply-owned API routes (${ambiguousApi.length}):\n${ambiguousApi.join("\n")}`);
}

const disabledClientRoutes = uniqueRoutes.filter(
  (route) => resolveClientRoute(route)?.readiness === "disabled"
);
const publicExposureFailures = [];
for (const route of disabledClientRoutes) {
  const marker = `<Route path="${route}">`;
  const start = appRoutes.indexOf(marker);
  const end = start >= 0 ? appRoutes.indexOf("</Route>", start) : -1;
  const routeBlock = start >= 0 && end >= 0 ? appRoutes.slice(start, end) : "";
  if (!routeBlock.includes("Component={NotFound}")) {
    publicExposureFailures.push(`client/src/AppRoutes.tsx -> ${route} is not fail-closed`);
  }
}
const exposureFiles = [
  ...walkServer(path.join(root, "client", "src")),
  path.join(root, "client", "public", "sitemap.xml"),
  path.join(root, "client", "public", "sitemap-index.xml"),
  path.join(root, "scripts", "generate-sitemap-core.mjs"),
].filter((file) => fs.existsSync(file) && !file.endsWith("AppRoutes.tsx"));

for (const file of exposureFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const route of disabledClientRoutes) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const publicDocument = /(?:sitemap|manifest)/i.test(file);
    const navigationReference = new RegExp(
      `(?:href|to|dashboard)\\s*[=:]\\s*["'\x60]${escaped}["'\x60]|` +
        `(?:navigate|setLocation)\\(\\s*["'\x60]${escaped}["'\x60]`
    );
    if ((publicDocument && source.includes(route)) || navigationReference.test(source)) {
      publicExposureFailures.push(`${path.relative(root, file)} -> ${route}`);
    }
  }
}
if (publicExposureFailures.length) {
  failures.push(
    `Disabled routes exposed through public discovery or navigation (${publicExposureFailures.length}):\n` +
      publicExposureFailures.join("\n")
  );
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
console.log(`Literal API registrations: ${apiRegistrations.length}`);
console.log(`Unique literal API routes: ${uniqueApiRoutes.length}`);
console.log(`Disabled client routes quarantined: ${disabledClientRoutes.length}`);
for (const [owner, count] of [...counts].sort()) console.log(`${owner}: ${count}`);
