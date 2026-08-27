import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("production runner uses a positive artifact and dependency allowlist", () => {
  const dockerfile = read("Dockerfile");
  assert.match(dockerfile, /FROM node:20-alpine AS runtime-deps/);
  assert.match(dockerfile, /COPY runtime\/package\.json runtime\/package-lock\.json/);
  assert.match(dockerfile, /npm ci --omit=dev && node smoke-runtime-dependencies\.mjs/);
  assert.match(dockerfile, /COPY --from=runtime-deps \/runtime\/node_modules \.\/node_modules/);
  assert.match(dockerfile, /node runtime\/verify-built-runtime\.mjs/);
  assert.match(dockerfile, /RENDER=false node dist\/release\/ensure-public-media-ready\.mjs/);
  for (const rootName of ["server", "shared", "scripts", "client", "docs", "data"]) {
    assert.doesNotMatch(
      dockerfile,
      new RegExp(`COPY --from=builder /app/${rootName} \\./${rootName}`)
    );
  }
  assert.match(dockerfile, /COPY --from=builder \/app\/server\/cache \.\/runtime\/scout-cache/);
  assert.match(dockerfile, /COPY --from=builder \/app\/migrations \.\/migrations/);
});

test("runtime lock retains the root security/version overrides used to generate it", () => {
  const rootPackage = JSON.parse(read("package.json"));
  const runtimePackage = JSON.parse(read("runtime/package.json"));
  assert.deepEqual(runtimePackage.overrides, rootPackage.overrides);
});

test("Render lifecycle invokes only compiled release entrypoints", () => {
  const dockerfile = read("Dockerfile");
  const blueprint = read("render.yaml");
  assert.match(dockerfile, /node dist\/release\/ensure-public-media-ready\.mjs/);
  assert.doesNotMatch(dockerfile, /node scripts\//);
  assert.match(blueprint, /node dist\/release\/migrate-red-graniti-public-media\.mjs/);
  assert.match(blueprint, /node dist\/release\/migrate-jw-stone-public-media\.mjs/);
  assert.match(blueprint, /node dist\/release\/db-migrate-safe\.mjs/);
  assert.match(blueprint, /node dist\/release\/check-required-production-schema\.mjs/);
  assert.doesNotMatch(blueprint, /preDeployCommand:.*npm run/);
  for (const runtimePath of [
    "TRADESCOUT_RUNTIME_DIR\n        value: /app/runtime",
    "SCOUT_CACHE_DIR\n        value: /app/runtime/scout-cache",
    "UPLOAD_DIR\n        value: /app/runtime/uploads/public",
    "PRIVATE_UPLOAD_DIR\n        value: /app/runtime/uploads/private",
  ]) {
    assert.match(blueprint, new RegExp(runtimePath));
  }
});

test("legacy service npm lifecycle commands select compiled release workers", () => {
  const packageJson = JSON.parse(read("package.json"));
  for (const [scriptName, builtName] of [
    ["db:migrate", "db-migrate-safe"],
    ["db:verify:required", "check-required-production-schema"],
    ["media:migrate:red-graniti", "migrate-red-graniti-public-media"],
    ["media:migrate:jw-stone", "migrate-jw-stone-public-media"],
  ]) {
    assert.match(packageJson.scripts[scriptName], new RegExp(`runtime/run-release\\.mjs ${builtName}`));
  }
});

test("immutable production disables source mutation and source static fallbacks", () => {
  const sourceFixes = read("server/ai-code-fixes.ts");
  const uiIssues = read("server/routes/admin/ui-issues.ts");
  const socialPreview = read("server/socialPreviewCardRenderer.ts");
  assert.match(sourceFixes, /RUNTIME_SOURCE_MUTATION_DISABLED/);
  assert.match(sourceFixes, /process\.env\.NODE_ENV !== "production"/);
  assert.match(uiIssues, /process\.env\.NODE_ENV === "production" \? \[\] : newIssues/);
  assert.match(socialPreview, /process\.env\.NODE_ENV === "production"/);
});
