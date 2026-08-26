import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const manifest = JSON.parse(
  fs.readFileSync(new URL("../client/src/data/jwStoneDominantColors.generated.json", import.meta.url))
);
const overrides = JSON.parse(
  fs.readFileSync(new URL("../client/src/data/jwStoneColorOverrides.json", import.meta.url))
);
const audit = JSON.parse(
  fs.readFileSync(new URL("../artifacts/jw-stone-color-truth/audit.json", import.meta.url))
);

test("unsafe or unresolved photos fail closed with no public color evidence", () => {
  for (const [slug, stone] of Object.entries(manifest.stones)) {
    if (stone.sample) continue;
    assert.deepEqual(stone.swatches, [], `${slug} swatches`);
    assert.deepEqual(stone.buckets, [], `${slug} buckets`);
    assert.equal(stone.sliver, null, `${slug} sliver`);
  }
  assert.ok(audit.counts.excluded > 0);
});

test("all shopper-facing colors have a reviewed slab-face sample", () => {
  for (const [slug, stone] of Object.entries(manifest.stones)) {
    if (!stone.buckets.length) continue;
    assert.ok(stone.sample, slug);
    assert.equal(stone.sample.source, "inner-slab-face-only", slug);
    assert.ok(stone.sample.confidence >= 0.79, slug);
  }
});

test("manual corrections are declared, minimal, and backed by audit dispositions", () => {
  assert.deepEqual(Object.keys(overrides).sort(), [
    "dueto",
    "emperor-brown",
    "mexican-brown",
    "namib-fantasy",
    "preto-sao-gabriel",
    "venta-black",
  ].sort());
  for (const [slug, override] of Object.entries(overrides)) {
    assert.ok(override.categories.length, slug);
    assert.ok(override.reason.length > 20, slug);
    const row = audit.stones.find((stone) => stone.slug === slug);
    assert.ok(row?.overrideDisposition.includes(override.disposition), slug);
  }
});

test("color collages never duplicate a stone to fake variety", () => {
  const allSlugs = [];
  for (const [band, slugs] of Object.entries(audit.collageEvidence)) {
    assert.equal(new Set(slugs).size, slugs.length, band);
    assert.ok(slugs.length <= 6, band);
    allSlugs.push(...slugs);
  }
  assert.equal(new Set(allSlugs).size, allSlugs.length, "duplicate across Browse by Color");
});
