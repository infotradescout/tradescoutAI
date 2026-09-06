import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
const source = read("client/src/pages/ProfileSiteView.tsx");
assert.doesNotMatch(source, /import WholesalerProfileTheme from/);
assert.match(source, /const WholesalerProfileTheme = lazy\(\s*\(\) => import\("@\/pages\/profile-sites\/WholesalerProfileTheme"\)\s*\)/);
assert.match(source, /import DefaultProfileTheme from/);

const branchStart = source.indexOf('if (siteTemplate === "wholesaler" || isTradePartner(business))');
const branchEnd = source.indexOf("\n  return (", branchStart);
assert.ok(branchStart >= 0 && branchEnd > branchStart, "Wholesaler selector changed");
const branch = source.slice(branchStart, branchEnd);
const owners = ["<SEOHelmet", "{manageChrome}", "<div\n", "<WholesalerProfileBoundary>", "<WholesalerProfileTheme\n", "</WholesalerProfileBoundary>", "</div>"];
let previous = -1;
for (const owner of owners) {
  const index = branch.indexOf(owner);
  assert.ok(index > previous, `${owner} changed Wholesaler ownership order`);
  previous = index;
}
assert.doesNotMatch(branch, /templateIndependentInventoryContext|ExpressDirectConnectPanel/);
assert.match(source, /data-testid="wholesaler-profile-loading"[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-busy="true"/);
for (const prop of [
  "profileSlug={profile.slug}", "displayName={displayName}", "businessAddress={publicBusinessAddress}",
  "headline={publicHeadline}", "contentBlocks={contentBlocks}", "categories={publicCategories}",
  "serviceAreas={publicServiceAreas}", "brandColors={business?.brandColors}",
  "contactReason={profile.contactPolicy?.reason}", "hasViewerSession={hasViewerSession}",
  "isSuperAdminViewer={isSuperAdminViewer}", "useExpressDirectConnect={useExpressDirectConnect}",
  "allowExpressCall={canExpressCall}", "profileShareDestination={profileShareDestination}",
  "currentPageShareDestination={currentPageShareDestination}",
  "sharedInventoryCategorySlug={categoryShareMeta?.categorySlug || null}", "platformBaseHref={platformBaseHref}",
  "sharedGallerySlug={sharedGallerySlug}", "tradeScoutReturnHref={tradeScoutReturnHref}",
  "directConnectHref={directConnectHref}", "preScoutCreateHref={preScoutCreateHref}",
  "preScoutSignInHref={preScoutSignInHref}", "recommendationsDirectory={recommendationsDirectory}",
  "recommendationDirectorySummary={recommendationDirectorySummary}",
  'trustActions={renderProfileTrustActions("light")}', "featuredStoneSlugs={featuredStoneSlugs}",
]) assert.ok(branch.includes(prop), `${prop} missing from Wholesaler branch`);
assert.match(branch, /currentPageShareTitle=\{\s*currentPageShareTitle === displayName[\s\S]*?`\$\{currentPageShareTitle\} \| \$\{displayName\}`[\s\S]*?\}/);
assert.match(branch, /profileItems=\{\s*hasVisiblePublicProfileItems\(profileItems, profileSections\)[\s\S]*?<PublicProfileItems[\s\S]*?\/>\s*\)\s*:\s*null\s*\}/);

const authority = read("shared/profileSiteTemplates.ts");
for (const law of [
  "const fromBlocks = readSiteTemplateIdFromBlocks(input.contentBlocks)",
  "if (fromBlocks) return fromBlocks",
  'if (slug === "jw-stone" || slug === "issa-build" || slug === "honey-onyx") return "wholesaler"',
  'if (input.tradePartner === true) return "wholesaler"',
]) assert.ok(authority.includes(law), `${law} changed template authority`);
assert.match(source, /resolveSiteTemplateId\(\{\s*slug: profile\.slug,\s*contentBlocks,\s*tradePartner: isTradePartner\(business\),\s*hasLocalServicePresentation:/);

const dispatcher = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
assert.match(dispatcher, /const normalizedSlug = props\.profileSlug\.trim\(\)\.toLowerCase\(\)/);
assert.match(dispatcher, /const JwStoneMarketplaceProfile = lazy\(\(\) => import\("\.\/JwStoneMarketplaceProfile"\)\)/);
assert.doesNotMatch(dispatcher, /import JwStoneMarketplaceProfile from/);
for (const [owner, modulePath] of [
  ["RedGranitiWebsiteProfile", "RedGranitiWebsiteProfile"],
  ["IssaBuildProfileTruthFrame", "IssaBuildProfileTruthFrame"],
  ["LegacyWholesalerProfileTheme", "WholesalerProfileThemeLegacy"],
]) {
  assert.match(dispatcher, new RegExp(`import ${owner} from "\\./${modulePath}"`));
  assert.doesNotMatch(dispatcher, new RegExp(`lazy\\([^)]*import\\("\\./${modulePath}"\\)`));
}
const dispatchOwners = [
  "if (isJwStoneProfile)",
  "<JwStoneMarketplaceProfile",
  "if (isRedGranitiProfile)",
  "<RedGranitiWebsiteProfile",
  "if (isIssaBuildProfile)",
  "<IssaBuildProfileTruthFrame",
  "<LegacyWholesalerProfileTheme",
];
let priorDispatch = -1;
for (const owner of dispatchOwners) {
  const index = dispatcher.indexOf(owner);
  assert.ok(index > priorDispatch, `${owner} changed dispatcher order`);
  priorDispatch = index;
}
for (const forwarding of [
  "profileActions={props.trustActions}",
  "profileCanonicalUrl={props.profileShareDestination}",
  "profileSlug={props.profileSlug}",
  "platformBaseHref={props.platformBaseHref}",
  "<IssaBuildProfileTruthFrame {...props} />",
  "<LegacyWholesalerProfileTheme {...props} />",
]) assert.ok(dispatcher.includes(forwarding), `${forwarding} changed dispatcher prop forwarding`);

const assetsDir = path.join(root, "dist/public/assets");
if (!existsSync(assetsDir)) { console.log("[wholesaler-chunk] source contracts verified"); process.exit(0); }
const html = read("dist/public/index.html");
const appName = html.match(/src="\/assets\/(app-[A-Za-z0-9_-]+\.js)"/)?.[1];
assert.ok(appName);
const appText = readFileSync(path.join(assetsDir, appName), "utf8");
const owned = (text, prefix) => {
  const names = [...text.matchAll(new RegExp(`(?:/assets/|\\./)(${prefix}[A-Za-z0-9_-]+\\.js)`, "g"))].map((match) => match[1]);
  assert.equal(new Set(names).size, 1, `expected one ${prefix} owner`);
  return names[0];
};
const coreName = owned(appText, "ProfileSiteView-");
const core = readFileSync(path.join(assetsDir, coreName));
const coreText = core.toString("utf8");
const outerName = owned(coreText, "WholesalerProfileTheme-");
const outer = readFileSync(path.join(assetsDir, outerName));
const outerText = outer.toString("utf8");
const jwName = owned(outerText, "JwStoneMarketplaceProfile-");
// Profile-specific install metadata added 818 raw bytes while the compressed
// core remained inside its established 75 kB limit. Keep that deliberate
// addition bounded to a 1 kB raw allowance instead of loosening gzip or lazy
// ownership limits.
assert.ok(core.length <= 286_000 && gzipSync(core).length <= 75_000, "Profile core budget exceeded");
assert.ok(outer.length <= 170_000 && gzipSync(outer).length <= 42_000, "Wholesaler outer budget exceeded");
for (const identity of ["jw-marketplace-scroll", "Loading JW Stone inventory", "R.E.D. GRANITI IN THE WORLD", "Kitchens, bathrooms and complete onyx projects."]) {
  assert.equal(coreText.includes(identity), false, `${identity} leaked into Profile core`);
  assert.equal(outerText.includes(identity), true, `${identity} missing from outer chunk`);
}

function table(text) {
  const helper = text.indexOf("const __vite__mapDeps=");
  const start = text.indexOf('["/assets/', helper);
  assert.ok(helper >= 0 && start >= 0, "dependency table missing");
  let string = false, escaped = false, depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (string) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') string = false; }
    else if (char === '"') string = true;
    else if (char === "[") depth += 1;
    else if (char === "]" && --depth === 0) {
      const parsed = JSON.parse(text.slice(start, index + 1));
      assert.ok(parsed.every((entry) => typeof entry === "string" && entry.startsWith("/assets/")));
      return parsed.map((entry) => entry.replace("/assets/", ""));
    }
  }
  assert.fail("unterminated dependency table");
}
const deps = (text, dependencyTable, prefix) => {
  const match = text.match(new RegExp(`import\\("\\./(${prefix}[A-Za-z0-9_-]+\\.js)"\\)(?:\\.then\\([^)]*\\))?,__vite__mapDeps\\(\\[([^\\]]*)\\]\\)`));
  assert.ok(match, `${prefix} graph missing`);
  return [...new Set(match[2].split(",").filter(Boolean).map((index) => dependencyTable[Number(index)]))];
};
const appTable = table(appText), coreTable = table(coreText), outerTable = table(outerText);
const profileBase = new Set(deps(appText, appTable, "ProfileSiteView-"));
for (const match of html.matchAll(/(?:src|href)="\/assets\/([A-Za-z0-9_.-]+\.(?:js|css))"/g)) profileBase.add(match[1]);
profileBase.add(appName);
const outerGraph = deps(coreText, coreTable, "WholesalerProfileTheme-");
const outerCold = outerGraph.filter((name) => !profileBase.has(name));
const sum = (names) => names.map((name) => readFileSync(path.join(assetsDir, name))).reduce((total, asset) => [total[0] + asset.length, total[1] + gzipSync(asset).length], [0, 0]);
const [outerRaw, outerGzip] = sum(outerCold);
assert.ok(outerCold.includes(outerName));
assert.ok(outerRaw <= 175_000 && outerGzip <= 45_000, `Wholesaler cold delta exceeded: ${outerRaw}/${outerGzip}`);
const outerBase = new Set([...profileBase, ...outerGraph]);
const jwGraph = deps(outerText, outerTable, "JwStoneMarketplaceProfile-");
const jwCold = jwGraph.filter((name) => !outerBase.has(name));
const [jwRaw, jwGzip] = sum(jwCold);
assert.ok(jwCold.includes(jwName));
assert.ok(jwCold.some((name) => name.startsWith("catalog-")), "nested JW delta missing catalog");
// Drive-backed member pricing intentionally adds a small amount to JW's inner
// lazy graph. Keep the reviewed raw allowance below 240 kB while preserving the
// established 72 kB compressed ceiling and nested ownership boundary.
assert.ok(jwRaw <= 240_000 && jwGzip <= 72_000, `nested JW cold delta exceeded reviewed pricing budget: ${jwRaw}/${jwGzip}`);
const siblingPrefixes = ["PrecisionAerialProfile-", "ProFabProfileTheme-", "JrsAutoGlassProfileTheme-", "VideographerProfileTheme-", "LocalServiceProfileTheme-", "SteelHomePackagesProfile-", "BuildingDesigner-", "CabinetDesigner-", "CountertopDesigner-", "three.module-"];
for (const prefix of siblingPrefixes) {
  assert.equal(outerGraph.some((name) => name?.startsWith(prefix)), false, `Wholesaler preloads ${prefix}`);
  assert.equal(jwGraph.some((name) => name?.startsWith(prefix)), false, `nested JW preloads ${prefix}`);
}

console.log(`[wholesaler-chunk] profile ${core.length}/${gzipSync(core).length}; outer ${outer.length}/${gzipSync(outer).length}; cold ${outerRaw}/${outerGzip}; JW delta ${jwRaw}/${jwGzip}`);
