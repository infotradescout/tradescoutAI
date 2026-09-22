import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { startCabinetLoopbackTestDatabase } from './start-cabinet-loopback-test-db.mjs';

const head = execFileSync('git', ['rev-parse','HEAD'], {encoding:'utf8'}).trim();
assert.equal(head, process.env.EXCHANGE_STONE_CANDIDATE);
const output = path.resolve(process.env.EXCHANGE_BATCH_OUTPUT, 'minimum-release');
await fs.mkdir(output, {recursive:true});
const native = JSON.parse(await fs.readFile(path.resolve(process.env.EXCHANGE_BATCH_OUTPUT, 'native/report.json'), 'utf8'));
assert.equal(native.head, head); assert.equal(native.passed, true);
assert.equal(native.checks.length, 10); assert(native.browser.length === 2 && native.browser.every(row => row.passed));
for (const key of ['DATABASE_URL','TEST_DATABASE_URL','SESSION_SECRET','STONE_METRICS_SECRET','STRIPE_SECRET_KEY','BREVO_API_KEY','SENDGRID_API_KEY','RESEND_API_KEY','SMTP_PASS']) assert(!process.env[key], 'No live credentials allowed');
const report = {head,startedAt:new Date().toISOString(),passed:false,scope:'Unchanged strict release contract on a fresh owned loopback PostgreSQL database; no production target or synthetic ledger stamps.'};
let database;
try {
  database = await startCabinetLoopbackTestDatabase();
  const env = {...process.env, NODE_ENV:'test', DATABASE_URL:database.url, TEST_DATABASE_URL:database.url,
    ALLOW_INSECURE_TEST_DATABASE:'true', TZ:'UTC'};
  const note = `Exact source ${head}: desktop and phone stone landing -> real built listing -> sign-in return via actual session login -> protected inquiry -> seller inbox passed. Lost response replay and two independent application processes passed. Synthetic accounts/photos on an owned disposable database; no production or external provider transaction.`;
  const result = spawnSync('npm',['run','gate:minimum-release','--','--browser-proof=manual',`--browser-note=${note}`], {env, encoding:'utf8', timeout:900000, maxBuffer:100*1024*1024});
  const log = String(result.stdout || '') + String(result.stderr || '');
  const safe = log.split(database.url).join('[OWNED_LOOPBACK_DATABASE]').replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[DATABASE_REDACTED]');
  await fs.writeFile(path.join(output,'gate.log'),safe);
  console.log(safe.slice(-25000));
  report.exitCode = result.status; report.processError = result.error?.code || null;
  const receipt = JSON.parse(await fs.readFile(path.join('artifacts','release-contract',head.slice(0,12),'evidence.json'),'utf8'));
  await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify(receipt,null,2));
  report.result = receipt.result; report.steps = receipt.steps;
  assert.equal(result.status,0); assert.equal(receipt.commit,head); assert.equal(receipt.result,'pass'); assert.equal(receipt.attestable,true);
  assert(receipt.steps.every(step=>step.status==='pass'));
  report.passed = true;
} catch (error) { report.error=String(error.stack || error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[DATABASE_REDACTED]'); }
finally {
  try { await database?.stop(); } catch(error) { report.cleanupError=String(error); report.passed=false; }
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log('STONE_MINIMUM_RELEASE_RESULT '+JSON.stringify(report));
  process.exitCode = report.passed ? 0 : 1;
}
