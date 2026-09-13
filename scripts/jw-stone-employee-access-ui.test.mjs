// Actual component functions/handlers with React, query and network ports mocked.
// This is not browser/DOM or end-to-end proof.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH || "typescript");
const root = new URL("../client/src/features/jw-stone/", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");
class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
const employee = { userId: "staff-one", email: "staff@example.test", name: "Test Staff", allowed: false, source: "none", revision: null, expired: false };
const ownerRow = { ...employee, userId: "owner", email: "owner@example.test", source: "owner", allowed: true };
async function ui(options = {}) {
  let slots = [], index = 0, pendingEffects = [], cleanups = [], component, view;
  const calls = [], invalidations = [];
  let query = { data: { viewerId: "owner", accounts: options.accounts || [ownerRow], truncated: false }, isError: false, isLoading: false, isFetching: false, error: null, refetch: async () => {} };
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(value) { const i = index++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
    useEffect(effect) { const i = index++; if (!(i in slots)) { slots[i] = true; pendingEffects.push(effect); } },
  };
  const context = createContext({ console, Error, window: { confirm: () => options.confirm !== false }, URL });
  const jsx = (type, props) => ({ type, props: props || {} });
  const deps = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "@tanstack/react-query": { useQuery: () => query, useQueryClient: () => ({ invalidateQueries: async args => { invalidations.push(args); } }) },
    "@/lib/queryClient": { ApiError, apiRequest: async (...args) => {
      calls.push(args);
      if (options.api) return options.api(...args);
      if (args[0].endsWith("/lookup")) return { viewerId: "owner", account: options.candidate || employee };
      const { userId, allowed } = args[1].body;
      return { viewerId: "owner", account: { ...employee, userId, allowed, source: "manual", revision: "r1" } };
    } },
  };
  const code = ts.transpileModule(await source("JwStoneEmployeeAccessManager.tsx"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = new SourceTextModule(code, { context });
  await module.link(async key => { const exports = deps[key]; assert.ok(exports, key); return new SyntheticModule(Object.keys(exports), function () { for (const [k,v] of Object.entries(exports)) this.setExport(k,v); }, { context }); });
  await module.evaluate(); component = module.namespace.default;
  const render = () => { index = 0; view = component({ viewerId: "owner" }); for (const effect of pendingEffects.splice(0)) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); } return view; };
  const walk = node => Array.isArray(node) ? node.flatMap(walk) : node && typeof node === "object" ? [node, ...walk(node.props?.children)] : [];
  const all = () => walk(view);
  const text = node => Array.isArray(node) ? node.map(text).join(" ") : node && typeof node === "object" ? text(node.props?.children) : typeof node === "string" ? node : "";
  const find = (type, predicate = () => true) => all().find(node => node.type === type && predicate(node));
  const button = label => find("button", node => text(node).trim() === label);
  const lookup = async () => { render(); find("input", node => node.props.type === "email").props.onChange({ target: { value: "staff@example.test" } }); render(); await find("form").props.onSubmit({ preventDefault() {} }); render(); };
  render();
  return { render, find, button, text: () => text(view), all, calls, invalidations, lookup,
    query(value) { query = { ...query, ...value }; }, unmount() { for (const cleanup of cleanups) cleanup(); } };
}
test("lookup alone cannot grant; explicit confirmation enables the grant button", async () => {
  const h = await ui(); await h.lookup();
  assert.equal(h.calls.length, 1); assert.equal(h.button("Grant inventory access").props.disabled, true);
  h.find("input", node => node.props.type === "checkbox").props.onChange({ target: { checked: true } }); h.render();
  assert.equal(h.button("Grant inventory access").props.disabled, false);
  await h.button("Grant inventory access").props.onClick(); h.render();
  // onClick deliberately uses void; flush the mutation microtasks before asserting state.
  await new Promise(resolve => setImmediate(resolve)); h.render();
  const mutation = h.calls.find(([,args]) => args.method === "PUT")[1].body;
  assert.deepEqual(JSON.parse(JSON.stringify(mutation)), { userId: "staff-one", allowed: true, expectedRevision: null, confirmed: true });
  assert.match(h.text(), /Inventory access enabled/);
});
test("editing the email clears the previous candidate and confirmation", async () => {
  const h = await ui(); await h.lookup();
  h.find("input", node => node.props.type === "checkbox").props.onChange({ target: { checked: true } });
  h.find("input", node => node.props.type === "email").props.onChange({ target: { value: "other@example.test" } }); h.render();
  assert.equal(h.button("Grant inventory access"), undefined); assert.equal(h.calls.length, 1);
});
test("canceling removal makes no request", async () => {
  const h = await ui({ accounts: [{ ...employee, allowed: true, source: "manual", revision: "r1" }], confirm: false });
  h.button("Remove access").props.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.length, 0);
});
test("removal sends the selected user's current revision and no customer membership fields", async () => {
  const h = await ui({ accounts: [{ ...employee, allowed: true, source: "manual", revision: "r7" }] });
  h.button("Remove access").props.onClick(); await new Promise(resolve => setImmediate(resolve)); h.render();
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0][1].body)), { userId: "staff-one", allowed: false, expectedRevision: "r7", confirmed: true });
  assert.match(h.text(), /Inventory access removed/);
});
test("a lookup can remove an active account even when outside the first listed page", async () => {
  const h = await ui({ candidate: { ...employee, allowed: true, source: "server_configuration" } }); await h.lookup();
  assert.ok(h.button("Remove access")); assert.equal(h.button("Grant inventory access"), undefined);
});
test("inherited owner and administrator rows never expose grant/revoke controls", async () => {
  const h = await ui({ accounts: [ownerRow, { ...ownerRow, userId: "admin", source: "platform_admin" }], candidate: ownerRow }); await h.lookup();
  assert.equal(h.button("Remove access"), undefined); assert.equal(h.button("Grant inventory access"), undefined);
});
test("failed or refreshing list data disables stale removal actions", async () => {
  const h = await ui({ accounts: [{ ...employee, allowed: true, source: "manual" }] });
  h.query({ isFetching: true }); h.render(); assert.equal(h.button("Remove access").props.disabled, true);
  h.query({ isFetching: false, isError: true, error: new Error("Refresh failed") }); h.render(); assert.equal(h.button("Remove access"), undefined);
});
test("mutation failure clears the candidate and does not show success", async () => {
  const h = await ui({ api: async (path) => { if (path.endsWith("/lookup")) return { viewerId: "owner", account: employee }; throw new ApiError("Permissions changed; refresh", 409); } });
  await h.lookup(); h.find("input", node => node.props.type === "checkbox").props.onChange({ target: { checked: true } }); h.render();
  h.button("Grant inventory access").props.onClick(); await new Promise(resolve => setImmediate(resolve)); h.render();
  assert.match(h.text(), /Permissions changed; refresh/); assert.ok(!h.text().includes("Inventory access enabled for"));
  assert.equal(h.button("Grant inventory access"), undefined);
});
test("mismatched viewer responses never expose another account's lookup", async () => {
  const h = await ui({ api: async () => ({ viewerId: "someone-else", account: employee }) }); await h.lookup();
  assert.equal(h.button("Grant inventory access"), undefined); assert.match(h.text(), /account response changed/);
});
test("losing owner authority hides management controls and invalidates the access query", async () => {
  const h = await ui({ api: async () => { throw new ApiError("Denied", 403); } }); await h.lookup();
  assert.equal(h.invalidations[0].queryKey[1], "receiving-access");
  h.query({ isError: true, error: new ApiError("Denied", 403) }); h.render();
  assert.equal(h.button("Find account"), undefined);
});
test("late lookup response after unmount is discarded", async () => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const h = await ui({ api: () => pending });
  const lookup = h.lookup(); await new Promise(resolve => setImmediate(resolve)); h.unmount();
  release({ viewerId: "owner", account: employee }); await lookup;
  assert.equal(h.button("Grant inventory access"), undefined);
});

async function entry(access, user = { id: "owner" }) {
  const workspace = () => null, manager = () => null;
  const jsx = (type, props, key) => ({ type, props, key });
  const deps = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "@tanstack/react-query": { useQuery: () => access },
    "@/hooks/useAuth": { useAuth: () => ({ user }) },
    "@/lib/queryClient": { apiRequest: async () => {}, ApiError },
    "./JwStoneReceivingWorkspace": { default: workspace },
    "./JwStoneEmployeeAccessManager": { default: manager },
  };
  const context = createContext({ console });
  const code = ts.transpileModule(await source("JwStoneEmployeeReceiving.tsx"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = new SourceTextModule(code, { context });
  await module.link(async key => { const exports = deps[key]; assert.ok(exports, key); return new SyntheticModule(Object.keys(exports), function () { for (const [k,v] of Object.entries(exports)) this.setExport(k,v); }, { context }); });
  await module.evaluate();
  return { result: module.namespace.JwStoneEmployeeReceiving(), workspace, manager };
}
test("approved employee entry keeps the receiving workspace without staff-management controls", async () => {
  const h = await entry({ data: { viewerId: "owner", allowed: true, enabled: true, canManageStaff: false } });
  assert.equal(h.result.props.children[0].type, h.workspace);
  assert.equal(h.result.props.children[1], null);
});
test("owner entry exposes management even while receiving writes await activation", async () => {
  const h = await entry({ data: { viewerId: "owner", allowed: true, enabled: false, canManageStaff: true } });
  assert.equal(h.result.props.children[0].props.enabled, false);
  assert.equal(h.result.props.children[1].type, h.manager);
  assert.equal(h.result.props.children[1].key, "staff:owner");
});
test("anonymous, unauthorized, and wrong-viewer entries do not mount employee controls", async () => {
  for (const data of [{ viewerId: "owner", allowed: false }, { viewerId: "other", allowed: true }]) assert.equal((await entry({ data })).result, null);
  assert.equal((await entry({ data: { viewerId: "owner", allowed: true } }, null)).result, null);
});
test("revocation hides the entry but a transient refresh error does not destroy an employee draft", async () => {
  const data = { viewerId: "owner", allowed: true, enabled: true };
  assert.equal((await entry({ data, error: new ApiError("Denied", 403) })).result, null);
  assert.ok((await entry({ data, error: new ApiError("Temporary failure", 503) })).result);
});
