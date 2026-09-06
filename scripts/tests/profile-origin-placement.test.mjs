import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

// Source-contract tests, not a substitute for an app build or browser review.
// Run from the repository root: node --test scripts/tests/profile-origin-placement.test.mjs
const FRAME = "client/src/pages/profile-sites/IssaBuildProfileTruthFrame.tsx";
const HERO = "client/src/features/jw-stone/MarketplaceIntroduction.tsx";
const PROFILE = "shared/issaBuildProfile.ts";
const NORMALIZER = "server/services/issaBuildVerifiedProfileNormalization.ts";
const ORIGINS = "shared/onyxOrigins.ts";

function read(relativePath) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function parse(relativePath) {
  const source = ts.createSourceFile(
    relativePath,
    read(relativePath),
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  assert.equal(source.parseDiagnostics.length, 0, `Invalid syntax in ${relativePath}`);
  return source;
}

function findAll(node, predicate) {
  const result = [];
  function visit(current) {
    if (predicate(current)) result.push(current);
    ts.forEachChild(current, visit);
  }
  visit(node);
  return result;
}

function unwrap(node) {
  while (
    node &&
    (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))
  ) {
    node = node.expression;
  }
  return node;
}

function variable(source, name) {
  const declaration = findAll(source, (node) =>
    ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name
  )[0];
  assert.ok(declaration?.initializer, `Missing variable: ${name}`);
  return unwrap(declaration.initializer);
}

function property(object, name) {
  const value = unwrap(object);
  assert.ok(value && ts.isObjectLiteralExpression(value), `Expected an object for ${name}`);
  const member = value.properties.find((node) =>
    ts.isPropertyAssignment(node) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
    node.name.text === name
  );
  assert.ok(member, `Missing property: ${name}`);
  return unwrap(member.initializer);
}

function stringValue(node) {
  const value = unwrap(node);
  assert.ok(value && ts.isStringLiteralLike(value), "Expected a string literal");
  return value.text;
}

function jsx(source, name) {
  return findAll(source, (node) =>
    (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
    node.tagName.getText(source) === name
  );
}

function attribute(element, name) {
  return element.attributes.properties.find((node) =>
    ts.isJsxAttribute(node) && node.name.getText() === name
  );
}

function profileBlocks(source) {
  const blocks = variable(source, "ISSA_BUILD_PROFILE_CONTENT_BLOCKS");
  assert.ok(ts.isArrayLiteralExpression(blocks));
  return blocks.elements;
}

for (const relativePath of [FRAME, HERO]) {
  test(`${relativePath}: no storefront-wide onyx banner`, () => {
    const source = parse(relativePath);
    assert.equal(jsx(source, "IranianOnyxFeature").length, 0);
    assert.equal(findAll(source, (node) =>
      ts.isImportDeclaration(node) && /IranianOnyxFeature/.test(node.moduleSpecifier.text)
    ).length, 0);
  });
}

test("ISSA Build: no added Pensacola service-link navigation above the profile", () => {
  const source = parse(FRAME);
  const navigation = jsx(source, "nav");
  assert.equal(navigation.filter((node) => {
    const label = attribute(node, "aria-label")?.initializer;
    return label && stringValue(label) === "ISSA Build Pensacola services";
  }).length, 0);
  assert.doesNotMatch(read(FRAME), /href=\{`\/u\/issa-build\/services\//);
});

test("ISSA Build: existing profile, verified status, and deliberate request panel remain", () => {
  const source = parse(FRAME);
  assert.equal(jsx(source, "LegacyWholesalerProfileTheme").length, 1);
  assert.ok(attribute(jsx(source, "LegacyWholesalerProfileTheme")[0], "onProjectRequest"));
  const panels = jsx(source, "ExpressDirectConnectPanel");
  assert.equal(panels.length, 1);
  assert.equal(stringValue(attribute(panels[0], "initialView").initializer), "request");
  assert.equal(stringValue(attribute(panels[0], "initialRequestType").initializer), "request_quote");
  assert.equal(stringValue(attribute(panels[0], "requestMode").initializer), "service");
  assert.match(read(FRAME), /100% Verified by TradeScout/);
  assert.match(read(FRAME), /pensacolaProjectMessage\("project"\)/);
});

test("JW Stone: existing hero video and approved headline remain", () => {
  const source = parse(HERO);
  assert.equal(jsx(source, "video").length, 1);
  assert.equal(jsx(source, "h1").length, 1);
  assert.equal(stringValue(variable(source, "JW_STONE_HERO_VIDEO")),
    "/images/businesses/jw-stone/video/hero.mp4");
  assert.equal(stringValue(variable(source, "JW_STONE_HERO_POSTER")),
    "/images/businesses/jw-stone/video/hero-poster.jpg");
  assert.match(read(HERO), /Natural stone, selected at the source\./);
});

test("Business introductions do not repeat stone origin", () => {
  for (const file of [FRAME, NORMALIZER]) {
    const literals = findAll(parse(file), ts.isStringLiteralLike);
    assert.equal(literals.filter((node) => /\bIran(?:ian)?\b/i.test(node.text)).length, 0, file);
  }
  const source = parse(PROFILE);
  const discovery = variable(source, "ISSA_BUILD_LOCAL_DISCOVERY");
  assert.doesNotMatch(stringValue(property(discovery, "description")), /\bIran(?:ian)?\b/i);
  assert.match(stringValue(property(discovery, "description")), /Pensacola/);
  assert.match(stringValue(property(discovery, "description")), /countertops and fabrication/);
});

test("Business profile has no added standalone country-of-origin FAQ", () => {
  const source = parse(PROFILE);
  const faqs = profileBlocks(source).filter((block) =>
    stringValue(property(block, "type")) === "faq"
  );
  assert.equal(faqs.filter((block) => /country of origin|Iran/i.test(block.getText(source))).length, 0);
});

test("Both named ISSA Build stones retain their own origin, thickness, and listing summaries", () => {
  const source = parse(PROFILE);
  const catalog = profileBlocks(source).find((block) =>
    stringValue(property(block, "type")) === "inventoryCatalog"
  );
  assert.ok(catalog);
  const categories = property(property(catalog, "data"), "categories");
  assert.ok(ts.isArrayLiteralExpression(categories));
  const stones = categories.elements.flatMap((category) => {
    const items = property(category, "stones");
    assert.ok(ts.isArrayLiteralExpression(items));
    return [...items.elements];
  });
  assert.equal(stones.length, 2);
  for (const slug of ["honey-onyx", "multi-green-onyx"]) {
    const stone = stones.find((item) => stringValue(property(item, "slug")) === slug);
    assert.ok(stone, slug);
    assert.equal(property(stone, "countryOfOrigin").getText(source),
      `ISSA_BUILD_ONYX_ORIGINS["${slug}"].country`);
    assert.equal(property(stone, "thicknessCm").getText(source), "IRANIAN_ONYX_STOCK.thicknessCm");
    assert.match(property(stone, "publicSummary").getText(source), /IRANIAN_ONYX_STOCK\.specification/);
    assert.ok(property(stone, "images"));
  }
});

test("Confirmed origin remains limited to the named offerings; stock is not turned into a price", () => {
  const source = parse(ORIGINS);
  const originCall = variable(source, "IRANIAN_ONYX_ORIGIN");
  assert.ok(ts.isCallExpression(originCall));
  assert.equal(stringValue(property(originCall.arguments[0], "country")), "Iran");
  const stockCall = variable(source, "IRANIAN_ONYX_STOCK");
  assert.ok(ts.isCallExpression(stockCall));
  assert.equal(property(stockCall.arguments[0], "thicknessCm").getText(source), "2");
  const jw = variable(source, "JW_STONE_ONYX_ORIGINS");
  assert.ok(ts.isCallExpression(jw));
  assert.equal(property(jw.arguments[0], "honey-onyx").getText(source), "IRANIAN_ONYX_ORIGIN");
  assert.equal(jw.arguments[0].properties.length, 1);
  for (const file of [FRAME, HERO, PROFILE, NORMALIZER, ORIGINS]) {
    assert.doesNotMatch(read(file), /\$\s*\d|\b(?:pricePerSqFt|privatePrice|memberPrice)\s*:/i, file);
  }
});

test("Edited TypeScript files transpile without syntax diagnostics", () => {
  for (const file of [FRAME, HERO, PROFILE, NORMALIZER]) {
    const result = ts.transpileModule(read(file), {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    const errors = (result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
    assert.deepEqual(errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, "\n")), [], file);
  }
});
