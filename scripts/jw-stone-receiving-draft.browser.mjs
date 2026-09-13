// Isolated component + real Chromium/IndexedDB proof. Auth/API are test fixtures,
// not production integration proof. This fixture is never part of the app build.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";

const root = process.cwd();
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {JwStoneEmployeeReceiving} from './client/src/features/jw-stone/JwStoneEmployeeReceiving';
import * as drafts from './client/src/features/jw-stone/jwStoneReceivingDraftStore';
window.__drafts=drafts;
const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
createRoot(document.getElementById('root')).render(<QueryClientProvider client={queryClient}><JwStoneEmployeeReceiving /></QueryClientProvider>);
`;
const apiFixture = `
export class ApiError extends Error { constructor(message,status){super(message);this.status=status;} }
export async function apiRequest(first,second){
 const method=typeof second==='string'?first:(second?.method||'GET');
 const url=typeof second==='string'?second:first;
 const response=await fetch(url,{method,body:typeof second==='object'?second.body:undefined,
 headers:{...(typeof second==='object'?second.headers:{}),'X-Proof-Viewer':sessionStorage.getItem('jw-proof-viewer')||'TEST_EMPLOYEE'}});
 const result=await response.json();if(!response.ok)throw new ApiError(result.message,response.status);return result;
}`;
const result = await build({
  stdin: { contents: entry, resolveDir: root, loader: "tsx" },
  bundle: true, write: false, platform: "browser", format: "esm", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"test"' },
  plugins: [{ name: "isolated-receiving-fixtures", setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/queryClient$|^@\/hooks\/useAuth$/ }, args => ({ path: args.path, namespace: "receiving-proof" }));
    builder.onLoad({ filter: /.*/, namespace: "receiving-proof" }, args => ({ loader: "js", contents: args.path.endsWith("useAuth")
      ? "export function useAuth(){return {user:{id:sessionStorage.getItem('jw-proof-viewer')||'TEST_EMPLOYEE'}};}" : apiFixture }));
    builder.onResolve({ filter: /^@shared\// }, args => ({ path: resolve(root, "shared", args.path.slice(8) + ".ts") }));
  }}],
});
const script = result.outputFiles[0].text;
const server = createServer((req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  if (req.url === "/proof.js") { res.setHeader("Content-Type", "text/javascript"); res.end(script); }
  else { res.setHeader("Content-Type", "text/html"); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/proof.js"></script>'); }
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const uploads = [];
const checks = [];
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route("**/api/**", async route => {
    const req = route.request(), viewerId = req.headers()["x-proof-viewer"];
    const path = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path.endsWith("/access")) return json({ viewerId, allowed: viewerId !== "TEST_MEMBER", enabled: true });
    if (path.endsWith("/receipts") && req.method() === "GET") return json({ viewerId, items: [] });
    if (path.endsWith("/receipts") && req.method() === "POST") {
      uploads.push(req.postDataBuffer());
      return uploads.length === 1 ? json({ message: "TEST interrupted upload" }, 503) : json({ published: true }, 201);
    }
    return json({ message: "Unexpected proof request" }, 500);
  });
  const page = await context.newPage();
  page.on("dialog", dialog => dialog.accept());
  await page.goto(origin);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Draft recovery is ready.", { exact: true })).toBeVisible();
  checks.push("authorized fixture opens the actual receiving component");
  const fields = { materialName: "TEST RECOVERY STONE", materialFamily: "granite", lotLabel: "TEST-001", quantity: "2", length: "120", height: "60", thicknessMm: "30", finish: "polished", locationLabel: "TEST RACK", sellPrice: "12.50" };
  for (const [name, value] of Object.entries(fields)) await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('[name="materialClass"]').selectOption("natural_stone");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jTYQAAAAASUVORK5CYII=", "base64");
  await page.getByLabel("Choose lot photos").setInputFiles({ name: "test-lot.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Draft saved on this device.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('[name="materialName"]')).toHaveValue("TEST RECOVERY STONE");
  await expect(page.getByRole("img", { name: "Lot photo 1" })).toBeVisible();
  const photo = await page.evaluate(async () => {
    const row = await window.__drafts.readReceivingDraft("TEST_EMPLOYEE");
    return { name: row.draft.photos[0].name, bytes: [...new Uint8Array(await row.draft.photos[0].arrayBuffer())] };
  });
  assert.equal(photo.name, "test-lot.png"); assert.deepEqual(Buffer.from(photo.bytes), png);
  checks.push("reload restores form fields and exact photo bytes");
  const failNextFrozenDraftWrite = () => page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, ...args) {
      if (value?.draft?.frozenReceipt) {
        IDBObjectStore.prototype.put = originalPut;
        throw new DOMException("TEST local quota failure", "QuotaExceededError");
      }
      return originalPut.call(this, value, ...args);
    };
  });
  await failNextFrozenDraftWrite();
  await page.getByRole("button", { name: "Receive & publish", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("TEST local quota failure");
  assert.equal(uploads.length, 0);
  await expect(page.locator('[name="materialName"]')).toBeEnabled();
  await expect(page.getByRole("button", { name: "Discard unsubmitted draft", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Remove photo 1", exact: true }).click();
  await expect(page.getByRole("img", { name: "Lot photo 1" })).toHaveCount(0);
  await page.getByLabel("Choose lot photos").setInputFiles({ name: "test-lot.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Draft saved on this device.", { exact: true })).toBeVisible();
  assert.equal((await page.evaluate(() => window.__drafts.readReceivingDraft("TEST_EMPLOYEE"))).draft.frozenReceipt, null);
  checks.push("failed local freeze sends nothing and leaves the draft editable for storage recovery");
  await page.getByRole("button", { name: "Receive & publish", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("TEST interrupted upload");
  await expect(page.getByRole("button", { name: "Retry this same arrival", exact: true })).toBeVisible();
  const attemptedReceipt = (await page.evaluate(() => window.__drafts.readReceivingDraft("TEST_EMPLOYEE"))).draft.frozenReceipt;
  await failNextFrozenDraftWrite();
  await page.getByRole("button", { name: "Retry this same arrival", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("TEST local quota failure");
  assert.equal(uploads.length, 1);
  await expect(page.locator('[name="materialName"]')).toBeDisabled();
  assert.deepEqual((await page.evaluate(() => window.__drafts.readReceivingDraft("TEST_EMPLOYEE"))).draft.frozenReceipt, attemptedReceipt);
  checks.push("a local write failure after an attempted upload retains its frozen receipt identity");
  await page.reload();
  await page.getByRole("button", { name: "Retry this same arrival", exact: true }).click();
  await expect(page.getByText("Arrival received and listed on JW Stone.", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved draft cleared.", { exact: true })).toBeVisible();
  assert.equal(uploads.length, 2);
  const receipt = body => JSON.parse(body.toString().match(/name="receipt"\r\n\r\n([^\r\n]+)/)[1]);
  assert.deepEqual(receipt(uploads[0]), receipt(uploads[1]));
  for (const body of uploads) assert.ok(body.includes(png));
  assert.equal((await page.evaluate(() => window.__drafts.readReceivingDraft("TEST_EMPLOYEE"))).draft, null);
  checks.push("interrupted upload survives reload and retries the same receipt and photos");
  const transactionChecks = await page.evaluate(async () => {
    const m = window.__drafts, row = await m.readReceivingDraft("TEST_EMPLOYEE");
    const draft = { fields: { lotLabel: "TEST-CAS" }, photos: [], frozenReceipt: null };
    const results = await Promise.allSettled([
      m.writeReceivingDraft("TEST_EMPLOYEE", row.revision, draft),
      m.writeReceivingDraft("TEST_EMPLOYEE", row.revision, draft),
    ]);
    const now = await m.readReceivingDraft("TEST_EMPLOYEE");
    await m.writeReceivingDraft("TEST_EMPLOYEE", now.revision, null);
    let staleRejected = false;
    try { await m.writeReceivingDraft("TEST_EMPLOYEE", now.revision, draft); } catch { staleRejected = true; }
    return { writers: results.filter(r => r.status === "fulfilled").length, staleRejected, other: await m.readReceivingDraft("TEST_OTHER_EMPLOYEE") };
  });
  assert.equal(transactionChecks.writers, 1); assert.equal(transactionChecks.staleRejected, true); assert.equal(transactionChecks.other.draft, null);
  checks.push("real IndexedDB rejects concurrent overwrites and stale draft resurrection");
  checks.push("different employee storage keys do not share drafts");
  await page.evaluate(() => sessionStorage.setItem("jw-proof-viewer", "TEST_MEMBER"));
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "JW Stone employee inventory" })).toHaveCount(0);
  checks.push("unassigned member fixture does not mount employee receiving");
  console.log(JSON.stringify({ passed: checks.length, checks, scope: "Real Chromium, React component and IndexedDB; authentication and server/storage APIs are fixtures, not live integration proof." }, null, 2));
  await context.close();
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
