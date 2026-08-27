import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const profileSource = read("client/src/pages/ProfileSiteView.tsx");

assert.doesNotMatch(
  profileSource,
  /import SteelHomePackagesProfile from/,
  "Steel Home must not return to the static profile graph"
);
assert.match(
  profileSource,
  /const SteelHomePackagesProfile = lazy\(\s*\(\) => import\("@\/pages\/profile-sites\/SteelHomePackagesProfile"\)/,
  "Steel Home must retain its dedicated lazy boundary"
);

for (const staticTheme of [
  "DefaultProfileTheme",
  "WholesalerProfileTheme",
  "LocalServiceProfileTheme",
]) {
  assert.match(
    profileSource,
    new RegExp(`import ${staticTheme}(?:,| from)`),
    `${staticTheme} must remain static`
  );
}

const steelBranch = profileSource.slice(profileSource.indexOf("if (isSteelHomePackagesProfileSlug"));
const seoIndex = steelBranch.indexOf("<SEOHelmet");
const manageIndex = steelBranch.indexOf("{manageChrome}");
const boundaryIndex = steelBranch.indexOf("<SteelHomeProfileBoundary>");
const steelComponentIndex = steelBranch.indexOf("<SteelHomePackagesProfile");
assert.ok(
  seoIndex >= 0 && manageIndex > seoIndex && boundaryIndex > manageIndex && steelComponentIndex > boundaryIndex,
  "SEO and manage chrome must remain mounted outside the nested Steel Home boundary"
);
assert.match(
  profileSource,
  /data-testid="steel-home-profile-loading"[\s\S]*?role="status"[\s\S]*?aria-live="polite"/,
  "Steel Home fallback must expose an accessible branded loading status"
);

for (const route of ["/u/:slug", "/u/:slug/:collection/:itemSlug", "/p/:slug", "/p/:slug/:collection/:itemSlug"]) {
  assert.ok(profileSource.includes(`useRoute("${route}")`), `${route} profile route must remain wired`);
}
assert.ok(
  profileSource.includes("__TS_CUSTOM_DOMAIN_PROFILE_SLUG__"),
  "custom-domain profile ownership must remain wired"
);
assert.match(profileSource, /requestHref=\{steelHomeRequestHref\}/);
assert.match(profileSource, /laborRequestHref=\{steelHomeLaborRequestHref\}/);
assert.match(profileSource, /initialBuilder=\{steelHomeBuilderRoute\}/);

const builderRoutes = read("shared/steelHomeBuilderRoutes.ts");
for (const [builder, slug] of [
  ["countertops", "countertops"],
  ["cabinets", "cabinets"],
  ["building", "metal-buildings"],
]) {
  assert.match(
    builderRoutes,
    new RegExp(`${builder}:\\s*["']${slug}["']`),
    `${builder} deep builder must remain canonical`
  );
}

const steelProfile = read("client/src/pages/profile-sites/SteelHomePackagesProfile.tsx");
assert.match(steelProfile, /window\.location\.hash/, "legacy hash selection must remain supported");
assert.match(steelProfile, /window\.localStorage/, "planner persistence must remain supported");
assert.match(steelProfile, /\.focus\(\)/, "planner close must restore focus");
assert.match(steelProfile, /requestHref/);
assert.match(steelProfile, /laborRequestHref/);

const assetsDir = path.join(root, "dist", "public", "assets");
if (!existsSync(assetsDir)) {
  console.log("[steel-home-lazy-boundary] source contracts verified");
  process.exit(0);
}

const builtHtml = read("dist/public/index.html");
const appName = builtHtml.match(/src="\/assets\/(app-[A-Za-z0-9_-]+\.js)"/)?.[1];
assert.ok(appName, "built app entry must be discoverable");
const appText = readFileSync(path.join(assetsDir, appName), "utf8");
const findOwnedChunk = (ownerText, prefix) => {
  const matches = [
    ...ownerText.matchAll(new RegExp(`/assets/(${prefix}[A-Za-z0-9_-]+\\.js)`, "g")),
  ].map((match) => match[1]);
  assert.equal(new Set(matches).size, 1, `expected one ${prefix} chunk in its current owner graph`);
  return matches[0];
};
const coreName = findOwnedChunk(appText, "ProfileSiteView-");
const core = readFileSync(path.join(assetsDir, coreName));
const steelName = findOwnedChunk(core.toString("utf8"), "SteelHomePackagesProfile-");
const steel = readFileSync(path.join(assetsDir, steelName));
const coreText = core.toString("utf8");
const steelText = steel.toString("utf8");

assert.ok(core.length <= 525_000, `profile core exceeded 525000 bytes: ${core.length}`);
assert.ok(gzipSync(core).length <= 130_000, "profile core exceeded its 130000-byte gzip budget");
for (const plannerIdentity of ["#building-designer", "#countertop-designer", "#cabinet-designer"]) {
  assert.equal(coreText.includes(plannerIdentity), false, `${plannerIdentity} leaked into profile core`);
}
assert.equal(coreText.includes("WebGLRenderer"), false, "WebGLRenderer leaked into profile core");

console.log(
  `[steel-home-lazy-boundary] profile ${core.length}/${gzipSync(core).length} bytes; Steel Home ${steel.length}/${gzipSync(steel).length} bytes`
);
