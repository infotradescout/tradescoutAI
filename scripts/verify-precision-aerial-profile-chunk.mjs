import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const profileSource = read("client/src/pages/ProfileSiteView.tsx");

assert.doesNotMatch(profileSource, /import PrecisionAerialProfile from/);
assert.match(
  profileSource,
  /const PrecisionAerialProfile = lazy\(\s*\(\) => import\("@\/pages\/profile-sites\/PrecisionAerialProfile"\)/,
  "Precision Aerial must retain its dedicated lazy owner"
);
for (const staticTheme of [
  "DefaultProfileTheme",
]) {
  assert.match(profileSource, new RegExp(`import ${staticTheme}(?:,| from)`));
}

const branchStart = profileSource.indexOf("if (profile.slug === PRECISION_AERIAL_PROFILE_SLUG)");
const branchEnd = profileSource.indexOf('if (siteTemplate === "auto-glass"', branchStart);
assert.ok(branchStart >= 0 && branchEnd > branchStart, "exact Precision Aerial slug branch must remain");
const branch = profileSource.slice(branchStart, branchEnd);
const orderedOwners = [
  "<SEOHelmet",
  "{manageChrome}",
  "{templateIndependentInventoryContext}",
  "<PrecisionAerialProfileBoundary>",
  "<PrecisionAerialProfile\n",
  "</PrecisionAerialProfileBoundary>",
  "<ExpressDirectConnectPanel",
];
let previousIndex = -1;
for (const owner of orderedOwners) {
  const index = branch.indexOf(owner);
  assert.ok(index > previousIndex, `${owner} must retain Precision branch ownership order`);
  previousIndex = index;
}
assert.match(
  profileSource,
  /data-testid="precision-aerial-profile-loading"[\s\S]*?role="status"[\s\S]*?aria-live="polite"/,
  "Precision Aerial fallback must remain branded and accessible"
);
for (const prop of [
  "profileSlug={profile.slug}",
  "platformBaseHref={platformBaseHref}",
  "contentBlocks={contentBlocks}",
  "galleryItems={galleryItems}",
  "sharedGallerySlug={sharedGallerySlug}",
  "profileShareDestination={profileShareDestination}",
  "profileShareImage={seoImage}",
  "onDirectConnect={openServiceDirectConnect}",
  'requestMode="service"',
  "initialServiceName={expressServiceContext}",
  "stayInProfile",
]) {
  assert.ok(branch.includes(prop), `${prop} must remain wired in the exact-slug branch`);
}
assert.ok(profileSource.includes("__TS_CUSTOM_DOMAIN_PROFILE_SLUG__"));

const precisionSource = read("client/src/pages/profile-sites/PrecisionAerialProfile.tsx");
for (const behavior of [
  "precision-aerial-hero-video",
  "precision-aerial-work",
  "precision-primary-direct-connect",
  "precision-project-brief-submit",
  "profileShareDestination",
  "buildProfilePublicItemPath",
  "onDirectConnect",
]) {
  assert.ok(precisionSource.includes(behavior), `${behavior} must remain in Precision Aerial`);
}

const assetsDir = path.join(root, "dist", "public", "assets");
if (!existsSync(assetsDir)) {
  console.log("[precision-aerial-chunk] source contracts verified");
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
const precisionName = ownedChunk(coreText, "PrecisionAerialProfile-");
const precision = readFileSync(path.join(assetsDir, precisionName));
const precisionText = precision.toString("utf8");

assert.ok(core.length <= 490_000, `profile core exceeded 490000 bytes: ${core.length}`);
assert.ok(gzipSync(core).length <= 121_000, "profile core exceeded its 121000-byte gzip budget");
assert.ok(precision.length <= 22_000, `Precision Aerial exceeded 22000 bytes: ${precision.length}`);
assert.ok(gzipSync(precision).length <= 7_000, "Precision Aerial exceeded 7000 gzip bytes");
for (const identity of [
  "precision-aerial-hero-video",
  "precision-aerial-work",
  "precision-primary-direct-connect",
  "precision-project-brief-submit",
]) {
  assert.equal(coreText.includes(identity), false, `${identity} leaked into profile core`);
  assert.equal(precisionText.includes(identity), true, `${identity} must remain in Precision chunk`);
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
  /import\("\.\/(PrecisionAerialProfile-[A-Za-z0-9_-]+\.js)"\),__vite__mapDeps\(\[([^\]]*)\]\)/
);
assert.ok(dynamicMatch, "Precision Aerial dynamic graph must remain inspectable");
const dependencies = dynamicMatch[2]
  .split(",")
  .filter(Boolean)
  .map((index) => dependencyTable[Number(index)]?.replace("/assets/", ""));
assert.ok(dependencies.includes(precisionName), "Precision graph must include its implementation");
for (const unrelated of ["SteelHomePackagesProfile-", "BuildingDesigner-", "CabinetDesigner-", "CountertopDesigner-"]) {
  assert.equal(
    dependencies.some((name) => name?.startsWith(unrelated)),
    false,
    `Precision graph must not preload ${unrelated}`
  );
}

console.log(
  `[precision-aerial-chunk] profile ${core.length}/${gzipSync(core).length}; Precision ${precision.length}/${gzipSync(precision).length}`
);
