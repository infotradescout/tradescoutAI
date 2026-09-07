import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

/** Opt-in isolated proof. Never accepts a remote database or production credentials. */
export async function verifyProfileRelease() {
  assert.notEqual(process.env.PROFILE_PROOF_MODE, 'production');
  assert.notEqual(process.getuid?.(), 0, 'Run the disposable server as an unprivileged build user');
  const root = process.cwd();
  const output = path.join(root, '.business-profile-proof');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const browser = JSON.parse(await fs.readFile(path.join(output, 'result.json'), 'utf8'));
  assert.equal(browser.source, head);
  assert.equal(browser.passed, true, 'The exact source must pass its browser checks first');
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tradescout-profile-disposable-'));
  await fs.chmod(tmp, 0o755);
  const releaseRoot = path.join(tmp, 'release');
  const record = { head, startedAt: new Date().toISOString(), commands: [], passed: false, databaseScope: 'Fresh loopback-only native PostgreSQL with the canonical full test fixture. Existing-schema compatibility; clean-bootstrap defect remains issue #598.', productionData: false };
  let started = false, worktreeCreated = false, workingDirectory = root, pgctl;
  const data = path.join(tmp, 'data');
  const command = (label, executable, args, options = {}) => {
    console.log('PROFILE_RELEASE_START ' + label);
    try {
      const value = execFileSync(executable, args, { cwd: workingDirectory, stdio: 'inherit', timeout: 900000, ...options });
      record.commands.push({ label, status: 'pass' });
      console.log('PROFILE_RELEASE_COMMAND ' + JSON.stringify({ label, status: 'pass' }));
      return value;
    } catch (error) {
      record.commands.push({ label, status: 'fail', exitCode: error.status ?? null });
      throw new Error(label + ' failed (exit ' + error.status + ')');
    }
  };
  try {
    // Preserve the browser build and its generated files. Run the unchanged gate in a fresh exact-head worktree instead of discarding edits.
    record.browserBuildChangedFiles = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    console.log('PROFILE_RELEASE_BROWSER_BUILD_FILES ' + JSON.stringify(record.browserBuildChangedFiles));
    command('create clean exact-head release worktree', 'git', ['worktree', 'add', '--detach', releaseRoot, head]);
    worktreeCreated = true;
    workingDirectory = releaseRoot;
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: releaseRoot, encoding: 'utf8' }).trim(), head);
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: releaseRoot, encoding: 'utf8' }).trim(), '');
    command('install dependencies in clean release worktree', 'npm', ['ci', '--include=dev']);

    const key = path.join(tmp, 'postgresql.asc');
    const response = await fetch('https://www.postgresql.org/media/keys/ACCC4CF8.asc', { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200);
    await fs.writeFile(key, await response.text());
    const fingerprints = execFileSync('gpg', ['--batch', '--show-keys', '--with-colons', key], { encoding: 'utf8' });
    assert.ok(fingerprints.split('\n').some((line) => line.startsWith('fpr:') && line.split(':')[9] === 'B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8'), 'Unexpected PostgreSQL signing key');
    const sourceList = path.join(tmp, 'postgresql.list');
    await fs.writeFile(sourceList, `deb [signed-by=${key}] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main\n`);
    for (const dir of ['lists/partial', 'cache/archives/partial', 'download', 'package']) await fs.mkdir(path.join(tmp, dir), { recursive: true });
    const apt = ['-o', `Dir::Etc::sourcelist=${sourceList}`, '-o', 'Dir::Etc::sourceparts=-', '-o', `Dir::State::lists=${path.join(tmp, 'lists')}`, '-o', `Dir::Cache=${path.join(tmp, 'cache')}`];
    command('verify signed native PostgreSQL package index', 'apt-get', [...apt, 'update']);
    const downloadDir = path.join(tmp, 'download');
    command('download signed-index PostgreSQL package without global installation', 'apt-get', [...apt, 'download', 'postgresql-17'], { cwd: downloadDir });
    const packages = (await fs.readdir(downloadDir)).filter((file) => /^postgresql-17_.*\.deb$/.test(file));
    assert.equal(packages.length, 1);
    const packageRoot = path.join(tmp, 'package');
    command('extract native server into disposable directory', 'dpkg-deb', ['-x', path.join(downloadDir, packages[0]), packageRoot]);
    const bin = path.join(packageRoot, 'usr/lib/postgresql/17/bin');
    pgctl = path.join(bin, 'pg_ctl');
    command('initialize empty native test database', path.join(bin, 'initdb'), ['-D', data, '-L', path.join(packageRoot, 'usr/share/postgresql/17'), '--encoding=UTF8', '--locale=C', '--auth=trust', '-U', 'profile_test']);
    const probe = net.createServer();
    await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    command('start native server on loopback only', pgctl, ['-D', data, '-l', path.join(tmp, 'postgres.log'), '-w', 'start', '-o', `-h 127.0.0.1 -p ${port} -k ${tmp}`]);
    started = true;
    const { default: pg } = await import('pg');
    const admin = new pg.Client({ connectionString: `postgres://profile_test@127.0.0.1:${port}/postgres` });
    await admin.connect();
    try { await admin.query('CREATE DATABASE tradescout_profile_test'); } finally { await admin.end(); }
    const url = `postgres://profile_test@127.0.0.1:${port}/tradescout_profile_test`;
    const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: url, TEST_DATABASE_URL: url, ALLOW_TEST_DB_FULL_SYNC: 'true', SKIP_TEST_DB_BOOTSTRAP: 'false' };
    command('canonical complete disposable test fixture', 'npm', ['run', 'db:bootstrap:test'], { env });
    command('canonical migration command on test database', 'npm', ['run', 'db:migrate'], { env });
    // Replay the documented fixture successors, not an invented reduced schema. See issue #598.
    const tags = ['0072_seo_publication_rules_and_freshness', '0115_profile_accounts', '0116_admin_live_stream_snapshots', '0117_managed_partner_intakes', '0118_profile_account_public_routes', '0130_business_managed_partner_contact'];
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      for (const tag of tags) {
        await client.query(await fs.readFile(path.join(releaseRoot, 'migrations', tag + '.sql'), 'utf8'));
        record.commands.push({ label: 'execute canonical SQL ' + tag, status: 'pass' });
      }
    } finally { await client.end(); }
    command('required canonical schema verification', 'npm', ['run', 'db:verify:required'], { env });
    const note = `Exact source ${head} passed the complete repository business-profile browser script in this run at ${browser.checkedAt}: all four viewports, actual image loading, unchanged copy, photo controls, separate Onyx and request-panel opening. No real request was sent. This unchanged gate runs in a separate clean checkout of that same source. This is not an authenticated membership or mailbox-delivery claim.`;
    command('unchanged complete minimum release contract', 'npm', ['run', 'gate:minimum-release', '--', '--browser-proof=manual', '--browser-note=' + note], { env });
    const evidencePath = path.join(releaseRoot, 'artifacts/release-contract', head.slice(0, 12), 'evidence.json');
    record.gate = JSON.parse(await fs.readFile(evidencePath, 'utf8'));
    assert.equal(record.gate.commit, head);
    assert.equal(record.gate.result, 'pass');
    await fs.copyFile(evidencePath, path.join(output, 'release-evidence.json'));
    record.passed = true;
  } catch (error) {
    record.error = error.message;
    process.exitCode = 1;
  } finally {
    let safeToRemove = true;
    if (started) {
      try { command('stop disposable native database', pgctl, ['-D', data, '-m', 'fast', '-w', 'stop']); }
      catch (error) { record.passed = false; record.shutdownError = error.message; process.exitCode = 1; safeToRemove = false; }
    }
    if (worktreeCreated && safeToRemove) {
      try { command('remove only the disposable proof checkout', 'git', ['worktree', 'remove', '--force', releaseRoot], { cwd: root }); }
      catch (error) { record.cleanupWarning = error.message; }
    }
    record.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(output, 'release-result.json'), JSON.stringify(record, null, 2));
    console.log('PROFILE_RELEASE_RESULT ' + JSON.stringify(record));
    if (safeToRemove) await fs.rm(tmp, { recursive: true, force: true });
  }
}
