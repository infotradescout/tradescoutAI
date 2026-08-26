/**
 * Pure geometry + palette helpers for JW Stone slab-face color extraction.
 *
 * Governing rule: color sampling may use only an inset rectangle inside the
 * photographed slab. Sky, trees, gravel, racks, clamps, neighboring slabs, and
 * other yard/environment pixels are never valid color evidence.
 */

const DEFAULT_CHANNELS = 3;
const LAB_BIN = 7;
const MAX_SWATCHES = 5;
const MIN_SWATCHES = 3;
const MIN_CLUSTER_SHARE = 0.004;
const MIN_DELTA_E = 12;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percentile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * clamp(q, 0, 1);
  const low = Math.floor(position);
  const high = Math.ceil(position);
  if (low === high) return sorted[low] ?? 0;
  const weight = position - low;
  return (sorted[low] ?? 0) * (1 - weight) + (sorted[high] ?? 0) * weight;
}

function median(values) {
  return percentile(values, 0.5);
}

function smoothScores(scores, radius = 2) {
  return scores.map((_, index) => {
    let total = 0;
    let count = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const value = scores[index + offset];
      if (!Number.isFinite(value)) continue;
      total += value;
      count += 1;
    }
    return count ? total / count : 0;
  });
}

function rgbDistance(data, channels, firstIndex, secondIndex) {
  const dr = Math.abs((data[firstIndex] ?? 0) - (data[secondIndex] ?? 0));
  const dg = Math.abs((data[firstIndex + 1] ?? 0) - (data[secondIndex + 1] ?? 0));
  const db = Math.abs((data[firstIndex + 2] ?? 0) - (data[secondIndex + 2] ?? 0));
  return (dr + dg + db) / 3;
}

function bestPeak(scores, start, end) {
  const from = clamp(Math.floor(start), 0, Math.max(0, scores.length - 1));
  const to = clamp(Math.ceil(end), from + 1, scores.length);
  const zone = scores.slice(from, to);
  const zoneMedian = median(zone);
  const zoneP90 = percentile(zone, 0.9);
  let index = from;
  let score = -Infinity;
  for (let cursor = from; cursor < to; cursor += 1) {
    const candidate = scores[cursor] ?? 0;
    if (candidate > score) {
      score = candidate;
      index = cursor;
    }
  }
  const prominence = score - zoneMedian;
  const strong = score >= Math.max(8, zoneMedian + 3);
  const normalizedProminence = clamp(
    prominence / Math.max(8, zoneP90 - zoneMedian + 6),
    0,
    1
  );
  return { index, score, zoneMedian, prominence, normalizedProminence, strong };
}

function normalizeBox(box, width, height) {
  return Object.freeze({
    left: box.left / width,
    top: box.top / height,
    width: box.width / width,
    height: box.height / height,
  });
}

function denormalizeBox(box, width, height) {
  const left = clamp(Math.round(box.left * width), 0, Math.max(0, width - 1));
  const top = clamp(Math.round(box.top * height), 0, Math.max(0, height - 1));
  const right = clamp(
    Math.round((box.left + box.width) * width),
    left + 1,
    width
  );
  const bottom = clamp(
    Math.round((box.top + box.height) * height),
    top + 1,
    height
  );
  return Object.freeze({ left, top, width: right - left, height: bottom - top });
}

export function safeCenterFaceBox(width, height, { handBias = false } = {}) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) {
    throw new Error("safeCenterFaceBox requires positive image dimensions");
  }

  const normalized = handBias
    ? { left: 0.2, top: 0.1, width: 0.6, height: 0.42 }
    : { left: 0.3, top: 0.34, width: 0.4, height: 0.32 };

  return denormalizeBox(normalized, width, height);
}

/**
 * Detect the large rectangular slab that contains the visual center.
 * Long, continuous contrast lines win over local tree branches, equipment,
 * veining, gravel, and other short environmental edges.
 */
export function detectSlabFaceBoxFromRaw(data, info, { handBias = false } = {}) {
  const width = Number(info?.width ?? 0);
  const height = Number(info?.height ?? 0);
  const channels = Number(info?.channels ?? DEFAULT_CHANNELS);

  if (!data || width < 24 || height < 24 || channels < 3) {
    const fallback = safeCenterFaceBox(Math.max(width, 2), Math.max(height, 2), {
      handBias,
    });
    return Object.freeze({
      mode: handBias ? "hand-safe-center" : "center-safe",
      confidence: 0,
      outer: normalizeBox(fallback, Math.max(width, 2), Math.max(height, 2)),
      sample: normalizeBox(fallback, Math.max(width, 2), Math.max(height, 2)),
    });
  }

  if (handBias) {
    const fallback = safeCenterFaceBox(width, height, { handBias: true });
    return Object.freeze({
      mode: "hand-safe-center",
      confidence: 0.45,
      outer: normalizeBox(fallback, width, height),
      sample: normalizeBox(fallback, width, height),
    });
  }

  const edgeOffset = Math.max(1, Math.round(Math.min(width, height) * 0.012));
  const verticalScores = new Array(width).fill(0);
  const horizontalScores = new Array(height).fill(0);

  const yStart = clamp(Math.round(height * 0.08), edgeOffset, height - edgeOffset - 1);
  const yEnd = clamp(Math.round(height * 0.94), yStart + 1, height - edgeOffset);
  const xStart = clamp(Math.round(width * 0.05), edgeOffset, width - edgeOffset - 1);
  const xEnd = clamp(Math.round(width * 0.95), xStart + 1, width - edgeOffset);

  for (let x = edgeOffset; x < width - edgeOffset; x += 1) {
    const values = [];
    for (let y = yStart; y < yEnd; y += 1) {
      const first = (y * width + (x - edgeOffset)) * channels;
      const second = (y * width + (x + edgeOffset)) * channels;
      values.push(rgbDistance(data, channels, first, second));
    }
    verticalScores[x] = percentile(values, 0.56) * 0.65 + percentile(values, 0.8) * 0.35;
  }

  for (let y = edgeOffset; y < height - edgeOffset; y += 1) {
    const values = [];
    for (let x = xStart; x < xEnd; x += 1) {
      const first = ((y - edgeOffset) * width + x) * channels;
      const second = ((y + edgeOffset) * width + x) * channels;
      values.push(rgbDistance(data, channels, first, second));
    }
    horizontalScores[y] =
      percentile(values, 0.56) * 0.65 + percentile(values, 0.8) * 0.35;
  }

  const vertical = smoothScores(verticalScores);
  const horizontal = smoothScores(horizontalScores);
  const left = bestPeak(vertical, width * 0.02, width * 0.46);
  const right = bestPeak(vertical, width * 0.54, width * 0.98);
  const top = bestPeak(horizontal, height * 0.02, height * 0.6);
  const bottom = bestPeak(horizontal, height * 0.4, height * 0.98);

  const outer = {
    left: left.index,
    top: top.index,
    width: right.index - left.index,
    height: bottom.index - top.index,
  };
  const strongCount = [left, right, top, bottom].filter((edge) => edge.strong).length;
  const dimensionsValid =
    outer.width >= width * 0.42 &&
    outer.height >= height * 0.3 &&
    outer.left < width * 0.48 &&
    outer.left + outer.width > width * 0.52 &&
    outer.top < height * 0.62 &&
    outer.top + outer.height > height * 0.52;
  const aspect = outer.width / Math.max(1, outer.height);
  const aspectValid = aspect >= 0.85 && aspect <= 4.2;
  const confidence = clamp(
    ([left, right, top, bottom].reduce(
      (sum, edge) => sum + edge.normalizedProminence,
      0
    ) /
      4) *
      0.7 +
      (strongCount / 4) * 0.3,
    0,
    1
  );

  if (!dimensionsValid || !aspectValid || strongCount < 3 || confidence < 0.42) {
    const fallback = safeCenterFaceBox(width, height);
    return Object.freeze({
      mode: "center-safe",
      confidence: Number(confidence.toFixed(3)),
      outer: normalizeBox(fallback, width, height),
      sample: normalizeBox(fallback, width, height),
    });
  }

  // Inset aggressively. The resulting sample is the slab core, never its border.
  // This is what prevents sky, trees, gravel, racks, clamps and neighboring slabs
  // from becoming shopper-facing stone colors.
  // The lifting clamp and its shadow usually occupy the upper quarter of a
  // correctly detected slab. Stay in the lower-middle face so those pixels do
  // not become shopper-facing color evidence even though they are technically
  // inside the slab boundary.
  const insetX = Math.round(outer.width * 0.22);
  const insetTop = Math.round(outer.height * 0.36);
  const insetBottom = Math.round(outer.height * 0.16);
  const sample = {
    left: outer.left + insetX,
    top: outer.top + insetTop,
    width: outer.width - insetX * 2,
    height: outer.height - insetTop - insetBottom,
  };

  if (sample.width < width * 0.2 || sample.height < height * 0.16) {
    const fallback = safeCenterFaceBox(width, height);
    return Object.freeze({
      mode: "center-safe",
      confidence: Number(confidence.toFixed(3)),
      outer: normalizeBox(outer, width, height),
      sample: normalizeBox(fallback, width, height),
    });
  }

  return Object.freeze({
    mode: "detected-slab-core",
    confidence: Number(confidence.toFixed(3)),
    outer: normalizeBox(outer, width, height),
    sample: normalizeBox(sample, width, height),
  });
}

export function boxFromNormalized(normalized, width, height) {
  return denormalizeBox(normalized, width, height);
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((value) =>
        clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")
      )
      .join("")
  );
}

function rgbToHsl(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const delta = max - min;
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h = 0;
  if (max === rr) h = ((gg - bb) / delta + (gg < bb ? 6 : 0)) / 6;
  else if (max === gg) h = ((bb - rr) / delta + 2) / 6;
  else h = ((rr - gg) / delta + 4) / 6;
  return { h: h * 360, s, l };
}

function srgbToLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(r, g, b) {
  const red = srgbToLinear(r);
  const green = srgbToLinear(g);
  const blue = srgbToLinear(b);
  let x = red * 0.4124564 + green * 0.3575761 + blue * 0.1804375;
  let y = red * 0.2126729 + green * 0.7151522 + blue * 0.072175;
  let z = red * 0.0193339 + green * 0.119192 + blue * 0.9503041;
  x /= 0.95047;
  z /= 1.08883;
  const transform = (value) =>
    value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const fx = transform(x);
  const fy = transform(y);
  const fz = transform(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function labDistance(first, second) {
  return Math.hypot(first.L - second.L, first.a - second.a, first.b - second.b);
}

function labChroma(lab) {
  return Math.hypot(lab.a, lab.b);
}

function isSkinTone(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b);
  const warm = (h >= 5 && h <= 55) || h >= 350;
  return warm && s >= 0.05 && l >= 0.25 && l <= 0.98 && r > g + 4 && r - b >= 18;
}

function bucketColor(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b);
  if (l <= 0.12 || (l <= 0.18 && s < 0.22)) return "black";
  if (l >= 0.88 || (l >= 0.82 && s < 0.32)) return "white";
  if (s < 0.1) {
    if (l >= 0.68) return "white";
    if (l <= 0.26) return "black";
    return "gray";
  }
  if (l >= 0.76 && s < 0.34 && h >= 15 && h <= 70) return "beige";
  if (h < 15 || h >= 345) return l < 0.35 ? "brown" : "rose";
  if (h < 40) return l < 0.28 ? "brown" : s >= 0.12 ? "gold" : "beige";
  if (h < 70) return l > 0.7 ? "beige" : l < 0.32 ? "brown" : "gold";
  if (h < 165) return "green";
  if (h < 250) return "blue";
  if (h < 290) return l > 0.55 ? "silver" : "blue";
  return "rose";
}

function clustersFromRaw(data, info, { handBias = false } = {}) {
  const channels = Number(info?.channels ?? DEFAULT_CHANNELS);
  const width = Number(info?.width ?? 0);
  const height = Number(info?.height ?? 0);
  const bins = new Map();
  let total = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * channels;
      if (channels >= 4 && (data[index + 3] ?? 255) < 200) continue;
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      if (handBias && isSkinTone(r, g, b)) continue;
      const lab = rgbToLab(r, g, b);
      const key = [
        Math.round(lab.L / LAB_BIN) * LAB_BIN,
        Math.round(lab.a / LAB_BIN) * LAB_BIN,
        Math.round(lab.b / LAB_BIN) * LAB_BIN,
      ].join(",");
      const existing = bins.get(key);
      if (existing) {
        existing.count += 1;
        existing.r += r;
        existing.g += g;
        existing.b += b;
        existing.L += lab.L;
        existing.a += lab.a;
        existing.labB += lab.b;
      } else {
        bins.set(key, {
          count: 1,
          r,
          g,
          b,
          L: lab.L,
          a: lab.a,
          labB: lab.b,
        });
      }
      total += 1;
    }
  }

  if (!total) return [];
  return [...bins.values()]
    .map((bin) => ({
      count: bin.count,
      share: bin.count / total,
      r: bin.r / bin.count,
      g: bin.g / bin.count,
      b: bin.b / bin.count,
      lab: {
        L: bin.L / bin.count,
        a: bin.a / bin.count,
        b: bin.labB / bin.count,
      },
    }))
    .filter((cluster) => cluster.share >= MIN_CLUSTER_SHARE)
    .sort((first, second) => second.share - first.share);
}

function addDistinct(target, candidate, minDelta = MIN_DELTA_E) {
  if (!candidate || target.length >= MAX_SWATCHES) return;
  if (target.some((existing) => labDistance(existing.lab, candidate.lab) < minDelta)) return;
  target.push(candidate);
}

/** Palette derived only from pixels already cropped to the verified slab core. */
export function extractPaletteFromRaw(data, info, options = {}) {
  const clusters = clustersFromRaw(data, info, options);
  if (!clusters.length) return Object.freeze({ swatches: [], buckets: [] });

  const picks = [];
  for (const cluster of clusters.slice(0, 20)) {
    addDistinct(picks, cluster);
    if (picks.length >= 2) break;
  }

  const lightest = [...clusters].sort((a, b) => b.lab.L - a.lab.L)[0];
  const darkest = [...clusters].sort((a, b) => a.lab.L - b.lab.L)[0];
  const mostChromatic = [...clusters].sort(
    (a, b) => labChroma(b.lab) * Math.sqrt(b.share) - labChroma(a.lab) * Math.sqrt(a.share)
  )[0];
  addDistinct(picks, lightest);
  addDistinct(picks, darkest);
  addDistinct(picks, mostChromatic);

  for (const cluster of clusters) {
    if (picks.length >= MAX_SWATCHES) break;
    addDistinct(picks, cluster);
  }
  for (const cluster of clusters) {
    if (picks.length >= MIN_SWATCHES) break;
    addDistinct(picks, cluster, 7);
  }

  picks.sort((a, b) => b.share - a.share);
  const swatches = picks.slice(0, MAX_SWATCHES).map((cluster) => ({
    hex: rgbToHex(cluster.r, cluster.g, cluster.b),
    bucket: bucketColor(cluster.r, cluster.g, cluster.b),
  }));
  const buckets = [];
  for (const swatch of swatches) {
    if (!buckets.includes(swatch.bucket)) buckets.push(swatch.bucket);
  }
  return Object.freeze({
    swatches: Object.freeze(swatches),
    buckets: Object.freeze(buckets),
  });
}
