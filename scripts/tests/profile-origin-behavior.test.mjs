import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

// Dependency-isolated logic tests: execute the real TSX with mocked imports and
// a JSX element recorder. These are NOT React DOM, browser, CSS, end-to-end,
// authentication, or production proof. Unknown dependencies fail closed.
const ROOT = process.cwd();
const noop = () => {};
const element = (type, props) => ({ type, props: props || {} });
const jsxRuntime = { jsx: element, jsxs: element, Fragment: "fragment" };
const icons = Object.fromEntries(
  ["ArrowLeft", "ArrowRight", "Bookmark", "BookmarkCheck", "MessageCircle", "CheckCircle2", "ShieldCheck"]
    .map((name) => [name, `icon:${name}`])
);

function load(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  const result = ts.transpileModule(source, {
    fileName: relativePath,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  assert.equal((result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0);
  const imports = { "react/jsx-runtime": jsxRuntime, "lucide-react": icons, ...dependencies };
  const module = { exports: {} };
  vm.runInNewContext(result.outputText, {
    module,
    exports: module.exports,
    require: (name) => {
      assert.ok(Object.hasOwn(imports, name), `Unmocked dependency: ${name}`);
      return imports[name];
    },
  }, { filename: relativePath, timeout: 1000 });
  return module.exports;
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  return tree && typeof tree === "object" ? text(tree.props?.children) : "";
}
function byType(tree, type) { return nodes(tree).filter((node) => node.type === type); }
function byId(tree, id) { return nodes(tree).find((node) => node.props["data-testid"] === id); }
function specs(tree) {
  return Object.fromEntries(byType(tree, "dl").flatMap((list) =>
    nodes(list).filter((node) => node.type === "div" && byType(node, "dt").length === 1)
      .map((row) => [text(byType(row, "dt")[0]), text(byType(row, "dd")[0])])
  ));
}

const { MarketplaceIntroduction } = load("client/src/features/jw-stone/MarketplaceIntroduction.tsx", {
  "./JWStoneMarketplace.exact-surfaces.css": {},
});

function detail(overrides = {}, handlers = {}) {
  const { StoneDetailDialog } = load("client/src/features/jw-stone/StoneDetailDialog.tsx", {
    "@/components/ui/dialog": Object.fromEntries(
      ["Dialog", "DialogContent", "DialogDescription", "DialogTitle"].map((name) => [name, name])
    ),
    "./brand": { JW_STONE_BRAND_STYLE: {}, jw: {} },
    "./firstCut": { isFirstCutDetailStone: (stone) => stone.firstCut === true },
    "./JwStoneShareControl": { JwStoneShareControl: "JwStoneShareControl" },
    "./JwStoneMemberPricing": { JwStoneMemberPriceDisplay: "JwStoneMemberPriceDisplay" },
    "./marketplaceRoutes": {
      firstCutShareDestination: () => "/jw-stone/first-cut",
      stoneShareDestination: (slug) => `/jw-stone/stones/${slug}`,
    },
    "./stoneFacts": {
      availabilityDetailLabel: (stone) => stone.availabilityLabel || null,
      confirmedFinishes: (stone) => stone.finishes || [],
      formatDimensionsForDisplay: (dimensions) => dimensions || null,
    },
    "./useMomentumRail": { useMomentumRail: () => ({
      activeIndex: 0, railRef: null, onScroll: noop, scrollToIndex: noop,
    }) },
  });
  const stone = {
    id: "test-stone", publicLabel: "Stone selection", images: ["/fixture-stone.jpg"],
    wishlistEligible: true, ...overrides,
  };
  return { stone, tree: StoneDetailDialog({
    stone, saved: false, onOpenChange: noop, onToggleSaved: noop, onAsk: noop, ...handlers,
  }) };
}

function profile(blocks = [], overrides = {}) {
  let requestOpen = false;
  const { default: Frame } = load("client/src/pages/profile-sites/IssaBuildProfileTruthFrame.tsx", {
    react: {
      useState: () => [requestOpen, (value) => { requestOpen = value; }],
      useMemo: (factory) => factory(),
    },
    "./ExpressDirectConnectPanel": { __esModule: true, default: "ExpressDirectConnectPanel" },
    "./WholesalerProfileThemeLegacy": { __esModule: true, default: "LegacyWholesalerProfileTheme" },
    "@shared/issaBuildProfile": { ISSA_BUILD_LOCAL_DISCOVERY: {
      description: "Pensacola-area kitchens, bathrooms, cabinets, countertops and fabrication.",
      services: [{ title: "Kitchen remodeling", description: "Kitchen projects" }],
    } },
    "@shared/pensacolaDiscovery": { pensacolaProjectMessage: (kind) => `request:${kind}` },
  });
  return () => Frame({
    contentBlocks: blocks, profileSlug: "issa-build", displayName: "ISSA Build",
    platformBaseHref: "/", hasViewerSession: false, allowExpressCall: false, ...overrides,
  });
}

test("JW hero: no banner, added CTA, origin copy or replaced media", () => {
  let invoked = false;
  const tree = MarketplaceIntroduction({ onExploreOnyx: () => { invoked = true; } });
  assert.equal(byType(tree, "section").length, 1);
  assert.equal(byType(tree, "h1").length, 1);
  assert.equal(byType(tree, "a").length + byType(tree, "button").length, 0);
  assert.equal(text(byType(tree, "h1")[0]), "Natural stone, selected at the source.");
  assert.equal(byType(tree, "video")[0].props.poster, "/images/businesses/jw-stone/video/hero-poster.jpg");
  assert.equal(byType(tree, "source")[0].props.src, "/images/businesses/jw-stone/video/hero.mp4");
  assert.doesNotMatch(text(tree), /Iran|country of origin/i);
  assert.equal(invoked, false);
});

test("ISSA wrapper: profile comes first without an added band, navigation or request button", () => {
  const tree = profile()();
  assert.equal(byType(tree, "nav").length, 0);
  assert.equal(byType(tree, "a").length, 0);
  assert.equal(byType(tree, "section").length, 0);
  assert.equal(byType(tree, "button").length, 0);
  assert.equal(byId(tree, "issa-build-verification-band"), undefined);
  assert.equal(tree.props.children[0].type, "LegacyWholesalerProfileTheme");
  assert.doesNotMatch(text(tree), /Iran|country of origin/i);
});

test("ISSA adapter: listing origin, thickness, photos and unrelated blocks survive unchanged", () => {
  const catalog = { type: "inventoryCatalog", data: { categories: [{ stones: [
    { slug: "honey-onyx", countryOfOrigin: "Iran", thicknessCm: 2, images: ["/honey.jpg"] },
    { slug: "multi-green-onyx", countryOfOrigin: "Iran", thicknessCm: 2, images: ["/green.jpg"] },
  ] }] } };
  const gallery = { type: "gallery", data: { images: ["/project.jpg"] } };
  const blocks = [catalog, gallery, { type: "about", data: { text: "Old introduction" } }];
  const original = JSON.stringify(blocks);
  const tree = profile(blocks)();
  const result = byType(tree, "LegacyWholesalerProfileTheme")[0].props.contentBlocks;
  assert.strictEqual(result[0], catalog);
  assert.strictEqual(result[1], gallery);
  assert.strictEqual(result[2], blocks[2]);
  assert.doesNotMatch(result[2].data.text, /Iran|country of origin/i);
  assert.equal(JSON.stringify(blocks), original);
});

test("ISSA request: opens only through an existing request control and closes again", () => {
  const render = profile();
  const panel = () => byType(render(), "ExpressDirectConnectPanel")[0].props;
  assert.equal(panel().open, false);
  byType(render(), "LegacyWholesalerProfileTheme")[0].props.onProjectRequest();
  assert.equal(panel().open, true);
  assert.equal(panel().profileSlug, "issa-build");
  assert.equal(panel().requestMode, "service");
  assert.equal(panel().initialRequestType, "request_quote");
  assert.equal(panel().initialMessage, "request:project");
  assert.equal(panel().hasViewerSession, false);
  assert.equal(panel().allowCall, false);
  panel().onClose();
  assert.equal(panel().open, false);
  assert.equal(byType(render(), "button").length, 0);
  byType(render(), "LegacyWholesalerProfileTheme")[0].props.onProjectRequest();
  assert.equal(panel().open, true);
});

for (const name of ["Honey Onyx", "Multi Green Onyx"]) {
  test(`${name}: origin and 2 cm are listing specifications, not extra sections`, () => {
    const { tree } = detail({ displayName: name, materialLabel: "Onyx", origin: { country: "Iran" }, thicknessCm: 2 });
    assert.deepEqual(specs(tree), { Material: "Onyx", "Country of origin": "Iran", Thickness: "2 cm" });
    assert.equal(byType(tree, "section").length, 0);
    assert.equal(byType(tree, "dl").length, 1);
    assert.equal(byId(tree, "jw-stone-detail-pending"), undefined);
  });
}

test("Known thickness alone appears without inventing origin or hiding it behind pending text", () => {
  const { tree } = detail({ thicknessCm: 2 });
  assert.deepEqual(specs(tree), { Thickness: "2 cm" });
  assert.equal(byId(tree, "jw-stone-detail-pending"), undefined);
});

for (const value of [undefined, 0, -2, NaN, Infinity, "2"]) {
  test(`Invalid or missing thickness ${String(value)} is not published as a specification`, () => {
    const { tree } = detail({ materialLabel: "Onyx", thicknessCm: value });
    assert.deepEqual(specs(tree), { Material: "Onyx" });
    assert.doesNotMatch(text(tree), /Country of origin/);
  });
}

test("Unconfirmed selection keeps pending text and does not borrow Iranian origin", () => {
  const { tree } = detail();
  assert.equal(byType(tree, "dl").length, 0);
  assert.ok(byId(tree, "jw-stone-detail-pending"));
  assert.doesNotMatch(text(tree), /Iran|2 cm|Country of origin/);
});

test("Stone request and save callbacks still receive the exact selected stone", () => {
  const calls = [];
  const { tree, stone } = detail({ displayName: "Honey Onyx", origin: { country: "Iran" }, thicknessCm: 2 }, {
    onAsk: (selected) => calls.push(["ask", selected]),
    onToggleSaved: (selected) => calls.push(["save", selected]),
  });
  assert.equal(calls.length, 0);
  byId(tree, "jw-stone-detail-ask").props.onClick();
  byId(tree, "jw-stone-detail-save").props.onClick();
  assert.deepEqual(calls, [["ask", stone], ["save", stone]]);
});

test("Stone details still delegate prices to the existing member-price component", () => {
  const { tree } = detail({ displayName: "Honey Onyx", thicknessCm: 2 });
  const pricing = byType(tree, "JwStoneMemberPriceDisplay");
  assert.equal(pricing.length, 1);
  assert.equal(pricing[0].props.stoneName, "Honey Onyx");
  assert.equal(pricing[0].props.presentation, "detail");
  assert.doesNotMatch(text(tree), /\$\s*\d/);
});


test("ISSA verification stays in the existing trust area with caller actions intact", () => {
  const originalActions = element("ExistingTrustActions", { children: "Recommend / Favorite / Share" });
  const tree = profile([], { trustActions: originalActions })();
  const trust = byType(tree, "LegacyWholesalerProfileTheme")[0].props.trustActions;
  const badge = byId(trust, "issa-build-verification-status");
  assert.ok(badge);
  assert.equal(text(badge), "100% Verified by TradeScout");
  assert.strictEqual(byType(trust, "ExistingTrustActions")[0], originalActions);
  assert.equal(byType(trust, "section").length + byType(trust, "button").length, 0);
  assert.equal(byId(tree, "issa-build-verification-status"), undefined);
});

test("ISSA service facts remain without replacing existing trust copy or material data", () => {
  const chapter = { slug: "honey-onyx", countryOfOrigin: "Iran", thicknessCm: 2 };
  const originalTrust = { type: "trust", data: { items: ["Existing trust copy"] } };
  const tree = profile([
    originalTrust,
    { type: "premiumProduct", data: { luxuryHouse: { materialChapters: [chapter] } } },
  ])();
  const blocks = byType(tree, "LegacyWholesalerProfileTheme")[0].props.contentBlocks;
  assert.strictEqual(blocks[0], originalTrust);
  const house = blocks[1].data.luxuryHouse;
  assert.strictEqual(house.materialChapters[0], chapter);
  const services = Array.from(house.capabilities.items, (item) => item.title);
  for (const service of ["Kitchen remodeling", "Custom onyx fabrication", "Backlighting design and installation", "Project fulfillment"]) {
    assert.ok(services.includes(service), service);
  }
  assert.ok(house.capabilities.items.every((item) => item.body === ""));
  assert.equal(byType(tree, "ul").length, 0);
});

test("ISSA presentation preserves existing headline, introduction, section and request wording", () => {
  const input = [
    { type: "hero", data: { eyebrow: "Existing eyebrow", headerLabel: "Existing headline", teaser: "Existing teaser" } },
    { type: "about", data: { text: "Existing introduction" } },
    { type: "cta", data: { heading: "Existing CTA heading", description: "Existing CTA copy" } },
    { type: "premiumProduct", data: { luxuryHouse: {
      designedWithLight: { title: "Existing light heading", body: "Existing light copy" },
      capabilities: { title: "Existing service heading", body: "Existing service copy", items: [] },
      consultation: { title: "Existing request heading", body: "Existing request copy" },
    } } },
  ];
  const before = JSON.stringify(input);
  const tree = profile(input)();
  const output = byType(tree, "LegacyWholesalerProfileTheme")[0].props.contentBlocks;
  for (const index of [0, 1, 2]) assert.strictEqual(output[index], input[index]);
  const actual = output[3].data.luxuryHouse;
  const original = input[3].data.luxuryHouse;
  assert.strictEqual(actual.designedWithLight, original.designedWithLight);
  assert.strictEqual(actual.consultation, original.consultation);
  assert.equal(actual.capabilities.title, original.capabilities.title);
  assert.equal(actual.capabilities.body, original.capabilities.body);
  assert.equal(JSON.stringify(input), before);
});

test("ISSA setup preserves canonical wording instead of injecting a second copy layer", () => {
  const chapter = { slug: "honey-onyx", countryOfOrigin: "Iran", thicknessCm: 2, images: ["/honey.jpg"] };
  const input = [
    { type: "hero", data: { eyebrow: "Existing eyebrow", headerLabel: "Existing headline", teaser: "Existing teaser" } },
    { type: "about", data: { text: "Existing introduction" } },
    { type: "cta", data: { heading: "Existing CTA heading", description: "Existing CTA copy" } },
    { type: "trust", data: { items: ["Existing trust fact"] } },
    { type: "premiumProduct", data: { luxuryHouse: {
      designedWithLight: { title: "Existing light heading", body: "Existing light copy" },
      capabilities: { title: "Existing service heading", body: "Existing service copy", items: [] },
      consultation: { title: "Existing request heading", body: "Existing request copy" },
      materialChapters: [chapter],
    } } },
    { type: "inventoryCatalog", data: { categories: [{ stones: [chapter] }] } },
  ];
  const before = JSON.stringify(input);
  const { buildVerifiedIssaBuildContentBlocks } = load("server/services/issaBuildVerifiedProfileNormalization.ts", {
    "drizzle-orm": { eq: noop },
    "@shared/issaBuildProfile": {
      ISSA_BUILD_PROFILE_CONTENT_BLOCKS: input,
      ISSA_BUILD_PROFILE_SLUG: "issa-build",
      ISSA_BUILD_BUSINESS_NAME: "ISSA Build",
      ISSA_BUILD_LOCAL_DISCOVERY: {
        description: "Existing search description",
        services: [{ title: "Kitchen remodeling" }],
      },
    },
    "@shared/businessDiscoveryAuthority": { LOCATION_CONFIRMED_PER_REQUEST_SERVICE_AREA_MODE: "per_request" },
    "@shared/schema": { businesses: {}, profiles: {} },
    "../db": { db: { transaction: () => { throw new Error("Database must not be used by this isolated copy check"); } } },
  });
  const output = buildVerifiedIssaBuildContentBlocks();
  for (const index of [0, 1, 2, 5]) assert.equal(JSON.stringify(output[index]), JSON.stringify(input[index]));
  const actual = output[4].data.luxuryHouse;
  const original = input[4].data.luxuryHouse;
  for (const key of ["designedWithLight", "consultation", "materialChapters"]) {
    assert.equal(JSON.stringify(actual[key]), JSON.stringify(original[key]));
  }
  assert.equal(actual.capabilities.title, original.capabilities.title);
  assert.equal(actual.capabilities.body, original.capabilities.body);
  assert.ok(actual.capabilities.items.some((item) => item.title === "Kitchen remodeling"));
  assert.ok(output[3].data.items.includes("100% Verified by TradeScout"));
  assert.ok(output[3].data.items.includes("Existing trust fact"));
  assert.equal(JSON.stringify(input), before);
});
