import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeFilesystemPlugin, guardedImport } from './esbuild-node-filesystem.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let resolve;
let load;
nodeFilesystemPlugin(root).setup({
  initialOptions: { external: ['express', '@vitejs/*'] },
  onResolve(_options, callback) { resolve = callback; },
  onLoad(_options, callback) { load = callback; },
});
const request = (specifier, kind = 'import-statement') => resolve({
  path: specifier, kind, resolveDir: root,
});

test('optional fallback requires every matching call to be inside a catching try block', () => {
  assert.equal(guardedImport("try { require('peer') } catch {}", 'peer'), true);
  assert.equal(guardedImport("require('peer')", 'peer'), false);
  assert.equal(guardedImport("try {} catch { require('peer') }", 'peer'), false);
  assert.equal(guardedImport("try { () => require('peer') } catch {}", 'peer'), false);
  assert.equal(guardedImport("try { require('peer') } catch {} require('peer')", 'peer'), false);
  assert.equal(guardedImport("try { await import('peer') } catch {}", 'peer', 'dynamic-import'), true);
  assert.equal(guardedImport("try { import('peer') } catch {}", 'peer', 'dynamic-import'), false);
  assert.equal(guardedImport("async function load() { try { return import('peer') } catch {} }", 'peer', 'dynamic-import'), false);
  assert.equal(guardedImport("async function load() { try { return await import('peer') } catch {} }", 'peer', 'dynamic-import'), true);
  assert.equal(guardedImport("import peer from 'peer'", 'peer', 'dynamic-import'), false);
});

test('preserves declared externals, subpaths, wildcards and builtins', () => {
  for (const name of ['express', 'express/lib/router', '@vitejs/plugin-react', 'node:fs', 'fs']) {
    assert.deepEqual(request(name), { path: name, external: true });
  }
  assert.equal(request('express-session').external, undefined);
});

test('resolves source entries and aliases through Node without native traversal', () => {
  assert.equal(request('server/index.ts', 'entry-point').path, path.join(root, 'server/index.ts'));
  const resolved = request('@shared/issaBuildPageContent');
  assert.equal(resolved.path, path.join(root, 'shared/issaBuildPageContent.ts'));
  const loaded = load(resolved);
  assert.equal(loaded.loader, 'ts');
  assert.ok(loaded.contents.length > 0);
  assert.equal(loaded.resolveDir, path.join(root, 'shared'));
});

test('resolves import and require packages and fails missing modules explicitly', () => {
  for (const kind of ['import-statement', 'require-call']) {
    const resolved = request('zod', kind);
    assert.equal(resolved.namespace, 'node-filesystem');
    assert.ok(path.isAbsolute(resolved.path));
  }
  assert.throws(() => request('tradescout-missing-build-contract-module'), /resolve/);
});
