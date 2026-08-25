#!/usr/bin/env node

/**
 * Rebuild JW Stone shopper colors from verified slab-core pixels only.
 *
 * Input manifest:
 *   client/src/data/jwStoneDominantColors.generated.json
 *   (the legacy extractor runs first to keep the cover list current)
 *
 * Outputs:
 *   client/src/data/jwStoneDominantColors.generated.json
 *   client/public/images/businesses/jw-stone/color-slivers/{slug}.webp
 *   client/public/images/businesses/jw-stone/color-collage/*.webp
 *
 * No pixel outside the detected/inset slab rectangle may influence a swatch,
 * filter bucket, color tile, or color collage.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  boxFromNormalized,
  detectSlabFaceBoxFromRaw,
  extractPaletteFromRaw,
} from "./jw-stone-face-color-core.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(
  repoRoot,
  "client/src/data/jwStoneDominantColors.generated.json"
);
const publicRoot = path.join(repoRoot, "client/public");
const sliverDir = path.join(
  publicRoot,
  "images/businesses/jw-stone/color-slivers"
);
const collageDir = path.join(
  publicRoot,
  "images/businesses/jw-stone/color-collage"
);
const sliverPublicPrefix = "/images/businesses/jw-stone/color-slivers";

const PREVIEW_WIDTH = 280;
const PREVIEW_HEIGHT = 240;
const PALETTE_SIZE = 320;
const SLIVER_WIDTH = 400;
const SLIVER_HEIGHT = 1200;
const COLLAGE_WIDTH = 960;
const COLLAGE_HEIGHT = 1800;
const COLLAGE_STRIP_COUNT = 6;

/** Same known hand/close-up evidence used by the legacy extractor. */
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

const COLLAGE_BANDS = [
  { id: "01-white", buckets: ["white"] },
  { id: "02-warm", buckets: ["beige"] },
  { id: "03-gray", buckets: ["gray", "silver"] },
  { id: "04-black", buckets: ["black"] },
  { id: "05-brown", buckets: ["brown"] },
  { id: "09-gold", buckets: ["gold", "yellow"] },
  { id: "06-green", buckets: ["green"] },
  { id: "07-blue", buckets: ["blue"] },
];

function roundRatio(value) {
  return Number(value.toFixed(5));
}

function normalizeSample(sample) {
  return Object.freeze({
    left: roundRatio(sample.left),
    top: roundRatio(sample.top),
    width: roundRatio(sample.width),
    height: roundRatio(sample.height),
  });
}

function driveFileId(imagePath) {
  const base = String(imagePath || "").split("/").pop() || "";
  return base.replace(/\.[^.]+$/, "");
}

function orientedDimensions(metadata) {
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const orientation = Number(metadata.orientation || 1);
  const swaps = orientation >= 5 && orientation <= 8;
  return swaps ? { width: height, height: width } : { width, height };
}

function validateSample(sample, slug) {
  const right = sample.left + sample.width;
  const bottom = sample.top + sample.height;
  if (
    sample.left < 0.05 ||
    sample.top < 0.05 ||
    right > 0.95 ||
    bottom > 0.95 ||
    sample.width < 0.16 ||
    sample.height < 0.12
  ) {
    throw new Error(
      `${slug}: unsafe slab sample ${JSON.stringify(sample)}; environment boundary breached`
    );
  }
}

async function analyzeStone(slug, cover) {
  const absolute = path.join(publicRoot, String(cover).replace(/^\//, ""));
  if (!fs.existsSync(absolute)) {
    return {
      palette: { swatches: [], buckets: [] },
      sample: null,
      sliver: null,
      missing: true,
    };
  }

  const handBias = HAND_COVER_FILE_IDS.has(driveFileId(cover));
  const metadata = await sharp(absolute).metadata();
  const oriented = orientedDimensions(metadata);
  if (!oriented.width || !oriented.height) {
    throw new Error(`${slug}: image has no usable dimensions`);
  }

  const preview = await sharp(absolute)
    .rotate()
    .resize({
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const detection = detectSlabFaceBoxFromRaw(preview.data, preview.info, { handBias });
  validateSample(detection.sample, slug);
  const sampleBox = boxFromNormalized(detection.sample, oriented.width, oriented.height);

  const faceBuffer = await sharp(absolute)
    .rotate()
    .extract(sampleBox)
    .toBuffer();

  const paletteRaw = await sharp(faceBuffer)
    .resize(PALETTE_SIZE, PALETTE_SIZE, {
      fit: "cover",
      position: "centre",
      kernel: "lanczos3",
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const palette = extractPaletteFromRaw(paletteRaw.data, paletteRaw.info, { handBias });

  fs.mkdirSync(sliverDir, { recursive: true });
  const sliverAbsolute = path.join(sliverDir, `${slug}.webp`);
  await sharp(faceBuffer)
    .resize(SLIVER_WIDTH, SLIVER_HEIGHT, {
      fit: "cover",
      position: "centre",
      kernel: "lanczos3",
    })
    .webp({ quality: 90, effort: 5 })
    .toFile(sliverAbsolute);

  return {
    palette,
    sample: {
      source: "inner-slab-face-only",
      mode: detection.mode,
      confidence: detection.confidence,
      box: normalizeSample(detection.sample),
    },
    sliver: `${sliverPublicPrefix}/${slug}.webp`,
    sliverAbsolute,
    missing: false,
  };
}

function collageScore(slug, entry, bucketSet) {
  const lead = entry.swatches?.[0]?.bucket;
  let score = 0;
  if (bucketSet.has(lead)) score -= 100;
  else if ((entry.buckets || []).some((bucket) => bucketSet.has(bucket))) score -= 45;
  if (slug.startsWith("trending-selection-")) score += 35;
  if (entry.sample?.mode === "center-safe") score += 8;
  score -= Number(entry.sample?.confidence || 0) * 12;
  return score;
}

async function rebuildCollages(stones, sliverBySlug) {
  fs.mkdirSync(collageDir, { recursive: true });

  for (const band of COLLAGE_BANDS) {
    const bucketSet = new Set(band.buckets);
    const ranked = Object.entries(stones)
      .filter(([, entry]) =>
        (entry.buckets || []).some((bucket) => bucketSet.has(bucket))
      )
      .filter(([slug]) => sliverBySlug.has(slug))
      .sort((first, second) => {
        const score =
          collageScore(first[0], first[1], bucketSet) -
          collageScore(second[0], second[1], bucketSet);
        return score || first[0].localeCompare(second[0]);
      })
      .slice(0, COLLAGE_STRIP_COUNT);

    if (!ranked.length) {
      console.warn(`[jw-colors] ${band.id}: no verified slab-face source; existing asset kept`);
      continue;
    }

    const sourceSlugs = ranked.map(([slug]) => slug);
    while (sourceSlugs.length < COLLAGE_STRIP_COUNT) {
      sourceSlugs.push(sourceSlugs[sourceSlugs.length % ranked.length]);
    }

    const composites = [];
    for (let index = 0; index < sourceSlugs.length; index += 1) {
      const left = Math.round((index * COLLAGE_WIDTH) / sourceSlugs.length);
      const right = Math.round(((index + 1) * COLLAGE_WIDTH) / sourceSlugs.length);
      const width = Math.max(1, right - left);
      const input = await sharp(sliverBySlug.get(sourceSlugs[index]))
        .resize(width, COLLAGE_HEIGHT, { fit: "cover", position: "centre" })
        .toBuffer();
      composites.push({ input, left, top: 0 });
    }

    const output = path.join(collageDir, `${band.id}.webp`);
    await sharp({
      create: {
        width: COLLAGE_WIDTH,
        height: COLLAGE_HEIGHT,
        channels: 3,
        background: { r: 42, g: 39, b: 35 },
      },
    })
      .composite(composites)
      .webp({ quality: 92, effort: 5 })
      .toFile(output);

    console.log(`[jw-colors] ${band.id}: ${sourceSlugs.join(", ")}`);
  }
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const result = {};
  const sliverBySlug = new Map();
  const counts = {
    "detected-slab-core": 0,
    "center-safe": 0,
    "hand-safe-center": 0,
    missing: 0,
  };

  for (const [slug, existing] of Object.entries(manifest.stones || {})) {
    const cover = existing?.cover || null;
    if (!cover) {
      counts.missing += 1;
      result[slug] = {
        cover: null,
        sliver: null,
        swatches: [],
        buckets: [],
        sample: null,
      };
      continue;
    }

    try {
      const analyzed = await analyzeStone(slug, cover);
      if (analyzed.missing) counts.missing += 1;
      else counts[analyzed.sample.mode] = (counts[analyzed.sample.mode] || 0) + 1;

      result[slug] = {
        cover,
        sliver: analyzed.sliver,
        swatches: analyzed.palette.swatches,
        buckets: analyzed.palette.buckets,
        sample: analyzed.sample,
      };
      if (analyzed.sliverAbsolute) sliverBySlug.set(slug, analyzed.sliverAbsolute);
    } catch (error) {
      counts.missing += 1;
      console.warn(`[jw-colors] ${slug}: ${String(error?.message || error)}`);
      result[slug] = {
        cover,
        sliver: null,
        swatches: [],
        buckets: [],
        sample: null,
      };
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    method:
      "inner slab-face rectangle only (detected rectangular slab core or conservative center-safe core); sky, trees, yard, gravel, racks, clamps, neighboring slabs and environment excluded before LAB palette extraction",
    stones: result,
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rebuildCollages(result, sliverBySlug);

  console.log(
    `[jw-colors] wrote ${Object.keys(result).length} palettes; ` +
      `detected=${counts["detected-slab-core"]} center-safe=${counts["center-safe"]} ` +
      `hand=${counts["hand-safe-center"]} missing=${counts.missing}`
  );
}

await main();
