import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Preserve the existing complete cabinet/countertop regression and strict release pipeline.
// Execute a deterministic in-memory extension; no source or gate files are rewritten.
const original = await fs.readFile('scripts/verify-cabinet-library.mjs', 'utf8');
const bytes = Buffer.from(original);
const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
assert.equal(hash, '81792e9b7b89edddc2184f05cd0c64ec354867d9', 'Review changes to the base verifier before extending it');
const anchor = '  await browser.close(); browser = null; server.kill(); server = null;';
assert.equal(original.split(anchor).length, 2);
let source = original
  .replace("from './prepare-cabinet-parent-proof.mjs'", "from './scripts/prepare-cabinet-parent-proof.mjs'")
  .replace("from './start-cabinet-loopback-test-db.mjs'", "from './scripts/start-cabinet-loopback-test-db.mjs'")
  .replace("const out = '.cabinet-library-proof';", "const out = '.cabinet-accessories-proof';")
  .replace(anchor, '  await verifyCabinetAccessories({ browser, local, phase, deployed, working, record });\n' + anchor)
  .replace('prior cabinet/countertop regressions retained\'', 'prior cabinet/countertop regressions retained; actual-parent accessory placement, setback, separate counts, CSV, reload and unsupported countertop gaps also passed\'');
source = "import { verifyCabinetAccessories } from './scripts/verify-cabinet-accessories-browser.mjs';\n" + source;
assert(source.includes('await verifyCabinetAccessories('));
assert(source.includes('npm') && source.includes('gate:minimum-release'));
console.log('ACCESSORY_VERIFIER_BASE ' + hash);
const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
// As with the base verifier, reports may contain passed=false. Inspect evidence, not host status.
