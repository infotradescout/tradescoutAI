import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteConfig = readFileSync(path.join(root, "vite.config.ts"), "utf8");

assert.match(
  viteConfig,
  /onlyExplicitManualChunks:\s*true/,
  "lazy feature dependencies must remain owned by their explicit feature graph"
);

const manualChunkMap = viteConfig.match(
  /const chunkByPackage:[\s\S]*?=\s*\{([\s\S]*?)\n\s*\};/
);
assert.ok(manualChunkMap, "manual package chunk map must remain inspectable");
for (const lazyOwnedPackage of [
  "recharts",
  "d3-array",
  "d3-color",
  "d3-ease",
  "d3-format",
  "d3-geo",
  "d3-interpolate",
  "d3-path",
  "d3-scale",
  "d3-shape",
  "d3-time",
  "d3-time-format",
  "d3-timer",
  "topojson-client",
  "jspdf",
  "@googlemaps/markerclusterer",
]) {
  assert.doesNotMatch(
    manualChunkMap[1],
    new RegExp(`["']?${lazyOwnedPackage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']?\\s*:`),
    `${lazyOwnedPackage} must remain owned by its lazy consumer graph`
  );
}

const publicDir = path.join(root, "dist", "public");
const indexPath = path.join(publicDir, "index.html");

if (!existsSync(indexPath)) {
  console.log("[app-entry-bundle] source ownership contract verified");
  process.exit(0);
}

const html = readFileSync(indexPath, "utf8");
const preloadHrefs = [...html.matchAll(/<link\b[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map(
  (match) => match[1]
);
const allowedEntryPreloads = [
  /^\/assets\/postOnboardingRoute-[A-Za-z0-9_-]+\.js$/,
  /^\/assets\/vendor-react-[A-Za-z0-9_-]+\.js$/,
];

for (const href of preloadHrefs) {
  assert.ok(
    allowedEntryPreloads.some((pattern) => pattern.test(href)),
    `app entry unexpectedly preloads a lazy feature asset: ${href}`
  );
}

const appMatch = html.match(/<script\b[^>]*type="module"[^>]*src="\/assets\/([^"]+\.js)"/);
assert.ok(appMatch, "app entry script must be present");
const appSource = readFileSync(path.join(publicDir, "assets", appMatch[1]), "utf8");
const staticImports = [...appSource.matchAll(/(?:import[^;]*?from|import)\s*["']\.\/([^"']+)["']/g)].map(
  (match) => match[1]
);

for (const href of staticImports) {
  assert.ok(
    [/^postOnboardingRoute-[A-Za-z0-9_-]+\.js$/, /^vendor-react-[A-Za-z0-9_-]+\.js$/].some(
      (pattern) => pattern.test(href)
    ),
    `app entry unexpectedly imports a lazy feature asset: ${href}`
  );
}

console.log(
  `[app-entry-bundle] verified ${preloadHrefs.length} startup preloads and zero lazy feature vendor imports`
);
