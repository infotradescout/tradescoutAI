/**
 * Precompute adaptive 3–5 dominant colors from each stone's cover (full-slab-first) photo.
 * Output: client/src/data/jwStoneDominantColors.generated.json
 *
 * Usage: node scripts/extract-jw-stone-dominant-colors.mjs
 *
 * Sampling strategy:
 * - Same cover ranking as client coverImages.ts (full-slab preferred, hand demoted)
 * - Among near-tied covers, prefer richer slab-face chroma (veins / flash)
 * - Extract a slab-face region from the original, then resize (preserve thin veins)
 * - Hand covers bias to the upper face (hands usually bottom) + skin reject
 * - Mask center slab face; drop clamp/crane yellow, sky, foliage-edge, ground, glare
 * - Body LAB histogram + outlier/accent pass; adaptive 3–5 distinct swatches
 * - Filter buckets from photographed swatches only (never stone names)
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const repoRoot = path.resolve(import.meta.dirname, "..");
const inventoryPath = path.join(repoRoot, "client/src/data/jwStoneInventory.generated.json");
const reconciliationPath = path.join(
  repoRoot,
  "client/src/data/jwStoneInventoryReconciliation.json"
);
const sourceNamesPath = path.join(repoRoot, "client/src/data/jwStoneSourceNames.generated.json");
const outPath = path.join(repoRoot, "client/src/data/jwStoneDominantColors.generated.json");
const publicRoot = path.join(repoRoot, "client/public");

/** Keep in sync with client/src/features/jw-stone/coverImages.ts */
const PREFERRED_COVER_FILE_IDS = {
  "aj-quartz-1": "1GhcyanNTSKcFuVXN3pAggbI-XYAmjx2u",
  "aj-quartz-4": "1V6D5-zXjoklqYg6au4tnAzUiGXeBW7Wc",
  "aj-quartz-5": "1pgK_FzwRM6E5K-1zz6xBrBS2KSBiTEuH",
  "bianco-carrara": "1BoLQprq014WBrpdxTyYU5LErye7D5O0U",
  "carrara-white-brazil-119x75": "13WKoBmd2quSG2-YTG9EpPHFkAHDDoAN1",
  "calacatta-cremo": "12ULnXkUBeSW7ViTBbAA8Wx5rFaPK2T_J",
  "calacatta-macchia": "1vDIoTtWdOceQ1IzY9u2vAl_knKGWJjxu",
  "matarazzo-zucchi": "1pVej6DwGpib3soV3YgLDv-v_X8XEIB4h",
  "marina-black-soapstone": "1tlOUM3_xMx98ZjC3jlpDsWRu7-3Xb-d9",
  "fusion-blue": "1opCWnnzl2Eba_qdW54RvF7B4jn-XD4PB",
  "perla-venata": "1ziFDFgSGEpCpx4dpI-YzlAGXuk69W3rk",
  superiore: "1M-2UdrtDBUyNDhZswqST_VjV5RvN9Zbo",
  "galaxy-white": "1g58rJny4wbYKb-V8z1rug_hCUEcb7DeO",
  "emperor-brown": "1UkwxC3a6LWlHkaUPZLKppFJT18s9f6oQ",
  "super-white": "1R9wC8J72zpDBdL31Zf4aMISigDudPaQy",
  "juparana-blue": "1D9v9nEKAm5BCDuSlzYpdn9PwOi0nkjKs",
  "beverly-blue": "1BHaSAxN9B8CbNN9gaKiK2F_HJ-GAyRVy",
  "bianco-superiory": "1-1U8FEyCh3N2_DOxRhNKT_lUW72Jh_RQ",
  "calacatta-amala": "1-8YRVJ9x4_lEyoLWh7RpAY0oFPbJHcFa",
  "fusion-brown": "1-uLJ9IFKldBW-UFnESx2UJ4WdOuAACUv",
  picasso: "17_4UcZBVch7I4OLgVFXx0Zc52KXBUDNu",
  bronzonite: "1_mX4CB3IZ9E9OgMkVyqU90bDQx61vFvJ",
  "shadow-storm": "1yuISE53-4yMFdH_4ElUlxi1y7QHmaCa8",
  "aspen-white": "1PGDSTn70sheqEx3u39VgzuJNodBJW0xe",
  // Face-true white — prior BLOCK#22129 lead was yard/sky blue-washed.
  "alabama-white": "1pRla8GWSa3dSbWTtgTsrytcJMb8D0Qso",
};

/** Keep in sync with client/src/features/jw-stone/coverImages.ts */
const HAND_COVER_FILE_IDS = new Set([
  "1UDe57h8Vq_IpmDKm9JvV-1jEdrc7TMKW",
  "1fqDCQbCGOI4ieLt5899s8XYZv3OlhJp6",
  "18gmBQeXMlJVXkyVR8CYZcr7S19YLnIvM",
  "1M2IO3m_dOI-OMPWbTE8Y4JgtLZaAVYnD",
  "11ax9DfAdp_SjHdkX2sTHMGu-NVFEGwru",
  "1o_wQm5dke5f0mnIXjslDs4Ai0XE6ttXA",
  "1_SEkFjSzvYBgRoP1PR0_YMJEkv5T9t6z",
  "1BrnNoAJ7X3z5lXuKwKZCPX17Y7G7rg-p",
  "1lfVGyu3oVXcdaAb6amxkgSJBB_w1Rh36",
  "1Sj9EjHRqjwVqTqi5bFZTrjdwMRhIm7ul",
  "1ApF2R6Pbn8aWYpXNHD7VNlJwsFlBsIP4",
  "1Xa7SrSqU8QkEQ2loN5e0MJAiBwqh5d7d",
  "112yUwIti-kOjZj7MZD9O_IRRRMO65hUT",
  "15V13zBDRJlRIWJPRHNwyEEhBj5YFRo7m",
  "1n3tCkEbpG8cwAZqp3rsULP5Npm0fYptH",
  "1aiC_duaWb8dY1HHKkGeK9UjbUMRqnPY0",
]);

const SAMPLE = 512;
const MIN_N = 3;
const MAX_N = 5;
const LAB_BIN = 6;
const PICK_DELTA_E = 14;
const MIN_BODY_SHARE = 0.018;
const MIN_ACCENT_SHARE = 0.005;

const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const reconciliation = JSON.parse(fs.readFileSync(reconciliationPath, "utf8"));
const sourceNames = JSON.parse(fs.readFileSync(sourceNamesPath, "utf8"));

/**
 * Expand generated inventory with reconciliation additions (named merges,
 * named additions, anonymous bundles) so every marketplace stone gets a palette.
 * Mirrors client/src/data/reconcileJwStoneInventory.ts at a data level.
 */
function buildMarketplaceStones() {
  const synthetic = /^trending-selection-\d+$/;
  const reconciled = inventory
    .filter((record) => !synthetic.test(record.slug))
    .map((record) => ({
      ...record,
      images: [...record.images],
      sourceFileIds: [...record.sourceFileIds],
    }));

  const unidentified = new Map();
  for (const batch of inventory.filter((record) => synthetic.test(record.slug))) {
    batch.sourceFileIds.forEach((sourceFileId, index) => {
      unidentified.set(sourceFileId, { image: batch.images[index] });
    });
  }

  const consumed = new Set();
  const take = (sourceFileIds) =>
    sourceFileIds.map((sourceFileId) => {
      const asset = unidentified.get(sourceFileId);
      if (!asset) throw new Error(`Unknown photo in reconciliation: ${sourceFileId}`);
      if (consumed.has(sourceFileId)) {
        throw new Error(`Photo assigned twice: ${sourceFileId}`);
      }
      consumed.add(sourceFileId);
      return { sourceFileId, image: asset.image };
    });

  for (const merge of reconciliation.namedMerges || []) {
    const target = reconciled.find((record) => record.slug === merge.targetSlug);
    if (!target) throw new Error(`Missing merge target: ${merge.targetSlug}`);
    const assets = take(merge.sourceFileIds);
    target.images.push(...assets.map((a) => a.image));
    target.sourceFileIds.push(...assets.map((a) => a.sourceFileId));
  }

  for (const addition of reconciliation.namedAdditions || []) {
    const assets = take(addition.sourceFileIds);
    reconciled.push({
      categorySlug: addition.categorySlug,
      name: addition.name,
      slug: addition.slug,
      images: assets.map((a) => a.image),
      sourceFileIds: assets.map((a) => a.sourceFileId),
      slabCounts: addition.slabCounts,
      finishes: addition.finishes,
    });
  }

  for (const bundle of reconciliation.anonymousBundles || []) {
    const assets = take(bundle.sourceFileIds);
    reconciled.push({
      categorySlug: "unconfirmed",
      name: bundle.slug,
      slug: bundle.slug,
      images: assets.map((a) => a.image),
      sourceFileIds: assets.map((a) => a.sourceFileId),
      slabCounts: bundle.slabCounts,
      finishes: bundle.finishes,
    });
  }

  return reconciled;
}

function driveFileIdFromImagePath(imagePath) {
  const base = imagePath.split("/").pop() || "";
  return base.replace(/\.[^.]+$/, "");
}

function normalizeName(sourceName = "") {
  return sourceName.toLowerCase().replace(/[_-]+/g, " ");
}

function isPhoneDumpSourceName(sourceName = "") {
  const compact = normalizeName(sourceName).replace(/\s+/g, "");
  return (
    /^(img_?\d+|dsc_?\d+|photo\d+|pxl_?\d+|heic)/i.test(compact) || /\.heic$/i.test(sourceName)
  );
}

function isCloseUpSourceName(sourceName = "") {
  const name = normalizeName(sourceName);
  return /(close\s*up|closeup|close\s*look|\bclose\b|\bdetail\b|\btexture\b|\bswatch\b|scloseup|\bsample\b|\bthumb\b|\bhand\b|\bhands\b|\bholding\b)/.test(
    name
  );
}

function isFullSlabSourceName(sourceName = "") {
  const name = normalizeName(sourceName);
  if (isCloseUpSourceName(name) || isPhoneDumpSourceName(sourceName)) return false;
  return (
    /\b(slabs?|bundle|bundles|warehouse|yard|rack|standing|full\s*size|full\s*slab)\b/.test(name) ||
    /\d+\s*[x×"']\s*\d+/.test(name)
  );
}

function isHandScaleCoverImage(imagePath) {
  const fileId = driveFileIdFromImagePath(imagePath);
  const name = sourceNames[fileId] || "";
  return HAND_COVER_FILE_IDS.has(fileId) || isCloseUpSourceName(name);
}

function slabCount(sourceName = "") {
  const match = normalizeName(sourceName).match(/(\d+)\s*slabs?\b/);
  return match ? Number(match[1]) : 0;
}

function hasDimensions(sourceName = "") {
  return /\d+\s*[x×"']\s*\d+/.test(normalizeName(sourceName));
}

function scoreImageForCover(imagePath, preferredFileId = "") {
  const fileId = driveFileIdFromImagePath(imagePath);
  const rawName = sourceNames[fileId] || "";
  const name = normalizeName(rawName);
  let value = 0;

  const preferredIsUsable =
    Boolean(preferredFileId) &&
    !HAND_COVER_FILE_IDS.has(preferredFileId) &&
    !isCloseUpSourceName(sourceNames[preferredFileId] || "") &&
    !isPhoneDumpSourceName(sourceNames[preferredFileId] || "");

  if (preferredIsUsable && fileId === preferredFileId) value += 500;
  if (HAND_COVER_FILE_IDS.has(fileId)) value -= 250;
  if (isPhoneDumpSourceName(rawName)) value -= 180;
  if (isCloseUpSourceName(name)) value -= 100;
  if (isFullSlabSourceName(rawName)) value += 50;
  if (/\b(warehouse|yard|rack|standing|full\s*size|full\s*slab)\b/.test(name)) value += 25;
  if (hasDimensions(name) && !isCloseUpSourceName(name) && !isPhoneDumpSourceName(rawName)) {
    value += 20;
  }
  if (/\bslabs?\b/.test(name) && !isCloseUpSourceName(name) && !isPhoneDumpSourceName(rawName)) {
    value += 15;
  }
  value += Math.min(slabCount(name), 8);
  return value;
}

function rankCoverCandidates(images, stoneSlug) {
  if (!images?.length) return [];
  const preferred = PREFERRED_COVER_FILE_IDS[stoneSlug] || "";
  return images
    .map((imagePath, index) => ({
      imagePath,
      index,
      score: scoreImageForCover(imagePath, preferred),
      hand: isHandScaleCoverImage(imagePath),
    }))
    .sort((a, b) => {
      if (a.hand !== b.hand) return a.hand ? 1 : -1;
      return b.score - a.score || a.index - b.index;
    });
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    default:
      h = ((r - g) / d + 4) / 6;
      break;
  }
  return { h: h * 360, s, l };
}

function srgbToLinear(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(r, g, b) {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  let x = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  let y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  let z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;
  x /= 0.95047;
  y /= 1;
  z /= 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function labDistance(p, q) {
  const dL = p.L - q.L;
  const da = p.a - q.a;
  const db = p.b - q.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

function chromaLab(lab) {
  return Math.sqrt(lab.a * lab.a + lab.b * lab.b);
}

/**
 * Map a sampled RGB into a customer filter bucket.
 * Buckets are visual (from the photo), never from the stone name.
 */
function bucketColor(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b);

  // Near-black body reads Black even when one channel dominates (shadow / clamp shade).
  // Keep chromatic dark blue/green flash (Steel Gray, etc.) out of this shortcut.
  if (l <= 0.12) return "black";
  if (l <= 0.18 && s < 0.22) return "black";

  // Near-white cream / blush veins read as White for customers.
  // (HSL saturation can read high on pale pinks — prefer lightness.)
  if (l >= 0.88) return "white";
  if (l >= 0.82 && s < 0.45 && (h < 40 || h > 340 || (h >= 15 && h <= 70))) return "white";

  const greenBias = g > r + 5 && g > b + 3;
  if (greenBias && h >= 70 && h <= 165 && l > 0.18 && l < 0.78) {
    if (s >= 0.05 || g - Math.max(r, b) >= 6) return "green";
  }

  if (s < 0.11) {
    if (l >= 0.68) return "white";
    if (l <= 0.26) return "black";
    return "gray";
  }

  if (l >= 0.76 && s < 0.42 && h >= 15 && h <= 70) return "white";

  if (s < 0.28 && h >= 20 && h <= 55) {
    if (l >= 0.62) return "beige";
    if (l >= 0.28 && l < 0.42 && s < 0.16) return "brown";
  }
  if (s < 0.2 && l >= 0.66) return "white";
  if (s < 0.16 && l <= 0.26) return "black";

  if (h < 15 || h >= 345) {
    if (s < 0.18) return l >= 0.62 ? "beige" : l <= 0.28 ? "black" : "gray";
    if (l > 0.55 && s < 0.45) return "rose";
    return l < 0.35 ? "brown" : "rose";
  }
  if (h < 40) {
    if (l < 0.2) return "black";
    if (s >= 0.12 && l >= 0.3 && l < 0.82) return "gold";
    if (l < 0.3 && s < 0.4) return l < 0.22 ? "black" : "brown";
    return l > 0.55 ? "beige" : "brown";
  }
  if (h < 70) {
    if (s >= 0.12 && l > 0.28 && l < 0.82) return "gold";
    if (l > 0.7) return "beige";
    return l < 0.4 ? "brown" : "yellow";
  }
  if (h < 165) return "green";
  if (h < 250) return "blue";
  if (h < 290) return l > 0.55 ? "silver" : "blue";
  if (h < 330) return "rose";
  return "rose";
}

function isSkinTone(r, g, b, h, s, l) {
  const warmHue = (h >= 5 && h <= 55) || h >= 350;
  if (!warmHue) return false;
  if (!(r > g + 4 && g >= b - 4 && r - b >= 18)) return false;
  // Pale hand highlights often report s≈1 in HSL — do not upper-bound s.
  if (s < 0.04) return false;
  if (l < 0.26 || l > 0.98) return false;
  return r > 130 || (r > 100 && s > 0.12);
}

function looksLikeSkinCluster(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b);
  if (isSkinTone(r, g, b, h, s, l)) return true;
  // Residual hand / nail highlights that sit just outside the strict skin window.
  const warmHue = (h >= 10 && h <= 55) || h >= 350;
  return (
    warmHue &&
    l >= 0.55 &&
    l <= 0.98 &&
    r > g + 6 &&
    g >= b - 2 &&
    r - b >= 20 &&
    r > 160 &&
    (s >= 0.12 || r > 230)
  );
}

function isClampOrange(h, s, l) {
  return h >= 8 && h <= 42 && s > 0.48 && l > 0.22 && l < 0.72;
}

/** Crane / hoist / clamp high-chroma yellow — not stone gold veins. */
function isIndustrialYellow(h, s, l) {
  if (isClampOrange(h, s, l)) return true;
  if (h < 25 || h > 68) return false;
  // Bright equipment yellow (incl. pale cream-yellow highlights).
  if (s > 0.55 && l > 0.35) return true;
  if (s > 0.4 && l > 0.78) return true;
  return false;
}

function isSkyBlue(h, s, l) {
  // Yard sky + polished-face sky reflections — keep dark blue quartz flash (low L).
  return h >= 180 && h <= 235 && s > 0.22 && l > 0.42;
}

function isFoliageGreen(h, s, l, edge) {
  return edge && h >= 75 && h <= 155 && s > 0.28 && l < 0.5;
}

/** Ground gravel / neighboring cream slabs — not dark-stone body. */
function isYardGroundWarm(h, s, l, { isDarkStone }) {
  if (!isDarkStone) return false;
  if (l < 0.55 || s < 0.12) return false;
  return (h >= 20 && h <= 75) || h >= 350 || h < 15;
}

function isYardGarbageHue(h, s, l, { isDarkStone = false, edge = false } = {}) {
  if (isIndustrialYellow(h, s, l)) return true;
  if (isSkyBlue(h, s, l)) return true;
  if (isFoliageGreen(h, s, l, edge)) return true;
  if (isYardGroundWarm(h, s, l, { isDarkStone })) return true;
  return false;
}

function median(values) {
  if (!values.length) return 0.5;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function labHistogramClusters(pixels) {
  if (!pixels.length) return [];
  const bins = new Map();
  for (const p of pixels) {
    const key = [
      Math.round(p.lab.L / LAB_BIN) * LAB_BIN,
      Math.round(p.lab.a / LAB_BIN) * LAB_BIN,
      Math.round(p.lab.b / LAB_BIN) * LAB_BIN,
    ].join(",");
    const prev = bins.get(key);
    if (prev) {
      prev.count += 1;
      prev.rSum += p.r;
      prev.gSum += p.g;
      prev.bSum += p.b;
      prev.lSum += p.lab.L;
      prev.aSum += p.lab.a;
      prev.bLabSum += p.lab.b;
    } else {
      bins.set(key, {
        count: 1,
        rSum: p.r,
        gSum: p.g,
        bSum: p.b,
        lSum: p.lab.L,
        aSum: p.lab.a,
        bLabSum: p.lab.b,
      });
    }
  }

  const total = pixels.length;
  return [...bins.values()]
    .map((bin) => ({
      count: bin.count,
      share: bin.count / total,
      r: bin.rSum / bin.count,
      g: bin.gSum / bin.count,
      b: bin.bSum / bin.count,
      lab: {
        L: bin.lSum / bin.count,
        a: bin.aSum / bin.count,
        b: bin.bLabSum / bin.count,
      },
    }))
    .sort((a, b) => b.count - a.count);
}

function isDistinctFromPicks(candidate, picks, deltaE) {
  return !picks.some((p) => {
    const dist = labDistance(p.lab, candidate.lab);
    const dL = Math.abs(p.lab.L - candidate.lab.L);
    // Near in LAB, or two near-neutral shades of the same lightness band.
    if (dist < deltaE && dL < 12) return true;
    const cChroma = chromaLab(candidate.lab);
    const pChroma = chromaLab(p.lab);
    if (cChroma < 10 && pChroma < 10 && dL < 16) return true;
    return false;
  });
}

function adaptiveTargetCount(bodyClusters, accentClusters) {
  const distinctBodies = [];
  for (const c of bodyClusters) {
    if (c.share < MIN_BODY_SHARE) continue;
    if (isDistinctFromPicks(c, distinctBodies, PICK_DELTA_E)) distinctBodies.push(c);
    if (distinctBodies.length >= MAX_N) break;
  }
  const usefulAccents = accentClusters.filter((c) => c.share >= MIN_ACCENT_SHARE).length;
  if (distinctBodies.length >= 4 && usefulAccents >= 2) return MAX_N;
  if (distinctBodies.length >= 3 && usefulAccents >= 1) return 4;
  return MIN_N;
}

function pickAdaptivePalette(
  bodyClusters,
  accentClusters,
  { isDarkStone, isLightStone, handBias = false }
) {
  const target = adaptiveTargetCount(bodyClusters, accentClusters);
  const picks = [];

  const tryAdd = (candidate, minShare) => {
    if (!candidate || picks.length >= target) return false;
    if (handBias && looksLikeSkinCluster(candidate.r, candidate.g, candidate.b)) return false;
    const { h, s, l } = rgbToHsl(candidate.r, candidate.g, candidate.b);
    if (isYardGarbageHue(h, s, l, { isDarkStone })) return false;
    if (candidate.share < minShare && picks.length >= MIN_N) return false;
    if (!isDistinctFromPicks(candidate, picks, PICK_DELTA_E)) return false;
    picks.push(candidate);
    return true;
  };

  // 1) Body by share — keep room for vein/accent colors.
  for (const c of bodyClusters) {
    tryAdd(c, MIN_BODY_SHARE);
    if (picks.length >= Math.min(2, target)) break;
  }

  // 2) Force lightness span (veins / crystal bands)
  const pool = [...bodyClusters, ...accentClusters].filter(
    (c) => !(handBias && looksLikeSkinCluster(c.r, c.g, c.b))
  );
  const byLight = [...pool].sort((a, b) => b.lab.L - a.lab.L);
  const byDark = [...pool].sort((a, b) => a.lab.L - b.lab.L);
  // Dark yard stones: lightest "veins" are usually sky/ground bounce — skip.
  if (!isDarkStone) tryAdd(byLight[0], MIN_ACCENT_SHARE);
  tryAdd(byDark[0], MIN_ACCENT_SHARE);

  // 3) Chroma / hue accents (gold veins, blue flash, rust lines)
  const rankedAccents = [...accentClusters].sort(
    (a, b) => chromaLab(b.lab) * Math.sqrt(b.share) - chromaLab(a.lab) * Math.sqrt(a.share)
  );
  for (const c of rankedAccents) {
    tryAdd(c, MIN_ACCENT_SHARE);
    if (picks.length >= target) break;
  }

  // 4) Dark stones: warm mid-tone gold/rust if missing (prefer over glare gray)
  if (isDarkStone) {
    const hasWarm = picks.some((p) => {
      const { h, s, l } = rgbToHsl(p.r, p.g, p.b);
      return s >= 0.1 && l >= 0.28 && l < 0.75 && h >= 15 && h < 70;
    });
    if (!hasWarm) {
      const warm = [...accentClusters, ...bodyClusters]
        .filter((c) => {
          const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
          return s >= 0.1 && l >= 0.28 && l < 0.72 && h >= 15 && h < 70;
        })
        .sort((a, b) => chromaLab(b.lab) * b.share - chromaLab(a.lab) * a.share)[0];
      tryAdd(warm, MIN_ACCENT_SHARE * 0.5);
    }
  }

  // 5) Mid-tone stones only: keep a true light vein if present (white quartz, cream).
  // Dark stones skip — pale samples are almost always yard reflections.
  if (!isLightStone && !isDarkStone) {
    const lightVein = [...accentClusters, ...bodyClusters]
      .filter((c) => {
        if (handBias && looksLikeSkinCluster(c.r, c.g, c.b)) return false;
        const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
        // Skip warm peach highlights on hand covers.
        if (handBias && l > 0.7 && h >= 15 && h <= 50 && s > 0.15) return false;
        return c.lab.L >= 68 && l >= 0.62 && s <= 0.35 && c.share >= MIN_ACCENT_SHARE * 0.5;
      })
      .sort((a, b) => b.lab.L * Math.sqrt(b.share) - a.lab.L * Math.sqrt(a.share))[0];
    tryAdd(lightVein, MIN_ACCENT_SHARE * 0.45);
  }

  // 6) Light stones: keep a dark vein if present
  if (isLightStone) {
    const darkVein = [...accentClusters, ...bodyClusters]
      .filter((c) => c.lab.L <= 45 && c.share >= MIN_ACCENT_SHARE * 0.45)
      .sort((a, b) => a.lab.L - b.lab.L)[0];
    tryAdd(darkVein, MIN_ACCENT_SHARE * 0.4);
  }

  // Fill to at least MIN_N
  for (const c of bodyClusters) {
    if (picks.length >= MIN_N) break;
    tryAdd(c, 0);
  }
  for (const c of accentClusters) {
    if (picks.length >= MIN_N) break;
    tryAdd(c, 0);
  }

  // Prefer displaying darker→lighter for dark stones, lighter→darker otherwise
  const ordered = [...picks].sort((a, b) =>
    isDarkStone ? a.lab.L - b.lab.L : b.share - a.share || b.lab.L - a.lab.L
  );
  return ordered.slice(0, Math.max(MIN_N, Math.min(target, ordered.length)));
}

function slabExtractBox(width, height, handBias) {
  if (handBias) {
    // Hands sit low — keep upper/mid face; bias slightly left for flash/vein detail.
    return {
      left: Math.round(width * 0.08),
      top: Math.round(height * 0.04),
      width: Math.round(width * 0.78),
      height: Math.round(height * 0.52),
    };
  }
  // Outdoor yard / full-slab: center the stone face — drop clamp, sky, gravel, sides.
  return {
    left: Math.round(width * 0.22),
    top: Math.round(height * 0.2),
    width: Math.round(width * 0.56),
    height: Math.round(height * 0.48),
  };
}

async function faceChromaScore(absPath, handBias) {
  try {
    const meta = await sharp(absPath).metadata();
    if (!meta.width || !meta.height) return 0;
    const box = slabExtractBox(meta.width, meta.height, handBias);
    const { data, info } = await sharp(absPath)
      .extract(box)
      .resize(96, 96, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let sum = 0;
    let n = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        if (data[i + 3] < 200) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const { h, s, l } = rgbToHsl(r, g, b);
        if (handBias && (isSkinTone(r, g, b, h, s, l) || looksLikeSkinCluster(r, g, b))) {
          continue;
        }
        if (isIndustrialYellow(h, s, l)) continue;
        // Sky / crane rejects on full-slab yard shots (hand covers are face-filling).
        if (!handBias && isSkyBlue(h, s, l)) continue;
        sum += chromaLab(rgbToLab(r, g, b));
        n += 1;
      }
    }
    return n ? sum / n : 0;
  } catch {
    return 0;
  }
}

async function pickCoverImage(images, stoneSlug) {
  const ranked = rankCoverCandidates(images, stoneSlug);
  if (!ranked.length) return null;

  const top = ranked[0];
  // Hand/close covers often differ by the close-up name penalty (-100). For palette
  // sampling, still compare chroma across the hand tier so blue flash / veins win.
  const scoreWindow = top.hand ? 160 : 40;
  const contenders = ranked
    .filter((c) => c.hand === top.hand && Math.abs(c.score - top.score) <= scoreWindow)
    .slice(0, 6);

  if (contenders.length === 1) return top.imagePath;

  const scored = [];
  for (const candidate of contenders) {
    const abs = path.join(publicRoot, candidate.imagePath.replace(/^\//, ""));
    if (!fs.existsSync(abs)) continue;
    const chroma = await faceChromaScore(abs, candidate.hand);
    scored.push({ candidate, chroma });
  }
  if (!scored.length) return top.imagePath;

  scored.sort((a, b) => b.chroma - a.chroma || a.candidate.index - b.candidate.index);
  return scored[0].candidate.imagePath;
}

async function extractDominantColors(absPath, { handBias = false } = {}) {
  const meta = await sharp(absPath).metadata();
  if (!meta.width || !meta.height) {
    return {
      swatches: [{ hex: "#888888", bucket: "gray" }],
      buckets: ["gray"],
    };
  }

  const box = slabExtractBox(meta.width, meta.height, handBias);
  const { data, info } = await sharp(absPath)
    .extract(box)
    .resize(SAMPLE, SAMPLE, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const width = info.width;
  const height = info.height;

  const soft = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Extra inset on the extracted face — still drop residual clamp/gravel edges.
      const nx = x / (width - 1);
      const ny = y / (height - 1);
      if (nx < 0.08 || nx > 0.92 || ny < 0.08 || ny > 0.9) continue;

      const i = (y * width + x) * channels;
      const a = data[i + 3];
      if (a < 200) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const { h, s, l } = rgbToHsl(r, g, b);
      const edge = nx < 0.14 || nx > 0.86 || ny < 0.12 || ny > 0.88;
      const topBand = ny < 0.28;

      if (handBias && isSkinTone(r, g, b, h, s, l)) continue;
      if (handBias && looksLikeSkinCluster(r, g, b)) continue;
      if (isIndustrialYellow(h, s, l)) continue;
      // Sky / foliage / equipment anywhere on yard shots; edge/top band is stricter for foliage.
      if (!handBias && isSkyBlue(h, s, l)) continue;
      if (!handBias && isFoliageGreen(h, s, l, edge || topBand)) continue;

      soft.push({ r, g, b, h, s, l, lab: rgbToLab(r, g, b) });
    }
  }

  if (!soft.length) {
    return {
      swatches: [{ hex: "#888888", bucket: "gray" }],
      buckets: ["gray"],
    };
  }

  const medianL = median(soft.map((p) => p.l));
  const isDarkStone = medianL < 0.38;
  const isLightStone = medianL > 0.58;

  const filtered = soft.filter((p) => {
    // Specular blowouts: HSL s can be ~1 on near-white, so key off lightness + channel max.
    const maxCh = Math.max(p.r, p.g, p.b);
    if (!isLightStone && p.l > 0.9 && maxCh > 235) return false;
    if (p.l > 0.96 && maxCh > 245) return false;
    if (isIndustrialYellow(p.h, p.s, p.l)) return false;

    if (isDarkStone) {
      // Drop washed glare / sky / yard reflections on polished dark faces.
      if (p.l > 0.55) return false;
      if (p.l > 0.48 && p.s < 0.12) return false;
      if (isSkyBlue(p.h, p.s, p.l)) return false;
      if (isYardGroundWarm(p.h, p.s, p.l, { isDarkStone: true })) return false;
      // High-chroma cool reflection (sky bounce) on dark stone.
      if (p.l > 0.35 && p.s > 0.16 && p.h >= 170 && p.h <= 250) return false;
      return true;
    }
    if (isLightStone) {
      if (p.l < 0.07) return false;
      if (p.l < 0.14 && p.s < 0.1) return false;
      return true;
    }
    if (p.l > 0.9 && maxCh > 230) return false;
    if (p.l < 0.05) return false;
    return true;
  });

  const pool = filtered.length >= 120 ? filtered : soft;
  const medianLab = {
    L: median(pool.map((p) => p.lab.L)),
    a: median(pool.map((p) => p.lab.a)),
    b: median(pool.map((p) => p.lab.b)),
  };
  const medianChroma = median(pool.map((p) => chromaLab(p.lab)));

  const rejectCluster = (c) => {
    const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
    if (handBias && looksLikeSkinCluster(c.r, c.g, c.b)) return true;
    return isYardGarbageHue(h, s, l, { isDarkStone, edge: false });
  };

  let bodyClusters = labHistogramClusters(pool).filter((c) => !rejectCluster(c));
  const accentPixels = pool.filter(
    (p) => labDistance(p.lab, medianLab) > 15 || chromaLab(p.lab) > medianChroma * 1.35
  );
  let accentClusters = labHistogramClusters(accentPixels).filter((c) => !rejectCluster(c));

  if (!bodyClusters.length) {
    return {
      swatches: [{ hex: "#888888", bucket: "gray" }],
      buckets: ["gray"],
    };
  }

  const picks = pickAdaptivePalette(bodyClusters, accentClusters, {
    isDarkStone,
    isLightStone,
    handBias,
  });

  const swatches = picks.map((p) => {
    const hex = rgbToHex(p.r, p.g, p.b);
    const bucket = bucketColor(p.r, p.g, p.b);
    return { hex, bucket, share: Number(p.share.toFixed(4)) };
  });

  const buckets = [];
  for (const s of swatches) {
    if (!buckets.includes(s.bucket)) buckets.push(s.bucket);
  }

  return { swatches: swatches.map(({ hex, bucket }) => ({ hex, bucket })), buckets };
}

async function main() {
  const stones = buildMarketplaceStones();
  const result = {};
  let ok = 0;
  let missing = 0;
  const samples = [];
  const spotlight = [
    "cristallo",
    "dallas-white",
    "amazonic-green",
    "gold-macaubas",
    "steel-gray",
    "arizona-gold",
    "blue-dunes",
    "black-pearl",
    "galaxy-white",
    "taj-mahal",
    "juparana-blue",
    "beverly-blue",
    "bronzonite",
  ];

  for (const stone of stones) {
    const cover = await pickCoverImage(stone.images, stone.slug);
    if (!cover) {
      missing += 1;
      result[stone.slug] = {
        cover: null,
        swatches: [{ hex: "#888888", bucket: "gray" }],
        buckets: ["gray"],
      };
      continue;
    }

    const abs = path.join(publicRoot, cover.replace(/^\//, ""));
    if (!fs.existsSync(abs)) {
      missing += 1;
      console.warn("missing file", stone.slug, abs);
      result[stone.slug] = {
        cover,
        swatches: [{ hex: "#888888", bucket: "gray" }],
        buckets: ["gray"],
      };
      continue;
    }

    const handBias = isHandScaleCoverImage(cover);

    const palette = await extractDominantColors(abs, { handBias });
    result[stone.slug] = {
      cover,
      swatches: palette.swatches,
      buckets: palette.buckets,
    };
    ok += 1;

    if (spotlight.includes(stone.slug)) {
      samples.push({ slug: stone.slug, handBias, ...result[stone.slug] });
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    method:
      "center slab-face extract + LAB body/accent histogram (sharp 512px); hand skin filter; clamp/crane/sky/foliage/ground/glare rejects; adaptive 3–5 distinct; buckets from HSL",
    stones: result,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(`ok=${ok} missing=${missing} total=${stones.length}`);
  console.log("samples:", JSON.stringify(samples, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
