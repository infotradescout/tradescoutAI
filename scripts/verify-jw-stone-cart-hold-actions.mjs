import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.cwd();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'jw-cart-actions-proof-'));
const checkout = path.join(temporary, 'source');
const outputRoot = path.join(root, 'test-results');
const actionOutput = path.join(outputRoot, 'jw-cart-hold-actions');
const outputs = ['jw-cart-hold-actions', 'jw-cart-holds'];

let status = 1;
let stage = 'preflight';
let failure = null;
let detachedCheckout = false;
let freshNpmCi = false;
let childStarted = false;
let nativeExitCode = null;

function safeError(error) {
  return String(error?.stack || error || 'Unknown verification failure')
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[DISPOSABLE_DATABASE]')
    .replace(/token[^\s]*[=:][^\s]+/gi, '[TOKEN]');
}

async function copyOutputs() {
  const errors = [];
  for (const name of outputs) {
    const from = path.join(checkout, 'test-results', name);
    const to = path.join(outputRoot, name);
    try {
      await fs.access(from);
      await fs.rm(to, { recursive: true, force: true });
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.cp(from, to, { recursive: true });
    } catch (error) {
      errors.push({ name, error: safeError(error) });
    }
  }
  return errors;
}

try {
  const sourceStatus = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
  assert.equal(
    sourceStatus,
    '',
    'Customer reservation verification requires a clean exact-head source tree'
  );

  for (const key of [
    'DATABASE_URL',
    'TEST_DATABASE_URL',
    'STRIPE_SECRET_KEY',
    'JW_STONE_PRICING_APPROVED_IMPORT',
    'JW_CART_DEPLOYED_SHA',
  ]) {
    assert(
      !process.env[key],
      'Do not inherit production/data credentials into reservation proof: ' + key
    );
  }

  stage = 'detached-checkout';
  execFileSync('git', ['clone', '--no-hardlinks', '--no-checkout', root, checkout], {
    stdio: 'inherit',
  });
  execFileSync('git', ['-C', checkout, 'checkout', '--detach', head], { stdio: 'inherit' });
  assert.equal(
    execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    head
  );
  assert.equal(
    execFileSync('git', ['-C', checkout, 'status', '--porcelain'], { encoding: 'utf8' }).trim(),
    ''
  );
  detachedCheckout = true;

  stage = 'npm-ci';
  execFileSync('npm', ['ci', '--include=dev'], {
    cwd: checkout,
    stdio: 'inherit',
    timeout: 600_000,
  });
  freshNpmCi = true;

  stage = 'native-reservation-proof';
  childStarted = true;
  const result = spawnSync(
    process.execPath,
    [
      'scripts/jw-stone-offer.native.mjs',
      '--feature-control',
      '--owned-hold-status',
      '--cart-hold-actions',
    ],
    {
      cwd: checkout,
      env: {
        ...process.env,
        JW_WORKFLOW_OUTPUT: path.join(checkout, 'test-results', 'jw-cart-hold-actions'),
      },
      stdio: 'inherit',
      timeout: 1_800_000,
    }
  );
  nativeExitCode = result.status ?? 1;
  status = nativeExitCode;

  stage = 'copy-evidence';
  const copyErrors = await copyOutputs();
  if (status === 0) assert.deepEqual(copyErrors, []);

  if (status !== 0) {
    throw new Error('Customer reservation native proof exited with code ' + status);
  }

  stage = 'validate-receipts';
  const receipt = JSON.parse(
    await fs.readFile(path.join(actionOutput, 'evidence.json'), 'utf8')
  );
  assert.equal(receipt.head, head);
  assert.equal(receipt.passed, true);
  assert.equal(receipt.customerReservationActionsProved, true);
  assert.deepEqual([...receipt.customerReservationDevices].sort(), ['desktop', 'touch']);
  assert.equal(receipt.productionWrites, false);
  assert.equal(receipt.liveCustomerWrites, false);
  assert.equal(receipt.backendCartHoldProof?.head, head);
  assert.equal(receipt.backendCartHoldProof?.passed, true);
  assert.equal(receipt.backendCartHoldProof?.releaseApproved, false);
  assert.equal(receipt.backendCartHoldProof?.productionWrites, false);

  const backendReceipt = JSON.parse(
    await fs.readFile(path.join(outputRoot, 'jw-cart-holds', 'evidence.json'), 'utf8')
  );
  assert.equal(backendReceipt.head, head);
  assert.equal(backendReceipt.passed, true);
  assert.equal(backendReceipt.releaseApproved, false);
  assert.equal(backendReceipt.productionWrites, false);

  stage = 'final-source-integrity';
  assert.equal(
    execFileSync('git', ['-C', checkout, 'status', '--porcelain'], { encoding: 'utf8' }).trim(),
    '',
    'Verification changed tracked exact-source inputs'
  );
  status = 0;
} catch (error) {
  failure = safeError(error);
  status = 1;
  console.error('JW_CART_ACTION_PROOF_FAILURE ' + failure);
} finally {
  const copyErrors = detachedCheckout ? await copyOutputs() : [];
  if (status === 0 && copyErrors.length) {
    status = 1;
    stage = 'final-evidence-copy';
    failure = 'Final exact-source evidence copy failed: ' + JSON.stringify(copyErrors);
  }
  await fs.mkdir(actionOutput, { recursive: true });
  await fs.writeFile(
    path.join(actionOutput, 'exact-source.json'),
    JSON.stringify(
      {
        head,
        passed: status === 0,
        stage,
        failure,
        cleanSourceRequired: true,
        detachedCheckout,
        freshNpmCi,
        childStarted,
        nativeExitCode,
        verificationExitCode: status,
        copiedEvidenceErrors: copyErrors,
        productionWrites: false,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    ) + '\n'
  );
  await fs.rm(temporary, { recursive: true, force: true });
}

process.exit(status);
