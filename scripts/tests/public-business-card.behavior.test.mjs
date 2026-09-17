import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = (file) => readFileSync(path.join(root, file), "utf8");
function load(file, mocks = {}) {
  const result = ts.transpileModule(source(file), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.deepEqual(result.diagnostics?.filter((entry) => entry.category === ts.DiagnosticCategory.Error), []);
  const module = { exports: {} };
  const resolve = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "@shared/publicBusinessCard") return load("shared/publicBusinessCard.ts");
    if (name === "@shared/publicListingSafety") return load("shared/publicListingSafety.ts");
    if (name.startsWith(".")) return load(path.join(path.dirname(file), `${name}.ts`));
    throw new Error(`Unmocked import: ${name}`);
  };
  new Function("require", "module", "exports", result.outputText)(resolve, module, module.exports);
  return module.exports;
}
const { toPublicBusinessCardDetails: project, readPublicBusinessImportedRating: rating } = load("shared/publicBusinessCard.ts");
const fixture = {
  tagline: "Repairs and remodels",
  description: "Residential plumbing, fixture replacement and water heater installation.",
  category: "Plumbing",
  services: ["Drain cleaning", "Water heaters", "Leak repair", "Fixture installation", "Repiping"],
  city: "Baton Rouge", stateCode: "la",
  importExtras: { average_rating: "4.8", review_count: "26", email: "private@example.test" },
  phone: "225-555-0199", email: "private@example.test", address: "120 Main Street",
  website: "https://private.example.test", ownerUserId: "private-owner", notes: "private-notes",
};

test("projection preserves useful saved descriptions, services, category and location", () => {
  const result = project(fixture);
  assert.equal(result.tagline, fixture.tagline);
  assert.equal(result.description, fixture.description);
  assert.equal(result.category, fixture.category);
  assert.deepEqual(result.services, fixture.services);
  assert.equal(result.city, "Baton Rouge");
  assert.equal(result.stateCode, "LA");
  assert.deepEqual(result.importedRating, { average: 4.8, reviewCount: 26 });
});
test("projection is an allowlist, not a copy of private business data", () => {
  const result = project(fixture);
  assert.deepEqual(Object.keys(result).sort(), ["category", "city", "description", "importedRating", "services", "stateCode", "tagline"]);
  const serialized = JSON.stringify(result);
  for (const secret of ["private@example.test", "225-555-0199", "120 Main Street", "private.example.test", "private-owner", "private-notes", "google_maps_url", "review_url"]) assert.ok(!serialized.includes(secret), secret);
});
for (const [name, value] of [["absent", undefined], ["null", null], ["array", []], ["string", "data"], ["number", 23]]) {
  test(`malformed ${name} profile produces an empty, honest projection`, () => {
    assert.deepEqual(project(value), { tagline: "", description: "", category: "", services: [], city: "", stateCode: "", importedRating: null });
  });
}
for (const [name, value] of [["email", "ask private@example.test"], ["phone", "call 225-555-0199"], ["address", "visit 120 Main Street"], ["website", "visit https://private.example.test"], ["bare domain", "private.example.test"]]) {
  test(`existing safety owner removes ${name} from newly exposed text`, () => {
    const result = project({ tagline: value, description: value, category: value, services: [value], city: value });
    for (const field of [result.tagline, result.description, result.category, ...result.services, result.city]) {
      assert.ok(field.includes("Continue through TradeScout"));
      assert.ok(!field.includes("private.example.test"));
      assert.ok(!field.includes("private@example.test"));
      assert.ok(!field.includes("225-555-0199"));
      assert.ok(!field.includes("120 Main Street"));
    }
  });
}
test("services are typed, trimmed, deduplicated in original order and bounded", () => {
  const result = project({ services: [null, {}, 42, "", " Drain cleaning ", "drain cleaning", ...Array.from({ length: 30 }, (_, n) => `Service ${n}`)] });
  assert.equal(result.services.length, 12);
  assert.equal(result.services[0], "Drain cleaning");
  assert.equal(result.services[1], "Service 0");
  assert.equal(result.services[11], "Service 10");
});
test("projection neither mutates source records nor coerces objects into text", () => {
  const input = Object.freeze({ services: Object.freeze(["Repairs"]), category: { toString: () => "injected" }, importExtras: Object.freeze({ average_rating: 5, review_count: 2 }) });
  assert.equal(project(input).category, "");
  assert.deepEqual(project(input).services, ["Repairs"]);
});
test("long fields and malformed state stay bounded", () => {
  const result = project({ description: "x".repeat(2000), tagline: "y".repeat(300), category: "z".repeat(200), city: "c".repeat(200), stateCode: "invalid" });
  assert.equal(result.description.length, 1200);
  assert.equal(result.tagline.length, 180);
  assert.equal(result.category.length, 100);
  assert.equal(result.city.length, 100);
  assert.equal(result.stateCode, "");
});
test("ratings accept complete numeric/string evidence including a single review", () => {
  assert.deepEqual(rating(5, "1"), { average: 5, reviewCount: 1 });
  assert.deepEqual(rating(" 4.75 ", 1234), { average: 4.75, reviewCount: 1234 });
});
for (const [average, count] of [[null, 2], ["", 2], [0, 2], [-1, 2], [5.1, 2], [Infinity, 2], [NaN, 2], [true, 2], [[], 2], ["0x5", 2], [4.8, null], [4.8, ""], [4.8, 0], [4.8, -1], [4.8, 1.5], [4.8, true], [4.8, Number.MAX_SAFE_INTEGER + 1]]) {
  test(`incomplete or invalid rating ${String(average)}/${String(count)} is not shown`, () => assert.equal(rating(average, count), null));
}

const jsx = (type, props = {}) => ({ type, props });
const uiMocks = {
  "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
  "lucide-react": Object.fromEntries(["ArrowUpRight", "Building2", "ChevronDown", "MapPin", "Star"].map((name) => [name, (props) => jsx("svg", { ...props, "data-icon": name })])),
  wouter: { Link: (props) => jsx("a", props) },
  "@/components/ShareButton": { ShareButton: (props) => jsx("button", { ...props, children: props.label, "data-share-destination": props.destination }) },
};
const { PublicBusinessCard } = load("client/src/components/directory/PublicBusinessCard.tsx", uiMocks);
function expand(node) {
  if (Array.isArray(node)) return node.map(expand);
  if (!node || typeof node !== "object") return node;
  if (typeof node.type === "function") return expand(node.type(node.props));
  return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
}
function all(node) {
  if (Array.isArray(node)) return node.flatMap(all);
  if (!node || typeof node !== "object") return [];
  return [node, ...all(node.props?.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (node == null || typeof node === "boolean") return "";
  return typeof node === "object" ? text(node.props?.children) : String(node);
}
const business = { id: "b1", slug: "test-plumbing", name: "Test Plumbing", claimStatus: "claimed", counties: [{ fips: "22033", name: "East Baton Rouge Parish", stateCode: "LA" }], card: project(fixture) };
const render = (data = business) => expand(PublicBusinessCard({ business: data }));

test("card renders real services, description and location rather than FIPS-only metadata", () => {
  const content = text(render());
  for (const value of [business.name, fixture.description, "Drain cleaning", "Water heaters", "Baton Rouge, LA", "Repiping"]) assert.ok(content.includes(value), value);
  assert.ok(!content.includes("22033"));
});
test("profile and share actions retain the exact business destination", () => {
  const elements = all(render());
  assert.equal(elements.filter((node) => node.type === "a" && node.props.href === "/business/test-plumbing").length, 2);
  assert.ok(elements.some((node) => node.type === "button" && node.props["data-share-destination"] === "/business/test-plumbing"));
  assert.ok(elements.some((node) => node.props["aria-label"] === "View business: Test Plumbing"));
});
test("slugs cannot escape the existing profile route", () => {
  const elements = all(render({ ...business, slug: "x/y?email=test#hash" }));
  for (const element of elements.filter((node) => node.type === "a")) assert.equal(element.props.href, "/business/x%2Fy%3Femail%3Dtest%23hash");
});
test("claimed is not shown as verified; imported reviews have a separate label", () => {
  const tree = render();
  assert.ok(text(tree).includes("Claimed listing"));
  assert.ok(text(tree).includes("Imported review rating"));
  assert.ok(!all(tree).some((node) => node.props["data-icon"] === "ShieldCheck"));
  assert.ok(!text(tree).includes("Professional Verified"));
});
test("extra services and longer descriptions are available through native disclosure", () => {
  const tree = render({ ...business, card: { ...business.card, description: "Saved business description. ".repeat(20) } });
  assert.ok(all(tree).some((node) => node.type === "details"));
  assert.ok(all(tree).some((node) => node.type === "summary"));
  assert.ok(text(tree).includes("More services"));
  assert.ok(text(tree).includes("Repiping"));
});
test("missing or malformed evidence never invents stars, services, status, availability or media", () => {
  const tree = render({ id: "b", slug: "empty", name: "Empty Business", claimStatus: "unknown", card: null });
  const content = text(tree);
  assert.ok(!all(tree).some((node) => node.props["data-testid"] === "public-business-imported-rating"));
  assert.ok(!content.includes("Claimed listing") && !content.includes("Unclaimed listing"));
  assert.ok(!content.includes("No reviews") && !content.includes("Open now") && !content.includes("Photo coming soon"));
  assert.ok(!all(tree).some((node) => node.type === "img"));
});
test("card revalidates rating values and scrubs business names at the rendering boundary", () => {
  const tree = render({ ...business, name: "Test private@example.test", card: { ...business.card, importedRating: { average: 6, reviewCount: 5 } } });
  assert.ok(!text(tree).includes("private@example.test"));
  assert.ok(!all(tree).some((node) => node.props["data-testid"] === "public-business-imported-rating"));
});

function routeHarness(initialRows = []) {
  const registered = new Map();
  let rows = initialRows;
  let failure = false;
  const calls = { selects: 0, predicates: 0, decisions: [], where: null };
  const schema = Object.fromEntries(["businesses", "businessCounties", "businessSuggestions", "counties", "tsPublicActivity", "users"].map((table) => [table, new Proxy({}, { get: (_, column) => `${table}.${String(column)}` })]));
  const operation = (name) => (...args) => ({ name, args });
  const sql = operation("sql");
  const query = {
    from() { return this; }, innerJoin() { return this; }, leftJoin() { return this; },
    where(value) { calls.where = value; return this; }, orderBy() { return this; }, limit() { return this; },
    async offset() { if (failure) throw new Error("test database failure"); return rows; },
  };
  load("server/routes/business-directory-public.ts", {
    // This suite isolates directory projection. Real media lookup/policy is exercised in the Vitest media suite.
    "../services/publicBusinessCardEnrichment": { enrichPublicBusinessCards: async (items) => items },
    express: { Router: () => ({ get: (url, handler) => registered.set(url, handler), post: () => {} }) },
    "drizzle-orm": { ...Object.fromEntries(["and", "asc", "desc", "eq", "ilike", "or"].map((name) => [name, operation(name)])), sql },
    "../auth": { isAuthenticated: () => {} },
    "../db": { db: { select: () => { calls.selects++; return query; } } },
    "../../shared/schema": schema,
    "../storage": { storage: {} },
    "../../shared/tradeSeo": { getTradeSeoMatch: () => null, normalizeTradeSlug: (value) => value, slugifyCountyName: (value) => value },
    "../../shared/states-counties": { US_STATES_COUNTIES: [] },
    "../publicationRules": { getPublicationRules: async () => ({}) },
    "../../shared/publication": { isPublicAndCrawlableActivity: () => ({ ok: true }), isPublicAndCrawlableBusiness: (signals) => ({ ok: signals.id !== "denied" }) },
    "../publicationBusiness": {
      buildPublicBusinessSignals: (value) => value,
      canServePublicBusinessDetail: (value) => { calls.decisions.push(value); return value.publication.ok; },
      derivePublicationTier: () => "imported", deriveTradeSlugFromProfileData: () => "plumbing",
      publicBusinessDetailExposureSqlPredicate: () => "detail-gate",
      publicBusinessSitemapCrawlabilitySqlPredicate: () => { calls.predicates++; return "public-gate"; },
    },
    "../seoDirectoryCitySlug": { sqlDirectoryCitySlugExpr: () => "city" },
    "../services/seoDirectoryNavigationService": {},
  });
  return {
    calls, setFailure(value) { failure = value; },
    async request(query = { countyFips: "22033" }, authenticated = false) {
      const result = { status: null, body: null, next: false };
      const response = { status(value) { result.status = value; return this; }, json(value) { result.body = value; return this; } };
      await registered.get("/api/businesses")({ query, isAuthenticated: () => authenticated }, response, () => { result.next = true; });
      return result;
    },
  };
}
const row = { ...business, type: "contractor", roleContext: "business", status: "active", updatedAt: new Date(), ownerUserId: "private-owner", publicDiscoveryEnabled: true, profileData: fixture, county: business.counties[0] };

test("actual directory handler adds the allowlisted card in one existing query", async () => {
  const harness = routeHarness([row]);
  const result = await harness.request();
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.items[0].card, project(fixture));
  assert.equal(harness.calls.selects, 1);
  assert.equal(harness.calls.predicates, 1);
  assert.ok(JSON.stringify(harness.calls.where).includes("public-gate"));
  assert.equal(harness.calls.decisions.length, 1);
  for (const value of ["private-owner", "private@example.test", "120 Main Street", "profileData", "ownerVerificationStatus"]) assert.ok(!JSON.stringify(result.body.items).includes(value), value);
});
test("denied exposure never emits an enriched card", async () => {
  const result = await routeHarness([{ ...row, id: "denied" }]).request();
  assert.deepEqual(result.body.items, []);
});
test("grouping retains one business and its returned county records", async () => {
  const harness = routeHarness([row, row, { ...row, county: { fips: "22063", name: "Livingston Parish", stateCode: "LA" } }]);
  const result = await harness.request();
  assert.equal(result.body.items.length, 1);
  assert.equal(result.body.items[0].counties.length, 2);
  assert.deepEqual(result.body.items[0].card.services, fixture.services);
});
test("authenticated public browsing uses the same safe projection; owner API still falls through", async () => {
  const harness = routeHarness([row]);
  assert.equal((await harness.request({ countyFips: "22033" }, true)).next, true);
  assert.equal(harness.calls.selects, 0);
  const result = await harness.request({ countyFips: "22033", public: "1" }, true);
  assert.equal(result.status, 200);
  assert.equal(result.next, false);
  assert.deepEqual(result.body.items[0].card, project(fixture));
});
test("invalid geographic scope never reaches the directory query", async () => {
  const harness = routeHarness([row]);
  assert.equal((await harness.request({})).status, 400);
  assert.equal(harness.calls.selects, 0);
});
test("public result caching does not introduce per-card lookups", async () => {
  const harness = routeHarness([row]);
  await harness.request();
  await harness.request();
  assert.equal(harness.calls.selects, 1);
});
test("database failures remain errors and are not cached as empty business results", async () => {
  const harness = routeHarness([row]);
  harness.setFailure(true);
  assert.equal((await harness.request()).status, 500);
  harness.setFailure(false);
  const result = await harness.request();
  assert.equal(result.status, 200);
  assert.equal(result.body.items.length, 1);
  assert.equal(harness.calls.selects, 2);
});

test("both directory consumers opt into public projection and mount the shared card", () => {
  const directory = source("client/src/pages/business-directory.tsx");
  const county = source("client/src/pages/trade/TradeCountyPage.tsx");
  assert.ok(directory.includes('sp.set("public", "1")'));
  assert.equal((county.match(/public: "1"/g) || []).length, 2);
  for (const text of [directory, county]) assert.ok(text.includes("<PublicBusinessCard key={business.id} business={business} />"));
  assert.ok(county.includes("structuredData={createBreadcrumbStructuredData(breadcrumbs)}"));
  assert.ok(county.includes("noIndex={shouldNoIndex}"));
  assert.ok(county.includes("scoutEstimateHref"));
  assert.ok(county.includes("setOffset((v) => v + limit)"));
});
for (const file of ["shared/publicBusinessCard.ts", "client/src/components/directory/PublicBusinessCard.tsx", "client/src/pages/business-directory.tsx", "client/src/pages/trade/TradeCountyPage.tsx", "server/routes/business-directory-public.ts"]) {
  test(`${file} parses as TypeScript/TSX`, () => {
    const result = ts.transpileModule(source(file), { fileName: file, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } });
    assert.deepEqual(result.diagnostics?.filter((entry) => entry.category === ts.DiagnosticCategory.Error), []);
  });
}
