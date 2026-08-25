import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyStoneSwatch,
  tightenStonePalette,
} from "./jw-stone-color-bucket-accuracy.mjs";

test("cool white and gray slab swatches never become blue", () => {
  for (const hex of ["#cdd7e1", "#9cabbd", "#a5b4c4", "#d9e0e8"]) {
    assert.notEqual(classifyStoneSwatch(hex), "blue", hex);
  }
});

test("real blue and green slab swatches remain eligible", () => {
  assert.equal(classifyStoneSwatch("#305897"), "blue");
  assert.equal(classifyStoneSwatch("#35764f"), "green");
});

test("weak one-off shades do not create a filter bucket", () => {
  const palette = tightenStonePalette({
    swatches: [
      { hex: "#eee9df", bucket: "white" },
      { hex: "#d8d3cb", bucket: "white" },
      { hex: "#9cabbd", bucket: "blue" },
      { hex: "#c8c3bb", bucket: "beige" },
    ],
    buckets: ["white", "blue", "beige"],
  });
  assert.deepEqual(palette.buckets, ["white"]);
  assert.ok(!palette.buckets.includes("blue"));
});

test("a strong visible stone accent remains filterable", () => {
  const palette = tightenStonePalette({
    swatches: [
      { hex: "#eee9df", bucket: "white" },
      { hex: "#d8d3cb", bucket: "white" },
      { hex: "#305897", bucket: "blue" },
    ],
    buckets: ["white", "blue"],
  });
  assert.deepEqual(palette.buckets, ["white", "blue"]);
});
