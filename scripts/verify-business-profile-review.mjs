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
    const proofDir = path.join(candidate, '.business-profile-proof');
    const report = JSON.parse(await fs.readFile(path.join(proofDir, 'public-contact-result.json'), 'utf8'));
    assert.equal(report.source, head); assert.equal(report.passed, true);
    if (process.env.PROFILE_PROOF_MODE === 'production') {
      const expected = process.env.PROFILE_EXPECTED_COMMIT || '';
      assert.match(expected, /^[a-f0-9]{40}$/);
      run('git', ['fetch', '--no-tags', '--depth=1', 'https://github.com/infotradescout/tradescoutAI.git', expected], candidate);
      const tree = (ref) => execFileSync('git', ['rev-parse', `${ref}^{tree}`], { cwd: candidate, encoding: 'utf8' }).trim();
      assert.equal(tree(expected), tree(head), 'The live release must contain exactly the tested source');
      const origin = 'https://www.thetradescout.com';
      const live = { source: head, productionCommit: expected, startedAt: new Date().toISOString(), passed: false, pages: [], actualCallsMade: 0, customerSubmissions: 0 };
      const read = (pathname) => fetch(origin + pathname, { headers: { 'user-agent': 'TradeScout-Release-Verification/1.0 (read-only; no customer event)' }, signal: AbortSignal.timeout(45000) });
      const healthResponse = await read('/api/health');
      assert.equal(healthResponse.status, 200);
      const health = await healthResponse.json();
      assert.equal(health.commit, expected);
      assert.equal(healthResponse.headers.get('x-tradescout-build'), expected);
      assert.equal(health.database, 'connected');
      assert.equal(health.migrations.compatibility, 'compatible');
      live.health = health;
      for (const pathname of ['/issa-build', '/issa-build/onyx', '/issa-build/onyx/inventory/honey-onyx', '/issa-build/onyx/inventory/multi-green-onyx']) {
        const response = await read(pathname);
        assert.equal(response.status, 200, pathname);
        assert.equal(new URL(response.url).pathname, pathname);
        const html = await response.text();
        assert.ok(/data-public-profile-contact=["']true["']/.test(html), 'Visible server-rendered contact is required at ' + pathname);
        assert.ok(html.includes('href="tel:+18505430748"'), 'Approved native telephone destination is required at ' + pathname);
        assert.ok(html.includes('contact@thetradescout.com'));
        const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
        assert.equal(new URL(canonical).pathname, pathname);
        const identities = [];
        const visit = (value) => {
          if (Array.isArray(value)) { value.forEach(visit); return; }
          if (!value || typeof value !== 'object') return;
          if (value['@type'] === 'LocalBusiness' && value['@id'] === origin + '/issa-build#identity') identities.push(value);
          if (value['@graph']) visit(value['@graph']);
        };
        for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) visit(JSON.parse(match[1]));
        assert.ok(identities.length > 0, 'Actual business identity is required at ' + pathname);
        for (const identity of identities) {
          assert.equal(identity.telephone, '+18505430748');
          assert.equal(identity.contactPoint.email, 'contact@thetradescout.com');
          assert.equal(identity.contactPoint.contactType, 'TradeScout managed contact');
        }
        live.pages.push({ pathname, status: response.status, canonical, publicPhone: '+18505430748', visibleContact: true, matchingBusinessIdentity: true, passed: true });
      }
      const finalVersionResponse = await read('/api/version');
      assert.equal(finalVersionResponse.status, 200);
      const finalVersion = await finalVersionResponse.json();
      assert.equal(finalVersion.commit || finalVersion.buildRevision, expected);
      live.passed = true; live.completedAt = new Date().toISOString();
      await fs.writeFile(path.join(proofDir, 'live-contact-result.json'), JSON.stringify(live, null, 2));
      console.log('PUBLIC_CONTACT_LIVE_RESULT ' + JSON.stringify(live));
    }
    await fs.mkdir(path.join(root, '.business-profile-proof'), { recursive: true });
    await fs.cp(proofDir, path.join(root, '.business-profile-proof'), { recursive: true });
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
