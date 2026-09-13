import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const repo = path.resolve(import.meta.dirname, "..");

function fixture(run) {
  const outputRoot = path.join(repo, "test-results");
  fs.mkdirSync(outputRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(outputRoot, "sitemap-generator-"));
  fs.mkdirSync(path.join(root, "scripts"));
  fs.mkdirSync(path.join(root, "client/public"), { recursive: true });
  fs.copyFileSync(path.join(repo, "scripts/generate-sitemap-core.mjs"), path.join(root, "scripts/generate-sitemap-core.mjs"));
  const clock = path.join(root, "clock.mjs");
  fs.writeFileSync(clock, `const OriginalDate = Date;
    globalThis.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : [process.env.SITEMAP_TEST_NOW])); }
      static now() { return new OriginalDate(process.env.SITEMAP_TEST_NOW).getTime(); }
    };`);
  const generate = (now) => {
    const result = spawnSync(process.execPath, ["--import", clock, path.join(root, "scripts/generate-sitemap-core.mjs")], {
      cwd: root, env: { ...process.env, SITEMAP_TEST_NOW: now }, encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    return Object.fromEntries(["sitemap.xml", "sitemap-index.xml"].map((name) => [name, fs.readFileSync(path.join(root, "client/public", name), "utf8")]));
  };
  try { run({ root, generate }); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("rebuilding on another day preserves both sitemap outputs byte for byte", () => fixture(({ generate }) => {
  const first = generate("2026-09-12T23:59:00Z");
  assert.deepEqual(generate("2026-09-13T00:01:00Z"), first);
  assert.deepEqual(generate("2036-01-01T00:00:00Z"), first);
}));

test("the index retains every submitted child and omits unknown child modification times", () => fixture(({ generate }) => {
  const index = generate("2036-01-01T00:00:00Z")["sitemap-index.xml"];
  assert.equal((index.match(/<sitemap>/g) || []).length, 17);
  assert(index.includes("https://www.thetradescout.com/sitemap-core.xml"));
  assert(index.includes("https://www.thetradescout.com/sitemap-exchange-listings.xml"));
  assert(!index.includes("<lastmod>"), "Build time is not a dynamic child sitemap's modification time");
}));

test("recorded route dates survive while routes without dates do not acquire build timestamps", () => fixture(({ root, generate }) => {
  fs.writeFileSync(path.join(root, "client/public/sitemap.xml"), `<urlset><url><loc>https://www.thetradescout.com/</loc><lastmod>2025-04-17</lastmod></url></urlset>`);
  const sitemap = generate("2036-01-01T00:00:00Z")["sitemap.xml"];
  assert(sitemap.includes("<lastmod>2025-04-17</lastmod>"));
  assert.equal((sitemap.match(/<lastmod>/g) || []).length, 1);
  assert(sitemap.includes("https://www.thetradescout.com/help"));
  assert(!sitemap.includes("2036-01-01"));
}));
