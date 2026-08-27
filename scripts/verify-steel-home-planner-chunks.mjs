import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");
const source = read("client/src/pages/profile-sites/SteelHomePackagesProfile.tsx");
const planners = ["BuildingDesigner", "CabinetDesigner", "CountertopDesigner"];

for (const planner of planners) {
  assert.doesNotMatch(
    source,
    new RegExp(`import ${planner} from`),
    `${planner} must not be static`
  );
  assert.match(
    source,
    new RegExp(
      `const ${planner} = lazy\\(\\(\\) => import\\("\\./steel-home-project-tools/${planner}"\\)\\)`
    ),
    `${planner} must own an independent lazy import`
  );
}
assert.match(
  source,
  /<PlannerBodyBoundary plannerTitle=\{activeBuilder\.title\}>/,
  "planner fallback must identify the selected planner"
);
assert.match(
  source,
  /data-testid="steel-home-planner-loading"[\s\S]*?role="status"[\s\S]*?aria-live="polite"/,
  "planner body fallback must remain accessible"
);
for (const behavior of [
  "window.location.hash",
  "window.localStorage",
  "window.history.pushState",
  'window.addEventListener("hashchange"',
  'window.addEventListener("popstate"',
  "requestAnimationFrame",
  "requestHref={requestHref}",
  "laborRequestHref={laborRequestHref}",
]) {
  assert.ok(source.includes(behavior), `${behavior} orchestration must remain in the Steel shell`);
}

const assetsDir = path.join(root, "dist", "public", "assets");
if (!existsSync(assetsDir)) {
  console.log("[steel-home-planner-chunks] source contracts verified");
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
const coreText = readFileSync(path.join(assetsDir, coreName), "utf8");
const steelName = ownedChunk(coreText, "SteelHomePackagesProfile-");
const steel = readFileSync(path.join(assetsDir, steelName));
const steelText = steel.toString("utf8");

assert.ok(steel.length <= 120_000, `Steel directory exceeded 120000 bytes: ${steel.length}`);
assert.ok(gzipSync(steel).length <= 38_000, "Steel directory exceeded its 38000-byte gzip budget");
for (const implementationIdentity of [
  "WebGLRenderer",
  "steel-home-building-include",
  "steel-home-cabinet-designer",
  "steel-home-countertop-designer",
]) {
  assert.equal(
    steelText.includes(implementationIdentity),
    false,
    `${implementationIdentity} leaked into the base Steel directory`
  );
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
    else if (character === "]") {
      depth -= 1;
      if (depth === 0) {
        const parsed = JSON.parse(builtSource.slice(tableStart, index + 1));
        assert.ok(
          Array.isArray(parsed) &&
            parsed.length > 0 &&
            parsed.every((entry) => typeof entry === "string" && entry.startsWith("/assets/")),
          "Vite dependency table must be a non-empty public-asset string array"
        );
        return parsed;
      }
    }
  }
  assert.fail("Vite dependency table did not terminate");
}

const dependencyTable = readViteDependencyTable(steelText);
const plannerMetrics = {};
const implementationIdentityByPlanner = {
  BuildingDesigner: "steel-home-building-include",
  CabinetDesigner: "steel-home-cabinet-designer",
  CountertopDesigner: "steel-home-countertop-designer",
};

for (const planner of planners) {
  const dynamicMatch = steelText.match(
    new RegExp(
      `import\\("\\./(${planner}-[A-Za-z0-9_-]+\\.js)"\\),__vite__mapDeps\\(\\[([^\\]]*)\\]\\)`
    )
  );
  assert.ok(dynamicMatch, `${planner} dynamic graph must remain inspectable`);
  const dependencies = dynamicMatch[2]
    .split(",")
    .filter(Boolean)
    .map((index) => dependencyTable[Number(index)]?.replace("/assets/", ""));
  assert.ok(
    dependencies.includes(dynamicMatch[1]),
    `${planner} graph must include its implementation`
  );
  for (const sibling of planners.filter((candidate) => candidate !== planner)) {
    assert.equal(
      dependencies.some((name) => name?.startsWith(`${sibling}-`)),
      false,
      `${planner} graph must not preload sibling ${sibling}`
    );
  }
  const chunk = readFileSync(path.join(assetsDir, dynamicMatch[1]));
  assert.ok(
    chunk.includes(implementationIdentityByPlanner[planner]),
    `${planner} chunk must retain its own implementation identity`
  );
  assert.ok(chunk.length <= 55_000, `${planner} exceeded 55000 bytes: ${chunk.length}`);
  assert.ok(gzipSync(chunk).length <= 16_000, `${planner} exceeded its 16000-byte gzip budget`);
  plannerMetrics[planner] = `${chunk.length}/${gzipSync(chunk).length}`;
}

const cabinetName = ownedChunk(steelText, "CabinetDesigner-");
const cabinetText = readFileSync(path.join(assetsDir, cabinetName), "utf8");
const threeName = ownedChunk(cabinetText, "three.module-");
const three = readFileSync(path.join(assetsDir, threeName), "utf8");
assert.ok(
  three.includes("WebGLRenderer"),
  "Three/WebGL must remain owned by a selected 3D planner graph"
);
assert.equal(
  steelText.includes(`from"./${threeName}"`),
  false,
  "base Steel directory must not import Three"
);

console.log(
  `[steel-home-planner-chunks] directory ${steel.length}/${gzipSync(steel).length}; ${Object.entries(
    plannerMetrics
  )
    .map(([name, bytes]) => `${name} ${bytes}`)
    .join(", ")}; Three ${three.length}/${gzipSync(three).length}`
);
