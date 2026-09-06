import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

// Isolated behavior checks: fake records and a fake HTTP response, no database,
// external network, browser, production records or full application build.
const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
function load(relative, mocks = {}) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const compiled = ts.transpileModule(source, {
    fileName: relative, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  assert.equal(compiled.diagnostics?.length || 0, 0, `${relative}: syntax diagnostics`);
  const module = { exports: {} };
  const customRequire = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith("node:")) return require(id);
    throw new Error(`Unmocked dependency: ${id}`);
  };
  vm.runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`, { filename: relative })(customRequire, module, module.exports);
  return module.exports;
}
const routes = load("shared/issaBuildRoutes.ts");
const oldAbout = "Custom Honey Onyx and Multi Green Onyx installations for residential and commercial interiors.";
const services = [{ slug: "kitchen-projects", title: "Kitchen projects in Pensacola", description: "Legacy instruction fixture" }];
const sourceBlocks = [
  { type: "services", data: { items: services } },
  { type: "serviceAreas", data: { areas: ["Pensacola, FL"], description: "Legacy area instruction fixture" } },
  { type: "hero", data: { headerLabel: "Onyx, brought to light.", teaser: oldAbout, eyebrow: "CUSTOM BACKLIT ONYX", logoUrl: "/owner-logo.png", imageUrl: "/owner-photo.jpg" } },
  { type: "about", data: { text: oldAbout } },
  { type: "trust", data: { items: [] } },
  { type: "premiumProduct", data: { presentation: "lux", copy: "Preserve this exact product copy" } },
  { type: "inventoryCatalog", data: { categories: [{ category: "Onyx", stones: [
    { name: "Honey Onyx", slug: "honey-onyx", countryOfOrigin: "Iran", thicknessCm: 2, images: ["/honey.jpg"] },
    { name: "Multi Green Onyx", slug: "multi-green-onyx", countryOfOrigin: "Iran", thicknessCm: 2, images: ["/green.jpg"] },
  ] }] } },
  { type: "publicDiscovery", data: { sitemap: { inventory: true, categories: true } } },
  { type: "cta", data: { heading: "Start with the room." } },
];
const canonical = {
  ISSA_BUILD_BUSINESS_NAME: "ISSA Build", ISSA_BUILD_PROFILE_SLUG: "issa-build", ISSA_BUILD_LOGO: "/logo.png",
  ISSA_BUILD_LOCAL_DISCOVERY: { services, title: "Business title fixture", description: "Business description fixture", headline: "Business headline fixture" },
  ISSA_BUILD_PROFILE_CONTENT_BLOCKS: sourceBlocks,
};
const content = load("shared/issaBuildPageContent.ts", { "./issaBuildProfile": canonical });
const server = load("server/issaBuildPublicRoutes.ts", {
  "@shared/issaBuildProfile": canonical, "@shared/issaBuildPageContent": content, "@shared/issaBuildRoutes": routes,
  "./utils/publicOrigin": { resolvePublicOrigin: () => "https://www.thetradescout.com" },
});

for (const [url, page] of [["/issa-build", "profile"], ["/issa-build/onyx", "onyx"], ["/issa-build/onyx/inventory/honey-onyx", "onyx"], ["/issa-build/onyx/inventory/multi-green-onyx?photo=2", "onyx"]]) {
  test(`distinct destination: ${url}`, () => assert.equal(routes.resolveIssaBuildPublicPage(url), page));
}
for (const [url, target] of [["/u/issa-build", "/issa-build"], ["/p/issa-build", "/issa-build"], ["/u/honey-onyx", "/issa-build/onyx"], ["/p/honey-onyx", "/issa-build/onyx"], ["/u/issa-build/categories/onyx", "/issa-build/onyx"], ["/u/issa-build/inventory/honey-onyx", "/issa-build/onyx/inventory/honey-onyx"], ["/p/issa-build/inventory/multi-green-onyx", "/issa-build/onyx/inventory/multi-green-onyx"]]) {
  test(`legacy redirect preserves referral, photo and fragment: ${url}`, () => {
    const suffix = "?ref=local&photo=2&request=stone#details";
    assert.equal(routes.resolveIssaBuildCanonicalRedirect(url + suffix), target + suffix);
    assert.equal(routes.resolveIssaBuildCanonicalRedirect(target + suffix), null);
  });
}
for (const url of ["/api/u/issa-build", "/u/issa-build/edit", "/jw-stone", "/issa-build-other", "/u/other-business", "//evil.example/issa-build", "https://evil.example/issa-build", "/u/issa-build\r\nLocation:bad", "/u/issa-build\\evil"]) {
  test(`does not intercept ${JSON.stringify(url)}`, () => assert.equal(routes.resolveIssaBuildCanonicalRedirect(url), null));
}
test("only product query selectors move the business visitor to onyx", () => {
  assert.equal(routes.resolveIssaBuildCanonicalRedirect("/issa-build?stone=honey-onyx&photo=2"), "/issa-build/onyx?stone=honey-onyx&photo=2");
  assert.equal(routes.resolveIssaBuildCanonicalRedirect("/issa-build?book=1"), null);
  assert.equal(routes.resolveIssaBuildCanonicalRedirect("/issa-build?edit=1"), null);
});
test("trailing slash canonicalization terminates", () => {
  for (const url of ["/issa-build/", "/issa-build/onyx/"]) {
    const next = routes.resolveIssaBuildCanonicalRedirect(url);
    assert.equal(next, url.slice(0, -1));
    assert.equal(routes.resolveIssaBuildCanonicalRedirect(next), null);
  }
});
test("business projection removes the product presentation but preserves owner media", () => {
  const blocks = content.buildIssaBuildBusinessContentBlocks(sourceBlocks);
  assert.equal(blocks.some((block) => block.type === "premiumProduct"), false);
  assert.equal(blocks.find((block) => block.type === "hero").data.logoUrl, "/owner-logo.png");
  assert.equal(blocks.find((block) => block.type === "hero").data.imageUrl, "/owner-photo.jpg");
  assert.equal(blocks.find((block) => block.type === "hero").data.text, canonical.ISSA_BUILD_LOCAL_DISCOVERY.headline);
  assert.equal(blocks.some((block) => block.type === "about"), false);
});
test("owner-authored text, links, galleries and unrelated blocks are not replaced", () => {
  const owner = [{ type: "hero", data: { title: "The owner's actual title", text: "The owner's actual introduction", instagramUrl: "https://example.test/owner" } }, { type: "about", data: { text: "The owner's own onyx business story" } }, { type: "gallery", data: { images: ["/project-original.jpg"] } }, { type: "custom", data: { text: "Do not replace this" } }, { type: "cta", data: { heading: "Owner CTA" } }];
  const result = content.buildIssaBuildBusinessContentBlocks(owner);
  for (const block of owner) assert.deepEqual(result.find((entry) => entry.type === block.type), block);
});
test("business projection is idempotent and does not mutate its input", () => {
  const original = JSON.stringify(sourceBlocks);
  const first = content.buildIssaBuildBusinessContentBlocks(sourceBlocks);
  assert.deepEqual(content.buildIssaBuildBusinessContentBlocks(first), first);
  assert.equal(JSON.stringify(sourceBlocks), original);
});
test("both named stones retain origin, thickness and supplied images", () => {
  const business = content.buildIssaBuildBusinessContentBlocks(sourceBlocks);
  const product = content.buildIssaBuildOnyxContentBlocks();
  for (const blocks of [business, product]) assert.deepEqual(blocks.find((block) => block.type === "inventoryCatalog"), sourceBlocks.find((block) => block.type === "inventoryCatalog"));
});
test("product retains exact source copy but not broad business service blocks", () => {
  const product = content.buildIssaBuildOnyxContentBlocks();
  assert.deepEqual(product, sourceBlocks.filter((block) => !["services", "serviceAreas"].includes(block.type)));
  product.find((block) => block.type === "premiumProduct").data.copy = "Test mutation";
  assert.equal(sourceBlocks.find((block) => block.type === "premiumProduct").data.copy, "Preserve this exact product copy");
});
test("only exact old service instruction descriptions are removed", () => {
  const result = content.buildIssaBuildBusinessContentBlocks(sourceBlocks);
  assert.equal(result.find((block) => block.type === "services").data.items[0].description, undefined);
  const edited = [{ type: "services", data: { items: [{ ...services[0], description: "Owner service wording" }] } }];
  assert.equal(content.buildIssaBuildBusinessContentBlocks(edited).find((block) => block.type === "services").data.items[0].description, "Owner service wording");
});
test("old product-only SEO title is not the business title; owner text survives", () => {
  assert.equal(content.issaBuildBusinessText("ISSA Build | Luxury Translucent Onyx", "Business"), "Business");
  assert.equal(content.issaBuildBusinessText("Owner approved onyx and kitchen headline", "Business"), "Owner approved onyx and kitchen headline");
});
test("verification remains one existing trust entry, not a product banner", () => {
  const trust = content.buildIssaBuildBusinessContentBlocks(sourceBlocks).find((block) => block.type === "trust");
  assert.deepEqual(trust.data.items, ["100% Verified by TradeScout"]);
});
test("URL rewriting changes only supported public destinations", () => {
  const transform = server.canonicalizeIssaBuildDocumentUrls;
  assert.equal(transform('href="/u/issa-build"'), 'href="/issa-build"');
  assert.equal(transform('href="/u/issa-build/categories/onyx"'), 'href="/issa-build/onyx"');
  assert.equal(transform('href="/u/issa-build/inventory/honey-onyx?photo=2"'), 'href="/issa-build/onyx/inventory/honey-onyx?photo=2"');
  for (const url of ["/api/u/issa-build", "/api/u/issa-build/categories/onyx", "/api/u/issa-build/inventory/honey-onyx", "/u/issa-build/gallery/room", "/u/issa-build/edit", "/u/issa-build-other", "/u/jw-stone"]) assert.equal(transform(url), url);
});
async function request(url, options = {}) {
  let middleware, rendered, reads = 0, next = false;
  const app = { use: (handler) => { middleware = handler; } };
  server.registerIssaBuildPublicRoutes(app, {
    readTemplate: () => "<html></html>",
    readProfile: async (slug) => { reads++; assert.equal(slug, "issa-build"); return options.missing ? null : { slug, seoMeta: {} }; },
    renderProfile: async (args) => { rendered = args; return options.empty ? null : options.html || '<a href="/u/issa-build">ISSA Build</a>'; },
  });
  const parsed = new URL(url, "https://www.thetradescout.com");
  const req = { method: options.method || "GET", headers: { host: options.host || "www.thetradescout.com" }, originalUrl: url, path: parsed.pathname, query: Object.fromEntries(parsed.searchParams), protocol: "https" };
  const res = { statusCode: 200, headers: {}, body: null, location: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
    redirect(code, target) { this.statusCode = code; this.location = target; return this; },
    type(value) { this.contentType = value; return this; },
  };
  await middleware(req, res, () => { next = true; });
  return { res, rendered, reads, next };
}
test("business and onyx server pages pass different page identities to the existing renderer", async () => {
  const business = await request("/issa-build");
  const product = await request("/issa-build/onyx");
  assert.equal(business.rendered.categorySlug, undefined);
  assert.equal(business.rendered.pageMetadata.canonical, "https://www.thetradescout.com/issa-build");
  assert.equal(business.rendered.pageMetadata.ogType, "profile");
  assert.equal(product.rendered.categorySlug, "onyx");
  assert.equal(product.rendered.pageMetadata.canonical, "https://www.thetradescout.com/issa-build/onyx");
});
test("individual stone metadata and photo validation remain owned by the existing renderer", async () => {
  const result = await request("/issa-build/onyx/inventory/honey-onyx?photo=2");
  assert.equal(result.rendered.itemSlug, "honey-onyx");
  assert.equal(result.rendered.itemPhoto, "2");
  assert.equal(result.rendered.pageMetadata.canonical, undefined);
  assert.equal(result.rendered.pageMetadata.description, undefined);
  assert.equal(result.rendered.pageMetadata.ogType, "product");
});
test("public visibility failure returns 404 without rendering", async () => {
  const result = await request("/issa-build", { missing: true });
  assert.equal(result.res.statusCode, 404);
  assert.equal(result.res.headers["Cache-Control"], "no-store");
  assert.equal(result.rendered, undefined);
});
test("invalid stone requests are not rendered as a successful business profile", async () => {
  for (const url of ["/issa-build/onyx?stone=unknown", "/issa-build/onyx/inventory/unknown"]) {
    const result = await request(url);
    assert.equal(result.res.statusCode, 404);
    assert.equal(result.rendered, undefined);
  }
});
test("other custom domains and non-GET requests are not intercepted", async () => {
  for (const options of [{ host: "another-business.example" }, { method: "POST" }]) {
    const result = await request("/issa-build", options);
    assert.equal(result.next, true);
    assert.equal(result.reads, 0);
  }
});
test("HEAD follows the same canonical handler without creating records", async () => {
  const result = await request("/issa-build/onyx", { method: "HEAD" });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.rendered.categorySlug, "onyx");
});
test("missing rendered profile is not cached as a successful public page", async () => {
  const result = await request("/issa-build", { empty: true });
  assert.equal(result.res.statusCode, 404);
  assert.equal(result.res.headers["Cache-Control"], "no-store");
});
