/**
 * Tighten shopper-facing JW Stone color buckets after slab-only pixel sampling.
 *
 * The slab crop is already authoritative. This layer prevents cool white/gray
 * neutrals from becoming "blue" and keeps weak one-off shades from creating a
 * material filter claim. Strong real stone colors remain eligible.
 */
const RANK_WEIGHTS = Object.freeze([0.52, 0.25, 0.13, 0.07, 0.03]);
const MIN_SECONDARY_EVIDENCE = 0.18;
const MIN_STRONG_COLOR_EVIDENCE = 0.07;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHsl(r, g, b) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lightness };
  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;
  if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
  else if (max === green) hue = ((blue - red) / delta + 2) / 6;
  else hue = ((red - green) / delta + 4) / 6;
  return { h: hue * 360, s: saturation, l: lightness };
}

export function classifyStoneSwatch(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "gray";
  const { r, g, b } = rgb;
  const { h, s, l } = rgbToHsl(r, g, b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const span = max - min;
  const greenBias = g >= r + 8 && g >= b + 4;
  const blueBias = b >= r + 20 && b >= g + 10;

  if (l <= 0.12 || (l <= 0.19 && s < 0.24)) return "black";
  if (l >= 0.9 || (l >= 0.82 && s < 0.26)) return "white";

  if (greenBias && h >= 70 && h <= 165 && l > 0.16 && l < 0.82) {
    if (s >= 0.055 || g - Math.max(r, b) >= 10) return "green";
  }

  // Blue-gray whites and silvers are neutral. A blue claim requires visible
  // channel separation and chroma, not merely a cool color temperature.
  if (h >= 165 && h < 250) {
    if (l >= 0.55 && (s < 0.32 || span < 46)) return l >= 0.78 ? "white" : "gray";
    if (blueBias && s >= 0.18 && l > 0.14 && l < 0.82) return "blue";
    return l >= 0.7 ? "white" : l <= 0.25 ? "black" : "gray";
  }

  if (s < 0.16 || span < 20) {
    if (l >= 0.72) return "white";
    if (l <= 0.26) return "black";
    if (h >= 20 && h <= 65 && l >= 0.52) return "beige";
    return "gray";
  }

  if (l >= 0.78 && s < 0.36 && h >= 15 && h <= 70) return "beige";
  if (h < 15 || h >= 345) return l < 0.35 ? "brown" : "rose";
  if (h < 40) return l < 0.28 ? "brown" : s >= 0.18 ? "gold" : "beige";
  if (h < 70) return l > 0.82 ? "beige" : l < 0.32 ? "brown" : "gold";
  if (h < 165) return greenBias ? "green" : l >= 0.62 ? "beige" : "gray";
  if (h < 290) return l > 0.55 ? "gray" : "blue";
  return "rose";
}

function strongChromaticEvidence(hex, bucket) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const { r, g, b } = rgb;
  const { s } = rgbToHsl(r, g, b);
  const span = Math.max(r, g, b) - Math.min(r, g, b);
  if (bucket === "blue") return b >= r + 20 && b >= g + 10 && s >= 0.18;
  if (bucket === "green") return g >= r + 8 && g >= b + 4 && s >= 0.055;
  return s >= 0.3 && span >= 42;
}

export function tightenStonePalette(palette) {
  const sourceSwatches = Array.isArray(palette?.swatches) ? palette.swatches : [];
  if (!sourceSwatches.length) {
    return Object.freeze({
      ...(palette || {}),
      swatches: Object.freeze([]),
      buckets: Object.freeze([]),
      bucketShares: Object.freeze({}),
    });
  }

  const swatches = sourceSwatches.map((swatch) =>
    Object.freeze({ ...swatch, bucket: classifyStoneSwatch(swatch.hex) })
  );
  const evidence = new Map();
  const strong = new Set();

  swatches.forEach((swatch, index) => {
    const weight = RANK_WEIGHTS[index] ?? 0;
    evidence.set(swatch.bucket, (evidence.get(swatch.bucket) || 0) + weight);
    if (strongChromaticEvidence(swatch.hex, swatch.bucket)) strong.add(swatch.bucket);
  });

  const ordered = [...evidence.entries()].sort(
    (first, second) => second[1] - first[1] || first[0].localeCompare(second[0])
  );
  const dominant = ordered[0]?.[0] || swatches[0].bucket;
  const buckets = ordered
    .filter(
      ([bucket, weight]) =>
        bucket === dominant ||
        weight >= MIN_SECONDARY_EVIDENCE ||
        (strong.has(bucket) && weight >= MIN_STRONG_COLOR_EVIDENCE)
    )
    .map(([bucket]) => bucket);
  const bucketShares = Object.fromEntries(
    ordered.map(([bucket, weight]) => [bucket, Number(clamp(weight, 0, 1).toFixed(4))])
  );

  return Object.freeze({
    ...(palette || {}),
    swatches: Object.freeze(swatches),
    buckets: Object.freeze(buckets),
    bucketShares: Object.freeze(bucketShares),
  });
}
