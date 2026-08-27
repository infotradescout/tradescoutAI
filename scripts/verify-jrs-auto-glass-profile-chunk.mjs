import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const profileSource = read("client/src/pages/ProfileSiteView.tsx");

assert.doesNotMatch(profileSource, /import JrsAutoGlassProfileTheme from/);
assert.match(
  profileSource,
  /const JrsAutoGlassProfileTheme = lazy\(\s*\(\) => import\("@\/pages\/profile-sites\/JrsAutoGlassProfileTheme"\)\s*\)/,
  "JR's Auto Glass must retain its dedicated lazy owner"
);
for (const staticTheme of [
  "DefaultProfileTheme",
  "WholesalerProfileTheme",
  "VideographerProfileTheme",
  "LocalServiceProfileTheme",
]) {
  assert.match(profileSource, new RegExp(`import ${staticTheme}(?:,| from)`));
}

const branchStart = profileSource.indexOf(
  'if (siteTemplate === "auto-glass" || profile.slug === "jrs-auto-glass")'
);
const branchEnd = profileSource.indexOf("// Legacy specialty shell", branchStart);
assert.ok(branchStart >= 0 && branchEnd > branchStart, "dual JRS selector branch must remain exact");
const branch = profileSource.slice(branchStart, branchEnd);
const orderedOwners = [
  "<SEOHelmet",
  "{manageChrome}",
  "{templateIndependentInventoryContext}",
  "<JrsAutoGlassProfileBoundary>",
  "<JrsAutoGlassProfileTheme\n",
  "</JrsAutoGlassProfileBoundary>",
  "<ExpressDirectConnectPanel",
];
let previousIndex = -1;
for (const owner of orderedOwners) {
  const index = branch.indexOf(owner);
  assert.ok(index > previousIndex, `${owner} must retain the JRS branch ownership order`);
  previousIndex = index;
}
assert.match(
  profileSource,
  /data-testid="jrs-auto-glass-profile-loading"[\s\S]*?role="status"[\s\S]*?aria-live="polite"/,
  "JRS fallback must remain branded and accessible"
);
for (const prop of [
  "profileSlug={profile.slug}",
  "platformBaseHref={platformBaseHref}",
  "onDirectConnect={openGeneralDirectConnect}",
  "hasViewerSession={hasViewerSession}",
  "tradeScoutReturnHref={tradeScoutReturnHref}",
  "profileShareDestination={profileShareDestination}",
  "publicRouteContentBlocks={contentBlocks}",
  "galleryItems={galleryItems}",
  "sharedGallerySlug={sharedGallerySlug}",
  "recommendationsDirectory={recommendationsDirectory}",
  'trustActions={renderProfileTrustActions("dark")}',
  'requestMode={expressInventoryContext ? "materials" : "auto_glass"}',
]) {
  assert.ok(branch.includes(prop), `${prop} must remain wired in the JRS branch`);
}

const themeSource = read("client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx");
for (const behavior of [
  "/images/businesses/jrs-auto-glass",
  "services.map",
  "profile-trust-section",
  "TradeScoutProfileHandoff",
  "galleryItems.length > 0 ? galleryItems.slice(0, 2) : defaultRecentWork",
  "buildProfilePublicItemPath({",
  'entry.recommendationType === "positive"',
  "publicRecommendations.slice(0, 6)",
]) {
  assert.ok(themeSource.includes(behavior), `${behavior} must remain in JRS Auto Glass`);
}
assert.equal((themeSource.match(/onClick=\{onDirectConnect\}/g) || []).length, 3);

const assetsDir = path.join(root, "dist", "public", "assets");
if (!existsSync(assetsDir)) {
  console.log("[jrs-auto-glass-chunk] source contracts verified");
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
const jrsName = ownedChunk(coreText, "JrsAutoGlassProfileTheme-");
const jrs = readFileSync(path.join(assetsDir, jrsName));
const jrsText = jrs.toString("utf8");

assert.ok(core.length <= 472_000, `profile core exceeded 472000 bytes: ${core.length}`);
assert.ok(gzipSync(core).length <= 117_000, "profile core exceeded 117000 gzip bytes");
assert.ok(jrs.length <= 13_000, `JRS exceeded 13000 bytes: ${jrs.length}`);
assert.ok(gzipSync(jrs).length <= 4_500, "JRS exceeded 4500 gzip bytes");
for (const identity of [
  "Mobile auto glass",
  "Rock chip repair",
  "Damage photos",
  "Send JR",
  "0 customer recommendations have been published.",
]) {
  assert.equal(coreText.includes(identity), false, `${identity} leaked into profile core`);
  assert.equal(jrsText.includes(identity), true, `${identity} must remain in JRS chunk`);
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
  /import\("\.\/(JrsAutoGlassProfileTheme-[A-Za-z0-9_-]+\.js)"\),__vite__mapDeps\(\[([^\]]*)\]\)/
);
assert.ok(dynamicMatch, "JRS dynamic graph must remain inspectable");
const dependencies = dynamicMatch[2]
  .split(",")
  .filter(Boolean)
  .map((index) => dependencyTable[Number(index)]?.replace("/assets/", ""));
assert.ok(dependencies.includes(jrsName), "JRS graph must include its implementation");
for (const unrelated of [
  "PrecisionAerialProfile-",
  "ProFabProfileTheme-",
  "SteelHomePackagesProfile-",
  "BuildingDesigner-",
  "CabinetDesigner-",
  "CountertopDesigner-",
]) {
  assert.equal(
    dependencies.some((name) => name?.startsWith(unrelated)),
    false,
    `JRS graph must not preload ${unrelated}`
  );
}

console.log(
  `[jrs-auto-glass-chunk] profile ${core.length}/${gzipSync(core).length}; JRS ${jrs.length}/${gzipSync(jrs).length}`
);
