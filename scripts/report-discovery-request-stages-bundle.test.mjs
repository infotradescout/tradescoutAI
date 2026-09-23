import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

test('bundled server import stays passive; original guard is a failing negative control', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'request-report-bundle-'));
  const current = path.resolve('scripts/report-discovery-request-stages.mjs');
  const source = await fs.readFile(current, 'utf8');
  const guardedLine = source.split('\n').find(line => line.startsWith('if(process.argv[1]'));
  assert(guardedLine?.includes('report-discovery-request-stages'));
  try {
    for (const [name, modulePath, expectedExit] of [['current', current, 0], ['negative', path.join(directory, 'old-report.mjs'), 1]]) {
      if (name === 'negative') await fs.writeFile(modulePath, source.replace(guardedLine, 'if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){'));
      const outfile = path.join(directory, name + '-server-entry.mjs');
      await build({ stdin: { contents: `import {validateWindow} from ${JSON.stringify(modulePath)}; console.log(JSON.stringify(validateWindow('2026-08-24T05:00:00Z','2026-09-21T05:00:00Z')));`, resolveDir: process.cwd(), sourcefile: 'server-entry.mjs', loader: 'js' }, bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile });
      const child = spawnSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 10000, env: { PATH: process.env.PATH, HOME: process.env.HOME } });
      assert.equal(child.status, expectedExit, child.stderr);
      assert.deepEqual(JSON.parse(child.stdout.trim()), { from: '2026-08-24T05:00:00.000Z', to: '2026-09-21T05:00:00.000Z' });
      if (name === 'current') assert.equal(child.stderr, '');
      else assert.match(child.stderr, /Acquisition report failed/);
    }
    const direct = spawnSync(process.execPath, [current, '--invalid=true'], { encoding: 'utf8', timeout: 10000, env: { PATH: process.env.PATH, HOME: process.env.HOME } });
    assert.equal(direct.status, 1); assert.match(direct.stderr, /Acquisition report failed/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
