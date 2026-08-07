/**
 * Build per-stone vertical face slivers + regenerate dominant colors from them.
 * Optionally rebuild color-collage/ direction bands as mosaics of bucket slivers.
 *
 * Usage:
 *   node scripts/build-jw-stone-color-slivers.mjs
 *   node scripts/build-jw-stone-color-slivers.mjs --skip-collage
 *
 * Outputs:
 *   client/public/images/businesses/jw-stone/color-slivers/{slug}.webp
 *   client/src/data/jwStoneDominantColors.generated.json
 *   client/public/images/businesses/jw-stone/color-collage/0N-*.webp (unless --skip-collage)
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const repoRoot = path.resolve(import.meta.dirname, "..");

// Reuse cover ranking + face extract + palette logic from the color extractor.
const extractMod = await import(
  pathToFileURL(path.join(repoRoot, "scripts/extract-jw-stone-dominant-colors.mjs")).href
);

const {
  buildMarketplaceStones,
  pickCoverImage,
  isHandScaleCoverImage,
  slabExtractBox,
  extractDominantColorsFromBuffer,
  publicRoot,
  outPath: dominantColorsOutPath,
} = extractMod;

const SLIVER_DIR = path.join(
  repoRoot,
  "client/public/images/businesses/jw-stone/color-slivers"
);
const COLLAGE_DIR = path.join(
  repoRoot,
  "client/public/images/businesses/jw-stone/color-collage"
);
const SLIVER_PUBLIC_PREFIX = "/images/businesses/jw-stone/color-slivers";

const SLIVER_W = 400;
const SLIVER_H = 1200;
const WEBP_QUALITY = 90;
const COLLAGE_W = 900;
const COLLAGE_H = 2400;
const COLLAGE_STRIP_COUNT = 6;

const skipCollage = process.argv.includes("--skip-collage");

/** Narrow the face region into a vertical sliver (center band of the face). */
function sliverExtractBox(width, height, handBias) {
  const face = slabExtractBox(width, height, handBias);
  // Take the middle ~38% of face width — tall face crop, avoid left/right clamps.
  const sliverWidth = Math.max(24, Math.round(face.width * 0.38));
  const left = face.left + Math.round((face.width - sliverWidth) / 2);
  return {
    left: Math.max(0, Math.min(left, width - sliverWidth)),
    top: face.top,
    width: Math.min(sliverWidth, width - left),
    height: Math.min(face.height, height - face.top),
  };
}

async function writeSliver(absCover, outAbs, handBias) {
  const meta = await sharp(absCover).metadata();
  if (!meta.width || !meta.height) throw new Error(`No dimensions: ${absCover}`);
  const box = sliverExtractBox(meta.width, meta.height, handBias);
  await sharp(absCover)
    .extract(box)
    .resize(SLIVER_W, SLIVER_H, { fit: "cover", position: "centre", kernel: "lanczos3" })
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toFile(outAbs);
  return box;
}

async function samplePaletteFromSliver(absSliver) {
  // Sliver is already face-cropped — sample with light edge inset, no second face extract.
  return extractDominantColorsFromBuffer(absSliver, { alreadyFaceCrop: true, handBias: false });
}

const COLLAGE_BANDS = [
  { id: "01-white", alt: "White stone faces", buckets: ["white"] },
  { id: "02-warm", alt: "Warm stone faces", buckets: ["beige", "gold", "yellow"] },
  { id: "03-gray", alt: "Gray stone faces", buckets: ["gray", "silver"] },
  { id: "04-black", alt: "Black stone faces", buckets: ["black"] },
  { id: "05-brown", alt: "Brown stone faces", buckets: ["brown"] },
  { id: "06-green", alt: "Green stone faces", buckets: ["green"] },
  { id: "07-blue", alt: "Blue stone faces", buckets: ["blue"] },
  { id: "08-red", alt: "Red burgundy stone faces", buckets: ["rose"] },
];

function collageRankScore(slug, palette, bucketSet) {
  const lead = palette.swatches?.[0]?.bucket;
  const buckets = palette.buckets || [];
  let score = 100;
  if (bucketSet.has(lead)) score -= 50;
  else if (buckets.some((b) => bucketSet.has(b))) score -= 20;
  if (slug.startsWith("trending-selection-")) score += 40;
  // Prefer named stones with more of the band's buckets.
  score -= buckets.filter((b) => bucketSet.has(b)).length * 3;
  return score;
}

async function rebuildCollageMosaics(stonePalettes, sliverAbsBySlug) {
  fs.mkdirSync(COLLAGE_DIR, { recursive: true });
  for (const band of COLLAGE_BANDS) {
    const bucketSet = new Set(band.buckets);
    const ranked = Object.entries(stonePalettes)
      .filter(([, palette]) => (palette.buckets || []).some((b) => bucketSet.has(b)))
      .filter(([slug]) => sliverAbsBySlug.has(slug))
      .sort((a, b) => {
        const aScore = collageRankScore(a[0], a[1], bucketSet);
        const bScore = collageRankScore(b[0], b[1], bucketSet);
        return aScore - bScore || a[0].localeCompare(b[0]);
      })
      .slice(0, COLLAGE_STRIP_COUNT);

    // Prefer lead-bucket matches when we have enough; otherwise fall back to any match.
    const leadMatched = ranked.filter(([, palette]) =>
      bucketSet.has(palette.swatches?.[0]?.bucket)
    );
    const selected =
      leadMatched.length >= Math.min(3, COLLAGE_STRIP_COUNT) ? leadMatched : ranked;

    if (!selected.length) {
      console.warn(`collage ${band.id}: no slivers for buckets ${band.buckets.join(",")}`);
      continue;
    }

    // Red/rose inventory is thin — pad with the known burgundy first-cut face if needed.
    const sources = selected.slice(0, COLLAGE_STRIP_COUNT).map(([slug]) => ({
      kind: "sliver",
      slug,
      abs: sliverAbsBySlug.get(slug),
    }));
    if (band.id === "08-red" && sources.length < 3) {
      const burgundy = path.join(
        repoRoot,
        "client/public/images/businesses/jw-stone/first-cut/02.jpg"
      );
      if (fs.existsSync(burgundy)) {
        while (sources.length < 3) {
          sources.push({ kind: "file", slug: "first-cut-02", abs: burgundy });
        }
      }
    }

    const stripW = Math.floor(COLLAGE_W / sources.length);
    const composites = [];
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const buf = await sharp(src.abs)
        .resize(stripW, COLLAGE_H, { fit: "cover", position: "centre" })
        .toBuffer();
      composites.push({ input: buf, left: i * stripW, top: 0 });
    }

    const canvas = sharp({
      create: {
        width: COLLAGE_W,
        height: COLLAGE_H,
        channels: 3,
        background: { r: 40, g: 38, b: 36 },
      },
    });

    const outPath = path.join(COLLAGE_DIR, `${band.id}.webp`);
    await canvas
      .composite(composites)
      .webp({ quality: 92, effort: 5 })
      .toFile(outPath);

    console.log(
      `collage ${band.id}: ${sources.map((s) => s.slug).join(", ")} -> ${path.basename(outPath)}`
    );
  }
}

async function main() {
  fs.mkdirSync(SLIVER_DIR, { recursive: true });

  const stones = buildMarketplaceStones();
  const result = {};
  const sliverAbsBySlug = new Map();
  let written = 0;
  let missing = 0;
  const failures = [];

  for (const stone of stones) {
    const cover = await pickCoverImage(stone.images, stone.slug);
    if (!cover) {
      missing += 1;
      result[stone.slug] = {
        cover: null,
        sliver: null,
        swatches: [{ hex: "#888888", bucket: "gray" }],
        buckets: ["gray"],
      };
      failures.push({ slug: stone.slug, reason: "no-cover" });
      continue;
    }

    const absCover = path.join(publicRoot, cover.replace(/^\//, ""));
    if (!fs.existsSync(absCover)) {
      missing += 1;
      result[stone.slug] = {
        cover,
        sliver: null,
        swatches: [{ hex: "#888888", bucket: "gray" }],
        buckets: ["gray"],
      };
      failures.push({ slug: stone.slug, reason: "missing-file", cover });
      continue;
    }

    const handBias = isHandScaleCoverImage(cover);
    const outAbs = path.join(SLIVER_DIR, `${stone.slug}.webp`);
    const sliverPublic = `${SLIVER_PUBLIC_PREFIX}/${stone.slug}.webp`;

    try {
      await writeSliver(absCover, outAbs, handBias);
      const palette = await samplePaletteFromSliver(outAbs);
      result[stone.slug] = {
        cover,
        sliver: sliverPublic,
        swatches: palette.swatches,
        buckets: palette.buckets,
      };
      sliverAbsBySlug.set(stone.slug, outAbs);
      written += 1;
    } catch (err) {
      missing += 1;
      failures.push({ slug: stone.slug, reason: String(err?.message || err) });
      result[stone.slug] = {
        cover,
        sliver: null,
        swatches: [{ hex: "#888888", bucket: "gray" }],
        buckets: ["gray"],
      };
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    method:
      "per-stone vertical face sliver (center slab-face crop) + LAB body/accent histogram on sliver; hand skin / clamp/crane/sky rejects; adaptive 3–5; buckets from HSL",
    stones: result,
  };

  fs.writeFileSync(dominantColorsOutPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Wrote ${dominantColorsOutPath}`);
  console.log(`slivers written=${written} missing=${missing} total=${stones.length}`);

  if (!skipCollage) {
    await rebuildCollageMosaics(result, sliverAbsBySlug);
    console.log("collage mosaics rebuilt from slivers");
  } else {
    console.log("skipped collage rebuild (--skip-collage)");
  }

  if (failures.length) {
    console.log(
      "failures (first 20):",
      JSON.stringify(failures.slice(0, 20), null, 2)
    );
  }

  // Spotlight sanity for known offenders
  for (const slug of ["alabama-white", "black-pearl", "dallas-white", "amazonic-green"]) {
    console.log(slug, JSON.stringify(result[slug]?.buckets), result[slug]?.sliver);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
