import test from "node:test";
import assert from "node:assert/strict";
import {
  boxFromNormalized,
  detectSlabFaceBoxFromRaw,
  extractPaletteFromRaw,
  safeCenterFaceBox,
} from "./jw-stone-face-color-core.mjs";

function scene({
  width = 240,
  height = 180,
  slab = { left: 20, top: 35, width: 200, height: 125 },
  slabColor = [142, 132, 118],
} = {}) {
  const channels = 3;
  const data = new Uint8Array(width * height * channels);
  const write = (x, y, [r, g, b]) => {
    const index = (y * width + x) * channels;
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let color;
      if (y < height * 0.45) color = [45, 145, 235];
      else color = [184, 153, 101];
      if ((x < width * 0.2 || x > width * 0.8) && y > height * 0.08 && y < height * 0.55) {
        color = [38 + ((x + y) % 22), 92 + ((x * 3 + y) % 45), 30];
      }
      write(x, y, color);
    }
  }

  for (let y = slab.top; y < slab.top + slab.height; y += 1) {
    for (let x = slab.left; x < slab.left + slab.width; x += 1) {
      const noise = ((x * 13 + y * 7) % 17) - 8;
      write(
        x,
        y,
        slabColor.map((channel) => Math.max(0, Math.min(255, channel + noise)))
      );
    }
  }

  return { data, info: { width, height, channels }, slab };
}

function assertInside(inner, outer) {
  assert.ok(inner.left >= outer.left, `${inner.left} >= ${outer.left}`);
  assert.ok(inner.top >= outer.top, `${inner.top} >= ${outer.top}`);
  assert.ok(inner.left + inner.width <= outer.left + outer.width);
  assert.ok(inner.top + inner.height <= outer.top + outer.height);
}

function cropRaw(source, box) {
  const { data, info } = source;
  const out = new Uint8Array(box.width * box.height * info.channels);
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      const from = ((box.top + y) * info.width + box.left + x) * info.channels;
      const to = (y * box.width + x) * info.channels;
      for (let channel = 0; channel < info.channels; channel += 1) {
        out[to + channel] = data[from + channel];
      }
    }
  }
  return {
    data: out,
    info: { width: box.width, height: box.height, channels: info.channels },
  };
}

test("detected sample stays completely inside the slab, excluding sky, trees and ground", () => {
  const source = scene();
  const detected = detectSlabFaceBoxFromRaw(source.data, source.info);
  const sample = boxFromNormalized(detected.sample, source.info.width, source.info.height);
  assert.equal(detected.mode, "detected-slab-core");
  assertInside(sample, source.slab);
  const cropped = cropRaw(source, sample);
  const palette = extractPaletteFromRaw(cropped.data, cropped.info);
  assert.ok(!palette.buckets.includes("blue"), JSON.stringify(palette));
  assert.ok(!palette.buckets.includes("green"), JSON.stringify(palette));
  assert.ok(!palette.buckets.includes("gold"), JSON.stringify(palette));
});

test("offset slab still produces an interior-only sample", () => {
  const source = scene({ slab: { left: 8, top: 46, width: 205, height: 112 } });
  const detected = detectSlabFaceBoxFromRaw(source.data, source.info);
  const sample = boxFromNormalized(detected.sample, source.info.width, source.info.height);
  assertInside(sample, source.slab);
});

test("real green and blue slab faces remain green and blue because hue is not discarded", () => {
  for (const [slabColor, expected] of [
    [[53, 118, 79], "green"],
    [[48, 88, 151], "blue"],
  ]) {
    const source = scene({ slabColor });
    const detected = detectSlabFaceBoxFromRaw(source.data, source.info);
    const sample = boxFromNormalized(detected.sample, source.info.width, source.info.height);
    const cropped = cropRaw(source, sample);
    const palette = extractPaletteFromRaw(cropped.data, cropped.info);
    assert.ok(palette.buckets.includes(expected), `${expected}: ${JSON.stringify(palette)}`);
  }
});

test("fallback crop is a small center-safe core, never the full photograph", () => {
  const box = safeCenterFaceBox(1000, 700);
  assert.ok(box.left >= 300);
  assert.ok(box.top >= 238);
  assert.ok(box.left + box.width <= 700);
  assert.ok(box.top + box.height <= 462);
});
