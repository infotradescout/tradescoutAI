import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url), ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function load(file, dependencies = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  });
  assert.equal(output.diagnostics?.length || 0, 0, file);
  const module = { exports: {} };
  new Function("require", "module", "exports", output.outputText)(id => dependencies[id] || require(id), module, module.exports);
  return module.exports;
}
const buyer = load("shared/exchangeStoneBuyerFlow.ts");
const draft = load("shared/exchangeStoneInquiryDraft.ts", { "./exchangeStoneBuyerFlow": buyer });
const id = "tradescout-stone-test";
const now = 1790010000000;
const sample = { listingId: id, intent: "callback", message: "Please call about two slabs.", actorId: null };
function memory() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values };
}

test("inquiry draft leads with the recorded full slab estimate and keeps the square-foot rate second", () => {
  const message = buyer.stoneInquiryMessage({
    title: "AJ Quartz", price: "30.00", specifications: {
      priceUnit: "sqft", referenceSizesInches: "128x64, 127.5x64",
    },
  }, "availability");
  assert.match(message, /^Please confirm availability for AJ Quartz\. Estimated full slab material price: \$1,700\.00–\$1,706\.67\. Listed material rate: \$30\.00 \/ sq ft\./);
  assert.match(message, /confirm the exact slab dimensions, available quantity, and delivery charges through TradeScout\.$/);
});

test("inquiry draft marks an unsized slab TBD without inventing a total", () => {
  const message = buyer.stoneInquiryMessage({
    title: "Unsized stone", price: "30.00", specifications: { priceUnit: "sqft" },
  }, "callback");
  assert.match(message, /^I would like a call about Unsized stone\. Slab price TBD\. Listed material rate: \$30\.00 \/ sq ft\./);
  assert.equal(message.includes("Estimated full slab material price"), false);
});

test("inquiry draft quotes an identified exact slab without a square-foot rate", () => {
  const message = buyer.stoneInquiryMessage({
    title: "Identified slab", price: "1707.00", specifications: { priceUnit: "slab", exactSlab: "Slab A" },
  }, "availability");
  assert.match(message, /Full slab material price: \$1,707\.00\./);
  assert.equal(message.includes("Listed material rate"), false);
});

test("only marked TradeScout retail listings receive this UI; profiles remain separate", () => {
  const good = { id, sourceType: "marketplace_listing", specifications: { commerceChannel: "tradescout_stone_retail" } };
  assert.equal(draft.isStoneRetailListing(good), true);
  for (const value of [null, {}, { ...good, id: "jw-stone-test" }, { ...good, specifications: {} }, { ...good, sourceType: "profile_catalog" }, { ...good, sourceType: "profile_offer" }]) assert.equal(draft.isStoneRetailListing(value), false);
});
test("anonymous draft survives sign-in in the same tab with exact message and intent", () => {
  const storage = memory();
  assert.equal(draft.saveStoneInquiryDraft(storage, sample, now), true);
  const restored = draft.restoreStoneInquiryDraft(storage, id, "buyer-1", now + 1);
  assert.equal(restored.message, sample.message);
  assert.equal(restored.intent, "callback");
});
test("drafts are listing-specific and cannot overwrite another stone", () => {
  const storage = memory();
  draft.saveStoneInquiryDraft(storage, sample, now);
  assert.equal(draft.restoreStoneInquiryDraft(storage, "tradescout-stone-other", null, now), null);
  assert.equal(draft.restoreStoneInquiryDraft(storage, id, null, now).message, sample.message);
});
test("a signed-in account cannot receive a different account's draft", () => {
  const storage = memory();
  draft.saveStoneInquiryDraft(storage, { ...sample, actorId: "buyer-1" }, now);
  assert.equal(draft.restoreStoneInquiryDraft(storage, id, "buyer-2", now), null);
  assert.equal(storage.values.size, 0);
});
test("expired and future-invalid drafts are deleted", () => {
  const storage = memory();
  draft.saveStoneInquiryDraft(storage, sample, now);
  assert.equal(draft.restoreStoneInquiryDraft(storage, id, null, now + draft.STONE_DRAFT_TTL_MS), null);
  draft.saveStoneInquiryDraft(storage, sample, now + draft.STONE_DRAFT_TTL_MS + 1);
  assert.equal(draft.restoreStoneInquiryDraft(storage, id, null, now), null);
});
test("invalid, huge or malformed persisted data is not restored", () => {
  for (const raw of ["{", '"invalid"', "x".repeat(25000), JSON.stringify({ ...sample, version: 1, expiresAt: now + 1, intent: "call_now" })]) {
    const storage = memory();
    storage.setItem(`tradescout:stone-inquiry:v1:${id}`, raw);
    assert.equal(draft.restoreStoneInquiryDraft(storage, id, null, now), null);
  }
});
test("invalid messages, intents and identities cannot be saved", () => {
  for (const value of [{ ...sample, message: " " }, { ...sample, message: "x".repeat(4001) }, { ...sample, listingId: "../private" }, { ...sample, intent: "send" }, { ...sample, actorId: 3 }]) assert.equal(draft.saveStoneInquiryDraft(memory(), value, now), false);
});
test("blocked or silently discarded browser storage is an explicit failure", () => {
  const fail = () => { throw new Error("denied"); };
  assert.equal(draft.saveStoneInquiryDraft({ getItem: fail, setItem: fail, removeItem: fail }, sample, now), false);
  assert.equal(draft.restoreStoneInquiryDraft({ getItem: fail, setItem: fail, removeItem: fail }, id, null, now), null);
  assert.equal(draft.saveStoneInquiryDraft({ getItem: () => null, setItem() {}, removeItem() {} }, sample, now), false);
});
test("successful send/cancel can erase a draft without affecting another listing", () => {
  const storage = memory();
  draft.saveStoneInquiryDraft(storage, sample, now);
  draft.saveStoneInquiryDraft(storage, { ...sample, listingId: "tradescout-stone-other" }, now);
  assert.equal(draft.forgetStoneInquiryDraft(storage, id), true);
  assert.equal(storage.values.size, 1);
});
test("screen compiles and retains the real Decision Card -> inquiry endpoints", () => {
  const file = "client/src/pages/exchange/ExchangeListingDetail.tsx";
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const parsed = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext } });
  assert.equal(parsed.diagnostics?.length || 0, 0);
  assert.ok(source.includes('"/api/decision-cards"'));
  assert.ok(source.includes('"/api/marketplace/inquiries"'));
  assert.ok(source.indexOf('"/api/decision-cards"') < source.indexOf('"/api/marketplace/inquiries"'));
  assert.ok(source.includes('authorityGate: "decision_card"'));
  assert.ok(source.includes('sourceDecisionCardId,'));
  assert.ok(source.includes('retry: false'));
  assert.ok(source.includes('submissionLock.current'));
  assert.ok(source.includes('"Sign in to send"'));
  assert.ok(source.includes('"Request a callback"') || source.includes('Request a callback'));
  assert.ok(!source.includes('jwstonelogistics'));
});
