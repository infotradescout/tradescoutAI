import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import approval from './data/exchange-stone-homeowner-approval-20260921.json';
import { stoneCatalog } from '../server/data/exchangeStoneCatalogIdentity';
import { selectStoneImportInputs, validateStoneMedia } from './lib/exchange-stone-import.mjs';
import { STONE_LAUNCH, downloadStoneLaunch, readStoneStoredArchive, validateStoneLaunchDocuments } from './lib/exchange-stone-launch-package.mjs';

const bytes = process.env.EXCHANGE_STONE_PACKAGE_FILE
  ? await fs.readFile(process.env.EXCHANGE_STONE_PACKAGE_FILE)
  : await downloadStoneLaunch(process.env.EXCHANGE_STONE_PACKAGE_URL || '');
const files = readStoneStoredArchive(bytes);
const { catalog, prices } = validateStoneLaunchDocuments(files, approval);
const selection = selectStoneImportInputs(catalog, prices, stoneCatalog);
assert.equal(selection.selected.length, STONE_LAUNCH.count);
assert.equal(selection.held.length, 0);
let totalBytes = 0;
for (const { source } of selection.selected) {
  const image = files.get('prepared-media/' + source.media.file)!;
  const decoder = sharp(image, { failOn: 'warning', limitInputPixels: 40000000 });
  const metadata = await decoder.metadata();
  validateStoneMedia(image, source.media.sha256, { format: metadata.format, width: metadata.width,
    height: metadata.height, pages: metadata.pages || 1, hasMetadata: Boolean(metadata.exif || metadata.xmp || metadata.iptc || metadata.icc) });
  await decoder.raw().toBuffer();
  totalBytes += image.length;
}
assert.equal(totalBytes, 62307874);
console.log('STONE_LAUNCH_PACKAGE_VERIFIED ' + JSON.stringify({ count: selection.selected.length,
  fullyDecodedPhotos: selection.selected.length, mediaBytes: totalBytes, archiveSha256: STONE_LAUNCH.sha256,
  prices: 'exact_owner_approved_Drive_snapshot', databaseConnected: false, published: false }));
