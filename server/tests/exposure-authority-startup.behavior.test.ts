import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";

const root = process.cwd();
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "exposure-startup-regression-"));
const sourcePath = path.resolve("server/services/exposureAuthority.ts");
const source = await fs.readFile(sourcePath, "utf8");
afterAll(async () => { await fs.rm(temporary, { recursive: true, force: true }); });

async function execute(initialization: "current" | "old-static-import") {
  // The application authority source and real Drizzle predicate are bundled.
  // A late storage consumer and the asynchronous database dependency reproduce
  // the initializer ordering from the actual compiled production entry.
  const authoritySource = initialization === "current" ? source
    : 'import { storage } from "../storage";\n' + source.replace('  const { storage } = await import("../storage");\n', "");
  const outfile = path.join(temporary, initialization + ".mjs");
  await build({
    stdin: { contents: `
      import assert from 'node:assert/strict';
      import { buildExposureAuthorityMap, hasExposureAuthority, exposureAuthoritySqlPredicate } from ${JSON.stringify(sourcePath)};
      import { sql } from 'drizzle-orm';
      const { storage } = await import('fixture-storage');
      assert.equal(storage.ready, true);
      assert(exposureAuthoritySqlPredicate(sql.raw('seller_id')));
      assert.deepEqual(await buildExposureAuthorityMap([]), {});
      assert.equal(storage.calls, 0);
      assert.deepEqual(await buildExposureAuthorityMap(['allowed','unverified','missing','allowed',' ']), { allowed:true, unverified:false, missing:false });
      assert.equal(await hasExposureAuthority('allowed'), true);
      assert.equal(await hasExposureAuthority('unverified'), false);
      console.log('EXPOSURE_STARTUP_PASS');
    `, resolveDir: root, sourcefile: "exposure-startup-entry.ts", loader: "ts" },
    outfile, bundle: true, platform: "node", format: "esm", target: "node20", logLevel: "silent",
    plugins: [{ name: "isolated-storage-cycle", setup(builder) {
      builder.onResolve({ filter: /^fixture-(storage|database)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      builder.onResolve({ filter: /^\.\.\/storage$/ }, args => args.importer === sourcePath
        ? { path: "fixture-storage", namespace: "fixture" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
        loader: "ts", resolveDir: root, contents: args.path === "fixture-database"
          ? 'await Promise.resolve(); export const ready = true;'
          : `
          import { ready } from 'fixture-database';
          import { exposureAuthoritySqlPredicate } from ${JSON.stringify(sourcePath)};
          import { sql } from 'drizzle-orm';
          if (!ready || !exposureAuthoritySqlPredicate(sql.raw('seller_id'))) throw new Error('Missing database or canonical SQL predicate');
          export const storage = {
            ready:true, calls:0,
            async getUsersByIds(ids) { this.calls++; return ids.filter(id=>id!=='missing').map(id=>({id,emailVerified:id==='allowed',addressVerified:true})); },
            async getUserVerificationSummary() { return {}; }
          };
        `,
      }));
      builder.onLoad({ filter: /exposureAuthority\.ts$/ }, args => args.path === sourcePath ? { contents: authoritySource, loader: "ts", resolveDir: path.dirname(sourcePath) } : undefined);
    } }],
  });
  return spawnSync(process.execPath, [outfile], { encoding: "utf8", timeout: 10000, env: { PATH: process.env.PATH, NODE_ENV: "test" } });
}

describe("Compiled exposure authority startup", () => {
  it("reproduces exit 13 for the former static-storage dependency and boots the current exact module", async () => {
    const old = await execute("old-static-import");
    expect(old.status, old.stderr).toBe(13);
    expect(old.stdout).not.toContain("EXPOSURE_STARTUP_PASS");
    const current = await execute("current");
    expect(current.error).toBeUndefined();
    expect(current.status, current.stderr).toBe(0);
    expect(current.stdout).toContain("EXPOSURE_STARTUP_PASS");
  });
});
