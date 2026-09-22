import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import approval from './data/exchange-stone-homeowner-approval-20260921.json' with { type: 'json' };
import { securePostgresConnectionString } from '../shared/database-url-security.mjs';
import { STONE_LAUNCH, downloadStoneLaunch, readStoneStoredArchive, validateStoneLaunchDocuments } from './lib/exchange-stone-launch-package.mjs';
import { inspectStoneLaunchEnvironment } from './lib/exchange-stone-launch-preflight.mjs';
import { stoneFailureCode, readStoneImporterReceipt } from './lib/exchange-stone-failure.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const receiptMatches = value => value?.version === 1 && value?.batch === STONE_LAUNCH.batch &&
  value?.packageSha256 === STONE_LAUNCH.sha256 && value?.sellerId === STONE_LAUNCH.sellerId &&
  value?.profileId === STONE_LAUNCH.profileId && value?.categoryId === STONE_LAUNCH.categoryId &&
  value?.count === STONE_LAUNCH.count && /^[a-f0-9]{64}$/.test(value?.planHash || '') &&
  Number.isFinite(Date.parse(value?.appliedAt));

/** Explicit operator mode only. Reusing this release step later does not re-import
 * or resurrect listings: the completed batch receipt is historical, not inventory. */
export async function applyExchangeStonePackage() {
  const mode = process.env.STONE_RETAIL_LAUNCH_MODE;
  if (!mode || mode === 'off') return { mode: 'off', changed: false };
  // Inspect is deliberately nonmutating and does not open a database connection.
  if (mode === 'inspect') return { mode, changed: false, ...inspectStoneLaunchEnvironment() };
  if (!['dry_run','apply'].includes(mode)) throw new Error('Unknown stone launch mode');
  if (process.env.NODE_ENV !== 'production' || process.env.RENDER_SERVICE_ID !== STONE_LAUNCH.serviceId) throw new Error('Stone launch is restricted to the verified TradeScout production service');
  if ((process.env.SESSION_SECRET || '').length < 24 || (process.env.STONE_METRICS_SECRET || '').length < 24) throw new Error('Existing publication and stable buyer-metrics signing configuration required');
  const connectionString = securePostgresConnectionString(process.env.DATABASE_URL);
  if (!connectionString) throw new Error('Production database is missing');
  const target = new URL(connectionString);
  if (!STONE_LAUNCH.hosts.includes(target.hostname) || decodeURIComponent(target.pathname.slice(1)) !== STONE_LAUNCH.database) throw new Error('Stone launch database identity mismatch');
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000, statement_timeout: 15000 });
  await client.connect();
  let working;
  try {
    if ((await client.query('SELECT current_database() AS name')).rows[0]?.name !== STONE_LAUNCH.database) throw new Error('Connected database mismatch');
    await client.query("SELECT pg_advisory_lock(hashtextextended('tradescout:stone:launch:20260922',0))");
    const existing = await client.query("SELECT value FROM site_settings WHERE category='general' AND key=$1 ORDER BY id LIMIT 2", [STONE_LAUNCH.receiptKey]);
    if (existing.rows.length) {
      if (existing.rows.length !== 1 || !receiptMatches(existing.rows[0].value)) throw new Error('Existing launch receipt conflicts; no import performed');
      return { mode: 'already_applied', changed: false, batch: STONE_LAUNCH.batch, count: STONE_LAUNCH.count, planHash: existing.rows[0].value.planHash };
    }
    const bytes = await downloadStoneLaunch(process.env.STONE_RETAIL_LAUNCH_URL || '');
    const files = readStoneStoredArchive(bytes);
    const documents = validateStoneLaunchDocuments(files, approval);
    working = await fs.mkdtemp(path.join(os.tmpdir(), 'tradescout-stone-launch-'));
    for (const [name, content] of files) {
      const destination = path.join(working, name);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, content, { flag: 'wx', mode: 0o600 });
    }
    const built = path.join(here, 'import-exchange-stone.mjs');
    const fallback = path.resolve('dist/release/import-exchange-stone.mjs');
    const importer = await fs.stat(built).then(() => built).catch(() => fallback);
    const args = [importer, `--catalog=${path.join(working, 'catalog.json')}`, `--approvals=${path.join(working, 'approvals.json')}`,
      `--media-root=${path.join(working, 'prepared-media')}`, `--expected-host=${target.hostname}`,
      `--expected-database=${STONE_LAUNCH.database}`, `--seller-user-id=${STONE_LAUNCH.sellerId}`, `--profile-id=${STONE_LAUNCH.profileId}`];
    function invoke(extra = []) {
      const result = spawnSync(process.execPath, [...args, ...extra], { env: process.env, encoding: 'utf8', timeout: 300000, maxBuffer: 2000000 });
      const receipt = readStoneImporterReceipt(result);
      if (receipt.eligible !== STONE_LAUNCH.count || receipt.items?.length !== STONE_LAUNCH.count || receipt.held?.length || !/^[a-f0-9]{64}$/.test(receipt.planHash || '')) throw new Error('Canonical importer receipt is incomplete');
      const expectedIds = documents.catalog.items.map(item => item.id).sort();
      if (JSON.stringify(receipt.items.map(item => item.id).sort()) !== JSON.stringify(expectedIds)) throw new Error('Importer receipt material set mismatch');
      return receipt;
    }
    const dry = invoke();
    if (dry.mode !== 'dry_run' || dry.inserted !== 0 || dry.mediaInserted !== 0) throw new Error('Read-only importer returned an invalid receipt');
    console.log('STONE_LAUNCH_DRY_RUN ' + JSON.stringify({ batch: STONE_LAUNCH.batch, count: dry.eligible, planHash: dry.planHash, packageSha256: STONE_LAUNCH.sha256 }));
    if (mode === 'dry_run') return { mode, changed: false, count: dry.eligible, planHash: dry.planHash };
    // The artifact's exact prices/photos and verified target are the operator's
    // approved action. No reference-price calculation or automatic new batch.
    const applied = invoke(['--apply', `--expected-plan=${dry.planHash}`]);
    if (applied.mode !== 'applied' || applied.planHash !== dry.planHash || applied.inserted + applied.unchanged !== STONE_LAUNCH.count) throw new Error('Apply receipt does not match the approved dry run');
    const expected = new Map(documents.prices.map(row => [row.id, row.priceCents]));
    const stored = await client.query('SELECT id,seller_id,price,status,specifications FROM marketplace_listings WHERE id=ANY($1::text[])', [[...expected.keys()]]);
    if (stored.rows.length !== STONE_LAUNCH.count || stored.rows.some(row => row.seller_id !== STONE_LAUNCH.sellerId || row.status !== 'active' || String(row.price) !== (expected.get(row.id) / 100).toFixed(2) || row.specifications?.commerceChannel !== 'tradescout_stone_retail')) throw new Error('Committed publication read-back differs from approved inputs');
    const receipt = { version: 1, batch: STONE_LAUNCH.batch, packageSha256: STONE_LAUNCH.sha256,
      appliedAt: new Date().toISOString(), count: STONE_LAUNCH.count, sellerId: STONE_LAUNCH.sellerId,
      profileId: STONE_LAUNCH.profileId, categoryId: STONE_LAUNCH.categoryId, planHash: applied.planHash };
    await client.query("INSERT INTO site_settings(category,key,value,description,is_active) VALUES('general',$1,$2::jsonb,'Completed approved TradeScout stone publication batch; not current stock.',true)", [STONE_LAUNCH.receiptKey, JSON.stringify(receipt)]);
    return { mode: 'applied', changed: applied.inserted > 0 || applied.mediaInserted > 0, ...receipt };
  } finally {
    if (working) await fs.rm(working, { recursive: true, force: true });
    await client.end(); // Releases the session lock even after failure or uncertainty.
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log('STONE_LAUNCH_RESULT ' + JSON.stringify(await applyExchangeStonePackage())); }
  catch (error) {
    // Safe booleans and bounded noncredential identities, never driver errors or secrets.
    console.error('STONE_LAUNCH_FAILED ' + JSON.stringify({ confirmed: false, code: stoneFailureCode(error), ...inspectStoneLaunchEnvironment() }));
    process.exitCode = 1;
  }
}
