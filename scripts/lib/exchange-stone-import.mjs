import { createHash } from 'node:crypto';

export const STONE_IMPORT_VERSION = 1;
export const hashStoneBytes = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = (value, max = 1000) => typeof value === 'string' && value.trim() && value.length <= max;
const safeCopy = value => value == null || (typeof value === 'string' && value.length <= 1000 && !/(?:\bjw\s*stone\b|jwstonelogistics|fabricator\s+price|supplier\s+cost|https?:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test(value));
const date = (value, now) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now;

export function stoneMediaKey(id, hash) {
  if (!/^tradescout-stone-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !digest(hash)) throw new Error('Invalid stone media identity');
  return `public-media/images/exchange/stone/${id}/${hash}.webp`;
}

/** Decode pixels before invoking this boundary. A magic prefix alone is not image validation. */
export function validateStoneMedia(bytes, expectedHash, decoded) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12 || bytes.length > 12000000 || !digest(expectedHash) || hashStoneBytes(bytes) !== expectedHash || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error('Photo bytes do not match the reviewed asset');
  if (!decoded || decoded.format !== 'webp' || !Number.isInteger(decoded.width) || !Number.isInteger(decoded.height) || Math.min(decoded.width, decoded.height) < 200 || decoded.width * decoded.height > 40000000 || decoded.pages > 1 || decoded.hasMetadata) throw new Error('Decoded photo dimensions, frame count or metadata failed validation');
}

/** No prices are inferred from supplier data. Only explicit approval records enter a batch. */
export function selectStoneImportInputs(manifest, approvals, identities, now = Date.now()) {
  if (!manifest || manifest.version !== STONE_IMPORT_VERSION || !Array.isArray(manifest.items) || !Array.isArray(approvals) || !(identities instanceof Map)) throw new Error('Invalid stone import documents');
  const sources = new Map();
  for (const item of manifest.items) {
    if (!item || identities.get(item.id) !== item.name || sources.has(item.id) || !safeCopy(item.name) || !safeCopy(item.material) || !safeCopy(item.referenceSizesInches)) throw new Error('Source catalog identity or public copy mismatch');
    sources.set(item.id, item);
  }
  const selected = [], approvedIds = new Set();
  for (const approval of approvals) {
    const source = sources.get(approval?.id);
    if (!source || approvedIds.has(approval.id)) throw new Error('Unknown or duplicate selling-price approval');
    approvedIds.add(approval.id);
    if (approval.status !== 'approved' || !Number.isSafeInteger(approval.priceCents) || approval.priceCents <= 0 || approval.priceCents > 9999999999 || !['sqft', 'slab'].includes(approval.unit) || !text(approval.approvedBy, 160) || !date(approval.approvedAt, now)) throw new Error(`Invalid explicit selling-price approval: ${approval.id}`);
    if (approval.unit === 'slab' && (!text(approval.exactSlab) || !safeCopy(approval.exactSlab))) throw new Error(`Exact slab required for full-slab price: ${approval.id}`);
    const media = source.media;
    if (!media || media.status !== 'reviewed' || !digest(media.sha256) || !digest(media.sourceSha256) || !text(media.reviewedBy, 160) || !date(media.reviewedAt, now)) throw new Error(`Reviewed photo required: ${approval.id}`);
    if (media.file !== `${source.id}/${media.sha256}.webp`) throw new Error('Photo path must match immutable material identity');
    selected.push({ source, approval });
  }
  return { selected: selected.sort((a, b) => a.source.id.localeCompare(b.source.id, 'en')), held: [...sources.keys()].filter(id => !approvedIds.has(id)).map(id => ({ id, reason: 'selling_price_not_approved' })) };
}

export function buildStoneImportRows(selected, config, signPublication, validatePublication) {
  if (!text(config?.sellerId, 160) || !text(config.categoryId, 160) || !text(config.profileId, 160) || !text(config.state, 64) || !text(config.county, 160) || !text(config.secret) || config.secret.length < 24) throw new Error('Verified TradeScout seller, location, category and signing configuration required');
  return selected.map(({ source, approval }) => {
    const price = `${Math.floor(approval.priceCents / 100)}.${String(approval.priceCents % 100).padStart(2, '0')}`;
    const unit = approval.unit === 'sqft' ? 'sq ft' : 'slab';
    const row = {
      id: source.id, sellerId: config.sellerId, categoryId: config.categoryId,
      title: `${source.name} Slabs | TradeScout`,
      description: `Buy ${source.name} slabs through TradeScout Exchange. Listed price: $${price} per ${unit}, material only.${source.material ? ` Material: ${source.material}.` : ''}${source.referenceSizesInches ? ` Recorded reference sizes: ${source.referenceSizesInches} inches; confirm the selected slab's dimensions.` : ' Exact slab dimensions must be confirmed.'} Photos are material references, not a current-stock guarantee. Confirm availability, thickness, finish and delivery charges before purchase. Fabrication and installation are not included.`,
      price, priceNegotiable: false, requiresBuyerVerification: false, expiresAt: null,
      condition: 'new', status: 'active', city: config.city || null, state: config.state, county: config.county,
      brand: 'TradeScout', images: [`/api/exchange/stone-media/${source.id}`],
      specifications: { commerceChannel: 'tradescout_stone_retail', retailAudience: 'US_EXCEPT_PENSACOLA_FL_CITY', sellerBrand: 'TradeScout', currency: 'USD', priceUnit: approval.unit,
        material: source.material || null, referenceSizesInches: source.referenceSizesInches || null,
        availability: 'confirm_before_purchase', shippingPolicy: 'quoted_separately',
        ...(approval.unit === 'slab' ? { exactSlab: approval.exactSlab } : {}),
        retailPublication: { approvedBy: approval.approvedBy, approvedAt: approval.approvedAt, assetSha256: source.media.sha256, assetReviewed: true } },
    };
    row.specifications.retailPublication.signature = signPublication(row, config.secret);
    if (!validatePublication(row, config.sellerId, config.secret)) throw new Error(`Canonical publication validation rejected ${source.id}`);
    return row;
  });
}

/** The plan fingerprint does not depend on a rotating signature but binds approved business values. */
export function stoneImportPlanHash(rows, profileId) {
  return hashStoneBytes(JSON.stringify({ version: STONE_IMPORT_VERSION, profileId, rows: rows.map(row => ({ ...row, specifications: { ...row.specifications, retailPublication: { ...row.specifications.retailPublication, signature: undefined } } })) }));
}

function sameListing(actual, row) {
  const values = { id: row.id, seller_id: row.sellerId, category_id: row.categoryId, title: row.title, description: row.description, price: row.price, price_type: 'fixed', county: row.county, state: row.state, city: row.city, condition: row.condition, brand: 'TradeScout', status: 'active', requires_buyer_verification: false, is_local_pickup_only: false, will_ship: false, primary_image_index: 0, expires_at: null, shipping_cost: null };
  for (const [key, value] of Object.entries(values)) {
    if (key === 'price') { if (String(actual[key]) !== value) return false; }
    else if (actual[key] !== value) return false;
  }
  // JSONB does not preserve key order.
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return JSON.stringify(canonical(actual.specifications)) === JSON.stringify(canonical(row.specifications)) && JSON.stringify(actual.images) === JSON.stringify(row.images);
}

/** No transaction nesting, live DDL, supplier updates, or external delivery side effects. */
export async function executeStoneImport({ client, selected, assets, resolveConfig, expectedPlan, apply = false, signPublication, validatePublication }) {
  await client.query(apply ? 'BEGIN ISOLATION LEVEL SERIALIZABLE' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    if (apply) await client.query("SELECT pg_advisory_xact_lock(hashtextextended('tradescout:stone:retail-import:v1',0))");
    const config = await resolveConfig(client, apply);
    const rows = buildStoneImportRows(selected, config, signPublication, validatePublication);
    const planHash = stoneImportPlanHash(rows, config.profileId);
    if (apply && (rows.length === 0 || !digest(expectedPlan) || expectedPlan !== planHash)) throw new Error('Apply requires the exact reviewed nonempty dry-run plan');
    const records = [];
    for (const row of rows) {
      const source = selected.find(item => item.source.id === row.id).source;
      const bytes = assets.get(row.id);
      if (!Buffer.isBuffer(bytes) || hashStoneBytes(bytes) !== source.media.sha256) throw new Error('Validated media bytes changed before transaction');
      const key = stoneMediaKey(row.id, source.media.sha256);
      const existing = await client.query('SELECT * FROM marketplace_listings WHERE id=$1', [row.id]);
      if (existing.rows.length && !sameListing(existing.rows[0], row)) throw new Error(`Existing listing differs; no overwrite: ${row.id}`);
      const media = await client.query('SELECT body,content_type,etag FROM public_media_objects WHERE object_key=$1', [key]);
      if (media.rows.length && (!Buffer.isBuffer(media.rows[0].body) || !media.rows[0].body.equals(bytes) || media.rows[0].content_type !== 'image/webp' || media.rows[0].etag !== `"${source.media.sha256}"`)) throw new Error(`Existing immutable photo differs: ${row.id}`);
      records.push({ row, bytes, key, listingExists: existing.rows.length > 0, mediaExists: media.rows.length > 0 });
    }
    for (const item of records) {
      if (!apply) continue;
      const { row, bytes, key } = item;
      if (!item.mediaExists) {
        await client.query("INSERT INTO public_media_objects(object_key,body,content_type,etag,cache_control,metadata) VALUES($1,$2,'image/webp',$3,'private, no-store',$4::jsonb)", [key, bytes, `"${row.specifications.retailPublication.assetSha256}"`, JSON.stringify({ channel: 'tradescout_stone_retail', listingId: row.id })]);
      }
      if (!item.listingExists) {
        await client.query(`INSERT INTO marketplace_listings(id,seller_id,category_id,title,description,price,price_type,county,state,city,condition,brand,status,images,specifications,requires_buyer_verification,is_local_pickup_only,will_ship,shipping_cost,primary_image_index,expires_at)
          VALUES($1,$2,$3,$4,$5,$6,'fixed',$7,$8,$9,$10,'TradeScout','active',$11::jsonb,$12::jsonb,false,false,false,NULL,0,NULL)`, [row.id,row.sellerId,row.categoryId,row.title,row.description,row.price,row.county,row.state,row.city,row.condition,JSON.stringify(row.images),JSON.stringify(row.specifications)]);
      }
      const reread = await client.query('SELECT * FROM marketplace_listings WHERE id=$1', [row.id]);
      const mediaRead = await client.query('SELECT body,content_type,etag FROM public_media_objects WHERE object_key=$1', [key]);
      if (!reread.rows[0] || !sameListing(reread.rows[0], row) || !mediaRead.rows[0]?.body?.equals(bytes) || mediaRead.rows[0].content_type !== 'image/webp' || mediaRead.rows[0].etag !== `"${row.specifications.retailPublication.assetSha256}"`) throw new Error('Stored listing/photo read-back failed');
    }
    // A failed/uncertain COMMIT is reported as failure. Replaying the identical plan is safe.
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    return { version: 1, mode: apply ? 'applied' : 'dry_run', planHash, eligible: rows.length,
      inserted: apply ? records.filter(item => !item.listingExists).length : 0,
      unchanged: records.filter(item => item.listingExists).length,
      mediaInserted: apply ? records.filter(item => !item.mediaExists).length : 0,
      items: records.map(item => ({ id: item.row.id, action: item.listingExists ? 'unchanged' : 'insert', photoSha256: item.row.specifications.retailPublication.assetSha256 })) };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Preserve the original failure, never report success. */ }
    throw error;
  }
}
