/** Executes actual sitemap/category declarations; database and HTTP dependencies are fixtures.
 * Run: node --test scripts/tests/exchange-sitemap-canonical.test.cjs
 * This is not native database, full application, production, or Google indexing proof.
 */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const root = process.env.EXCHANGE_CANONICAL_SOURCE_ROOT || process.cwd();
function source(file) {
  return ts.createSourceFile(file, readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}
function declarationText(file, names) {
  const parsed = source(file);
  return names.map((name) => {
    const matches = parsed.statements.filter((statement) =>
      (ts.isFunctionDeclaration(statement) && statement.name?.text === name) ||
      (ts.isVariableStatement(statement) && statement.declarationList.declarations.some((item) => ts.isIdentifier(item.name) && item.name.text === name)));
    assert.equal(matches.length, 1, `${file}: exact declaration ${name} must exist once`);
    return matches[0].getText(parsed);
  }).join('\n');
}
function execute(text, names, dependencies = {}) {
  const context = { ...dependencies, exports: {}, module: { exports: {} } };
  const compiled = ts.transpileModule(`${text}\nmodule.exports = { ${names.join(', ')} };`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(compiled, context, { timeout: 2000 });
  return context.module.exports;
}
const ruleNames = ['EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME', 'getExchangeCategorySlugFromMarketplaceCategoryName'];
const rules = execute(declarationText('shared/exchangeListingRules.ts', ruleNames), ruleNames);
const ownerNames = ['asRecord', 'categorySlugFromValue', 'resolvePersistedExchangeCategorySlug'];
const canonical = execute(declarationText('server/publicExchangeListingHtml.ts', ownerNames), ownerNames, rules);
const parsed = source('server/routes/profiles.ts');
const route = parsed.statements.find((statement) => ts.isExpressionStatement(statement) &&
  ts.isCallExpression(statement.expression) && statement.expression.expression.getText(parsed) === 'router.get' &&
  statement.expression.arguments[0]?.text === '/sitemap-exchange-listings.xml');
assert.ok(route, 'Actual Exchange sitemap registrar must exist');
const callback = route.expression.arguments[1].getText(parsed)
  .replace('await import("../publicExchangeListingHtml")', 'await loadCanonicalOwner()')
  .replace('await import("../../shared/exchangeListingRules")', 'await loadRules()');

async function render({ listings = [], offers = [], authorized, listingError = false, offerError = false } = {}) {
  const read = { canonicalLoads: 0, categories: [], queries: [], sellers: [], fallback: false };
  let body;
  let contentType;
  const allSellers = [...listings.map((row) => row.sellerUserId), ...offers.map((row) => row.seller_user_id)];
  const authority = Object.fromEntries((authorized || allSellers).map((id) => [id, true]));
  const handler = execute(`const handler = ${callback};`, ['handler'], {
    getCanonicalBaseUrl: () => 'https://www.thetradescout.com',
    getTodayYmd: () => '2026-09-16',
    toYmd: (value, fallback) => value ? String(value).slice(0, 10) : fallback,
    buildUrlSet: (rows) => JSON.stringify(rows),
    sendSitemapFallback: () => { read.fallback = true; },
    console: { warn() {}, error() {} },
    storage: { async listActiveExchangeListingsForSitemap() { if (listingError) throw Error('fixture listing read failed'); return listings; } },
    pool: { async query(sql) { read.queries.push(sql); if (offerError) throw Error('fixture offer read failed'); return { rows: offers }; } },
    buildExposureAuthorityMap: async (sellers) => { read.sellers = Array.from(sellers); return authority; },
    loadCanonicalOwner: async () => {
      read.canonicalLoads++;
      return { resolvePersistedExchangeCategorySlug: (listing, categoryName) => {
        read.categories.push(categoryName);
        return canonical.resolvePersistedExchangeCategorySlug(listing, categoryName);
      } };
    },
    loadRules: async () => rules,
    slugifyCategory: (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  }).handler;
  await handler({}, { type(value) { contentType = value; }, send(value) { body = value; } });
  assert.equal(read.fallback, false, 'An unexpected handler error must not masquerade as an empty successful sitemap');
  assert.equal(contentType, 'application/xml');
  return { entries: JSON.parse(body), read };
}
function row(categoryName, id = 'listing', sellerUserId = 'public-owner') {
  return { id, categoryName, sellerUserId, updatedAt: null };
}

test('reported unknown category produces the detail canonical rather than a made-up slug', async () => {
  const id = 'a93737e6-23fc-4a70-937b-827ef7f98daf';
  const result = await render({ listings: [row('smokecategory-1773022418828', id)] });
  assert.equal(result.entries[0].loc, `https://www.thetradescout.com/exchange/other/${id}`);
});

test('all 16 marketplace labels and 16 canonical slugs retain canonical category parity', async () => {
  const rows = Object.entries(rules.EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME).flatMap(([slug, label]) => [row(label, `${slug}-label`), row(` ${slug.toUpperCase()} `, `${slug}-slug`)]);
  const { entries } = await render({ listings: rows });
  assert.equal(entries.length, 32);
  for (let index = 0; index < rows.length; index++) {
    const slug = canonical.resolvePersistedExchangeCategorySlug({}, rows[index].categoryName);
    assert.equal(entries[index].loc, `https://www.thetradescout.com/exchange/${slug}/${rows[index].id}`);
  }
});

test('profile-offer canonical categories and unknown fallback remain aligned', async () => {
  const offers = ['real-estate', 'tools', 'unknown-offer-category'].map((value, index) => ({ id: `offer-${index}`, seller_user_id: 'public-owner', category_slug: value, updated_at: null }));
  const { entries } = await render({ offers });
  assert.deepEqual(entries.map((entry) => entry.loc), ['real-estate', 'tools', 'other'].map((slug, index) => `https://www.thetradescout.com/exchange/${slug}/profile-offer-offer-${index}`));
});

test('audience-gated retail stones never publish bare 404 detail URLs', async () => {
  const { entries, read } = await render({
    listings: [
      row('Building Materials', 'tradescout-stone-aj-quartz', 'stone-owner'),
      row('Tools & Hardware', 'ordinary-tool', 'public-owner'),
    ],
    offers: [{ id: 'offer-1', seller_user_id: 'offer-owner', category_slug: 'tools', updated_at: null }],
  });
  assert.deepEqual(entries.map((entry) => entry.loc), [
    'https://www.thetradescout.com/exchange/tools/ordinary-tool',
    'https://www.thetradescout.com/exchange/tools/profile-offer-offer-1',
  ]);
  assert.deepEqual(read.sellers, ['public-owner', 'offer-owner']);
});

test('missing labels use other, blank ids are omitted, and ids remain encoded', async () => {
  const { entries } = await render({ listings: [row(undefined, 'a/b ?'), row('', 'blank-label'), row('tools', '  ')] });
  assert.deepEqual(entries.map((entry) => entry.loc), ['https://www.thetradescout.com/exchange/other/a%2Fb%20%3F', 'https://www.thetradescout.com/exchange/other/blank-label']);
});

test('unapproved sellers stay out of both listing and profile-offer sitemap projections', async () => {
  const { entries, read } = await render({ listings: [row('tools', 'allowed', 'yes'), row('tools', 'hidden', 'no')], offers: [{ id: 'private', seller_user_id: 'no', category_slug: 'tools' }], authorized: ['yes'] });
  assert.equal(entries.length, 1);
  assert.match(entries[0].loc, /\/allowed$/);
  assert.deepEqual(read.sellers, ['yes', 'no', 'no']);
  assert.match(read.queries[0], /WHERE is_active = true\s+AND offer_type = 'item'/);
  assert.match(read.queries[0], /LIMIT 5000/);
});

test('the route calls the existing detail category owner rather than maintaining another policy', async () => {
  const { read } = await render({ listings: [row('Tools & Hardware')] });
  assert.equal(read.canonicalLoads, 1);
  assert.deepEqual(read.categories, ['Tools & Hardware']);
});

test('existing independent read-failure fallbacks retain the other eligible source', async () => {
  const first = await render({ listingError: true, offers: [{ id: 'kept', seller_user_id: 'public-owner', category_slug: 'tools' }] });
  assert.equal(first.entries.length, 1);
  const second = await render({ offerError: true, listings: [row('Vehicles', 'kept')] });
  assert.equal(second.entries.length, 1);
});
