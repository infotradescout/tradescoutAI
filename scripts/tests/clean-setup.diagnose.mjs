import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';

// The initial per-file diagnostic is preserved in the branch history and its
// first two build records. Release acceptance now uses the real command chain,
// independent parent validation, complete regression suite, and clean checkout.
assert.ok(!process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL, 'Supplied database targets are forbidden');
const root = process.cwd();
const git = (args) => {
  const result = spawnSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(result.status, 0, result.stderr || 'Git source identity check failed');
  return result.stdout.trim();
};
const source = git(['rev-parse', 'HEAD']);
assert.match(source, /^[a-f0-9]{40}$/);
// Render's disposable checkout may omit the origin remote. The repository is
// public; add only its canonical read endpoint so genuine controls can be read.
if (spawnSync('git', ['remote', 'get-url', 'origin'], { stdio: 'ignore' }).status !== 0) {
  git(['remote', 'add', 'origin', 'https://github.com/infotradescout/tradescoutAI.git']);
}
const original = '38ffc9422faa20967aa7c9f982a434287a403b04';
if (spawnSync('git', ['cat-file', '-e', original + '^{commit}'], { stdio: 'ignore' }).status !== 0) {
  git(['fetch', '--no-tags', '--depth=1', 'origin', original]);
}
const requireNative = createRequire('/tmp/tradescout-clean-dependencies/package.json');
const status = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['scripts/tests/database-bootstrap.native.mjs'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, EMBEDDED_POSTGRES_MODULE: requireNative.resolve('embedded-postgres'),
      DB598_ISOLATE_CHECKOUT: '1', DB598_EXPECTED_HEAD: source, DB598_FULL_RELEASE: '1' },
  });
  child.once('error', reject);
  child.once('close', (code) => resolve(code ?? 1));
});
assert.equal(status, 0, 'The independent database proof parent rejected this candidate');
const evidence = path.join(root, '.db-bootstrap-proof');
const report = JSON.parse(await fs.readFile(path.join(evidence, 'result.json'), 'utf8'));
assert.equal(report.source, source);
assert.equal(report.passed, true);
assert.equal(report.databaseCleanup, 'stopped');
assert.equal(report.publicationCases?.length, 22);
assert.ok(report.publicationCases.every((item) => item.passed === true));
assert.equal(report.scenarios?.length, 12);
assert.ok(report.scenarios.every((item) => item.passed === true));
const release = JSON.parse(await fs.readFile(path.join(evidence, 'release-evidence.json'), 'utf8'));
assert.equal(release.commit, source);
assert.equal(release.result, 'pass');
assert.ok(release.steps.length > 0 && release.steps.every((item) => item.status === 'pass'));
const publish = path.join(root, '.clean-setup-diagnostic');
await fs.rm(publish, { recursive: true, force: true });
await fs.cp(evidence, publish, { recursive: true });
console.log('CLEAN_SETUP_RELEASE_ACCEPTED ' + JSON.stringify({ source, scenarios: report.scenarios.length, publicationCases: report.publicationCases.length, passed: true }));
