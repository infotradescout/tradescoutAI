import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, createContext } from 'node:vm';

for (const verdict of [0, 1]) {
  test('explicit verdict ' + verdict + ' survives a fixed-zero beforeExit hook and flushes both pipes', () => {
    const script = `import { finishProofCli } from ${JSON.stringify(new URL('./finish-proof-cli.mjs', import.meta.url).href)};
      process.once('beforeExit', () => process.exit(0));
      process.stdout.write('x'.repeat(131072)); process.stderr.write('y'.repeat(131072));
      await finishProofCli(${verdict});`;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 10000 });
    assert.equal(child.status, verdict);
    assert.equal(child.stdout, 'x'.repeat(131072)); assert.equal(child.stderr, 'y'.repeat(131072));
  });
}

test('a failed output flush forces failure even when the proof verdict was success', async () => {
  let exitCode, stderrFlushed = false;
  const context = createContext({ process: {
    stdout: { write(_value, done) { done(new Error('Synthetic flush error')); } },
    stderr: { write(_value, done) { setImmediate(() => { stderrFlushed = true; done(); }); } },
    exit(code) { assert.equal(stderrFlushed, true, 'The other pipe must finish flushing too'); exitCode = code; },
  } });
  const module = new SourceTextModule(await readFile(new URL('./finish-proof-cli.mjs', import.meta.url), 'utf8'), { context });
  await module.link(() => { throw new Error('Unexpected dependency'); }); await module.evaluate();
  await module.namespace.finishProofCli(0);
  assert.equal(exitCode, 1);
});
