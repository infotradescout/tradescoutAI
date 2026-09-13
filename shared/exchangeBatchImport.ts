/** CSV/photo preparation only. Creation must still use the authenticated Exchange API. */
export const EXCHANGE_BATCH_LIMITS = { rows: 100, imagesPerListing: 8, csvBytes: 1_048_576, imageBytes: 10_485_760, totalImageBytes: 524_288_000 } as const;
export type BatchCategory = { id: string; name: string };
export type BatchPhoto = { name: string; size: number; type: string; webkitRelativePath?: string };
export type BatchRow = {
  line: number;
  key: string;
  title: string;
  payload: Record<string, unknown>;
  photoIndexes: number[];
  errors: string[];
};
export type BatchPreview = { rows: BatchRow[]; errors: string[]; unusedPhotos: string[] };
const headers = new Set(['listing_id', 'title', 'description', 'price', 'category', 'condition', 'city', 'state', 'zip_code', 'county', 'images', 'price_type', 'location_visibility', 'will_ship', 'shipping_cost', 'brand', 'model']);
const required = ['listing_id', 'title', 'description', 'price', 'category', 'condition', 'city', 'state', 'zip_code', 'county'];
const imageExtension = /\.(jpe?g|png|webp)$/i;
const states = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY AS GU MP PR VI'.split(' '));
const normalized = (text: string) => text.trim().normalize('NFC').toLowerCase();
export const photoPath = (photo: BatchPhoto) => (photo.webkitRelativePath || photo.name).replace(/\\/g, '/');

/** Strict quoted CSV, including Excel BOM, CRLF, escaped quotes and multiline cells. */
export function parseExchangeCsv(input: string): { line: number; cells: string[] }[] {
  if (new TextEncoder().encode(input).length > EXCHANGE_BATCH_LIMITS.csvBytes) throw new Error('CSV must be 1 MB or smaller.');
  const text = input.replace(/^\uFEFF/, '');
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [], cell = '', quoted = false, closed = false, line = 1, start = 1;
  const finishCell = () => { cells.push(cell.trim()); cell = ''; closed = false; };
  const finishRow = () => {
    finishCell();
    if (cells.some(Boolean)) records.push({ line: start, cells });
    if (records.length > EXCHANGE_BATCH_LIMITS.rows + 1) throw new Error('Use at most 100 listings per CSV.');
    cells = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else {
        if (char === '\r' || char === '\n') {
          if (char === '\r' && text[i + 1] === '\n') i++;
          line++; cell += '\n';
        } else cell += char;
      }
      continue;
    }
    if (char === ',') { finishCell(); continue; }
    if (char === '\r' || char === '\n') {
      finishRow();
      if (char === '\r' && text[i + 1] === '\n') i++;
      line++; start = line; continue;
    }
    if (closed && char !== ' ' && char !== '\t') throw new Error(`CSV line ${line}: unexpected text after a closing quote.`);
    if (closed) continue;
    if (char === '"') {
      if (cell.trim()) throw new Error(`CSV line ${line}: quote inside an unquoted field.`);
      cell = ''; quoted = true;
    } else cell += char;
  }
  if (quoted) throw new Error(`CSV line ${start}: a quoted field is not closed.`);
  if (cell || cells.length || closed) finishRow();
  return records;
}

export function prepareExchangeBatch(csv: string, photos: readonly BatchPhoto[], categories: readonly BatchCategory[]): BatchPreview {
  const preview: BatchPreview = { rows: [], errors: [], unusedPhotos: [] };
  let records: ReturnType<typeof parseExchangeCsv>;
  try { records = parseExchangeCsv(csv); } catch (error) { preview.errors.push((error as Error).message); return preview; }
  if (records.length < 2) { preview.errors.push('Add a header and at least one listing row.'); return preview; }
  const columns = records[0].cells.map(value => normalized(value).replace(/[ -]/g, '_'));
  if (new Set(columns).size !== columns.length) preview.errors.push('CSV contains duplicate column names.');
  for (const column of columns) if (!headers.has(column)) preview.errors.push(`Unknown column: ${column || '(blank)'}. Use the template headers.`);
  for (const column of required) if (!columns.includes(column)) preview.errors.push(`Missing column: ${column}.`);
  if (!categories.length) preview.errors.push('Categories are not available. Reload categories before importing.');
  if (photos.length > EXCHANGE_BATCH_LIMITS.rows * EXCHANGE_BATCH_LIMITS.imagesPerListing) preview.errors.push('Select at most 800 photos per batch.');
  if (photos.reduce((sum, photo) => sum + photo.size, 0) > EXCHANGE_BATCH_LIMITS.totalImageBytes) preview.errors.push('Photos must total 500 MB or less.');
  if (preview.errors.length) return preview;
  const used = new Set<number>();
  const keyRows = new Map<string, BatchRow[]>();
  const knownPaths = new Map<string, number[]>();
  const knownNames = new Map<string, number[]>();
  photos.forEach((photo, index) => {
    const path = normalized(photoPath(photo)), name = normalized(photo.name);
    knownPaths.set(path, [...(knownPaths.get(path) || []), index]);
    knownNames.set(name, [...(knownNames.get(name) || []), index]);
  });
  for (const record of records.slice(1)) {
    const values = Object.fromEntries(columns.map((column, index) => [column, record.cells[index] || '']));
    const row: BatchRow = { line: record.line, key: values.listing_id, title: values.title, payload: {}, photoIndexes: [], errors: [] };
    preview.rows.push(row);
    if (record.cells.length !== columns.length) row.errors.push(`Expected ${columns.length} columns; found ${record.cells.length}.`);
    for (const field of required) if (!values[field]) row.errors.push(`${field} is required.`);
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(row.key)) row.errors.push('listing_id must be 1–80 letters, numbers, underscores or hyphens.');
    const key = normalized(row.key);
    keyRows.set(key, [...(keyRows.get(key) || []), row]);
    if (values.title.length < 5 || values.title.length > 200) row.errors.push('Title must be 5–200 characters.');
    if (values.description.length < 20 || values.description.length > 10000) row.errors.push('Description must be 20–10,000 characters.');
    const validMoney = (value: string) => /^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(value);
    if (!validMoney(values.price)) row.errors.push('Price must be a nonnegative amount with at most two decimal places; omit currency symbols and commas.');
    const matches = categories.filter(category => normalized(category.id) === normalized(values.category) || normalized(category.name) === normalized(values.category));
    if (matches.length !== 1) row.errors.push('Category must match one current Exchange category name or ID.');
    const condition = normalized(values.condition).replace(/[ -]/g, '_');
    if (!['new', 'like_new', 'excellent', 'good', 'fair', 'poor', 'parts_only'].includes(condition)) row.errors.push('Condition must be new, like_new, excellent, good, fair, poor or parts_only.');
    const priceType = normalized(values.price_type || 'fixed');
    if (!['fixed', 'negotiable', 'best_offer', 'trade'].includes(priceType)) row.errors.push('price_type must be fixed, negotiable, best_offer or trade.');
    const state = values.state.toUpperCase();
    if (!states.has(state)) row.errors.push('State must be a valid two-letter US state or territory code.');
    if (!/^\d{5}(-\d{4})?$/.test(values.zip_code)) row.errors.push('ZIP code must have five digits, optionally followed by - plus four digits.');
    if (['unknown', 'n/a', 'none'].includes(normalized(values.county))) row.errors.push('Enter the actual county, not Unknown or N/A.');
    const visibility = normalized(values.location_visibility || 'meetup_only');
    if (!['exact', 'meetup_only'].includes(visibility)) row.errors.push('location_visibility must be exact or meetup_only.');
    const ship = normalized(values.will_ship || 'false');
    if (!['true', 'false', 'yes', 'no', '1', '0'].includes(ship)) row.errors.push('will_ship must be true or false.');
    const willShip = ['true', 'yes', '1'].includes(ship);
    if (values.shipping_cost && !validMoney(values.shipping_cost)) row.errors.push('shipping_cost must be a nonnegative amount with at most two decimals.');
    if (willShip && !values.shipping_cost) row.errors.push('Enter shipping_cost when will_ship is true; use 0 for included shipping.');
    if (!willShip && Number(values.shipping_cost || 0) > 0) row.errors.push('Set will_ship to true before adding a shipping cost.');
    if (values.images) {
      const references = values.images.split('|').map(value => normalized(value.replace(/\\/g, '/')));
      if (references.some(value => !value)) row.errors.push('Remove empty filenames from images.');
      for (const reference of references.filter(Boolean)) {
        const indexes = (reference.includes('/') ? knownPaths.get(reference) : knownNames.get(reference)) || [];
        if (indexes.length !== 1) row.errors.push(`${reference}: ${indexes.length ? 'filename is ambiguous; use a unique name or full relative path' : 'photo is missing'}.`);
        else row.photoIndexes.push(indexes[0]);
      }
    } else if (/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(row.key)) {
      // Full key is anchored: ITEM1 cannot accidentally consume ITEM10 photos.
      const pattern = new RegExp(`^${key}[_-](\\d+)\\.(jpe?g|png|webp)$`, 'i');
      const matching: { index: number; order: number }[] = [];
      photos.forEach((photo, index) => {
        const name = normalized(photo.name);
        const match = name.match(pattern);
        if (match && Number(match[1]) > 0 && Number.isSafeInteger(Number(match[1]))) matching.push({ index, order: Number(match[1]) });
      });
      matching.sort((a, b) => a.order - b.order);
      if (new Set(matching.map(photo => photo.order)).size !== matching.length) row.errors.push('Two photos have the same sequence number. Rename them.');
      row.photoIndexes = matching.map(photo => photo.index);
    }
    if (new Set(row.photoIndexes).size !== row.photoIndexes.length) row.errors.push('A photo is listed more than once.');
    if (!row.photoIndexes.length) row.errors.push('Add at least one matching photo.');
    if (row.photoIndexes.length > EXCHANGE_BATCH_LIMITS.imagesPerListing) row.errors.push('A listing can have at most 8 photos; none will be silently dropped.');
    for (const index of row.photoIndexes) {
      used.add(index);
      const photo = photos[index];
      if (!imageExtension.test(photo.name) || (photo.type && !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type))) row.errors.push(`${photo.name}: use JPG, PNG or WebP.`);
      if (!Number.isFinite(photo.size) || photo.size <= 0 || photo.size > EXCHANGE_BATCH_LIMITS.imageBytes) row.errors.push(`${photo.name}: photo must be nonempty and 10 MB or smaller.`);
    }
    const shippingCost = values.shipping_cost || '0';
    row.payload = {
      title: values.title, description: values.description, price: values.price,
      categoryId: matches[0]?.id, condition, priceType: priceType === 'trade' ? 'best_offer' : priceType,
      city: values.city, state, zipCode: values.zip_code, county: values.county,
      locationVisibility: visibility, willShip, isLocalPickupOnly: !willShip,
      ...(willShip ? { shippingCost, shippingQuote: { carrier: 'usps', serviceName: Number(shippingCost) > 0 ? 'USPS seller-estimated label' : 'USPS included shipping', estimatedCost: Number(shippingCost), buyerPays: Number(shippingCost) > 0, sellerAbsorbs: Number(shippingCost) === 0, labelPurchaseMode: 'seller_external' } } : {}),
      ...(values.brand ? { brand: values.brand } : {}), ...(values.model ? { model: values.model } : {}),
      specifications: { externalListingId: row.key, ...(priceType === 'trade' ? { tradeAccepted: true } : {}) },
    };
  }
  for (const rows of keyRows.values()) if (rows.length > 1) rows.forEach(row => row.errors.push('Duplicate listing_id in this CSV (case-insensitive).'));
  preview.unusedPhotos = photos.filter((_, index) => !used.has(index)).map(photoPath);
  return preview;
}

/** Neutralize spreadsheet formulas in downloadable error/result reports. */
export function exchangeCsvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export const EXCHANGE_BATCH_TEMPLATE = 'listing_id,title,description,price,category,condition,city,state,zip_code,county,images\r\n';
