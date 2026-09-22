// Existing Exchange executor. Legacy proof is preserved byte-for-byte next to this dispatcher.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const candidate = process.env.EXCHANGE_STONE_CANDIDATE;
if (process.env.EXCHANGE_STONE_OBSERVE_COMMIT) {
  assert(!candidate, 'Read-only production observation is separate from candidate execution');
  for (const key of ['DATABASE_URL','TEST_DATABASE_URL','SESSION_SECRET','STONE_METRICS_SECRET','STRIPE_SECRET_KEY','BREVO_API_KEY','SENDGRID_API_KEY','RESEND_API_KEY','SMTP_PASS','STONE_RETAIL_LAUNCH_MODE','STONE_RETAIL_LAUNCH_URL']) assert(!process.env[key], 'Observer must not inherit live credentials or publication authority');
  await import('./observe-stone-publication.mjs');
} else if (!candidate) {
  await import('./verify-exchange-batch-legacy.mjs');
} else {
  assert.match(candidate, /^[a-f0-9]{40}$/, 'Exact committed stone candidate required');
  assert(process.env.EXCHANGE_BATCH_OUTPUT, 'Existing executor evidence location required');
  for (const key of ['DATABASE_URL','TEST_DATABASE_URL','SESSION_SECRET','STONE_METRICS_SECRET','BREVO_API_KEY','SENDGRID_API_KEY','RESEND_API_KEY','SMTP_PASS','STRIPE_SECRET_KEY','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY']) assert(!process.env[key], 'No live credentials permitted: ' + key);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'exchange-stone-candidate-'));
  const source = path.join(temporary, 'source');
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', CI: 'true' };
  delete env.NODE_ENV;
  try {
    // Connector download URLs expire independently of builds. Acquire only the
    // fixed approved bytes now, privately, then let the exact candidate fully
    // revalidate the archive, approval records and decoded photos later.
    try {
      const url = new URL(process.env.EXCHANGE_STONE_PACKAGE_URL || '');
      assert(url.protocol === 'https:' && !url.username && !url.password && !url.port && /^[a-z0-9-]+\.oaiusercontent\.com$/.test(url.hostname));
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120000) });
      assert.equal(response.status, 200);assert(response.body);
      const expectedSize = 62415047;
      const declared = response.headers.get('content-length');
      if (declared !== null) assert.equal(Number(declared), expectedSize);
      const chunks = [];let size = 0;
      for await (const chunk of response.body) { size += chunk.length;assert(size <= expectedSize);chunks.push(Buffer.from(chunk)); }
      const bytes = Buffer.concat(chunks);
      assert.equal(bytes.length, expectedSize);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), '4a955c956dd1648d548852e7eb392a7394a6c4b8fcb4377ca8a91db531647229');
      env.EXCHANGE_STONE_PACKAGE_FILE = path.join(temporary, 'approved-package.zip');
      await fs.writeFile(env.EXCHANGE_STONE_PACKAGE_FILE, bytes, { flag: 'wx', mode: 0o600 });
      console.log('STONE_EXECUTOR_PACKAGE_ACQUIRED ' + JSON.stringify({size, pinnedHashMatched:true, privatelyStored:true, published:false}));
    } catch { throw new Error('Approved package acquisition failed before candidate verification; no private URL is emitted'); }
    execFileSync('git', ['clone','--no-hardlinks','--no-checkout',process.cwd(),source], { stdio:'inherit', env, timeout:180000 });
    execFileSync('git', ['-C',source,'remote','set-url','origin','https://github.com/infotradescout/tradescoutAI.git'], { stdio:'inherit', env });
    execFileSync('git', ['-C',source,'config','remote.origin.promisor','true']);
    execFileSync('git', ['-C',source,'config','remote.origin.partialclonefilter','blob:none']);
    const shallow = execFileSync('git', ['-C',source,'rev-parse','--is-shallow-repository'], {encoding:'utf8'}).trim() === 'true';
    // Retrieve genuine complete commit ancestry, not synthetic or shallow history.
    // Historical blobs are fetched on demand by Git; the checked-out candidate
    // still contains the exact full application tree and the release gate is unchanged.
    console.log('STONE_EXECUTOR_FETCH_AUTHENTIC_HISTORY ' + candidate);
    execFileSync('git', ['-C',source,'fetch',...(shallow ? ['--unshallow'] : []),'--filter=blob:none','--no-tags','origin','+refs/heads/main:refs/remotes/origin/main',candidate], { stdio:'inherit', env, timeout:600000 });
    execFileSync('git', ['-C',source,'checkout','--detach',candidate], { stdio:'inherit', env, timeout:180000 });
    assert.equal(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),candidate);
    assert.equal(execFileSync('git',['-C',source,'rev-parse','--is-shallow-repository'],{encoding:'utf8'}).trim(),'false');
    execFileSync('git', ['-C',source,'merge-base','--is-ancestor','origin/main',candidate], {stdio:'inherit'});
    execFileSync('npm', ['ci','--include=dev','--no-audit','--no-fund'], { cwd:source, stdio:'inherit', env, timeout:600000 });
    const result = spawnSync(process.execPath, ['scripts/verify-exchange-stone-release.mjs'], { cwd:source, stdio:'inherit', env, timeout:1800000 });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    await fs.rm(temporary, { recursive:true, force:true });
  }
}
