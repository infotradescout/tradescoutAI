import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.cwd();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceStatus = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
assert.equal(sourceStatus, '', 'Customer reservation verification requires a clean exact-head source tree');

for (const key of [
  'DATABASE_URL',
  'TEST_DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'JW_STONE_PRICING_APPROVED_IMPORT',
  'JW_CART_DEPLOYED_SHA',
]) {
  assert(!process.env[key], 'Do not inherit production/data credentials into reservation proof: ' + key);
}

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'jw-cart-actions-proof-'));
const checkout = path.join(temporary, 'source');
const outputs = ['jw-cart-hold-actions', 'jw-cart-holds'];
let status = 1;

try {
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

  execFileSync('npm', ['ci', '--include=dev'], {
    cwd: checkout,
    stdio: 'inherit',
    timeout: 600_000,
  });

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
  status = result.status ?? 1;

  for (const name of outputs) {
    const from = path.join(checkout, 'test-results', name);
    const to = path.join(root, 'test-results', name);
    try {
      await fs.rm(to, { recursive: true, force: true });
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.cp(from, to, { recursive: true });
    } catch (error) {
      if (status === 0) throw error;
    }
  }

  const receiptPath = path.join(root, 'test-results', 'jw-cart-hold-actions', 'evidence.json');
  if (status === 0) {
    const receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
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
      await fs.readFile(path.join(root, 'test-results', 'jw-cart-holds', 'evidence.json'), 'utf8')
    );
    assert.equal(backendReceipt.head, head);
    assert.equal(backendReceipt.passed, true);
    assert.equal(backendReceipt.releaseApproved, false);
    assert.equal(backendReceipt.productionWrites, false);
  }

  await fs.mkdir(path.join(root, 'test-results', 'jw-cart-hold-actions'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'test-results', 'jw-cart-hold-actions', 'exact-source.json'),
    JSON.stringify(
      {
        head,
        cleanSource: true,
        detachedCheckout: true,
        freshNpmCi: true,
        childExitCode: status,
        productionWrites: false,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    ) + '\n'
  );
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}

process.exit(status);
