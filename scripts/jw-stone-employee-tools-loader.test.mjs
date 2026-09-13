// Actual component functions with controlled hook lifecycles and deferred imports.
// This is not browser/DOM, real chunk transport, or end-to-end proof.
// Run with: node --experimental-vm-modules --test scripts/jw-stone-employee-tools-loader.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH || "typescript");
const root = new URL("../client/src/features/jw-stone/", import.meta.url);
const jsx = (type, props, key) => ({ type, props: props || {}, key });
const compile = async (file) => ts.transpileModule(await readFile(new URL(file, root), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const pureComponents = new WeakSet();
const children = (node) => pureComponents.has(node.type) ? node.type(node.props) : node.props?.children;
const walk = (node) => Array.isArray(node) ? node.flatMap(walk) : node && typeof node === "object" ? [node, ...walk(children(node))] : [];
const text = (node) => Array.isArray(node) ? node.map(text).join(" ") : node && typeof node === "object" ? text(children(node)) : typeof node === "string" ? node : "";
const propsFor = (viewerId = "owner", extra = {}) => ({ viewerId, enabled: true, canManageStaff: false, ...extra });
const settle = () => new Promise((resolve) => setImmediate(resolve));

function synthetic(exports, context) {
  return new SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context });
}

async function loader(options = {}) {
  const imports = [];
  const context = createContext({ console });
  const tools = () => null;
  const toolsModule = synthetic({ [options.moduleExport || "default"]: tools }, context);
  await toolsModule.link(() => { throw new Error("Unexpected tools dependency"); });
  await toolsModule.evaluate();
  let active;
  const react = {
    useState(initial) {
      const instance = active;
      const index = instance.index++;
      if (!(index in instance.slots)) instance.slots[index] = { value: typeof initial === "function" ? initial() : initial };
      const slot = instance.slots[index];
      return [slot.value, (value) => {
        instance.stateWrites++;
        if (!instance.mounted) instance.lateStateWrites++;
        slot.value = typeof value === "function" ? value(slot.value) : value;
      }];
    },
    useEffect(effect, dependencies) {
      const instance = active;
      const index = instance.index++;
      const previous = instance.slots[index];
      const changed = !previous || !dependencies || dependencies.length !== previous.dependencies?.length || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]));
      if (changed) {
        const slot = { dependencies: dependencies?.slice(), cleanup: undefined };
        instance.slots[index] = slot;
        instance.effects.push(() => {
          previous?.cleanup?.();
          slot.cleanup = effect();
        });
      }
    },
  };
  const dependencies = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    ...(options.dependencies || {}),
  };
  // Execute the shared hook/cache implementation; only React's lifecycle ports
  // and the asynchronous chunk response are controlled by this harness.
  const deferredModule = new SourceTextModule(await compile("deferredJwStoneComponent.ts"), { context });
  await deferredModule.link(async (key) => {
    assert.ok(dependencies[key], `Unexpected deferred-helper dependency: ${key}`);
    return synthetic(dependencies[key], context);
  });
  await deferredModule.evaluate();
  const statusModule = new SourceTextModule(await compile("JwStoneLoadingStatus.tsx"), { context });
  await statusModule.link(async (key) => {
    assert.ok(dependencies[key], `Unexpected loading-status dependency: ${key}`);
    return synthetic(dependencies[key], context);
  });
  await statusModule.evaluate();
  // Expand this actual, hook-free component for status text and button events.
  // Other function nodes remain boundaries and run only through mount().
  pureComponents.add(statusModule.namespace.JwStoneLoadingStatus);
  const module = new SourceTextModule(await compile(options.file || "JwStoneEmployeeToolsLoader.tsx"), {
    context,
    importModuleDynamically(specifier) {
      assert.equal(specifier, options.importPath || "./JwStoneEmployeeTools");
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      imports.push({ resolve, reject });
      return promise.then(() => toolsModule);
    },
  });
  await module.link(async (key) => {
    if (key === "./deferredJwStoneComponent") return deferredModule;
    if (key === "./JwStoneLoadingStatus") return statusModule;
    assert.ok(dependencies[key], `Unexpected eager dependency: ${key}`);
    return synthetic(dependencies[key], context);
  });
  await module.evaluate();
  const Component = module.namespace[options.componentExport || "JwStoneEmployeeToolsLoader"];
  function mount(props = propsFor(), component = Component) {
    const instance = {
      props, slots: [], index: 0, effects: [], mounted: true, stateWrites: 0, lateStateWrites: 0, view: undefined,
      render(nextProps = this.props) {
        assert.ok(this.mounted, "Cannot render an unmounted component");
        this.props = nextProps;
        this.index = 0;
        active = this;
        try { this.view = component(this.props); } finally { active = undefined; }
        for (const effect of this.effects.splice(0)) effect();
        return this.view;
      },
      find(type, predicate = () => true) { return walk(this.view).find((node) => node.type === type && predicate(node)); },
      text() { return text(this.view); },
      unmount() {
        this.mounted = false;
        for (const slot of this.slots) slot.cleanup?.();
      },
    };
    instance.render();
    return instance;
  }
  return { imports, tools, mount };
}

test("authorized loader starts one deferred import and exposes an accessible loading state", async () => {
  const h = await loader();
  const view = h.mount();
  assert.equal(h.imports.length, 1);
  assert.match(view.text(), /Loading employee tools/);
  const status = view.find("p", (node) => node.props.role === "status");
  assert.equal(status.props["aria-live"], "polite");
  assert.equal(status.props["aria-busy"], true);
  assert.equal(view.find(h.tools), undefined);
  assert.equal(view.find("button"), undefined);
  view.unmount();
  h.imports[0].resolve();
  await settle();
});

test("loaded tools receive current viewer, activation, and management props", async () => {
  const h = await loader();
  const props = propsFor("owner", { enabled: false, canManageStaff: true });
  const view = h.mount(props);
  h.imports[0].resolve();
  await settle();
  view.render();
  assert.equal(view.view.type, h.tools);
  assert.deepEqual({ ...view.view.props }, props);
  view.render({ ...props, enabled: true, canManageStaff: false });
  assert.equal(view.view.props.enabled, true);
  assert.equal(view.view.props.canManageStaff, false);
  assert.equal(h.imports.length, 1);
  view.unmount();
});

test("a failed import exposes retry, and retry makes a fresh import that can succeed", async () => {
  const h = await loader();
  const view = h.mount();
  h.imports[0].reject(new Error("Transient chunk failure"));
  await settle();
  view.render();
  assert.match(view.text(), /Could not load employee tools/);
  assert.equal(view.find("p", (node) => node.props.role === "status").props["aria-busy"], false);
  assert.equal(view.find(h.tools), undefined);
  const retry = view.find("button", (node) => text(node) === "Try again");
  assert.ok(retry);
  assert.equal(retry.props.type, "button");
  retry.props.onClick();
  view.render();
  view.render(); // Commit the effect's loading-state update.
  assert.equal(h.imports.length, 2);
  assert.match(view.text(), /Loading employee tools/);
  assert.equal(view.find("button"), undefined);
  h.imports[1].resolve();
  await settle();
  view.render();
  assert.equal(view.view.type, h.tools);
  assert.ok(!view.text().includes("Could not load employee tools"));
  view.unmount();
});

test("successful chunks are shared across concurrent authorized mounts and reused after remount", async () => {
  const h = await loader();
  const first = h.mount(propsFor("first"));
  const second = h.mount(propsFor("second"));
  assert.equal(h.imports.length, 1);
  h.imports[0].resolve();
  await settle();
  first.render(); second.render();
  assert.equal(first.view.type, h.tools);
  assert.equal(second.view.type, h.tools);
  assert.equal(first.view.props.viewerId, "first");
  assert.equal(second.view.props.viewerId, "second");
  first.unmount(); second.unmount();
  const third = h.mount(propsFor("third"));
  await settle();
  third.render();
  assert.equal(h.imports.length, 1);
  assert.equal(third.view.type, h.tools);
  assert.equal(third.view.props.viewerId, "third");
  third.unmount();
});

test("revocation or unmount during loading discards late success and failure without state writes", async () => {
  for (const outcome of ["resolve", "reject"]) {
    const h = await loader();
    const view = h.mount();
    view.unmount();
    h.imports[0][outcome](new Error("Late failure"));
    await settle();
    assert.equal(view.lateStateWrites, 0, outcome);
    assert.equal(view.find(h.tools), undefined, outcome);
  }
});

test("viewer-keyed remount cannot reopen the old viewer when a shared pending chunk resolves", async () => {
  const h = await loader();
  const oldViewer = h.mount(propsFor("former-owner", { canManageStaff: true }));
  oldViewer.unmount(); // The entry component uses viewerId as the React key.
  const newViewer = h.mount(propsFor("current-staff", { enabled: false }));
  assert.equal(h.imports.length, 1);
  h.imports[0].resolve();
  await settle();
  newViewer.render();
  assert.equal(oldViewer.lateStateWrites, 0);
  assert.equal(oldViewer.find(h.tools), undefined);
  assert.equal(newViewer.view.type, h.tools);
  assert.deepEqual({ ...newViewer.view.props }, propsFor("current-staff", { enabled: false }));
  newViewer.unmount();
});

test("the loaded tools preserve the original viewer-keyed workspace and owner-only manager", async () => {
  const context = createContext({ console });
  const workspace = () => null, manager = () => null;
  const dependencies = {
    "react": { useState: () => [true, () => {}], useEffect() {} },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "./JwStoneReceivingWorkspace": { default: workspace },
    "./JwStoneEmployeeAccessManager": { default: manager },
  };
  const module = new SourceTextModule(await compile("JwStoneEmployeeTools.tsx"), { context });
  await module.link(async (key) => {
    assert.ok(dependencies[key], key);
    return synthetic(dependencies[key], context);
  });
  await module.evaluate();
  for (const canManageStaff of [false, true]) {
    const result = module.namespace.default(propsFor("staff-one", { enabled: false, canManageStaff }));
    const [editor, accessManager] = result.props.children;
    assert.equal(editor.type, workspace);
    assert.equal(editor.key, "staff-one");
    assert.deepEqual({ ...editor.props }, { viewerId: "staff-one", enabled: false });
    if (canManageStaff) {
      assert.equal(accessManager.type, manager);
      assert.equal(accessManager.key, "staff:staff-one");
      assert.equal(accessManager.props.viewerId, "staff-one");
    } else assert.equal(accessManager, null);
  }
});

const savedProps = (open = false, extra = {}) => ({
  open, items: [], restored: true, persisted: true, knownEmail: null,
  onOpenChange() {}, onRemove() {}, onClear() {}, onOpenStone() {}, onAsk() {},
  ...extra,
});
const wishlistLoader = () => loader({
  file: "WishlistPanelLoader.tsx",
  componentExport: "WishlistPanel",
  importPath: "./WishlistPanel",
  moduleExport: "WishlistPanel",
  dependencies: { "./brand": { JW_STONE_BRAND_STYLE: {} } },
});

test("closed saved stones render nothing and do not request the panel chunk until opened", async () => {
  const h = await wishlistLoader();
  const props = savedProps();
  const view = h.mount(props);
  assert.equal(view.view, null);
  assert.equal(h.imports.length, 0);
  view.render({ ...props, open: true });
  assert.equal(h.imports.length, 1);
  assert.match(view.text(), /Loading saved stones/);
  const status = view.find("p", (node) => node.props.role === "status");
  assert.equal(status.props["aria-live"], "polite");
  assert.equal(status.props["aria-busy"], true);
  assert.equal(view.find(h.tools), undefined);
  view.unmount();
  h.imports[0].resolve();
  await settle();
});

test("closing saved stones while the chunk is pending discards late success and failure", async () => {
  for (const outcome of ["resolve", "reject"]) {
    const h = await wishlistLoader();
    const changes = [];
    const props = savedProps(true, { onOpenChange: (open) => changes.push(open) });
    const view = h.mount(props);
    const close = view.find("button", (node) => text(node) === "Close");
    assert.equal(close.props.type, "button");
    close.props.onClick();
    assert.deepEqual(changes, [false]);
    view.render({ ...props, open: changes[0] });
    assert.equal(view.view, null);
    const writesAfterClose = view.stateWrites;
    h.imports[0][outcome](new Error("Late panel failure"));
    await settle();
    view.render();
    assert.equal(view.stateWrites, writesAfterClose, outcome);
    assert.equal(view.view, null, outcome);
    view.unmount();
  }
});

test("loaded saved stones keep the same panel mounted when closed so its quote handoff survives", async () => {
  const h = await wishlistLoader();
  const props = savedProps(true, { knownEmail: "staff@example.test" });
  const view = h.mount(props);
  h.imports[0].resolve();
  await settle();
  view.render();
  assert.equal(view.view.type, h.tools);
  assert.deepEqual({ ...view.view.props }, props);
  const mountedType = view.view.type;
  const mountedKey = view.view.key;
  const closedProps = { ...props, open: false };
  view.render(closedProps);
  assert.equal(view.view.type, mountedType);
  assert.equal(view.view.key, mountedKey);
  assert.deepEqual({ ...view.view.props }, closedProps);
  view.render(props);
  assert.equal(view.view.type, mountedType);
  assert.equal(view.view.key, mountedKey);
  assert.equal(h.imports.length, 1);
  view.unmount();
});

test("saved stones retry a failed chunk without dropping the panel callbacks or selected items", async () => {
  const h = await wishlistLoader();
  const props = savedProps(true, { items: [{ id: "stone-one" }] });
  const view = h.mount(props);
  h.imports[0].reject(new Error("Saved panel unavailable"));
  await settle();
  view.render();
  assert.match(view.text(), /Could not load saved stones/);
  assert.equal(view.find("p", (node) => node.props.role === "status").props["aria-busy"], false);
  assert.ok(view.find("button", (node) => text(node) === "Close"));
  view.find("button", (node) => text(node) === "Try again").props.onClick();
  view.render(); view.render();
  assert.equal(h.imports.length, 2);
  assert.match(view.text(), /Loading saved stones/);
  h.imports[1].resolve();
  await settle();
  view.render();
  assert.equal(view.view.type, h.tools);
  assert.equal(view.view.props.items, props.items);
  for (const callback of ["onOpenChange", "onRemove", "onClear", "onOpenStone", "onAsk"]) {
    assert.equal(view.view.props[callback], props[callback]);
  }
  view.unmount();
});

test("reopening saved stones after closing a pending load reuses its successful chunk", async () => {
  const h = await wishlistLoader();
  const props = savedProps(true);
  const view = h.mount(props);
  view.render({ ...props, open: false });
  h.imports[0].resolve();
  await settle();
  view.render();
  assert.equal(view.view, null);
  view.render(props);
  await settle();
  view.render();
  assert.equal(h.imports.length, 1);
  assert.equal(view.view.type, h.tools);
  assert.equal(view.view.props.open, true);
  view.unmount();
});

async function receiptLoader(user = null) {
  const fallback = () => null, cartButton = () => null;
  let viewer = user;
  const h = await loader({
    file: "JwStoneArrivalPrice.tsx",
    componentExport: "JwStoneArrivalPrice",
    importPath: "./JwStoneReceiptPriceDetails",
    dependencies: {
      "@/hooks/useAuth": { useAuth: () => ({ user: viewer }) },
      "./JwStoneMemberPricing": { JwStoneMemberPriceDisplay: fallback },
      "./JwStoneCart": { JwStoneLotCartButton: cartButton },
    },
  });
  return { ...h, fallback, cartButton, viewer(user) { viewer = user; } };
}
const arrival = {
  id: "received-lot-one", materialName: "Test granite",
  dimensions: { length: 120, height: 60, unit: "in" },
  imageUrls: ["/images/businesses/jw-stone/receiving/fixture/1.jpg"],
};

test("guest arrival pricing keeps its original fallback and eager lot cart button without loading receipt details", async () => {
  const h = await receiptLoader();
  const onCartOpen = () => {};
  const view = h.mount({ item: arrival, onCartOpen });
  const [price, cart] = view.view.props.children;
  assert.equal(price.type, h.fallback);
  assert.deepEqual({ ...price.props }, {
    stoneName: arrival.materialName, slabDimensions: arrival.dimensions,
    presentation: "inventory", allowCatalogCart: false,
  });
  assert.equal(cart.type, h.cartButton);
  assert.equal(cart.props.item, arrival);
  assert.equal(cart.props.onOpenCart, onCartOpen);
  assert.equal(h.imports.length, 0);
  view.unmount();
});

test("signed-in arrival pricing keys the deferred child by viewer while keeping the lot cart button eager", async () => {
  const h = await receiptLoader({ id: "first-viewer" });
  const onCartOpen = () => {};
  const view = h.mount({ item: arrival, onCartOpen });
  const [firstPrice, firstCart] = view.view.props.children;
  assert.equal(firstPrice.key, "first-viewer");
  assert.equal(firstPrice.props.viewerId, "first-viewer");
  assert.equal(firstPrice.props.item, arrival);
  assert.equal(firstPrice.props.fallback.type, h.fallback);
  assert.equal(firstCart.type, h.cartButton);
  assert.equal(firstCart.props.onOpenCart, onCartOpen);
  h.viewer({ id: "second-viewer" });
  view.render();
  const [secondPrice, secondCart] = view.view.props.children;
  assert.equal(secondPrice.type, firstPrice.type);
  assert.equal(secondPrice.key, "second-viewer");
  assert.equal(secondPrice.props.viewerId, "second-viewer");
  assert.equal(secondCart.type, h.cartButton);
  h.viewer(null);
  view.render();
  assert.equal(view.view.props.children[0].type, h.fallback);
  assert.equal(view.view.props.children[1].type, h.cartButton);
  assert.equal(h.imports.length, 0);
  view.unmount();
});

test("receipt-price chunk failure can retry without rendering fallback prices or disabling the eager lot cart entry", async () => {
  const h = await receiptLoader({ id: "current-viewer" });
  const entry = h.mount({ item: arrival });
  const priceEntry = entry.view.props.children[0];
  const price = h.mount(priceEntry.props, priceEntry.type);
  assert.equal(h.imports.length, 1);
  assert.match(price.text(), /Loading lot prices/);
  assert.equal(price.find(h.fallback), undefined);
  assert.equal(entry.view.props.children[1].type, h.cartButton);
  h.imports[0].reject(new Error("Receipt-price chunk unavailable"));
  await settle();
  price.render();
  assert.match(price.text(), /Could not load lot prices/);
  assert.equal(price.find(h.fallback), undefined);
  assert.equal(price.find(h.tools), undefined);
  assert.equal(entry.view.props.children[1].type, h.cartButton);
  const retry = price.find("button", (node) => text(node) === "Try again");
  assert.equal(retry.props.type, "button");
  retry.props.onClick();
  price.render(); price.render();
  assert.equal(h.imports.length, 2);
  h.imports[1].resolve();
  await settle();
  price.render();
  assert.equal(price.view.type, h.tools);
  assert.equal(price.view.props.item, arrival);
  assert.equal(price.view.props.viewerId, "current-viewer");
  assert.equal(price.view.props.fallback, priceEntry.props.fallback);
  price.unmount(); entry.unmount();
});
