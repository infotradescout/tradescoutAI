// Executes component functions/event handlers with mocked React/query/UI ports.
// This is not a DOM renderer, browser journey, or live network/email test.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import * as cart from "../shared/jwStoneCart.ts";
import * as saved from "../client/src/features/jw-stone/jwStoneSavedLotsStore.ts";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = new URL("../", import.meta.url);
const id = n => `stone_${n.toString(16).padStart(32, "0")}`;
const lot = { id: id(1), stoneName: "Test granite" };
const item = { id: id(1), materialName: "Test granite", imageUrls: [], dimensions: null, quantity: 2 };
const plain = value => JSON.parse(JSON.stringify(value));
const ui = Object.fromEntries(["Sheet", "SheetContent", "SheetDescription", "SheetHeader", "SheetTitle"].map(key => [key, key]));
const icons = Object.fromEntries(["Bookmark", "MessageCircle", "Trash2", "Copy", "Mail", "Minus", "Plus", "ShoppingCart"].map(key => [key, key]));
function nodes(root) {
  if (root === null || root === undefined || typeof root === "boolean") return [];
  if (Array.isArray(root)) return root.flatMap(nodes);
  if (typeof root !== "object") return [];
  return [root, ...nodes(root.props?.children)];
}
function text(root) {
  if (root === null || root === undefined || typeof root === "boolean") return "";
  if (Array.isArray(root)) return root.map(text).join("");
  if (typeof root !== "object") return String(root);
  return text(root.props?.children);
}
const button = (tree, label) => nodes(tree).find(node => node.type === "button" && text(node).includes(label));
const node = (tree, type) => nodes(tree).find(entry => entry.type === type);
async function moduleAt(path, deps, context = createContext({ console })) {
  const raw = await readFile(new URL(path, root), "utf8");
  const source = path.endsWith(".tsx") ? ts.transpileModule(raw, { fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText : stripTypeScriptTypes(raw);
  const module = new SourceTextModule(source, { context });
  await module.link(async name => {
    const exports = deps[name]; if (!exports) throw new Error(`Unexpected dependency ${name} in ${path}`);
    return new SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  });
  await module.evaluate(); return module.namespace;
}
function fixture(options = {}) {
  const slots = []; let cursor = 0; const queries = []; const requests = []; const copied = [];
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect() { cursor++; },
    useMemo(fn, deps) { const index = cursor++; const prior = slots[index]; if (!prior || !equal(deps, prior.deps)) slots[index] = { value: fn(), deps }; return slots[index].value; },
    useSyncExternalStore(_subscribe, getSnapshot) { cursor++; return getSnapshot(); },
    createContext(value) { return { Provider: "context-provider", defaultValue: value }; },
    useContext(context) { cursor++; return options.contextValue || context.defaultValue; },
  };
  const port = options.storage || { getItem: () => null, setItem: () => {} };
  const context = createContext({ console, AbortController, window: { localStorage: port, confirm: () => true }, navigator: { clipboard: options.clipboardFailure ? { writeText: async () => { throw new Error("Clipboard blocked"); } } : { writeText: async value => { copied.push(value); } } } });
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  class ApiError extends Error { constructor(message, values = {}) { super(message); Object.assign(this, values); } }
  const deps = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "lucide-react": icons,
    "@/components/ui/sheet": ui,
    "@/hooks/useAuth": { useAuth: () => options.auth || { user: null, isAuthenticated: false } },
    "@/lib/queryClient": { ApiError, apiRequest: async (...args) => { requests.push(args); return options.apiResult ?? { sent: true }; } },
    "@tanstack/react-query": { useQuery(config) {
      queries.push(config);
      if (config.queryKey[1] === "cart-access") return { data: { viewerId: "member-a", allowed: options.member !== false }, dataUpdatedAt: 1, isError: false };
      if (config.queryKey[1] === "cart-review") return { isError: false, isFetching: false, refetch: async () => {} };
      return { data: { profileSlug: "jw-stone", items: options.items ?? [item] }, isError: false, isFetching: false, refetch: async () => {}, ...(options.query || {}) };
    } },
    "@/pages/profile-sites/ExpressDirectConnectPanel": { default: "request-panel" },
    "./brand": { JW_STONE_BRAND_STYLE: {}, jw: { ghostOnLight: "ghost", accentCta: "accent", page: "page", border: "border", surface: "surface", muted: "muted", field: "field" } },
    "./jwStoneSavedLotsStore": saved,
    "./JwStoneArrivalGallery": { JwStoneArrivalGallery: "gallery" },
    "./JwStoneArrivalPrice": { JwStoneArrivalPrice: "price" },
    "./JwStoneSavedLotsSection": { JwStoneSavedLotsSection: "saved-lots" },
    "./useJwStoneWishlist": { useJwStoneWishlist: () => ({ notice: "", savedLots: options.savedLots ?? [lot] }) },
    "./useJwStoneSavedLots": { useJwStoneSavedLots: () => options.savedStore || ({ restored: true, isSaved: () => false, toggle() {} }) },
    "@shared/jwStoneCart": cart,
  };
  return { context, deps, queries, requests, copied,
    async load(path, additions = {}) { return moduleAt(path, { ...deps, ...additions }, context); },
    render(component, props) { cursor = 0; return component(props); },
  };
}
const path = name => `client/src/features/jw-stone/${name}.tsx`;

test("save-lot control is disabled until restore and reports selected state", async () => {
  const f = fixture({ savedStore: { restored: false, isSaved: () => true, toggle() {} } });
  const m = await f.load(path("JwStoneLotActions")); const result = f.render(m.JwStoneSaveLotButton, { item });
  assert.equal(result.props.disabled, true); assert.equal(result.props["aria-pressed"], true);
});
test("save-lot click passes the exact inventory record, not a catalog alias", async () => {
  let received; const f = fixture({ savedStore: { restored: true, isSaved: () => false, toggle(value) { received = value; } } });
  const m = await f.load(path("JwStoneLotActions")); f.render(m.JwStoneSaveLotButton, { item }).props.onClick();
  assert.equal(received.id, item.id);
});
test("arrival inquiry opens with exact lot ID and does not pretend a guest has a session", async () => {
  const f = fixture(); const m = await f.load(path("JwStoneLotActions")); let tree = f.render(m.JwStoneLotActions, { item });
  button(tree, "Ask about this arrival").props.onClick(); tree = f.render(m.JwStoneLotActions, { item });
  const panel = node(tree, "request-panel"); assert.ok(panel.props.initialMessage.includes(item.id)); assert.equal(panel.props.hasViewerSession, false);
  assert.equal(panel.props.initialRequestType, "request_material");
});
test("saved listed lots use current data and close the saved panel when opening a cart", async () => {
  let opened = false; const f = fixture(); const m = await f.load(path("JwStoneSavedLotsSection"));
  const tree = f.render(m.JwStoneSavedLotsSection, { open: true, lots: [lot], onRemove() {}, onAsk() {}, onCartOpen() { opened = true; } });
  assert.equal(node(tree, "price").props.item.id, item.id); node(tree, "price").props.onCartOpen(); assert.equal(opened, true);
  const query = f.queries.at(-1); assert.equal(query.enabled, true); assert.equal(query.staleTime, 0);
});
test("a missing listing keeps the favorite reference but shows no price or cart controls", async () => {
  const f = fixture({ items: [] }); const m = await f.load(path("JwStoneSavedLotsSection"));
  const tree = f.render(m.JwStoneSavedLotsSection, { open: true, lots: [lot], onRemove() {}, onAsk() {}, onCartOpen() {} });
  assert.ok(text(tree).includes(lot.id)); assert.ok(text(tree).includes("Not currently listed")); assert.equal(node(tree, "price"), undefined);
});
test("failed or in-flight refreshes never render stale lot prices as current", async () => {
  for (const query of [{ isError: true }, { isFetching: true }]) {
    const f = fixture({ query }); const m = await f.load(path("JwStoneSavedLotsSection"));
    const tree = f.render(m.JwStoneSavedLotsSection, { open: true, lots: [lot], onRemove() {}, onAsk() {}, onCartOpen() {} });
    assert.equal(node(tree, "price"), undefined); assert.ok(text(tree).includes(lot.id)); assert.ok(!text(tree).includes("Not currently listed"));
  }
});
test("saved-lot inquiry retains the exact reference even when the listing is unavailable", async () => {
  let message; const f = fixture({ items: [] }); const m = await f.load(path("JwStoneSavedLotsSection"));
  const tree = f.render(m.JwStoneSavedLotsSection, { open: true, lots: [lot], onRemove() {}, onAsk(value) { message = value; }, onCartOpen() {} });
  button(tree, "Ask about this exact lot").props.onClick(); assert.ok(message.includes(lot.id));
});
test("the all-inventory query rejects a response for another profile", async () => {
  const f = fixture({ apiResult: { profileSlug: "other", items: [] } }); const m = await f.load(path("JwStoneSavedLotsSection"));
  f.render(m.JwStoneSavedLotsSection, { open: true, lots: [lot], onRemove() {}, onAsk() {}, onCartOpen() {} });
  await assert.rejects(f.queries.at(-1).queryFn(), /verified/);
});
const panelProps = () => ({ open: true, items: [], restored: true, persisted: true, onOpenChange() {}, onRemove() {}, onClear() {}, onOpenStone() {}, onAsk() {} });
test("a lot-only wishlist is not shown as empty and does not offer catalog email", async () => {
  const f = fixture(); const m = await f.load(path("WishlistPanel")); const tree = f.render(m.WishlistPanel, panelProps());
  assert.equal(node(tree, "saved-lots").props.lots[0].id, lot.id); assert.ok(!text(tree).includes("Nothing saved yet"));
  assert.equal(button(tree, "Email my"), undefined); assert.ok(button(tree, "Copy all 1"));
});
test("copy all includes exact saved lot IDs and no persisted price or cost", async () => {
  const f = fixture({ savedLots: [{ ...lot, landedCostCents: 887733 }] }); const m = await f.load(path("WishlistPanel"));
  const tree = f.render(m.WishlistPanel, panelProps()); button(tree, "Copy all").props.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert.ok(f.copied[0].includes(lot.id)); assert.ok(!f.copied[0].includes("887733"));
});
test("blocked clipboard exposes a selectable text fallback", async () => {
  const f = fixture({ clipboardFailure: true }); const m = await f.load(path("WishlistPanel")); const props = panelProps();
  let tree = f.render(m.WishlistPanel, props); button(tree, "Copy all").props.onClick(); await new Promise(resolve => setImmediate(resolve)); tree = f.render(m.WishlistPanel, props);
  const area = node(tree, "textarea"); assert.equal(area.props.readOnly, true); assert.ok(area.props.value.includes(lot.id));
});
test("catalog email remains explicitly scoped and never silently omits lots from a claimed full-list send", async () => {
  const f = fixture(); const m = await f.load(path("WishlistPanel")); const props = { ...panelProps(), knownEmail: "test@example.invalid", items: [{ id: "test-catalog", shareSlug: "test-catalog", displayName: "Catalog stone", publicLabel: "Catalog stone", images: [], finishes: [] }] };
  const tree = f.render(m.WishlistPanel, props); assert.ok(text(tree).includes("Inventory lots are not included"));
  button(tree, "Email my saved catalog stones").props.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.requests.length, 1); assert.deepEqual(plain(f.requests[0][1].body.stones), [{ name: "Catalog stone", shareSlug: "test-catalog" }]);
});
test("clearing mixed saved selections still requires explicit confirmation", async () => {
  let cleared = 0; const f = fixture(); const m = await f.load(path("WishlistPanel")); const props = { ...panelProps(), onClear() { cleared++; } };
  let tree = f.render(m.WishlistPanel, props); button(tree, "Clear all saved").props.onClick(); assert.equal(cleared, 0);
  tree = f.render(m.WishlistPanel, props); button(tree, "Confirm clear all").props.onClick(); assert.equal(cleared, 1);
});
const cartStores = await moduleAt("client/src/features/jw-stone/jwStoneCartStore.ts", { "../../../../shared/jwStoneCart": cart });
async function cartFixture(member = true) {
  const data = new Map([[cartStores.JW_STONE_CART_STORAGE_PREFIX + "member-a", JSON.stringify({ version: 2, viewerId: "member-a", lines: Array.from({ length: 100 }, (_, i) => ({ id: id(i + 1), stoneName: `Test ${i + 1}`, kind: "lot", quantity: 1 })) })]]);
  const f = fixture({ member, storage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } });
  const m = await f.load(path("JwStoneCart"), { "./jwStoneCartStore": cartStores });
  const wrapper = f.render(m.JwStoneCartProvider, { viewerId: "member-a", children: null });
  return { f, m, component: wrapper.type, props: wrapper.props };
}
test("overflow cart shows batch controls without deleting saved selections", async () => {
  const { f, component, props } = await cartFixture(); const tree = f.render(component, props);
  assert.ok(text(tree).includes("All 100 saved selections are preserved")); assert.equal(nodes(tree).filter(entry => entry.type === "li").length, 50);
});
test("batch navigation switches both stock review and inquiry to the same exact lot set", async () => {
  const { f, component, props } = await cartFixture(); let tree = f.render(component, props);
  button(tree, "Next batch").props.onClick(); tree = f.render(component, props);
  const query = f.queries.filter(config => config.queryKey[1] === "cart-review").at(-1);
  const lines = JSON.parse(query.queryKey[3]); assert.equal(lines.length, 50); assert.equal(lines[0].inventoryPublicId, id(51));
  button(tree, "Ask JW Stone about batch 2").props.onClick(); tree = f.render(component, props);
  const message = node(tree, "request-panel").props.initialMessage; assert.ok(message.includes(id(51))); assert.ok(message.includes(id(100))); assert.ok(!message.includes(id(1)));
});
test("a non-member sees no cart sheet or cart request controls", async () => {
  const { f, component, props } = await cartFixture(false); const tree = f.render(component, props);
  assert.equal(node(tree, "Sheet"), undefined); assert.equal(node(tree, "request-panel"), undefined);
});
test("opening a lot cart closes the originating saved-stones panel", async () => {
  let attempted = false, closed = false;
  const f = fixture({ contextValue: { enabled: true, add() { attempted = true; return false; } } });
  const m = await f.load(path("JwStoneCart"), { "./jwStoneCartStore": cartStores });
  const tree = f.render(m.JwStoneLotCartButton, { item, onOpenCart() { closed = true; } }); tree.props.onClick();
  assert.equal(attempted, true); assert.equal(closed, true);
});
