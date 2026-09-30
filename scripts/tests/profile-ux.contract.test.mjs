import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = "client/src/components/profile/";
const read = (file) => readFileSync(path.join(root, dir, file), "utf8");
const searchSource = read("profileTemplateSearch.ts");
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(searchSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports: module.exports, module });
const { filterProfileTemplates } = module.exports;
const catalog = Object.freeze([
  Object.freeze({ id: "wholesaler", label: "Wholesaler", description: "Materials and inventory", bestFor: "Stone sourcing", family: "inventory" }),
  Object.freeze({ id: "auto-glass", label: "Auto glass", description: "Mobile windshield repair", bestFor: "Vehicle shops", family: "vehicle" }),
  Object.freeze({ id: "electrician-solo", label: "Électrician", description: "Independent electrical services", bestFor: "Small crews", family: "electrical" }),
]);
const ids = (query) => Array.from(filterProfileTemplates(catalog, query), (entry) => entry.id);

test("empty search retains every supplied catalog entry in order", () => assert.deepEqual(ids(""), catalog.map((t) => t.id)));
test("whitespace search retains catalog order", () => assert.deepEqual(ids(" \n\t "), catalog.map((t) => t.id)));
test("case-insensitive label search", () => assert.deepEqual(ids("AUTO GLASS"), ["auto-glass"]));
test("diacritic-insensitive label search", () => assert.deepEqual(ids("electrician"), ["electrician-solo"]));
test("description is searchable", () => assert.deepEqual(ids("windshield"), ["auto-glass"]));
test("business fit is searchable", () => assert.deepEqual(ids("small crews"), ["electrician-solo"]));
test("family is searchable", () => assert.deepEqual(ids("vehicle"), ["auto-glass"]));
test("all search words must match, even across fields", () => assert.deepEqual(ids("glass mobile vehicle"), ["auto-glass"]));
test("mixed unrelated words do not return a false match", () => assert.deepEqual(ids("glass electrical"), []));
test("no query creates a missing template", () => assert.deepEqual(ids("roofing"), []));
test("search metacharacters are literal, not regular expressions", () => assert.deepEqual(ids(".*"), []));
test("search does not mutate catalog records", () => {
  const result = filterProfileTemplates(catalog, "glass");
  assert.equal(result[0], catalog[1]);
  assert.equal(catalog.length, 3);
});
test("legacy metadata without optional search fields remains supported", () => {
  const result = filterProfileTemplates([{ id: "default", label: "Default", description: "Basic profile" }], "basic");
  assert.equal(result.length, 1);
});

for (const file of ["profileTemplateSearch.ts", "ProfileTemplatePicker.tsx", "ProfileSiteManageChrome.tsx", "PublicProfileProductCard.tsx"]) {
  test(`${file} parses as TypeScript/TSX`, () => {
    const result = ts.transpileModule(read(file), { fileName: file, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } });
    assert.deepEqual(result.diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error), []);
  });
}

const picker = read("ProfileTemplatePicker.tsx");
const manager = read("ProfileSiteManageChrome.tsx");
const card = read("PublicProfileProductCard.tsx");

test("picker reuses the canonical selectable catalog and requires explicit apply", () => {
  assert.match(picker, /listSelectableProfileSiteTemplates\(\)/);
  assert.match(picker, /type="radio"/);
  assert.match(picker, /type="submit" disabled=\{!canApply\}/);
  assert.match(picker, /selected\.id !== currentTemplate && !saving && !hasUnsavedEdits/);
  assert.doesNotMatch(picker, /fetch\(|apiRequest\(|window\.confirm/);
});
test("template writes retain existing owner and non-reset behavior", () => {
  assert.match(manager, /apiRequest\("PUT", `\/api\/profiles\/\$\{profileId\}`/);
  assert.match(manager, /reset: false/);
  assert.match(manager, /if \(success\) closeTemplates\(\)/);
  assert.match(manager, /if \(savingRef\.current\) return false/);
});
test("editor controls retain inventory, photos, qualified editor and domain bridge", () => {
  for (const token of ["JwStoneCurrentInventoryManager", "upsertInventoryLeadImage", "qualifyPublicProfileItemDestination", "requiresDocumentNavigation(editorHref)", "manage-bridge-token", 'target.searchParams.set("admin_token", token)', 'data-testid="profile-manage-save-inline"']) assert.ok(manager.includes(token), token);
});
test("editing has labelled inputs, visible error recovery and leave protection", () => {
  assert.match(manager, /role="alert"/);
  assert.match(manager, /htmlFor=\{`\$\{id\}-name`\}/);
  assert.match(manager, /id=\{`\$\{id\}-name`\}/);
  assert.match(manager, /window\.addEventListener\("beforeunload"/);
  assert.match(manager, /window\.removeEventListener\("beforeunload"/);
  assert.match(manager, /onClick=\{guardEditorNavigation\}/);
  assert.match(manager, /templateToggleRef\.current\?\.focus\(\)/);
});
test("product cards preserve exact destination qualification and sharing props", () => {
  assert.match(card, /requiresDocumentNavigation\(destination\)/);
  assert.match(card, /<a href=\{destination\}/);
  assert.match(card, /<Link href=\{destination\}/);
  assert.match(card, /<ShareButton destination=\{destination\} title=\{title\} text=\{shareText\}/);
  assert.doesNotMatch(card, /tel:|mailto:|apiRequest|fetch\(/);
});
test("product cards expose honest image fallback and reduced-motion styles", () => {
  assert.match(card, /failedImageUrl !== imageUrl/);
  assert.match(card, /onError=\{\(\) => setFailedImageUrl\(imageUrl\)\}/);
  assert.match(card, /No photo available/);
  assert.match(card, /motion-reduce:transition-none/);
  assert.match(card, /\[overflow-wrap:anywhere\]/);
  assert.doesNotMatch(card, /Photo coming soon|bg-emerald/);
});
