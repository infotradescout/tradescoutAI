import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const profileSource = read("client/src/pages/ProfileSiteView.tsx");

assert.doesNotMatch(profileSource, /import VideographerProfileTheme from/);
assert.match(
  profileSource,
  /const VideographerProfileTheme = lazy\(\s*\(\) => import\("@\/pages\/profile-sites\/VideographerProfileTheme"\)\s*\)/,
  "Videographer must retain its dedicated lazy owner"
);
for (const staticTheme of ["DefaultProfileTheme", "WholesalerProfileTheme"]) {
  assert.match(profileSource, new RegExp(`import ${staticTheme}(?:,| from)`));
}

const branchStart = profileSource.indexOf('if (siteTemplate === "videographer")');
const branchEnd = profileSource.indexOf('if (siteTemplate === "wholesaler"', branchStart);
assert.ok(branchStart >= 0 && branchEnd > branchStart, "videographer template-only branch must remain");
const branch = profileSource.slice(branchStart, branchEnd);
assert.doesNotMatch(branch.slice(0, branch.indexOf("return")), /profile\.slug|\|\|/);
const orderedOwners = [
  "<SEOHelmet",
  "{manageChrome}",
  "{templateIndependentInventoryContext}",
  "<VideographerProfileBoundary>",
  "<VideographerProfileTheme\n",
  "</VideographerProfileBoundary>",
  "<ExpressDirectConnectPanel",
];
let previousIndex = -1;
for (const owner of orderedOwners) {
  const index = branch.indexOf(owner);
  assert.ok(index > previousIndex, `${owner} must retain videographer branch ownership order`);
  previousIndex = index;
}
assert.match(
  profileSource,
  /data-testid="videographer-profile-loading"[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-busy="true"/,
  "videographer fallback must remain branded and accessible"
);
for (const prop of [
  "profileSlug={profile.slug}",
  "platformBaseHref={platformBaseHref}",
  "businessName={displayName}",
  "headline={publicHeadline}",
  "contentBlocks={contentBlocks}",
  "services={serviceTags}",
  "serviceAreas={serviceAreas}",
  "aboutText={aboutText}",
  "galleryItems={galleryItems}",
  "sharedGallerySlug={sharedGallerySlug}",
  "profileShareDestination={profileShareDestination}",
  "onDirectConnect={openServiceDirectConnect}",
  "deliveryCustody={business?.expressContactCapabilities?.deliveryCustody}",
  'trustActions={renderProfileTrustActions("dark")}',
  'requestMode="service"',
  "initialServiceName={expressServiceContext}",
  'initialRequestType={expressServiceContext ? "request_service" : null}',
]) {
  assert.ok(branch.includes(prop), `${prop} must remain wired in the videographer branch`);
}
assert.match(
  branch,
  /profileItems=\{\s*hasVisiblePublicProfileItems\(profileItems, profileSections\)\s*\?\s*\(\s*<PublicProfileItems[\s\S]*?items=\{profileItems\}[\s\S]*?profileSections=\{profileSections\}[\s\S]*?platformBaseHref=\{platformBaseHref\}[\s\S]*?\/>\s*\)\s*:\s*null\s*\}/,
  "conditional PublicProfileItems ownership must remain inside the videographer theme props"
);

const themeSource = read("client/src/pages/profile-sites/VideographerProfileTheme.tsx");
for (const behavior of [
  'data-testid="videographer-profile"',
  'id="work"',
  'id="services"',
  "galleryItems.find",
  "safeFeaturedWorkUrl",
  "safeSocialUrl",
  "onDirectConnect(service.trim().slice(0, 180))",
  "TradeScoutProfileHandoff",
  "profile-trust-section",
]) {
  assert.ok(themeSource.includes(behavior), `${behavior} must remain in videographer theme`);
}

const assetsDir = path.join(root, "dist", "public", "assets");
if (!existsSync(assetsDir)) {
  console.log("[videographer-chunk] source contracts verified");
  process.exit(0);
}
const html = read("dist/public/index.html");
const appName = html.match(/src="\/assets\/(app-[A-Za-z0-9_-]+\.js)"/)?.[1];
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
const themeName = ownedChunk(coreText, "VideographerProfileTheme-");
const theme = readFileSync(path.join(assetsDir, themeName));
const builtTheme = theme.toString("utf8");

assert.ok(core.length <= 459_000, `profile core exceeded 459000 bytes: ${core.length}`);
assert.ok(gzipSync(core).length <= 114_000, "profile core exceeded 114000 gzip bytes");
assert.ok(theme.length <= 20_000, `videographer exceeded 20000 bytes: ${theme.length}`);
assert.ok(gzipSync(theme).length <= 6_500, "videographer exceeded 6500 gzip bytes");
for (const identity of [
  "Watch featured work",
  "Watch on Instagram",
  "Close portfolio image",
  "Watch on TikTok",
]) {
  assert.equal(coreText.includes(identity), false, `${identity} leaked into profile core`);
  assert.equal(builtTheme.includes(identity), true, `${identity} must remain in videographer chunk`);
}

function readViteDependencyTable(source) {
  const helperIndex = source.indexOf("const __vite__mapDeps=");
  assert.ok(helperIndex >= 0, "Vite dependency helper must remain inspectable");
  const tableStart = source.indexOf('["/assets/', helperIndex);
  assert.ok(tableStart >= 0, "Vite dependency table must remain inspectable");
  let inString = false;
  let escaped = false;
  let depth = 0;
  for (let index = tableStart; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "[") depth += 1;
    else if (character === "]" && --depth === 0) {
      const parsed = JSON.parse(source.slice(tableStart, index + 1));
      assert.ok(
        Array.isArray(parsed) && parsed.length > 0 &&
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
  /import\("\.\/(VideographerProfileTheme-[A-Za-z0-9_-]+\.js)"\),__vite__mapDeps\(\[([^\]]*)\]\)/
);
assert.ok(dynamicMatch, "videographer dynamic graph must remain inspectable");
const dependencies = dynamicMatch[2]
  .split(",")
  .filter(Boolean)
  .map((index) => dependencyTable[Number(index)]?.replace("/assets/", ""));
assert.ok(dependencies.includes(themeName), "videographer graph must include its implementation");
for (const unrelated of [
  "PrecisionAerialProfile-",
  "ProFabProfileTheme-",
  "JrsAutoGlassProfileTheme-",
  "SteelHomePackagesProfile-",
  "BuildingDesigner-",
  "CabinetDesigner-",
  "CountertopDesigner-",
  "three.module-",
  "JwStoneMarketplaceProfile-",
  "RedGranitiWebsiteProfile-",
]) {
  assert.equal(
    dependencies.some((name) => name?.startsWith(unrelated)),
    false,
    `videographer graph must not preload ${unrelated}`
  );
}

console.log(
  `[videographer-chunk] profile ${core.length}/${gzipSync(core).length}; theme ${theme.length}/${gzipSync(theme).length}`
);
