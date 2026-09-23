import { createHash } from 'node:crypto';

export const STONE_LAUNCH = Object.freeze({
  batch: 'drive-homeowner-96-20260922', count: 96, fileCount: 98,
  size: 62415047, sha256: '4a955c956dd1648d548852e7eb392a7394a6c4b8fcb4377ca8a91db531647229',
  catalogSha256: '4c22f83cf93a730a2b0187aa18889e4f8ea6f98ad31b8ffd3cb990771b5ac77c',
  approvalsSha256: 'b73dc5f82d519c5b584e8a70382a489ba0fadeb8ff61f1138f363c55739b7f67',
  serviceId: 'srv-d4rivgm3jp1c7391th0g', database: 'neondb',
  sellerId: '8499ade7-af90-4d42-8dc1-fdbe60518c83',
  profileId: '5af22c45-d8d5-4c50-94d0-20b67a861071',
  categoryId: '574cea97-a73b-4269-8a4a-2e81c1afcd5c',
  hosts: Object.freeze(['ep-fragrant-sunset-adhfd1uo.c-2.us-east-1.aws.neon.tech', 'ep-fragrant-sunset-adhfd1uo-pooler.c-2.us-east-1.aws.neon.tech']),
  receiptKey: 'exchange_stone_retail_launch_receipt_20260922',
});
export const stoneLaunchHash = bytes => createHash('sha256').update(bytes).digest('hex');
const mediaName = /^prepared-media\/tradescout-stone-[a-z0-9]+(?:-[a-z0-9]+)*\/[a-f0-9]{64}\.webp$/;

/** Deliberately restricted to the reviewed ZIP_STORED package. Never extract ZIP
 * paths using an archive library's filesystem semantics, symlinks or permissions. */
export function readStoneStoredArchive(bytes, pin = STONE_LAUNCH) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== pin.size || bytes.length > 70000000 || stoneLaunchHash(bytes) !== pin.sha256) throw new Error('Launch archive identity mismatch');
  const files = new Map(); let offset = 0;
  while (offset + 4 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    if (offset + 30 > bytes.length) throw new Error('Truncated archive header');
    const flags = bytes.readUInt16LE(offset + 6), method = bytes.readUInt16LE(offset + 8);
    const packed = bytes.readUInt32LE(offset + 18), size = bytes.readUInt32LE(offset + 22);
    const nameLength = bytes.readUInt16LE(offset + 26), extraLength = bytes.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength, end = start + size;
    if (flags !== 0 || method !== 0 || packed !== size || size > 12000000 || size <= 0 || nameLength < 1 || nameLength > 300 || extraLength > 1024 || end > bytes.length) throw new Error('Unsupported archive entry');
    const name = bytes.toString('utf8', offset + 30, offset + 30 + nameLength);
    if (!['catalog.json','approvals.json'].includes(name) && !mediaName.test(name)) throw new Error('Unexpected archive path');
    if (files.has(name) || files.size >= pin.fileCount) throw new Error('Duplicate or excess archive entry');
    files.set(name, bytes.subarray(start, end)); offset = end;
  }
  if (files.size !== pin.fileCount || offset + 4 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error('Incomplete archive or missing directory');
  // The whole-file SHA binds the reviewed central directory too. No code executes
  // from this package; all extracted entries are written as ordinary new files.
  return files;
}

export function validateStoneLaunchDocuments(files, approved, pin = STONE_LAUNCH) {
  const catalogBytes = files.get('catalog.json'), approvalsBytes = files.get('approvals.json');
  if (!catalogBytes || !approvalsBytes || stoneLaunchHash(catalogBytes) !== pin.catalogSha256 || stoneLaunchHash(approvalsBytes) !== pin.approvalsSha256) throw new Error('Launch document identity mismatch');
  const catalog = JSON.parse(catalogBytes.toString('utf8')), prices = JSON.parse(approvalsBytes.toString('utf8'));
  if (catalog.version !== 1 || !Array.isArray(catalog.items) || !Array.isArray(prices) || catalog.items.length !== pin.count || prices.length !== pin.count) throw new Error('Launch count mismatch');
  const expected = new Map(approved.prices.map(row => [row.id, row.priceCents]));
  const byId = new Map();
  for (const row of prices) {
    if (byId.has(row.id) || row.status !== 'approved' || row.unit !== 'sqft' || row.approvedBy !== approved.approvedBy || row.approvedAt !== approved.approvedAt || row.priceCents !== expected.get(row.id) || !Number.isSafeInteger(row.priceCents) || row.priceCents <= 0) throw new Error('Launch price differs from owner-approved Drive snapshot');
    byId.set(row.id, row);
  }
  const seen = new Set();
  for (const item of catalog.items) {
    if (!byId.has(item.id) || seen.has(item.id) || item.media?.status !== 'reviewed') throw new Error('Launch catalog identity mismatch');
    seen.add(item.id);
    const name = 'prepared-media/' + item.media.file;
    if (!mediaName.test(name) || item.media.file !== `${item.id}/${item.media.sha256}.webp`) throw new Error('Launch photo is not bound to its material');
    const bytes = files.get(name);
    if (!bytes || stoneLaunchHash(bytes) !== item.media.sha256) throw new Error('Launch photo identity mismatch');
  }
  if (files.size !== pin.count + 2) throw new Error('Unreferenced launch files');
  return { catalog, prices };
}

export async function downloadStoneLaunch(url, fetcher = fetch, pin = STONE_LAUNCH) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !/^[a-z0-9-]+\.oaiusercontent\.com$/.test(parsed.hostname)) throw new Error('Launch URL is not an authorized connector download');
  const response = await fetcher(parsed.href, { redirect: 'error', signal: AbortSignal.timeout(120000) });
  if (response.status !== 200 || !response.body) throw new Error('Launch download failed');
  const declared = response.headers.get('content-length');
  if (declared !== null && Number(declared) !== pin.size) throw new Error('Launch download length mismatch');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > pin.size) { await response.body.cancel?.().catch(() => {}); throw new Error('Launch download exceeds its approved size'); }
    chunks.push(Buffer.from(chunk));
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.length !== pin.size || stoneLaunchHash(bytes) !== pin.sha256) throw new Error('Launch download does not match approved bytes');
  return bytes;
}
