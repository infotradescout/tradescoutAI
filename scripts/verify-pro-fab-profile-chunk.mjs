import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const profileSource = read("client/src/pages/ProfileSiteView.tsx");

assert.doesNotMatch(profileSource, /import ProFabProfileTheme from/);
assert.match(
  profileSource,
  /const ProFabProfileTheme = lazy\(\(\) => import\("@\/pages\/profile-sites\/ProFabProfileTheme"\)\)/,
  "Pro Fab must retain its dedicated lazy owner"
);
for (const staticTheme of [
  "DefaultProfileTheme",
  "WholesalerProfileTheme",
]) {
  assert.match(profileSource, new RegExp(`import ${staticTheme}(?:,| from)`));
}

const branchStart = profileSource.indexOf('if (profile.slug === "pro-fab-specialty-services")');
const branchEnd = profileSource.indexOf("if (\n    resolvedLocalServicePresentation", branchStart);
assert.ok(branchStart >= 0 && branchEnd > branchStart, "exact Pro Fab slug branch must remain");
const branch = profileSource.slice(branchStart, branchEnd);
const orderedOwners = [
  "<SEOHelmet",
  "{manageChrome}",
  "{templateIndependentInventoryContext}",
  "<ProFabProfileBoundary>",
  "<ProFabProfileTheme\n",
  "</ProFabProfileBoundary>",
  "<ExpressDirectConnectPanel",
];
let previousIndex = -1;
for (const owner of orderedOwners) {
  const index = branch.indexOf(owner);
  assert.ok(index > previousIndex, `${owner} must retain Pro Fab branch ownership order`);
  previousIndex = index;
}
assert.match(
  profileSource,
  /data-testid="pro-fab-profile-loading"[\s\S]*?role="status"[\s\S]*?aria-live="polite"/,
  "Pro Fab fallback must remain branded and accessible"
);
for (const prop of [
  "profileSlug={profile.slug}",
  "platformBaseHref={platformBaseHref}",
  "onDirectConnect={openGeneralDirectConnect}",
  "recommendationsDirectory={recommendationsDirectory}",
  'trustActions={renderProfileTrustActions("dark")}',
  'requestMode={expressInventoryContext ? "materials" : "service"}',
  "initialStoneName={expressInventoryContext?.itemName}",
  "initialItemId={expressInventoryContext?.itemId}",
]) {
  assert.ok(branch.includes(prop), `${prop} must remain wired in the Pro Fab branch`);
}

const themeSource = read("client/src/pages/profile-sites/ProFabProfileTheme.tsx");
for (const behavior of [
  "/images/businesses/pro-fab-specialty-services",
  "services.map",
  "markets.map",
  "profile-trust-section",
  "TradeScoutProfileHandoff",
  'entry.recommendationType === "positive"',
  "publicRecommendations.slice(0, 6)",
]) {
  assert.ok(themeSource.includes(behavior), `${behavior} must remain in Pro Fab`);
}
assert.equal((themeSource.match(/onClick=\{onDirectConnect\}/g) || []).length, 3);

const assetsDir = path.join(root, "dist", "public", "assets");
if (!existsSync(assetsDir)) {
  console.log("[pro-fab-chunk] source contracts verified");
  process.exit(0);
}
const builtHtml = read("dist/public/index.html");
const appName = builtHtml.match(/src="\/assets\/(app-[A-Za-z0-9_-]+\.js)"/)?.[1];
assert.ok(appName, "built app entry must be discoverable");
const appText = readFileSync(path.join(assetsDir, appName), "utf8");
const ownedChunk = (ownerText, prefix) => {
  const matches = [
    ...ownerText.matchAll(new RegExp(`(?:/assets/|\\./)(${prefix}[A-Za-z0-9_-]+\\.js)`, "g")),
  ].map((match) => match[1]);
  assert.equal(new Set(matches).size, 1, `expected one ${prefix} chunk in its owner graph`);
  return matches[0];
};
const coreName = ownedChunk(appText, "ProfileSiteView-");
const core = readFileSync(path.join(assetsDir, coreName));
const coreText = core.toString("utf8");
const proFabName = ownedChunk(coreText, "ProFabProfileTheme-");
const proFab = readFileSync(path.join(assetsDir, proFabName));
const proFabText = proFab.toString("utf8");

assert.ok(core.length <= 480_000, `profile core exceeded 480000 bytes: ${core.length}`);
assert.ok(gzipSync(core).length <= 119_000, "profile core exceeded 119000 gzip bytes");
assert.ok(proFab.length <= 12_000, `Pro Fab exceeded 12000 bytes: ${proFab.length}`);
assert.ok(gzipSync(proFab).length <= 4_000, "Pro Fab exceeded 4000 gzip bytes");
for (const identity of [
  "Custom metal fabrication",
  "Structural steel fabrication & installation",
  "Plant maintenance & shutdown support",
  "Built strong. Welded right.",
  "Send Pro Fab the project details.",
]) {
  assert.equal(coreText.includes(identity), false, `${identity} leaked into profile core`);
  assert.equal(proFabText.includes(identity), true, `${identity} must remain in Pro Fab chunk`);
}

function readViteDependencyTable(builtSource) {
  const helperIndex = builtSource.indexOf("const __vite__mapDeps=");
  assert.ok(helperIndex >= 0, "Vite dependency helper must remain inspectable");
  const tableStart = builtSource.indexOf('["/assets/', helperIndex);
  assert.ok(tableStart >= 0, "Vite dependency table must remain inspectable");
  let inString = false;
  let escaped = false;
  let depth = 0;
  for (let index = tableStart; index < builtSource.length; index += 1) {
    const character = builtSource[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "[") depth += 1;
    else if (character === "]" && --depth === 0) {
      const parsed = JSON.parse(builtSource.slice(tableStart, index + 1));
      assert.ok(
        Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every((entry) => typeof entry === "string" && entry.startsWith("/assets/")),
        "Vite dependency table must be a public-asset string array"
      );
      return parsed;
    }
  }
  assert.fail("Vite dependency table did not terminate");
}
const dependencyTable = readViteDependencyTable(coreText);
const dynamicMatch = coreText.match(
  /import\("\.\/(ProFabProfileTheme-[A-Za-z0-9_-]+\.js)"\),__vite__mapDeps\(\[([^\]]*)\]\)/
);
assert.ok(dynamicMatch, "Pro Fab dynamic graph must remain inspectable");
const dependencies = dynamicMatch[2]
  .split(",")
  .filter(Boolean)
  .map((index) => dependencyTable[Number(index)]?.replace("/assets/", ""));
assert.ok(dependencies.includes(proFabName), "Pro Fab graph must include its implementation");
for (const unrelated of [
  "PrecisionAerialProfile-",
  "SteelHomePackagesProfile-",
  "BuildingDesigner-",
  "CabinetDesigner-",
  "CountertopDesigner-",
]) {
  assert.equal(
    dependencies.some((name) => name?.startsWith(unrelated)),
    false,
    `Pro Fab graph must not preload ${unrelated}`
  );
}

console.log(
  `[pro-fab-chunk] profile ${core.length}/${gzipSync(core).length}; Pro Fab ${proFab.length}/${gzipSync(proFab).length}`
);
