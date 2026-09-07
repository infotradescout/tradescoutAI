import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';

export async function verifyPublicContactRelease() {
  const root = process.cwd();
  const base = 'c638746e0e80e22cb76f275e97ece6ebe44d320c';
  const repository = 'https://github.com/infotradescout/tradescoutAI.git';
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'public-contact-release-'));
  const env = { ...process.env, PROFILE_PUBLIC_CONTACT_RELEASE: '0', PROFILE_EXPECT_PUBLIC_CONTACT: '1' };
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'BASE_URL', 'APP_URL', 'SKIP_NPM_CI', 'SKIP_TEST_DB_BOOTSTRAP']) delete env[key];
  const run = (command, args, cwd = root, overrides = {}) => execFileSync(command, args, { cwd, env: { ...env, ...overrides }, stdio: 'inherit', timeout: 1800000 });
  const git = (args, cwd = root) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim();
  const source = git(['rev-parse', 'HEAD']);
  assert.match(process.env.PROFILE_CONTACT_EXPECTED_HEAD || '', /^[a-f0-9]{40}$/);
  assert.equal(source, process.env.PROFILE_CONTACT_EXPECTED_HEAD);
  const result = { source, base, startedAt: new Date().toISOString(), mode: process.env.PROFILE_PROOF_MODE || 'preview', passed: false, actualCallsMade: 0, customerSubmissions: 0 };
  const configuration = '.public-contact.vitest.config.mjs';
  const testFile = 'server/tests/public-profile-contact.behavior.test.tsx';
  const config = `import {defineConfig} from 'vitest/config';import path from 'node:path';export default defineConfig({esbuild:{jsx:'automatic'},resolve:{alias:{'@':path.resolve('client/src'),'@shared':path.resolve('shared')}},test:{environment:'node',pool:'forks',maxWorkers:1,minWorkers:1,setupFiles:[],include:['${testFile}']}});`;
  let control;
  try {
    console.log('PUBLIC_CONTACT_RELEASE_START ' + JSON.stringify(result));
    for (const reference of [base, '908d2d4e2c76141ffe2cdcfa52e756dfb52fae84', '38ffc9422faa20967aa7c9f982a434287a403b04', '701ffd407e2619d6e1259b46e1b9fe97c3108c63']) {
      if (spawnSync('git', ['cat-file', '-e', `${reference}^{commit}`], { cwd: root }).status !== 0) run('git', ['fetch', '--no-tags', '--depth=1', repository, reference]);
    }
    run('git', ['diff', '--check', base, source]);
    await fs.writeFile(configuration, config);
    try { run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', configuration]); }
    finally { await fs.rm(configuration, { force: true }); }
    result.focusedTests = 'passed';
    if (result.mode === 'preview') {
      control = path.join(temporary, 'unchanged-control');
      run('git', ['worktree', 'add', '--detach', control, base]);
      await fs.symlink(path.join(root, 'node_modules'), path.join(control, 'node_modules'), 'dir');
      await fs.copyFile(path.join(root, 'shared/publicProfileContact.ts'), path.join(control, 'shared/publicProfileContact.ts'));
      await fs.copyFile(path.join(root, testFile), path.join(control, testFile));
      await fs.writeFile(path.join(control, configuration), config);
      const reportPath = path.join(temporary, 'negative-control.json');
      const negative = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', configuration, '--reporter=json', '--outputFile=' + reportPath], { cwd: control, env, stdio: 'inherit' });
      const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
      assert.notEqual(negative.status, 0);
      assert.ok(report.numTotalTests > 0 && report.numFailedTests >= 5, 'Reproduce failed behavior, not a broken test runner');
      result.negativeControl = { source: base, total: report.numTotalTests, failed: report.numFailedTests };
      console.log('PUBLIC_CONTACT_NEGATIVE_CONTROL ' + JSON.stringify(result.negativeControl));
      run('git', ['worktree', 'remove', '--force', control]); control = null;
      const dependencies = path.join(temporary, 'native-dependencies');
      run('npm', ['install', '--prefix', dependencies, '--no-audit', '--no-fund', '--package-lock=false', 'embedded-postgres@18.4.0-beta.17']);
      const nativeModule = createRequire(import.meta.url).resolve('embedded-postgres', { paths: [dependencies] });
      run(process.execPath, ['scripts/tests/database-bootstrap.native.mjs'], root, { EMBEDDED_POSTGRES_MODULE: nativeModule, DB598_ISOLATE_CHECKOUT: '1', DB598_FULL_RELEASE: '1', DB598_EXPECTED_HEAD: source, PROFILE_PROOF_MODE: 'preview', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'remote.origin.url', GIT_CONFIG_VALUE_0: repository });
      const database = JSON.parse(await fs.readFile('.db-bootstrap-proof/result.json', 'utf8'));
      assert.equal(database.source, source); assert.equal(database.passed, true); assert.equal(database.scenarios.length, 12);
      result.minimumRelease = 'passed'; result.databaseScenarios = database.scenarios.length;
    }
    run(process.execPath, ['scripts/verify-business-profile-review.mjs'], root, { PROFILE_PROOF_MODE: result.mode });
    const browser = JSON.parse(await fs.readFile('.business-profile-proof/result.json', 'utf8'));
    assert.equal(browser.source, source); assert.equal(browser.passed, true);
    assert.ok(browser.pages.length === 4 && browser.pages.every((page) => page.publicContact?.tel === '+18505430748'));
    result.browserViewports = browser.pages.map(({ size, passed, publicContact }) => ({ size, passed, publicContact }));
    if (result.mode === 'preview') {
      await fs.cp('.db-bootstrap-proof', '.business-profile-proof/full-release', { recursive: true });
    }
    result.passed = true; result.completedAt = new Date().toISOString();
    await fs.writeFile('.business-profile-proof/public-contact-result.json', JSON.stringify(result, null, 2));
    console.log('PUBLIC_CONTACT_RELEASE_RESULT ' + JSON.stringify(result));
  } catch (error) {
    result.failure = error.message;
    console.error('PUBLIC_CONTACT_RELEASE_FAILURE ' + JSON.stringify(result));
    throw error;
  } finally {
    await fs.rm(configuration, { force: true });
    if (control) run('git', ['worktree', 'remove', '--force', control]);
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
