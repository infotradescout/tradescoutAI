import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

// Executes the actual HTML renderer with controlled catalog/metadata fixtures.
// This is renderer-contract proof, not canonical-catalog, server-route, React,
// authentication, image-loading, full-build, or end-to-end proof.
const origin = "https://www.thetradescout.com";
const templateHtml = '<!doctype html><html><head><title>TradeScout</title></head><body><div id="root"></div></body></html>';
const itemFixtures = {
  "honey-onyx": {
    itemName: "Honey Onyx", category: "Onyx", countryOfOrigin: "Iran", thicknessCm: 2,
    title: "Honey Onyx from Iran | JW Stone Logistics",
    description: "Honey Onyx. Country of origin: Iran. Thickness: 2 cm.",
  },
  "black-dunes": {
    itemName: "Black Dunes", category: "Granite", title: "Black Dunes | JW Stone Logistics",
    description: "Black Dunes granite slab photos.",
  },
};
const categories = [
  { slug: "onyx", name: "Onyx", indexable: true, summary: "Onyx stone listings." },
  { slug: "granite", name: "Granite", indexable: true, summary: "Granite stone listings." },
];
const destination = (profileUrl, route) => `${profileUrl.replace(/\/$/, "")}/${route}`;
const metadata = ({ profileUrl, itemSlug }) => {
  const item = itemFixtures[itemSlug];
  return item ? {
    ...item, itemSlug, hasPublicName: true, hasPublicSummary: true,
    imageUrl: `https://fixture.invalid/${itemSlug}.webp`, imageAlt: item.itemName,
    canonical: destination(profileUrl, `stones/${itemSlug}`),
  } : null;
};
const dependencies = {
  "@shared/brand": { formatTradeScoutTitle: (title) => `${title} | TradeScout` },
  "@shared/jwStonePresentation": { JW_STONE_PUBLIC_IDENTITY: {
    brandName: "JW Stone Logistics", about: "Fixture company description.", foundingDate: "2017",
    address: { streetAddress: "Fixture address", addressLocality: "Pensacola",
      addressRegion: "FL", postalCode: "32505", addressCountry: "US",
      formatted: "Fixture address, Pensacola, FL 32505", mapUrl: "https://fixture.invalid/map" },
    socials: [],
  } },
  "@shared/jwStoneLegacyAliases": { resolveJwStoneLegacyItemSlug: (slug) => slug },
  "@shared/profileCategoryShare": {
    listProfileInventoryCategories: () => categories,
    createProfileInventoryCategoryShareMetadata: ({ profileUrl, categorySlug }) => {
      const category = categories.find((entry) => entry.slug === categorySlug);
      if (!category) return null;
      const itemSlugs = Object.keys(itemFixtures).filter((slug) => itemFixtures[slug].category === category.name);
      return { categoryName: category.name, categorySlug, indexable: true,
        title: `${category.name} | JW Stone Logistics`, description: category.summary,
        canonical: destination(profileUrl, `materials/${categorySlug}`),
        imageUrl: "https://fixture.invalid/category.webp", itemCount: itemSlugs.length, itemSlugs };
    },
  },
  "@shared/profileItemShare": {
    createProfileInventoryItemShareMetadata: metadata,
    listProfileInventoryItems: () => Object.keys(itemFixtures).map((slug) => ({
      slug, hasPublicName: true, publicKind: "offering", publicSummary: itemFixtures[slug].description,
    })),
  },
  "../client/src/data/jwStoneProfilePresentation": { JW_STONE_PUBLIC_DISCOVERY_BLOCK: {} },
  "./jwStoneCanonicalInventory": { JW_STONE_CANONICAL_INVENTORY_CATEGORIES: [] },
  // Retained only to reproduce the rejected banner against the pre-fix renderer.
  "@shared/onyxOrigins": { IRANIAN_ONYX_STOCK: {
    headline: "Iranian onyx · 2 cm", stockLabel: "10,000 sq ft in shared stock",
    stockNote: "One shared total across onyx colors and storefronts.",
  } },
};
const filename = "server/publicJwStoneMarketplaceHtml.ts";
const source = fs.readFileSync(path.resolve(filename), "utf8");
const compiled = ts.transpileModule(source, {
  fileName: filename, reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
assert.deepEqual((compiled.diagnostics || []).filter((entry) => entry.category === ts.DiagnosticCategory.Error), []);
const module = { exports: {} };
vm.runInNewContext(compiled.outputText, {
  exports: module.exports, module, URL,
  require: (name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unmocked dependency: ${name}`);
    return dependencies[name];
  },
}, { filename, timeout: 1000 });
const { buildPublicJwStoneMarketplaceHtml: render, buildJwStoneMarketplaceSitemapXml, buildJwStoneMarketplaceLlmsText } = module.exports;
const schema = (html) => {
  const matches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(matches.length, 1);
  return JSON.parse(matches[0][1]);
};
const noPrivateFields = (value) => assert.doesNotMatch(JSON.stringify(value), /"(?:offers|price|priceSpecification|telephone|email|contactPoint)"|bundlePriceCents|slabPriceCents/);
const exportDirectory = process.env.PROFILE_ORIGIN_HTML_OUTPUT_DIR;
if (exportDirectory) fs.mkdirSync(exportDirectory, { recursive: true });

for (const marketplaceDomainSurface of [false, true]) {
  const label = marketplaceDomainSurface ? "custom" : "platform";
  const options = { templateHtml, marketplaceDomainSurface,
    origin: marketplaceDomainSurface ? "https://jwstonelogistics.com" : origin };
  const collectionUrl = marketplaceDomainSurface ? "https://jwstonelogistics.com/" : `${origin}/jw-stone`;
  const pages = {
    home: render(options),
    onyx: render({ ...options, stoneSlug: "honey-onyx" }),
    unrelated: render({ ...options, stoneSlug: "black-dunes" }),
    category: render({ ...options, materialSlug: "onyx" }),
    unknown: render({ ...options, stoneSlug: "missing-stone" }),
  };
  if (exportDirectory) for (const [name, html] of Object.entries(pages)) {
    fs.writeFileSync(path.join(exportDirectory, `${label}-${name}.html`), html);
  }
  test(`${label}: home omits the rejected banner and site-wide origin promotion`, () => {
    assert.doesNotMatch(pages.home, /Featured Iranian onyx|Explore Honey Onyx|Iranian|Country of origin|10,000|across onyx colors/);
    assert.match(pages.home, /Honey Onyx<\/a>/);
    assert.match(pages.home, /Natural stone.*selected at the source/);
  });
  test(`${label}: home keeps canonical metadata, identity and gated request links`, () => {
    const data = schema(pages.home);
    assert.equal(data.url, collectionUrl);
    assert.equal(data.mainEntity["@type"], marketplaceDomainSurface ? "Store" : "Organization");
    assert.equal(data.mainEntity.countryOfOrigin, undefined);
    assert.equal(data.mainEntity.address.addressCountry, "US");
    assert.match(pages.home, /request=collection/);
    assert.match(pages.home, /materials\/onyx/);
    noPrivateFields(data);
  });
  test(`${label}: onyx origin and thickness stay attached to the named Product`, () => {
    const data = schema(pages.onyx);
    assert.equal(data.mainEntity["@type"], "Product");
    assert.equal(data.mainEntity.name, "Honey Onyx");
    assert.deepEqual(data.mainEntity.countryOfOrigin, { "@type": "Country", name: "Iran" });
    assert.deepEqual(data.mainEntity.additionalProperty, [{ "@type": "PropertyValue", name: "Thickness", value: 2, unitText: "cm" }]);
    assert.equal(data.about.countryOfOrigin, undefined);
    assert.match(pages.onyx, /Country of origin: Iran/);
    assert.match(pages.onyx, /Thickness: 2 cm/);
    assert.match(pages.onyx, /honey-onyx\?request=stone/);
    assert.doesNotMatch(pages.onyx, /Featured Iranian onyx|10,000/);
    noPrivateFields(data);
  });
  test(`${label}: unrelated stone does not inherit onyx facts`, () => {
    assert.doesNotMatch(pages.unrelated, /Iran|countryOfOrigin|"name":"Thickness"/);
    assert.equal(schema(pages.unrelated).mainEntity.name, "Black Dunes");
    noPrivateFields(schema(pages.unrelated));
  });
  test(`${label}: material category keeps its listing links without a banner`, () => {
    const data = schema(pages.category);
    assert.equal(data.mainEntity["@type"], "ItemList");
    assert.equal(data.mainEntity.itemListElement[0].name, "Honey Onyx");
    assert.match(pages.category, /stones\/honey-onyx/);
    assert.doesNotMatch(pages.category, /Featured Iranian onyx|Explore Honey Onyx/);
    noPrivateFields(data);
  });
  test(`${label}: unknown selection remains noindex without promotional fallback`, () => {
    assert.match(pages.unknown, /content="noindex, follow"/);
    assert.doesNotMatch(pages.unknown, /Featured Iranian onyx|Iranian|10,000/);
    assert.equal(schema(pages.unknown).url, collectionUrl);
  });
}

test("sitemap keeps category and individual onyx destinations", () => {
  const xml = buildJwStoneMarketplaceSitemapXml("https://jwstonelogistics.com");
  assert.match(xml, /https:\/\/jwstonelogistics.com\/materials\/onyx/);
  assert.match(xml, /https:\/\/jwstonelogistics.com\/stones\/honey-onyx/);
});
test("discovery text keeps the named onyx destination and gated request method", () => {
  const text = buildJwStoneMarketplaceLlmsText("https://jwstonelogistics.com");
  assert.match(text, /https:\/\/jwstonelogistics.com\/stones\/honey-onyx/);
  assert.match(text, /Express Direct Connect/);
});
