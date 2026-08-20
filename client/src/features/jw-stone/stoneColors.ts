/**
 * Literal Color filter vocabulary + photo-derived palettes.
 *
 * Swatches and filter buckets come from cover-image sampling
 * (see scripts/extract-jw-stone-dominant-colors.mjs). Stone names/slugs
 * are never used as color truth.
 *
 * "Pairs with" swatches are derived with simple color theory from the
 * photographed hues — not sampled from the photo.
 */
import dominantColors from "@/data/jwStoneDominantColors.generated.json";

export const STONE_COLOR_VOCABULARY = [
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
  { id: "gray", label: "Gray" },
  { id: "beige", label: "Beige" },
  { id: "brown", label: "Brown" },
  { id: "green", label: "Green" },
  { id: "blue", label: "Blue" },
  { id: "gold", label: "Gold" },
  { id: "silver", label: "Silver" },
  { id: "rose", label: "Rose" },
  { id: "yellow", label: "Yellow" },
] as const;

export type StoneColorId = (typeof STONE_COLOR_VOCABULARY)[number]["id"];

export type StoneColorSwatch = Readonly<{
  hex: string;
  bucket: StoneColorId;
}>;

type DominantColorStone = {
  cover: string | null;
  swatches: ReadonlyArray<{ hex: string; bucket: string }>;
  buckets: readonly string[];
};

type DominantColorFile = {
  stones: Record<string, DominantColorStone>;
};

const COLOR_IDS = new Set<string>(STONE_COLOR_VOCABULARY.map((entry) => entry.id));
const PALETTE_BY_ID = (dominantColors as DominantColorFile).stones;
const MAX_STONE_SWATCHES = 5;
const MAX_PAIRING_SWATCHES = 4;

/**
 * Face-true color bucket overrides when cover sampling still picks up yard /
 * floor / sky / clamp chrome instead of the stone face. When set, these buckets
 * fully replace photographed filter buckets (surround chrome must not linger).
 * Never invent hex swatches here.
 */
export const JW_STONE_FACE_TRUE_COLOR_OVERRIDES: Readonly<Record<string, readonly StoneColorId[]>> =
  Object.freeze({
    "mexican-brown": Object.freeze(["brown", "gray"] as const),
    "chocolate-brown": Object.freeze(["brown", "black"] as const),
    dueto: Object.freeze(["brown", "black"] as const),
    "pinta-verde": Object.freeze(["green", "white"] as const),
    "blue-bahia": Object.freeze(["blue", "gray"] as const),
    "emerald-pearl": Object.freeze(["green", "black"] as const),
    // Dark faces misread as light gray/white or blue from outdoor glare.
    "preto-sao-gabriel": Object.freeze(["black", "gray"] as const),
    "venta-black": Object.freeze(["black", "blue"] as const),
    // Emperor Brown's photographed face is brown; clamp/sky sampling returned gold/white.
    "emperor-brown": Object.freeze(["brown", "beige"] as const),
    "fusion-yellow": Object.freeze(["yellow", "gold", "black"] as const),
    // Soft white faces misread as blue from yard/sky wash or hand-close chrome.
    "alabama-white": Object.freeze(["white", "gray"] as const),
    "dallas-white": Object.freeze(["white", "gray"] as const),
    "namib-fantasy": Object.freeze(["white", "gray"] as const),
  });

export function isStoneColorId(value: unknown): value is StoneColorId {
  return typeof value === "string" && COLOR_IDS.has(value);
}

export function getStoneColorLabel(id: string): string | null {
  return STONE_COLOR_VOCABULARY.find((entry) => entry.id === id)?.label ?? null;
}

function asSwatches(raw: DominantColorStone | undefined): readonly StoneColorSwatch[] {
  if (!raw?.swatches?.length) return Object.freeze([]);
  const swatches: StoneColorSwatch[] = [];
  for (const entry of raw.swatches.slice(0, MAX_STONE_SWATCHES)) {
    if (!entry?.hex || !isStoneColorId(entry.bucket)) continue;
    swatches.push(Object.freeze({ hex: entry.hex, bucket: entry.bucket }));
  }
  return Object.freeze(swatches);
}

/** Top visual swatches from the stone's cover photograph (precomputed, 3–5). */
export function getSwatchesForStone(stoneId: string): readonly StoneColorSwatch[] {
  return asSwatches(PALETTE_BY_ID[stoneId]);
}

/**
 * Filter buckets derived from the photographed palette.
 * Empty only when the stone has no sampled cover data.
 * Face-true overrides fully replace photographed buckets when surround chrome
 * washed the face hue (so a wrong "blue" cannot linger beside "white").
 */
export function getColorsForStone(stoneId: string): readonly StoneColorId[] {
  const override = JW_STONE_FACE_TRUE_COLOR_OVERRIDES[stoneId];
  if (override?.length) return Object.freeze([...override]);

  const raw = PALETTE_BY_ID[stoneId];
  if (!raw) return Object.freeze([]);
  const fromBuckets = (raw.buckets ?? []).filter(isStoneColorId);
  if (fromBuckets.length) return Object.freeze(fromBuckets);
  return Object.freeze(
    asSwatches(raw)
      .map((swatch) => swatch.bucket)
      .filter((bucket, index, list) => list.indexOf(bucket) === index)
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = match[1]!;
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((channel) =>
        Math.max(0, Math.min(255, Math.round(channel)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case rr:
      h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
      break;
    case gg:
      h = ((bb - rr) / d + 2) / 6;
      break;
    default:
      h = ((rr - gg) / d + 4) / 6;
      break;
  }
  return { h: h * 360, s, l };
}

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp01(s);
  const ll = clamp01(l);
  if (ss === 0) {
    const gray = ll * 255;
    return { r: gray, g: gray, b: gray };
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const hk = hh / 360;
  return {
    r: hueToRgb(p, q, hk + 1 / 3) * 255,
    g: hueToRgb(p, q, hk) * 255,
    b: hueToRgb(p, q, hk - 1 / 3) * 255,
  };
}

function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

function hexDistance(a: string, b: string): number {
  const aa = hexToRgb(a);
  const bb = hexToRgb(b);
  if (!aa || !bb) return 999;
  const dr = aa.r - bb.r;
  const dg = aa.g - bb.g;
  const db = aa.b - bb.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function pushUnique(list: string[], hex: string, minDistance = 28): void {
  if (list.length >= MAX_PAIRING_SWATCHES) return;
  if (list.some((existing) => hexDistance(existing, hex) < minDistance)) return;
  list.push(hex);
}

function stoneLightness(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHsl(rgb.r, rgb.g, rgb.b).l;
}

/** Near-black / charcoal stone faces — pair with warm neutrals, not theory pastels. */
function isDarkNearBlackPalette(stoneHexes: readonly string[]): boolean {
  const lights = stoneHexes.map(stoneLightness).filter((value): value is number => value != null);
  if (!lights.length) return false;
  const sorted = [...lights].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianL = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const darkShare = lights.filter((l) => l <= 0.42).length / lights.length;
  return medianL <= 0.35 || darkShare >= 0.67;
}

/**
 * Soft "Pairs with" colors derived only from cleaned stone swatches.
 * Dark/near-black stones stay on warm neutrals / soft white / muted metal —
 * never pastel teal/lavender from complementary theory on bad hues.
 */
export function derivePairingSwatches(stoneHexes: readonly string[]): readonly string[] {
  const pairings: string[] = [];

  if (isDarkNearBlackPalette(stoneHexes)) {
    pushUnique(pairings, hslToHex(40, 0.12, 0.92)); // soft white
    pushUnique(pairings, hslToHex(36, 0.22, 0.78)); // warm cream
    pushUnique(pairings, hslToHex(30, 0.14, 0.58)); // warm taupe
    pushUnique(pairings, hslToHex(210, 0.06, 0.52)); // muted metal
    return Object.freeze(pairings.slice(0, MAX_PAIRING_SWATCHES));
  }

  for (const hex of stoneHexes.slice(0, 3)) {
    const rgb = hexToRgb(hex);
    if (!rgb) continue;
    const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

    if (s < 0.1) {
      // Neutrals: cool stones pair warm; warm stones pair soft cool.
      const warmUndertone = h >= 20 && h <= 70;
      if (l <= 0.28) {
        pushUnique(pairings, hslToHex(38, 0.22, 0.72)); // soft warm cream
        pushUnique(pairings, hslToHex(210, 0.08, 0.48)); // muted metal
      } else if (l >= 0.7) {
        pushUnique(pairings, hslToHex(210, 0.1, 0.36)); // deep cool metal
        pushUnique(pairings, hslToHex(28, 0.28, 0.48)); // warm taupe
      } else if (warmUndertone) {
        pushUnique(pairings, hslToHex(205, 0.12, 0.46)); // muted cool metal
      } else {
        pushUnique(pairings, hslToHex(32, 0.32, 0.55)); // warm sand
      }
      continue;
    }

    // Complementary (hue + 180°), nudged toward a usable mid lightness.
    // Cap saturation so yard-garbage complements never become pastel teal/lavender.
    const complementL = clamp01(l < 0.35 ? l + 0.18 : l > 0.7 ? l - 0.16 : l);
    const complementS = clamp01(Math.max(0.14, Math.min(0.38, s * 0.55 + 0.06)));
    pushUnique(pairings, hslToHex(h + 180, complementS, complementL));

    // Soft split-complement for the lead chromatic hue only.
    if (pairings.length < 3) {
      pushUnique(
        pairings,
        hslToHex(h + 150, clamp01(complementS * 0.85), clamp01(complementL + 0.04))
      );
    }
  }

  // Analogous soft neighbor from the primary chromatic stone hue.
  const lead = stoneHexes[0] ? hexToRgb(stoneHexes[0]) : null;
  if (lead && pairings.length < MAX_PAIRING_SWATCHES) {
    const { h, s, l } = rgbToHsl(lead.r, lead.g, lead.b);
    if (s >= 0.1) {
      pushUnique(
        pairings,
        hslToHex(h + 28, clamp01(s * 0.45), clamp01(l > 0.55 ? l - 0.08 : l + 0.1))
      );
    }
  }

  return Object.freeze(pairings.slice(0, MAX_PAIRING_SWATCHES));
}

/** Soft pairing swatches derived from the stone's photographed palette. */
export function getPairingSwatchesForStone(stoneId: string): readonly string[] {
  const hexes = getSwatchesForStone(stoneId).map((swatch) => swatch.hex);
  return derivePairingSwatches(hexes);
}
