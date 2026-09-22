/** Explicit operator import, not a public API. Default is a read-only dry run. */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import sharp from 'sharp';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { sanitizePublicListingText } from '../shared/publicListingSafety';
import { stoneCatalog } from '../server/data/exchangeStoneCatalogIdentity';
import { stonePublicationSignature, validStonePublication } from '../server/services/exchangeStoneDiscovery';
import { exposureAuthoritySqlPredicate } from '../server/services/exposureAuthority';
import { securePostgresConnectionString } from '../shared/database-url-security.mjs';
import { resolveStoneRetailSigningSecret } from '../shared/stoneRetailSigning.mjs';
import { executeStoneImport, selectStoneImportInputs, validateStoneMedia } from './lib/exchange-stone-import.mjs';
import { stoneFailureCode } from './lib/exchange-stone-failure.mjs';

const allowed = new Set(['catalog','approvals','media-root','expected-host','expected-database','seller-user-id','profile-id','expected-plan']);
function argumentsFor(values: string[]) {
  const out: Record<string, string | boolean> = {};
  for (const value of values) {
    if (value === '--apply') { if (out.apply) throw new Error('Duplicate apply argument'); out.apply = true; continue; }
    const match = /^--([^=]+)=(.+)$/.exec(value);
    if (!match || !allowed.has(match[1]) || out[match[1]] !== undefined) throw new Error('Unknown, missing or duplicate import argument');
    out[match[1]] = match[2];
  }
  for (const key of allowed) if (key !== 'expected-plan' && typeof out[key] !== 'string') throw new Error(`Missing --${key}`);
  if (out.apply && !/^[a-f0-9]{64}$/.test(String(out['expected-plan'] || ''))) throw new Error('--apply requires the preceding dry-run plan fingerprint');
  return out;
}
async function jsonFile(name: string) {
  const stat = await fs.stat(name);
  if (!stat.isFile() || stat.size > 2000000) throw new Error('Import document is too large or not a file');
  return JSON.parse(await fs.readFile(name, 'utf8'));
}

async function main() {
  const args = argumentsFor(process.argv.slice(2));
  const { selected, held } = selectStoneImportInputs(await jsonFile(String(args.catalog)), await jsonFile(String(args.approvals)), stoneCatalog);
  // No approved prices means no database connection, no photo upload and no invented selling price.
  if (!selected.length) {
    if (args.apply) throw new Error('No explicitly approved selling prices to publish');
    console.log(JSON.stringify({ mode: 'dry_run', eligible: 0, inserted: 0, mediaInserted: 0, held }, null, 2));
    return;
  }
  const mediaRoot = await fs.realpath(String(args['media-root']));
  const assets = new Map<string, Buffer>();
  for (const item of selected) {
    const filename = await fs.realpath(path.join(mediaRoot, item.source.media.file));
    const relative = path.relative(mediaRoot, filename);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Photo escapes its reviewed media root');
    const stat = await fs.stat(filename);
    if (!stat.isFile() || stat.size > 12000000) throw new Error('Photo file is invalid or oversized');
    const bytes = await fs.readFile(filename);
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 40000000 });
    const metadata = await image.metadata();
    validateStoneMedia(bytes, item.source.media.sha256, { format: metadata.format, width: metadata.width, height: metadata.height, pages: metadata.pages || 1, hasMetadata: Boolean(metadata.exif || metadata.xmp || metadata.iptc || metadata.icc) });
    await image.raw().toBuffer(); // Complete decode: corrupt/truncated images cannot pass on a header alone.
    assets.set(item.source.id, bytes);
  }
  const connectionString = securePostgresConnectionString(process.env.DATABASE_URL || process.env.TEST_DATABASE_URL);
  if (!connectionString) throw new Error('An explicit secured database connection is required');
  const target = new URL(connectionString);
  if (target.hostname !== args['expected-host'] || decodeURIComponent(target.pathname.slice(1)) !== args['expected-database']) throw new Error('Database target differs from the operator-reviewed host/database');
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000, statement_timeout: 30000 });
  await client.connect();
  try {
    const receipt = await executeStoneImport({ client, selected, assets, apply: args.apply === true,
      expectedPlan: args['expected-plan'], signPublication: stonePublicationSignature,
      validatePublication: (row: any, sellerId: string, secret: string) => validStonePublication(row, sellerId, secret) &&
        sanitizePublicListingText(row.title, 200) === row.title && sanitizePublicListingText(row.description, 4000) === row.description &&
        [row.specifications.material, row.specifications.referenceSizesInches, row.specifications.exactSlab].every(value => value == null || sanitizePublicListingText(value, 1000) === value),
      resolveConfig: async (transaction: pg.Client, apply: boolean) => {
        const identity = await transaction.query('SELECT current_database() AS name');
        if (identity.rows[0]?.name !== args['expected-database']) throw new Error('Server database identity does not match reviewed target');
        const lock = apply ? ' FOR SHARE' : '';
        const settings = await transaction.query("SELECT value FROM site_settings WHERE category='general' AND key='exchange_stone_retail_seller_user_id' AND is_active=true ORDER BY id LIMIT 2" + lock);
        if (settings.rows.length !== 1 || settings.rows[0].value !== args['seller-user-id']) throw new Error('Exactly one existing TradeScout seller setting must match the reviewed seller');
        const profile = await transaction.query("SELECT id FROM profiles WHERE id=$1 AND owner_user_id=$2 AND display_name='TradeScout' AND status='published'" + lock, [args['profile-id'], args['seller-user-id']]);
        if (profile.rows.length !== 1) throw new Error('The reviewed published TradeScout profile does not belong to the configured seller');
        const category = await transaction.query("SELECT id FROM marketplace_categories WHERE name='Building Materials & Surfaces' AND is_active=true ORDER BY id LIMIT 2" + lock);
        if (category.rows.length !== 1) throw new Error('The active canonical stone category is missing or ambiguous');
        const exposure = new PgDialect().sqlToQuery(sql`SELECT ${exposureAuthoritySqlPredicate(sql`${String(args['seller-user-id'])}`)} AS allowed`);
        if ((await transaction.query(exposure.sql, exposure.params)).rows[0]?.allowed !== true) throw new Error('TradeScout seller does not currently meet canonical exposure authority');
        const user = await transaction.query('SELECT city,state,to_jsonb(users)->>\'state_code\' AS state_code, to_jsonb(users)->>\'county\' AS county,to_jsonb(users)->>\'county_name\' AS county_name FROM users WHERE id=$1' + lock, [args['seller-user-id']]);
        if (user.rows.length !== 1) throw new Error('Configured TradeScout seller account is missing');
        return { sellerId: String(args['seller-user-id']), profileId: String(args['profile-id']), categoryId: category.rows[0].id,
          city: user.rows[0].city, state: user.rows[0].state_code || user.rows[0].state,
          county: user.rows[0].county || user.rows[0].county_name, secret: resolveStoneRetailSigningSecret() };
      },
    });
    console.log(JSON.stringify({ ...receipt, held }, null, 2));
  } finally { await client.end(); }
}
main().catch((error) => {
  // Do not dump connection strings, image bytes or approval documents from driver errors.
  console.error('STONE_IMPORT_FAILED ' + JSON.stringify({ confirmed: false, code: stoneFailureCode(error) }));
  process.exitCode = 1;
});