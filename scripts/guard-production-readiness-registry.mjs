import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  API_ROUTE_FAMILIES,
  CANONICAL_OBJECTS,
  CLIENT_ROUTE_EXPOSURE_POLICIES,
  CLIENT_ROUTE_FAMILIES,
  PR_RECOVERY_DISPOSITIONS,
  PR_DISPOSITIONS,
  READINESS_STATES,
  ROUTE_EXPOSURE_KINDS,
  SERVER_RENDERED_CLIENT_ROUTE_PREFIXES,
  resolveClientRoute,
} from "../config/production-readiness-registry.mjs";

const GUARDED_ACCESS = new Set(["protected", "admin", "feature_gate"]);
const NON_PUBLIC_READINESS = new Set(["disabled", "retired", "internal_only"]);

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function routeProtectionFromBlock(block) {
  if (block.includes("Component={NotFound}")) return { access: "disabled", requiredRoles: [] };
  const protectedRoute = block.match(/<ProtectedRoute\b([^>]*)>/);
  if (protectedRoute) {
    const requiredRolesBlock = protectedRoute[1].match(
      /\brequiredRoles\s*=\s*\{\s*\[([\s\S]*?)\]\s*\}/
    )?.[1];
    const requiredRoles = requiredRolesBlock
      ? [...requiredRolesBlock.matchAll(/["'`]([^"'`]+)["'`]/g)].map((match) => match[1])
      : [];
    return {
      access: /\badminOnly\b/.test(protectedRoute[1]) ? "admin" : "protected",
      requiredRoles,
    };
  }
  if (/(?:ProgressiveFeatureGate|LandingAccessGate)/.test(block)) {
    return { access: "feature_gate", requiredRoles: [] };
  }
  return { access: "public", requiredRoles: [] };
}

export function extractLiteralClientRoutes(source, sourceName = "client/src/AppRoutes.tsx") {
  const matches = [...source.matchAll(/<Route\s+path="([^"]+)"/g)].filter((match) =>
    match[1].startsWith("/")
  );
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const nextStart = matches[index + 1]?.index ?? source.length;
    const closing = source.indexOf("</Route>", start);
    const end = closing >= 0 && closing < nextStart ? closing + "</Route>".length : nextStart;
    const block = source.slice(start, end);
    return { path: match[1], source: sourceName, ...routeProtectionFromBlock(block) };
  });
}

export function extractCompatibilityRedirects(
  source,
  sourceName = "client/src/routing/compatibilityRedirects.ts"
) {
  const routes = [];
  for (const objectMatch of source.matchAll(/\{([^{}]*\bfrom:\s*"[^"]+"[^{}]*)\}/g)) {
    const body = objectMatch[1];
    const from = body.match(/\bfrom:\s*"([^"]+)"/)?.[1];
    const to = body.match(/\bto:\s*"([^"]+)"/)?.[1];
    const access = body.match(/\baccess:\s*"(public|protected|admin)"/)?.[1];
    if (!from || !to || !access) continue;
    routes.push({ path: from, target: to, source: sourceName, access });
  }
  return routes;
}

export function extractServerRenderedClientRoutes(
  source,
  prefixes = SERVER_RENDERED_CLIENT_ROUTE_PREFIXES,
  sourceName = "server/index.ts"
) {
  const routes = [];
  for (const match of source.matchAll(
    /\.(?:get|post|put|patch|delete|use|head|options|all)\(\s*["'`]([^"'`]+)["'`]/g
  )) {
    const route = match[1];
    if (!prefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`))) continue;
    routes.push({ path: route, source: sourceName, access: "public" });
  }
  return routes;
}

function readStaticBindings(source) {
  const bindings = new Map();
  for (const match of source.matchAll(
    /\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(["'`])([^"'`]*)\2\s*(?:as\s+const)?\s*;/g
  )) {
    bindings.set(match[1], [match[3]]);
  }
  for (const match of source.matchAll(
    /\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*\[([\s\S]*?)\]\s*(?:as\s+const)?\s*;/g
  )) {
    const values = [...match[2].matchAll(/["'`]([^"'`]+)["'`]/g)].map((item) => item[1]);
    if (values.length) bindings.set(match[1], values);
  }
  return bindings;
}

export function extractApiRegistrationsFromSource(source) {
  const routes = [];
  const method = "(?:get|post|put|patch|delete|use|head|options|all)";
  for (const match of source.matchAll(
    new RegExp(`\\.${method}\\(\\s*["'\\x60]([^"'\\x60]+)["'\\x60]`, "g")
  )) {
    if (match[1].startsWith("/api")) routes.push(match[1]);
  }
  for (const match of source.matchAll(
    new RegExp(`\\.${method}\\(\\s*\\[([\\s\\S]*?)\\]\\s*,`, "g")
  )) {
    for (const item of match[1].matchAll(/["'`]([^"'`]+)["'`]/g)) {
      if (item[1].startsWith("/api")) routes.push(item[1]);
    }
  }
  const bindings = readStaticBindings(source);
  for (const match of source.matchAll(
    new RegExp(`\\.${method}\\(\\s*([A-Za-z_$][\\w$]*)\\s*,`, "g")
  )) {
    for (const value of bindings.get(match[1]) ?? []) {
      if (value.startsWith("/api")) routes.push(value);
    }
  }
  return routes;
}

function walkSource(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!["_archive", "tests"].includes(entry.name)) walkSource(entryPath, files);
    } else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
      files.push(entryPath);
    }
  }
  return files;
}

export function extractSitemapPaths(source) {
  return uniqueSorted(
    [...source.matchAll(/<loc>https:\/\/www\.thetradescout\.com([^<]*)<\/loc>/g)].map(
      (match) => match[1] || "/"
    )
  );
}

export function extractGeneratedSitemapPaths(source) {
  const block = source.match(/const STATIC_PUBLIC_ROUTES\s*=\s*\[([\s\S]*?)\n\];/)?.[1] ?? "";
  return uniqueSorted([...block.matchAll(/\bpath:\s*["']([^"']+)["']/g)].map((match) => match[1]));
}

export function validatePrRecoveryRecords(records = PR_RECOVERY_DISPOSITIONS) {
  const failures = [];
  const byNumber = new Map();
  for (const pr of records) {
    if (byNumber.has(pr.number)) failures.push(`Duplicate PR disposition for #${pr.number}`);
    byNumber.set(pr.number, pr);
    if (!PR_DISPOSITIONS.includes(pr.disposition)) {
      failures.push(`PR #${pr.number} has invalid disposition ${pr.disposition}`);
    }
    if (!["open", "closed"].includes(pr.status)) failures.push(`PR #${pr.number} has invalid status`);
    if (pr.disposition === "close" && pr.status !== "closed") {
      failures.push(`PR #${pr.number} is marked close but remains ${pr.status}`);
    }
    if (pr.disposition === "hold" && pr.status !== "open") {
      failures.push(`PR #${pr.number} is marked hold but is ${pr.status}`);
    }
    if (!pr.owner || !pr.reason) failures.push(`PR #${pr.number} lacks an owner or reason`);
    if (/current-main[^.]*draft PR/i.test(pr.reason)) {
      failures.push(`PR #${pr.number} incorrectly describes a draft PR as current-main`);
    }
    if (pr.disposition === "hold") {
      if (!pr.headRef || pr.mergedIntoMain !== false || !Array.isArray(pr.replaces) || !pr.replaces.length) {
        failures.push(`Held PR #${pr.number} lacks an unmerged headRef and replacement linkage`);
      }
    }
  }
  for (const pr of records) {
    if (pr.replacementPr) {
      const replacement = byNumber.get(pr.replacementPr);
      if (!replacement || replacement.disposition !== "hold" || replacement.status !== "open") {
        failures.push(`PR #${pr.number} replacement #${pr.replacementPr} is not an open hold`);
      }
      if (!replacement?.replaces?.includes(pr.number)) {
        failures.push(`PR #${pr.number} replacement #${pr.replacementPr} lacks reverse linkage`);
      }
    }
    if (pr.disposition === "hold") {
      for (const replacedNumber of pr.replaces ?? []) {
        const replaced = byNumber.get(replacedNumber);
        if (!replaced || replaced.replacementPr !== pr.number) {
          failures.push(`Held PR #${pr.number} replacement link to #${replacedNumber} is not reciprocal`);
        }
      }
    }
  }
  return failures;
}

function validateFamilies(families, label) {
  const failures = [];
  const ids = new Set();
  for (const routeFamily of families) {
    if (ids.has(routeFamily.id)) failures.push(`Duplicate ${label} family id ${routeFamily.id}`);
    ids.add(routeFamily.id);
    if (!READINESS_STATES.includes(routeFamily.readiness)) {
      failures.push(`${label} family ${routeFamily.id} has invalid readiness ${routeFamily.readiness}`);
    }
    if (!CANONICAL_OBJECTS[routeFamily.canonicalObject]) {
      failures.push(`${label} family ${routeFamily.id} references unknown object ${routeFamily.canonicalObject}`);
    }
    for (const field of ["owner", "audience", "job"]) {
      if (!routeFamily[field]) failures.push(`${label} family ${routeFamily.id} lacks ${field}`);
    }
    if (!Array.isArray(routeFamily.roles)) failures.push(`${label} family ${routeFamily.id} lacks roles`);
    if (["disabled", "retired"].includes(routeFamily.readiness) && routeFamily.roles?.length) {
      failures.push(`${label} family ${routeFamily.id} is ${routeFamily.readiness} but grants roles`);
    }
    if (routeFamily.readiness === "internal_only") {
      if (!routeFamily.roles?.length || routeFamily.roles.includes("anonymous")) {
        failures.push(`${label} family ${routeFamily.id} is internal_only without a private role boundary`);
      }
    }
    if (routeFamily.readiness === "closed_beta") {
      if (!routeFamily.roles?.some((role) => role !== "anonymous")) {
        failures.push(`${label} family ${routeFamily.id} is closed_beta without a non-anonymous role`);
      }
    }
  }
  return failures;
}

function routeMatches(route, families) {
  return families.filter((routeFamily) => routeFamily.match.test(route));
}

export function validateApiRouteOwnership(routes, families = API_ROUTE_FAMILIES) {
  const failures = [];
  for (const route of uniqueSorted(routes)) {
    const matches = routeMatches(route, families);
    if (!matches.length) failures.push(`Unowned API route ${route}`);
    else if (matches.length > 1) {
      failures.push(`Multiply-owned API route ${route}: ${matches.map((item) => item.id).join(", ")}`);
    }
  }
  return failures;
}

export function validateRouteExposure({
  routeEntries,
  sitemapRoutes = [],
  families = CLIENT_ROUTE_FAMILIES,
  policies = CLIENT_ROUTE_EXPOSURE_POLICIES,
}) {
  const failures = [];
  const policyByPath = new Map();
  for (const policy of policies) {
    if (policyByPath.has(policy.path)) failures.push(`Duplicate public exposure policy for ${policy.path}`);
    policyByPath.set(policy.path, policy);
    if (!ROUTE_EXPOSURE_KINDS.includes(policy.kind) || !policy.owner || !policy.rationale) {
      failures.push(`Public exposure policy ${policy.path} is incomplete`);
    }
  }

  const routeByPath = new Map();
  for (const entry of routeEntries) {
    if (!routeByPath.has(entry.path)) routeByPath.set(entry.path, entry);
    const matches = routeMatches(entry.path, families);
    if (!matches.length) {
      failures.push(`Unowned client route ${entry.path} (${entry.source})`);
      continue;
    }
    if (matches.length > 1) {
      failures.push(`Multiply-owned client route ${entry.path}: ${matches.map((item) => item.id).join(", ")}`);
      continue;
    }
    const routeFamily = matches[0];
    const policy = policyByPath.get(entry.path);
    if (policy && (routeFamily.readiness !== "closed_beta" || policy.owner !== routeFamily.owner)) {
      failures.push(`Public exposure policy ${entry.path} does not match its closed-beta owner`);
    }
    if (["disabled", "retired"].includes(routeFamily.readiness) && entry.access !== "disabled") {
      failures.push(`${routeFamily.readiness} route ${entry.path} is not fail-closed`);
    }
    if (routeFamily.readiness === "internal_only" && !GUARDED_ACCESS.has(entry.access)) {
      failures.push(`internal_only route ${entry.path} is exposed as ${entry.access}`);
    }
    if (routeFamily.readiness === "closed_beta" && entry.access === "public" && !policy) {
      failures.push(`closed_beta route ${entry.path} is public without an exposure policy`);
    }
  }

  for (const route of sitemapRoutes) {
    const matches = routeMatches(route, families);
    if (!matches.length) {
      failures.push(`Unowned sitemap route ${route}`);
      continue;
    }
    if (matches.length > 1) {
      failures.push(`Multiply-owned sitemap route ${route}: ${matches.map((item) => item.id).join(", ")}`);
      continue;
    }
    const routeFamily = matches[0];
    const policy = policyByPath.get(route);
    if (NON_PUBLIC_READINESS.has(routeFamily.readiness)) {
      failures.push(`${routeFamily.readiness} route ${route} is exposed in the sitemap`);
    }
    if (routeFamily.readiness === "closed_beta" && !policy?.indexable) {
      failures.push(`closed_beta route ${route} is indexed without an indexable exposure policy`);
    }
  }

  for (const policy of policies) {
    if (!routeByPath.has(policy.path)) failures.push(`Stale public exposure policy for missing route ${policy.path}`);
  }
  return failures;
}

export function runProductionReadinessGuard(root = process.cwd()) {
  const failures = [];
  const appRoutesPath = path.join(root, "client", "src", "AppRoutes.tsx");
  const compatibilityPath = path.join(root, "client", "src", "routing", "compatibilityRedirects.ts");
  const serverIndexPath = path.join(root, "server", "index.ts");
  const sitemapPath = path.join(root, "client", "public", "sitemap.xml");
  const sitemapIndexPath = path.join(root, "client", "public", "sitemap-index.xml");
  const sitemapGeneratorPath = path.join(root, "scripts", "generate-sitemap-core.mjs");

  const appRoutes = fs.readFileSync(appRoutesPath, "utf8");
  const compatibilitySource = fs.readFileSync(compatibilityPath, "utf8");
  const serverIndex = fs.readFileSync(serverIndexPath, "utf8");
  const routeEntries = [
    ...extractLiteralClientRoutes(appRoutes),
    ...extractCompatibilityRedirects(compatibilitySource),
    ...extractServerRenderedClientRoutes(serverIndex),
  ];
  const sitemapRoutes = uniqueSorted([
    ...extractSitemapPaths(fs.readFileSync(sitemapPath, "utf8")),
    ...extractGeneratedSitemapPaths(fs.readFileSync(sitemapGeneratorPath, "utf8")),
  ]);

  const apiRegistrations = [];
  for (const file of walkSource(path.join(root, "server"))) {
    apiRegistrations.push(...extractApiRegistrationsFromSource(fs.readFileSync(file, "utf8")));
  }
  const uniqueApiRoutes = uniqueSorted(apiRegistrations);

  failures.push(...validatePrRecoveryRecords());
  for (const [id, object] of Object.entries(CANONICAL_OBJECTS)) {
    if (!object.owner || !object.source || object.authority !== "server") {
      failures.push(`Canonical object ${id} lacks a server owner or source`);
    }
  }
  failures.push(...validateFamilies(CLIENT_ROUTE_FAMILIES, "Client route"));
  failures.push(...validateFamilies(API_ROUTE_FAMILIES, "API route"));
  failures.push(...validateRouteExposure({ routeEntries, sitemapRoutes }));

  failures.push(...validateApiRouteOwnership(uniqueApiRoutes));

  const disabledClientRoutes = uniqueSorted(
    routeEntries
      .filter((entry) => resolveClientRoute(entry.path)?.readiness === "disabled")
      .map((entry) => entry.path)
  );
  const exposureFiles = [
    ...walkSource(path.join(root, "client", "src")),
    sitemapPath,
    sitemapIndexPath,
    sitemapGeneratorPath,
  ].filter((file) => fs.existsSync(file) && file !== appRoutesPath);
  for (const file of exposureFiles) {
    const source = fs.readFileSync(file, "utf8");
    for (const route of disabledClientRoutes) {
      const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const publicDocument = /(?:sitemap|manifest)/i.test(file);
      const navigationReference = new RegExp(
        `(?:href|to|dashboard)\\s*[=:]\\s*["'\\x60]${escaped}["'\\x60]|` +
          `(?:navigate|setLocation)\\(\\s*["'\\x60]${escaped}["'\\x60]`
      );
      if ((publicDocument && source.includes(route)) || navigationReference.test(source)) {
        failures.push(`Disabled route exposed: ${path.relative(root, file)} -> ${route}`);
      }
    }
  }

  return {
    failures: uniqueSorted(failures),
    counts: {
      canonicalObjects: Object.keys(CANONICAL_OBJECTS).length,
      prRecoveryDispositions: PR_RECOVERY_DISPOSITIONS.length,
      openPrHolds: PR_RECOVERY_DISPOSITIONS.filter(
        (pr) => pr.status === "open" && pr.disposition === "hold"
      ).length,
      clientRoutes: uniqueSorted(routeEntries.map((entry) => entry.path)).length,
      compatibilityRedirects: extractCompatibilityRedirects(compatibilitySource).length,
      serverRenderedClientRoutes: extractServerRenderedClientRoutes(serverIndex).length,
      apiRegistrations: apiRegistrations.length,
      uniqueApiRoutes: uniqueApiRoutes.length,
      disabledClientRoutes: disabledClientRoutes.length,
    },
  };
}

function printResult(result) {
  if (result.failures.length) {
    console.error(`[production-readiness-registry] FAIL\n\n${result.failures.join("\n")}`);
    return false;
  }
  console.log("[production-readiness-registry] PASS");
  console.log(`Canonical objects: ${result.counts.canonicalObjects}`);
  console.log(`PR recovery dispositions: ${result.counts.prRecoveryDispositions}`);
  console.log(`Open PRs held for recovery: ${result.counts.openPrHolds}`);
  console.log(`Owned client routes: ${result.counts.clientRoutes}`);
  console.log(`Compatibility redirects: ${result.counts.compatibilityRedirects}`);
  console.log(`Server-rendered client routes: ${result.counts.serverRenderedClientRoutes}`);
  console.log(`API registrations: ${result.counts.apiRegistrations}`);
  console.log(`Unique API routes: ${result.counts.uniqueApiRoutes}`);
  console.log(`Disabled client routes quarantined: ${result.counts.disabledClientRoutes}`);
  return true;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  if (!printResult(runProductionReadinessGuard())) process.exitCode = 1;
}
