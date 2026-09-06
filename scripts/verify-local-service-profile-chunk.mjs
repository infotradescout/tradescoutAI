import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const source = read("client/src/pages/ProfileSiteView.tsx");

assert.doesNotMatch(source, /import LocalServiceProfileTheme(?:,| from)/);
assert.match(
  source,
  /const LocalServiceProfileTheme = lazy\(\s*\(\) => import\("@\/pages\/profile-sites\/LocalServiceProfileTheme"\)\s*\)/
);
for (const staticTheme of ["DefaultProfileTheme"]) {
  assert.match(source, new RegExp(`import ${staticTheme}(?:,| from)`));
}

const selector = `if (
    resolvedLocalServicePresentation &&
    (siteTemplate === "plumbing-company" ||
      siteTemplate === "electrician-solo" ||
      resolvedLocalServicePresentation.template === "local-service")
  )`;
const branchStart = source.indexOf(selector);
const branchEnd = source.indexOf('if (siteTemplate === "financial-professional")', branchStart);
assert.ok(branchStart >= 0 && branchEnd > branchStart, "LocalService selector precedence changed");
const branch = source.slice(branchStart, branchEnd);
const pipeline = `const storedLocalServicePresentation = contentBlocks.find(
    (block: any) => block?.type === "localServiceProfile"
  )?.data as LocalServiceProfilePresentation | undefined;
  const localServicePresentation =
    profile.slug === LA_PLUMBING_PROFILE_SLUG
      ? LA_PLUMBING_PROFILE_PRESENTATION
      : storedLocalServicePresentation;
  const siteTemplate = resolveSiteTemplateId({
    slug: profile.slug,
    contentBlocks,
    tradePartner: isTradePartner(business),
    hasLocalServicePresentation: Boolean(localServicePresentation?.template === "local-service"),
  });`;
assert.ok(source.includes(pipeline), "stored/LA/template LocalService authority pipeline changed");
assert.match(
  source,
  /const resolvedLocalServicePresentation =\s*localServicePresentation \|\|\s*\(\(siteTemplate === "plumbing-company" \|\| siteTemplate === "electrician-solo"\) &&[\s\S]*?seedBlocksForTemplate\(siteTemplate, contentBlocks, \{[\s\S]*?displayName,[\s\S]*?\}\)[\s\S]*?entry\.type === "localServiceProfile"/,
  "presentation-first and seeded plumbing/electric fallback pipeline changed"
);
for (const earlierBranch of [
  "if (isSteelHomePackagesProfileSlug(profile.slug))",
  "if (profile.slug === PRECISION_AERIAL_PROFILE_SLUG)",
  'if (siteTemplate === "auto-glass" || profile.slug === "jrs-auto-glass")',
  'if (profile.slug === "pro-fab-specialty-services")',
]) {
  assert.ok(
    source.indexOf(earlierBranch) < branchStart,
    `${earlierBranch} must precede LocalService`
  );
}
const owners = [
  "<SEOHelmet",
  "{manageChrome}",
  "{templateIndependentInventoryContext}",
  "<LocalServiceProfileBoundary>",
  "<LocalServiceProfileTheme\n",
  "</LocalServiceProfileBoundary>",
  "<ExpressDirectConnectPanel",
];
let previous = -1;
for (const owner of owners) {
  const index = branch.indexOf(owner);
  assert.ok(index > previous, `${owner} changed LocalService ownership order`);
  previous = index;
}
assert.match(
  source,
  /data-testid="local-service-profile-loading"[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-busy="true"/
);
for (const prop of [
  "profileSlug={profile.slug}",
  "platformBaseHref={platformBaseHref}",
  "businessName={displayName}",
  "presentation={resolvedLocalServicePresentation}",
  "onDirectConnect={openServiceDirectConnect}",
  "canCall={canExpressCall}",
  "hasViewerSession={hasViewerSession}",
  "tradeScoutReturnHref={tradeScoutReturnHref}",
  "profileShareDestination={profileShareDestination}",
  "publicRouteContentBlocks={contentBlocks}",
  "galleryItems={galleryItems}",
  "sharedGallerySlug={sharedGallerySlug}",
  'recommendationDirectoryMode === "received"',
  "profileSections.reviews !== false",
  "initialServiceName={expressInventoryContext ? null : expressServiceContext}",
  'initialView={canExpressCall ? "choice" : "request"}',
  "deliveryCustody={business?.expressContactCapabilities?.deliveryCustody}",
  "stayInProfile",
  "trustActions={renderProfileTrustActions(",
  'resolvedLocalServicePresentation.layout === "project-profile" ? "light" : "dark"',
  'resolvedLocalServicePresentation.layout === "project-profile" ? "compact" : "default"',
  "verificationStatus={business?.verificationStatus}",
  "verifiedBadge={business?.verifiedBadge === true}",
  "communityVerification={business?.communityVerification}",
])
  assert.ok(branch.includes(prop), `${prop} is missing from LocalService branch`);
assert.match(
  branch,
  /profileItems=\{\s*hasVisiblePublicProfileItems\(profileItems, profileSections\)[\s\S]*?<PublicProfileItems[\s\S]*?\/>\s*\)\s*:\s*null\s*\}/
);

const themeSource = read("client/src/pages/profile-sites/LocalServiceProfileTheme.tsx");
for (const identity of [
  "trackProfileAction",
  "navigator.sendBeacon",
  'openProtectedContact("request", "mobile_bar")',
  'entry.recommendationType === "positive" && entry.comment.trim().length > 0',
  "publicRecommendations.slice(0, 6)",
  "setActiveGalleryIndex",
  "Community Verification Score",
  "Powered by TradeScout",
])
  assert.ok(themeSource.includes(identity), `${identity} left LocalService implementation`);
assert.doesNotMatch(themeSource, /href=["'](?:tel|mailto):/);

const assetsDir = path.join(root, "dist/public/assets");
if (!existsSync(assetsDir)) {
  console.log("[local-service-chunk] source contracts verified");
  process.exit(0);
}
const html = read("dist/public/index.html");
const appName = html.match(/src="\/assets\/(app-[A-Za-z0-9_-]+\.js)"/)?.[1];
assert.ok(appName);
const appText = readFileSync(path.join(assetsDir, appName), "utf8");
const owned = (text, prefix) => {
  const names = [
    ...text.matchAll(new RegExp(`(?:/assets/|\\./)(${prefix}[A-Za-z0-9_-]+\\.js)`, "g")),
  ].map((match) => match[1]);
  assert.equal(new Set(names).size, 1, `expected one ${prefix} owner`);
  return names[0];
};
const coreName = owned(appText, "ProfileSiteView-");
const core = readFileSync(path.join(assetsDir, coreName));
const coreText = core.toString("utf8");
const themeName = owned(coreText, "LocalServiceProfileTheme-");
const theme = readFileSync(path.join(assetsDir, themeName));
const builtTheme = theme.toString("utf8");
const coreGzip = gzipSync(core).length;
const themeGzip = gzipSync(theme).length;
assert.ok(core.length <= 435_000, `profile core exceeded 435000: ${core.length}`);
assert.ok(coreGzip <= 109_000, `profile core gzip exceeded 109000: ${coreGzip}`);
assert.ok(theme.length <= 38_000, `LocalService exceeded 38000: ${theme.length}`);
assert.ok(themeGzip <= 12_000, `LocalService gzip exceeded 12000: ${themeGzip}`);
for (const identity of [
  "Ask about financing",
  "Community Verification Score",
  "View credential numbers",
  "Active policy boosts:",
]) {
  assert.equal(coreText.includes(identity), false, `${identity} leaked into profile core`);
  assert.equal(builtTheme.includes(identity), true, `${identity} missing from LocalService chunk`);
}

function dependencyTable(text) {
  const helper = text.indexOf("const __vite__mapDeps=");
  const start = text.indexOf('["/assets/', helper);
  assert.ok(helper >= 0 && start >= 0, "Vite dependency table missing");
  let string = false,
    escaped = false,
    depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (string) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') string = false;
    } else if (char === '"') string = true;
    else if (char === "[") depth += 1;
    else if (char === "]" && --depth === 0) {
      const parsed = JSON.parse(text.slice(start, index + 1));
      assert.ok(parsed.every((entry) => typeof entry === "string" && entry.startsWith("/assets/")));
      return parsed;
    }
  }
  assert.fail("unterminated dependency table");
}
const table = dependencyTable(coreText);
const dynamic = coreText.match(
  /import\("\.\/(LocalServiceProfileTheme-[A-Za-z0-9_-]+\.js)"\),__vite__mapDeps\(\[([^\]]*)\]\)/
);
assert.ok(dynamic, "LocalService dynamic graph missing");
const graph = dynamic[2]
  .split(",")
  .filter(Boolean)
  .map((index) => table[Number(index)]?.replace("/assets/", ""));
assert.ok(graph.includes(themeName));
for (const prefix of [
  "PrecisionAerialProfile-",
  "ProFabProfileTheme-",
  "JrsAutoGlassProfileTheme-",
  "VideographerProfileTheme-",
  "SteelHomePackagesProfile-",
  "BuildingDesigner-",
  "CabinetDesigner-",
  "CountertopDesigner-",
  "three.module-",
  "JwStoneMarketplaceProfile-",
  "RedGranitiWebsiteProfile-",
]) {
  assert.equal(
    graph.some((name) => name?.startsWith(prefix)),
    false,
    `LocalService graph preloads ${prefix}`
  );
}

const appTable = dependencyTable(appText);
const baseDynamic = appText.match(
  /import\("\.\/(ProfileSiteView-[A-Za-z0-9_-]+\.js)"\)\.then\([^)]*\),__vite__mapDeps\(\[([^\]]*)\]\)/
);
assert.ok(baseDynamic, "Profile base dependency graph missing");
const profileBaseGraph = new Set(
  baseDynamic[2]
    .split(",")
    .filter(Boolean)
    .map((index) => appTable[Number(index)]?.replace("/assets/", ""))
);
for (const match of html.matchAll(/(?:src|href)="\/assets\/([A-Za-z0-9_.-]+\.(?:js|css))"/g)) {
  profileBaseGraph.add(match[1]);
}
profileBaseGraph.add(appName);
const coldNames = [...new Set(graph)].filter((name) => name && !profileBaseGraph.has(name));
for (const prefix of [
  "LocalServiceProfileTheme-",
  "badge-check-",
  "hard-hat-",
  "calendar-clock-",
  "wallet-cards-",
]) {
  assert.ok(
    coldNames.some((name) => name.startsWith(prefix)),
    `cold LocalService delta missing ${prefix}`
  );
}
const coldAssets = coldNames.map((name) => readFileSync(path.join(assetsDir, name)));
const coldRaw = coldAssets.reduce((total, asset) => total + asset.length, 0);
const coldGzip = coldAssets.reduce((total, asset) => total + gzipSync(asset).length, 0);
assert.ok(coldRaw <= 35_000, `LocalService cold raw delta exceeded 35000: ${coldRaw}`);
assert.ok(coldGzip <= 10_000, `LocalService cold gzip delta exceeded 10000: ${coldGzip}`);

console.log(
  `[local-service-chunk] profile ${core.length}/${coreGzip}; theme ${theme.length}/${themeGzip}; cold delta ${coldRaw}/${coldGzip}`
);
