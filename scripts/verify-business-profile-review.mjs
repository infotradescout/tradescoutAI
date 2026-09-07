// Preserve the original review path. The contact repair is checked from its own exact source.
if (process.env.PROFILE_PUBLIC_CONTACT_RELEASE === '1') {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const assert = (await import('node:assert/strict')).default;
  const { execFileSync } = await import('node:child_process');
  const root = process.cwd();
  const head = process.env.PROFILE_CONTACT_EXPECTED_HEAD || '';
  assert.match(head, /^[a-f0-9]{40}$/);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'contact-review-checkout-'));
  const candidate = path.join(temporary, 'candidate');
  const env = { ...process.env };
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'BASE_URL', 'APP_URL', 'SKIP_NPM_CI', 'SKIP_TEST_DB_BOOTSTRAP']) delete env[key];
  const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, env, stdio: 'inherit', timeout: 1800000 });
  let added = false;
  try {
    run('git', ['fetch', '--no-tags', '--depth=1', 'https://github.com/infotradescout/tradescoutAI.git', head]);
    run('git', ['worktree', 'add', '--detach', candidate, head]); added = true;
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: candidate, encoding: 'utf8' }).trim(), head);
    run('npm', ['ci', '--include=dev'], candidate);
    run(process.execPath, ['scripts/verify-business-profile-review.mjs'], candidate);
    const report = JSON.parse(await fs.readFile(path.join(candidate, '.business-profile-proof/public-contact-result.json'), 'utf8'));
    assert.equal(report.source, head); assert.equal(report.passed, true);
    await fs.mkdir(path.join(root, '.business-profile-proof'), { recursive: true });
    await fs.cp(path.join(candidate, '.business-profile-proof'), path.join(root, '.business-profile-proof'), { recursive: true });
  } finally {
    if (added) run('git', ['worktree', 'remove', '--force', candidate]);
    await fs.rm(temporary, { recursive: true, force: true });
  }
} else {
  // Keep the actual browser checks unchanged; optional release proof uses only a disposable database.
  await import('./verify-business-profile-browser.mjs');
  if (process.env.PROFILE_RUN_MINIMUM_GATE === '1' && process.env.PROFILE_PROOF_MODE !== 'production' && !process.exitCode) {
    const { verifyProfileRelease } = await import('./verify-business-profile-release.mjs');
    await verifyProfileRelease();
  }
}
