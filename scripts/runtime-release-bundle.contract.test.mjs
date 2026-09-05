import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function releaseLauncherFixture(t, layout) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryRoot, "tradescout-release-launcher-"));
  t.after(() => {
    assert.equal(path.dirname(directory), temporaryRoot);
    assert.ok(path.basename(directory).startsWith("tradescout-release-launcher-"));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const write = (relative, contents) => {
    const target = path.join(directory, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  };
  write("runtime/run-release.mjs", read("runtime/run-release.mjs"));
  const securityPath = `${layout === "source" ? "shared" : "runtime"}/database-url-security.mjs`;
  write(securityPath, read("shared/database-url-security.mjs"));
  write(
    layout === "source" ? "scripts/fixture-worker.mjs" : "dist/release/fixture-worker.mjs",
    `console.log(JSON.stringify({
      entrypoint: ${JSON.stringify(layout)},
      databaseSslmode: new URL(process.env.DATABASE_URL).searchParams.get("sslmode"),
      testDatabaseSslmode: new URL(process.env.TEST_DATABASE_URL).searchParams.get("sslmode"),
      sentinel: process.env.RELEASE_TEST_SENTINEL,
      args: process.argv.slice(2)
    }));`
  );
  return {
    directory,
    securityPath,
    write,
    run(overrides = {}) {
      return spawnSync(
        process.execPath,
        [
          path.join(directory, "runtime/run-release.mjs"),
          "fixture-worker",
          "scripts/fixture-worker.mjs",
          "--probe",
          "argument with spaces",
        ],
        {
          cwd: directory,
          encoding: "utf8",
          env: {
            ...process.env,
            NODE_OPTIONS: "",
            NODE_ENV: "production",
            DATABASE_URL: "postgresql://fixture:unused@primary.example/tradescout?sslmode=require",
            TEST_DATABASE_URL:
              "postgresql://fixture:unused@test.example/tradescout?sslmode=verify-ca",
            ALLOW_INSECURE_TEST_DATABASE: "true",
            RELEASE_TEST_SENTINEL: "preserved",
            ...overrides,
          },
        }
      );
    },
  };
}

for (const layout of ["source", "runtime"]) {
  test(`release launcher executes the ${layout} layout with certificate verification`, (t) => {
    const fixture = releaseLauncherFixture(t, layout);
    if (layout === "runtime") {
      assert.equal(fs.existsSync(path.join(fixture.directory, "shared")), false);
      assert.equal(fs.existsSync(path.join(fixture.directory, "scripts")), false);
    }
    const result = fixture.run();
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      entrypoint: layout,
      databaseSslmode: "verify-full",
      testDatabaseSslmode: "verify-full",
      sentinel: "preserved",
      args: ["--probe", "argument with spaces"],
    });
  });

  test(`release launcher rejects insecure remote URLs before executing the ${layout} worker`, (t) => {
    const fixture = releaseLauncherFixture(t, layout);
    for (const key of ["DATABASE_URL", "TEST_DATABASE_URL"]) {
      for (const mode of ["disable", "allow"]) {
        const result = fixture.run({
          [key]: `postgresql://fixture:unused@database.example/tradescout?sslmode=${mode}`,
        });
        assert.ifError(result.error);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /may not disable certificate verification/);
        assert.equal(result.stdout, "");
      }
    }
  });
}

test("release launcher does not fall back after a bundled security module fails", (t) => {
  const fixture = releaseLauncherFixture(t, "runtime");
  fixture.write("shared/database-url-security.mjs", read("shared/database-url-security.mjs"));
  fixture.write(
    fixture.securityPath,
    `${read("shared/database-url-security.mjs")}\nthrow new Error("Bundled security module failed");`
  );
  const result = fixture.run();
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Bundled security module failed/);
  assert.equal(result.stdout, "");
});

test("release launcher fails closed when neither security module is present", (t) => {
  const fixture = releaseLauncherFixture(t, "source");
  fs.unlinkSync(path.join(fixture.directory, fixture.securityPath));
  const result = fixture.run();
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ERR_MODULE_NOT_FOUND/);
  assert.equal(result.stdout, "");
});

test("production release entries are bundled with evidence and an external guard", () => {
  const source = read("build-server.mjs");
  for (const entry of [
    "ensure-public-media-ready",
    "migrate-jw-stone-public-media",
    "migrate-red-graniti-public-media",
    "migrate-profile-public-media",
    "db-migrate-safe",
    "db-baseline-drizzle",
    "check-required-production-schema",
    "seed-businesses-places-new",
  ]) {
    assert.match(source, new RegExp(`['\"]${entry}['\"]\\s*:`));
  }
  assert.match(source, /metafile:\s*true/);
  assert.match(source, /assertRuntimeExternals\(externals\)/);
  assert.match(source, /dist\/runtime-externals\.json/);
  assert.match(source, /runtime['"], ['"]package\.json/);
  assert.match(source, /releaseManifestDirectory/);
  assert.match(source, /public-shell-local-dedupe-manifest\.json/);
  assert.match(source, /outExtension:\s*\{ ['"]\.js['"]: ['"]\.mjs['"] \}/);
});

test("media readiness supports source and colocated bundled migrations", () => {
  const source = read("scripts/ensure-public-media-ready.mjs");
  assert.match(source, /findRuntimeRoot/);
  assert.match(source, /path\.join\(scriptDirectory, scriptName\)/);
  assert.match(source, /PUBLIC_MEDIA_MANIFEST_DIR/);
  assert.match(source, /scriptDirectory, "manifests", filename/);
});

test("all bundled migration workers resolve copied manifests", () => {
  const resolver = read("scripts/public-media-manifest-path.mjs");
  assert.match(resolver, /PUBLIC_MEDIA_MANIFEST_DIR/);
  assert.match(resolver, /scriptDirectory, "manifests", filename/);
  for (const script of [
    "scripts/migrate-jw-stone-public-media.mjs",
    "scripts/migrate-red-graniti-public-media.mjs",
    "scripts/migrate-profile-public-media.mjs",
  ]) {
    assert.match(read(script), /resolvePublicMediaManifest\(/);
    assert.doesNotMatch(
      read(script),
      /scripts\/data\/(jw-stone|red-graniti)-public-media-manifest/
    );
  }
});

test("bundled database repair launches its colocated baseline helper", () => {
  const source = read("scripts/db-migrate-safe.mjs");
  assert.match(source, /path\.join\(scriptDirectory, "db-baseline-drizzle\.mjs"\)/);
  assert.match(source, /node \$\{baselineEntrypoint\(\)\}/);
});

test("runtime entrypoint resolver prefers a built production worker and preserves dev source", () => {
  const source = read("server/runtimeEntrypoints.ts");
  assert.match(source, /process\.env\.NODE_ENV === "production"/);
  assert.match(source, /fs\.existsSync\(bundledPath\)/);
  assert.match(source, /return bundledPath/);
  assert.match(source, /return path\.join\(cwd, sourceRelativePath\)/);
});

test("admin seed execution resolves the stable runtime worker", () => {
  const source = read("server/routes/admin.ts");
  assert.match(source, /resolveRuntimeEntrypoint\(/);
  assert.match(source, /"seed-businesses-places-new\.mjs"/);
  assert.doesNotMatch(
    source,
    /spawn\(process\.execPath, \["scripts\/seed_businesses_places_new\.mjs"\]/
  );
});
