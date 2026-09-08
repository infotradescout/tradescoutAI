import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertNoUnreviewedDynamicLandingMedia,
  assertPublicShellSourceTotals,
  gitBlobSha,
  publicShellSourceStats,
  validatePublicShellDedupeManifest,
} from "./public-shell-local-dedupe-core.mjs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(
  fs.readFileSync(
    new URL("./data/public-shell-local-dedupe-manifest.json", import.meta.url),
    "utf8"
  )
);

function publicSourceFixture(t) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryRoot, "tradescout-public-source-"));
  t.after(() => {
    assert.equal(path.dirname(directory), temporaryRoot);
    assert.ok(path.basename(directory).startsWith("tradescout-public-source-"));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

test("source totals treat LF and CRLF alike without changing UTF-8, BOM, or media bytes", (t) => {
  const directory = publicSourceFixture(t);
  const extensions = ["css", "html", "js", "json", "svg", "txt", "webmanifest", "xml"];
  const source = Buffer.from("\uFEFFfirst café line\nsecond line\n");
  const binary = Buffer.from([0x89, 0, 13, 10, 0xff, 13, 10]);
  for (const extension of extensions)
    fs.writeFileSync(path.join(directory, `source.${extension}`), source);
  fs.mkdirSync(path.join(directory, "nested"));
  fs.writeFileSync(path.join(directory, "nested", "image.png"), binary);
  const expected = {
    files: extensions.length + 1,
    bytes: extensions.length * source.length + binary.length,
  };
  assert.deepEqual(publicShellSourceStats(directory), expected);
  for (const extension of extensions) {
    fs.writeFileSync(
      path.join(directory, `source.${extension}`),
      source.toString("utf8").replace(/\n/g, "\r\n")
    );
  }
  assert.deepEqual(publicShellSourceStats(directory), expected);
  assert.deepEqual(fs.readFileSync(path.join(directory, "nested", "image.png")), binary);
  assert.notEqual(gitBlobSha(binary), gitBlobSha(Buffer.from([0x89, 0, 10, 0xff, 10])));
});

test("source totals still reject real text, final-newline, binary, and file-count changes", (t) => {
  const directory = publicSourceFixture(t);
  const sourcePath = path.join(directory, "sitemap.xml");
  const mediaPath = path.join(directory, "icon.png");
  const originalSource = "<urlset>\n</urlset>\n";
  const originalMedia = Buffer.from([0, 13, 10, 0xff]);
  fs.writeFileSync(sourcePath, originalSource);
  fs.writeFileSync(mediaPath, originalMedia);
  const stats = publicShellSourceStats(directory);
  const expected = { clientPublicFiles: stats.files, clientPublicBytes: stats.bytes };
  const verify = () => assertPublicShellSourceTotals(publicShellSourceStats(directory), expected);
  assert.doesNotThrow(verify);
  for (const changed of [originalSource + " ", originalSource.trimEnd(), originalSource + "\r"]) {
    fs.writeFileSync(sourcePath, changed);
    assert.throws(verify, /totals changed without review/);
  }
  fs.writeFileSync(sourcePath, originalSource);
  fs.writeFileSync(mediaPath, Buffer.from([0, 10, 0xff]));
  assert.throws(verify, /totals changed without review/);
  fs.writeFileSync(mediaPath, originalMedia);
  fs.writeFileSync(path.join(directory, "extra.txt"), "");
  assert.throws(verify, /totals changed without review/);
});

test("text normalization refuses invalid UTF-8 and binary content disguised as source", (t) => {
  const directory = publicSourceFixture(t);
  const sourcePath = path.join(directory, "source.svg");
  fs.writeFileSync(sourcePath, Buffer.from([0xff, 13, 10]));
  assert.throws(() => publicShellSourceStats(directory), /encoded data was not valid/);
  fs.writeFileSync(sourcePath, Buffer.from([0, 13, 10]));
  assert.throws(() => publicShellSourceStats(directory), /Invalid public shell source text/);
});

test("Release B pins six redirects and four dead paths after deleting only their local bytes", () => {
  assert.deepEqual(validatePublicShellDedupeManifest(manifest), {
    files: 10,
    bytes: 1433218,
    aliases: 6,
    deadPinned: 4,
    digest: "cc384baaf127ea06cfd89e6e12f15d1a4d1eb5a0b9189aa6b26ba097ca530839",
  });
  for (const entry of manifest.entries) {
    assert.equal(fs.existsSync(new URL(`client/public/${entry.publicPath.slice(1)}`, root)), false);
  }
});

test("every removed alias retains an exact canonical file", () => {
  for (const entry of manifest.entries.filter((candidate) => candidate.kind === "alias")) {
    const canonical = fs.readFileSync(
      new URL(`client/public/${entry.canonicalPath.slice(1)}`, root)
    );
    assert.equal(canonical.length, entry.bytes);
    assert.equal(gitBlobSha(canonical), entry.gitBlobSha);
  }
});

test("unsafe or changed alias contracts fail closed", () => {
  const unsafe = structuredClone(manifest);
  unsafe.entries[0].publicPath = "/%2e%2e/private.png";
  assert.throws(() => validatePublicShellDedupeManifest(unsafe), /Unsafe public shell path/);
  const changed = structuredClone(manifest);
  changed.entries[0].canonicalPath = changed.entries[0].publicPath;
  assert.throws(() => validatePublicShellDedupeManifest(changed), /Unsafe public shell alias/);
  const contentType = structuredClone(manifest);
  contentType.entries[0].contentType = "application/octet-stream";
  assert.throws(
    () => validatePublicShellDedupeManifest(contentType),
    /Invalid public shell content type/
  );
});

test("production route order canonicalizes removed aliases before identity and static serving", () => {
  const server = fs.readFileSync(new URL("../server/index.ts", import.meta.url), "utf8");
  const alias = server.indexOf("registerPublicShellAliasRoutes(app)");
  const identity = server.indexOf("const identityAssets = new Set", alias);
  const identityGet = server.indexOf("app.get(Array.from(identityAssets)", identity);
  const staticServe = server.indexOf("express.static(publicDistPath", identityGet);
  assert.ok(alias >= 0 && identity > alias && identityGet > identity && staticServe > identityGet);
});

test("dead landing paths stay reference-free while live owners remain explicit", () => {
  const verifier = fs.readFileSync(
    new URL("./verify-public-shell-local-dedupe.mjs", import.meta.url),
    "utf8"
  );
  assert.match(verifier, /dead-pinned/);
  assert.match(verifier, /Dead pinned shell path regained production references/);
  assert.match(verifier, /Live landing ownership changed/);
  assert.match(verifier, /assertNoUnreviewedDynamicLandingMedia\(sourceByPath, \[\]\)/);
});

test("dynamic landing media construction is rejected in every non-reviewed production source", () => {
  const clean = new Map([
    ["client/src/pages/landingVariants.ts", 'const hero = "/landing/hero.jpg";'],
  ]);
  assert.doesNotThrow(() => assertNoUnreviewedDynamicLandingMedia(clean, []));

  const mutated = new Map(clean);
  mutated.set(
    "client/src/pages/unrelated-production-source.ts",
    "const image = `/landing/${variant}.webp`;"
  );
  assert.throws(
    () => assertNoUnreviewedDynamicLandingMedia(mutated, []),
    /Dynamic landing media construction requires explicit review: client\/src\/pages\/unrelated-production-source\.ts/
  );
  assert.doesNotThrow(() =>
    assertNoUnreviewedDynamicLandingMedia(mutated, [
      "client/src/pages/unrelated-production-source.ts",
    ])
  );
});
