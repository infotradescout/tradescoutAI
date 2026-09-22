// Existing Exchange executor. Legacy proof is preserved byte-for-byte next to this dispatcher.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const candidate = process.env.EXCHANGE_STONE_CANDIDATE;
if (!candidate) {
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
    execFileSync('git', ['clone','--no-hardlinks','--no-checkout',process.cwd(),source], { stdio:'inherit', env });
    execFileSync('git', ['-C',source,'remote','set-url','origin','https://github.com/infotradescout/tradescoutAI.git'], { stdio:'inherit', env });
    const shallow = execFileSync('git', ['-C',source,'rev-parse','--is-shallow-repository'], {encoding:'utf8'}).trim() === 'true';
    // The release registry proves past merged PRs against origin/main. Supply
    // real repository history instead of weakening that check for a shallow clone.
    execFileSync('git', ['-C',source,'fetch',...(shallow ? ['--unshallow'] : []),'--no-tags','origin','+refs/heads/main:refs/remotes/origin/main',candidate], { stdio:'inherit', env, timeout:180000 });
    execFileSync('git', ['-C',source,'checkout','--detach',candidate], { stdio:'inherit', env });
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
