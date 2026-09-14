// Executes actual component handlers with storage/network/React ports mocked.
// Real IndexedDB coverage remains in jw-stone-receiving-draft.browser.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import ts from "typescript";
import * as receiving from "../shared/jwStoneReceiving.ts";

class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
const draft = () => ({ fields: {
  materialName: "Test Granite", materialFamily: "granite", materialClass: "natural_stone",
  lotLabel: "TEST-001", quantity: "2", length: "120", height: "60", dimensionUnit: "in",
  thicknessMm: "30", finish: "polished", locationLabel: "Test rack", priceUnit: "square_foot", sellPrice: "12.50",
}, photos: [new File(["test photo bytes"], "test.jpg", { type: "image/jpeg" })], frozenReceipt: null });

async function workspace() {
  let slots = [], index = 0, effects = [], view, revision = 1, saved = draft();
  let failFrozenWrite = false, failUpload = false;
  const uploads = [], timers = new Map();
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useRef(initial) { const i = index++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useMemo(compute) { index++; return compute(); },
    useEffect(effect) { const i = index++; if (!(i in slots)) { slots[i] = true; effects.push(effect); } },
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const dependencies = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "lucide-react": { Camera: "camera", PackagePlus: "package", X: "close" },
    "@shared/jwStoneReceiving": receiving,
    "@tanstack/react-query": { useQuery: () => ({ data: { viewerId: "staff", items: [] } }), useQueryClient: () => ({ invalidateQueries: async () => {} }) },
    "./jwStoneReceivingDraftStore": {
      readReceivingDraft: async () => ({ revision, draft: saved }),
      writeReceivingDraft: async (_viewerId, expectedRevision, value) => {
        assert.equal(expectedRevision, revision);
        if (failFrozenWrite && value?.frozenReceipt) { failFrozenWrite = false; throw new Error("TEST storage full"); }
        saved = value; return ++revision;
      },
    },
    "@/lib/queryClient": { ApiError, apiRequest: async (_path, options) => {
      const receipt = JSON.parse(options.body.get("receipt"));
      // The exact receipt and photo must be durable before either network attempt.
      assert.deepEqual(receipt, saved.frozenReceipt);
      assert.equal(await options.body.get("photos").text(), await saved.photos[0].text());
      uploads.push(receipt);
      if (failUpload) { failUpload = false; throw new ApiError("TEST interrupted upload", 503); }
      return { published: true };
    } },
  };
  const context = createContext({
    Error, File, FormData, crypto: { randomUUID },
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    window: { confirm: () => true, addEventListener() {}, removeEventListener() {} },
    setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const source = await readFile(new URL("../client/src/features/jw-stone/JwStoneReceivingWorkspace.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = new SourceTextModule(code, { context });
  await module.link(specifier => { const exports = dependencies[specifier]; assert.ok(exports, specifier); return new SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context }); });
  await module.evaluate();
  const render = () => { index = 0; view = module.namespace.default({ viewerId: "staff", enabled: true }); for (const effect of effects.splice(0)) effect(); };
  const walk = node => Array.isArray(node) ? node.flatMap(walk) : node && typeof node === "object" ? [node, ...walk(node.props?.children)] : [];
  const text = node => Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.props?.children) : typeof node === "string" || typeof node === "number" ? String(node) : "";
  const find = (type, predicate = () => true) => walk(view).find(node => node.type === type && predicate(node));
  const button = label => find("button", node => text(node) === label);
  render(); await new Promise(resolve => setImmediate(resolve)); render();
  return { render, find, button, uploads, get saved() { return saved; },
    failNextFrozenWrite() { failFrozenWrite = true; }, failNextUpload() { failUpload = true; },
    async submit() { await find("form").props.onSubmit({ preventDefault() {} }); render(); },
  };
}

test("failed first durable freeze keeps editing, photo removal, and discard available without uploading", async () => {
  const h = await workspace(); h.failNextFrozenWrite(); await h.submit();
  assert.equal(h.uploads.length, 0);
  assert.equal(h.saved.frozenReceipt, null);
  assert.equal(h.find("fieldset").props.disabled, false);
  assert.equal(h.button("Discard unsubmitted draft").props.disabled, false);
  h.button("Remove photo 1").props.onClick(); h.render();
  assert.equal(h.find("img"), undefined);
});

test("successful retry after local failure durably saves the receipt before upload and then clears it", async () => {
  const h = await workspace(); h.failNextFrozenWrite(); await h.submit(); await h.submit();
  assert.equal(h.uploads.length, 1);
  assert.equal(h.saved, null);
  assert.equal(h.find("fieldset").props.disabled, false);
});

test("local failure after an ambiguous upload preserves the exact frozen receipt for retry", async () => {
  const h = await workspace(); h.failNextUpload(); await h.submit();
  const receipt = h.saved.frozenReceipt;
  h.failNextFrozenWrite(); await h.submit();
  assert.equal(h.uploads.length, 1);
  assert.equal(h.find("fieldset").props.disabled, true);
  assert.equal(h.button("Discard unsubmitted draft"), undefined);
  assert.deepEqual(h.saved.frozenReceipt, receipt);
  await h.submit();
  assert.equal(h.uploads.length, 2);
  assert.deepEqual(h.uploads[0], h.uploads[1]);
  assert.equal(h.saved, null);
});
