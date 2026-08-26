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
const overridePath = path.join(repoRoot, "client/src/data/jwStoneColorOverrides.json");
const inventoryPath = path.join(repoRoot, "client/src/data/jwStoneInventory.generated.json");
const sourceNamesPath = path.join(repoRoot, "client/src/data/jwStoneSourceNames.generated.json");
const publicRoot = path.join(repoRoot, "client/public");
const sliverDir = path.join(
  publicRoot,
  "images/businesses/jw-stone/color-slivers"
);
const collageDir = path.join(
  publicRoot,
  "images/businesses/jw-stone/color-collage"
);
const auditDir = path.join(repoRoot, "artifacts/jw-stone-color-truth");
const auditImageDir = path.join(auditDir, "images");
const sliverPublicPrefix = "/images/businesses/jw-stone/color-slivers";

const PREVIEW_WIDTH = 280;
const PREVIEW_HEIGHT = 240;
const PALETTE_SIZE = 320;
const SLIVER_WIDTH = 400;
const SLIVER_HEIGHT = 1200;
const COLLAGE_WIDTH = 960;
const COLLAGE_HEIGHT = 1800;
const COLLAGE_STRIP_COUNT = 6;
const MIN_AUTOMATIC_CONFIDENCE = 0.79;

/**
 * Deliberate, cover-image-specific normalized crop boxes. A crop belongs to the
 * exact cover path and must be re-reviewed if that cover changes. Keep this
 * list small: automatic high-confidence slab detection is preferred.
 */
export const EXPLICIT_FACE_CROPS = Object.freeze({});

/** Visual-audit exclusions where hardware or supports cross the slab face. */
export const OBSTRUCTED_FACE_SLUGS = new Set([
  "beverly-blue-antigo",
  "carrara-white-brazil-119x75",
  "casa-blanca",
  "calacatta-macchia",
  "calacatta-macchia-vecchia",
  "oyster-white",
  "toulon-white",
  "trending-selection-34",
  "trending-selection-35",
  "trending-selection-36",
  "trending-selection-37",
  "trending-selection-38",
]);

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
  "11_8FYGX-hKzb7MMljH8LGukCR6ofFcaz",
  "1_jxbwi-xAV-_3Zs2ivWlzwNXFnyRgRxL",
  "101ftcLyGe6pWSzuCPcrs94AanpuG5Dnb",
  "1POZ36aWL-ASV2uQSMS_5w11Q22X5nQgY",
  "130CuUhmYEbsQwGynnQ8R6lDIW34E9qKc",
  "1XHgYqAJR548-hOlxH8rx7oCQ8q8feIRP",
  "1sD8kGUwsGE5tymxjMEr6QPEFP9TlRorr",
  "1CtB0-MY_RP50AEdeSHvwHYJzSwGYs8Ae",
  "1T9OTfK4VWe5j0wMuIof2BUdeo7RZ57_R",
  "1ippYy4EpV8TV6C8orM8B_KWwMrNZI2NE",
  "1Fxc4jXM4YxGC1rPSVpCN-UD1hme2HKKK",
  "1AehD2Gk37gaaQNfAUqoIA0X2nbeVBvNs",
  "black-pearl-face-1AehD2Gk37gaaQNfAUqoIA0X2nbeVBvNs",
  "16683MPLP7Tbr_zWA29ito0eVct7ooffq",
  "1QJ3LbaifHqRv24aZ5hWSnmlU_IL1XjfX",
  "1wca7RSqaHX7QSKjERH3zQLUT9-dVr8rW",
  "1WhkGLRxAOoWKJhaZznwf-Z9ER9wV5M-b",
  "1L42L_3HT_2rFzdCTWT46k_AS_ytajWF-",
  "1KlXD4-B96IBcvKjfCPGTM-aR8AwmD446",
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

function isHandOrCloseImage(imagePath, sourceNames) {
  const fileId = driveFileId(imagePath);
  const sourceName = String(sourceNames[fileId] || "").toLowerCase();
  return HAND_COVER_FILE_IDS.has(fileId) || /\b(hand|hands|holding|close[ -]?up|close look|sample|swatch|detail)\b/.test(sourceName);
}

function chooseCover(slug, existingCover, inventoryBySlug, sourceNames) {
  const images = inventoryBySlug.get(slug)?.images || [];
  // Never carry forward a legacy cover that is no longer attached to this
  // inventory record. That can assign another stone's face (or a hand detail)
  // to the wrong picker result.
  if (existingCover && images.includes(existingCover) && !isHandOrCloseImage(existingCover, sourceNames)) {
    return existingCover;
  }
  return images.find((image) => !isHandOrCloseImage(image, sourceNames)) || existingCover || images[0] || null;
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
  const explicit = EXPLICIT_FACE_CROPS[slug];
  const explicitMatchesCover = explicit?.cover === cover;
  const safeAutomatic =
    detection.mode === "detected-slab-core" &&
    Number(detection.confidence || 0) >= MIN_AUTOMATIC_CONFIDENCE &&
    !OBSTRUCTED_FACE_SLUGS.has(slug);
  const sample = explicitMatchesCover ? explicit.box : safeAutomatic ? detection.sample : null;

  if (!sample) {
    return {
      palette: { swatches: [], buckets: [] },
      sample: null,
      detection,
      sliver: null,
      sliverAbsolute: null,
      missing: false,
      status: "excluded",
      reason: explicit && !explicitMatchesCover
        ? "explicit-crop-cover-mismatch"
        : OBSTRUCTED_FACE_SLUGS.has(slug)
          ? "visual-audit-obstruction"
          : `unsafe-${detection.mode}`,
    };
  }

  validateSample(sample, slug);
  const sampleBox = boxFromNormalized(sample, oriented.width, oriented.height);

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
      mode: explicitMatchesCover ? "explicit-image-crop" : detection.mode,
      confidence: explicitMatchesCover ? 1 : detection.confidence,
      box: normalizeSample(sample),
    },
    detection,
    sliver: `${sliverPublicPrefix}/${slug}.webp`,
    sliverAbsolute,
    missing: false,
    status: explicitMatchesCover ? "corrected" : "safe",
    reason: explicitMatchesCover ? "reviewed-image-specific-crop" : "high-confidence-slab-detection",
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
  const usedAcrossBrowseSurface = new Set();
  const evidence = {};

  for (const band of COLLAGE_BANDS) {
    const bucketSet = new Set(band.buckets);
    const ranked = Object.entries(stones)
      .filter(([, entry]) =>
        (entry.buckets || []).some((bucket) => bucketSet.has(bucket))
      )
      .filter(([slug]) => sliverBySlug.has(slug))
      .filter(([slug]) => !usedAcrossBrowseSurface.has(slug))
      .sort((first, second) => {
        const score =
          collageScore(first[0], first[1], bucketSet) -
          collageScore(second[0], second[1], bucketSet);
        return score || first[0].localeCompare(second[0]);
      })
      .slice(0, COLLAGE_STRIP_COUNT);

    if (!ranked.length) {
      const staleOutput = path.join(collageDir, `${band.id}.webp`);
      if (fs.existsSync(staleOutput)) fs.rmSync(staleOutput);
      evidence[band.id] = [];
      console.warn(`[jw-colors] ${band.id}: no verified unique slab-face source; stale asset removed`);
      continue;
    }

    const sourceSlugs = ranked.map(([slug]) => slug);
    if (new Set(sourceSlugs).size !== sourceSlugs.length) {
      throw new Error(`${band.id}: duplicate stone slug in collage evidence`);
    }
    sourceSlugs.forEach((slug) => usedAcrossBrowseSurface.add(slug));
    evidence[band.id] = sourceSlugs;

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
  return evidence;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function writeAuditImage(slug, cover, detection, sample) {
  if (!cover || !detection) return null;
  const absolute = path.join(publicRoot, String(cover).replace(/^\//, ""));
  if (!fs.existsSync(absolute)) return null;
  fs.mkdirSync(auditImageDir, { recursive: true });
  const base = await sharp(absolute).rotate().resize({ width: 900, withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const width = base.info.width;
  const height = base.info.height;
  if (!width || !height) return null;
  const rect = (box, color, stroke) => {
    if (!box) return "";
    return `<rect x="${box.left * width}" y="${box.top * height}" width="${box.width * width}" height="${box.height * height}" fill="none" stroke="${color}" stroke-width="${stroke}"/>`;
  };
  const overlay = Buffer.from(
    `<svg width="${width}" height="${height}">${rect(detection.outer, "#ffd400", Math.max(4, width / 180))}${rect(sample, "#00ff66", Math.max(5, width / 150))}</svg>`
  );
  const output = path.join(auditImageDir, `${slug}.webp`);
  await sharp(base.data).composite([{ input: overlay, top: 0, left: 0 }])
    .webp({ quality: 84 }).toFile(output);
  return `images/${slug}.webp`;
}

async function writeAudit(auditRows, counts, collageEvidence) {
  fs.mkdirSync(auditDir, { recursive: true });
  const riskOrder = { excluded: 0, corrected: 1, safe: 2 };
  auditRows.sort((a, b) => (riskOrder[a.status] ?? 9) - (riskOrder[b.status] ?? 9) || a.confidence - b.confidence || a.slug.localeCompare(b.slug));
  fs.writeFileSync(path.join(auditDir, "audit.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), counts, collageEvidence, stones: auditRows }, null, 2)}\n`);
  const cards = auditRows.map((row) => `<article><h2>${escapeHtml(row.name)} <small>${escapeHtml(row.slug)}</small></h2><div class="grid"><img src="${escapeHtml(row.auditImage || "")}" alt="Detected slab and inset sample for ${escapeHtml(row.name)}"><img src="${escapeHtml(row.sliver ? `../../client/public${row.sliver}` : "")}" alt="Final slab-face crop for ${escapeHtml(row.name)}"></div><p><b>${row.status}</b> · ${escapeHtml(row.mode)} · confidence ${row.confidence.toFixed(3)} · ${escapeHtml(row.reason)}</p><p>Cover: <code>${escapeHtml(row.cover)}</code></p><p>Swatches: ${(row.swatches || []).map((swatch) => `<i style="background:${escapeHtml(swatch.hex)}" title="${escapeHtml(swatch.bucket)}"></i>`).join("")} · Categories: ${escapeHtml((row.buckets || []).join(", ") || "none")}</p><p>Manual override: ${escapeHtml(row.overrideDisposition)}</p></article>`).join("\n");
  const html = `<!doctype html><meta charset="utf-8"><title>JW Stone color-truth audit</title><style>body{font:14px system-ui;margin:24px;background:#171512;color:#f6f1e8}header{max-width:1100px;margin:auto}article{max-width:1100px;margin:24px auto;padding:20px;background:#26221c;border:1px solid #51483c;border-radius:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.grid img{width:100%;height:360px;object-fit:contain;background:#0d0c0a}small,code{color:#cbbda8}i{display:inline-block;width:24px;height:24px;border-radius:50%;border:1px solid #fff8;margin:0 3px;vertical-align:middle}@media(max-width:700px){.grid{grid-template-columns:1fr}.grid img{height:280px}}</style><header><h1>JW Stone slab-face color evidence</h1><p>${counts.total} catalog stones · ${counts.safeAutomatic} safe automatic crops · ${counts.explicit} explicit crops · ${counts.excluded} excluded</p><p>Yellow: detected boundary. Green: exact shopper-facing sample. No green box means no color claim.</p></header>${cards}`;
  fs.writeFileSync(path.join(auditDir, "index.html"), html);
}

async function main() {
  // Generated slivers are a complete snapshot. Clear the previous snapshot so
  // a newly excluded/unsafe stone cannot remain available as a stale asset.
  fs.rmSync(sliverDir, { recursive: true, force: true });
  fs.mkdirSync(sliverDir, { recursive: true });

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const reviewedOverrides = JSON.parse(fs.readFileSync(overridePath, "utf8"));
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
  const sourceNames = JSON.parse(fs.readFileSync(sourceNamesPath, "utf8"));
  const inventoryBySlug = new Map(inventory.map((stone) => [stone.slug, stone]));
  const result = {};
  const sliverBySlug = new Map();
  const counts = {
    "detected-slab-core": 0,
    "center-safe": 0,
    "hand-safe-center": 0,
    missing: 0,
    total: 0,
    safeAutomatic: 0,
    explicit: 0,
    excluded: 0,
  };
  const auditRows = [];
  const collageEvidence = {};

  for (const [slug, existing] of Object.entries(manifest.stones || {})) {
    counts.total += 1;
    const cover = chooseCover(slug, existing?.cover || null, inventoryBySlug, sourceNames);
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
      else if (analyzed.sample) counts[analyzed.sample.mode] = (counts[analyzed.sample.mode] || 0) + 1;
      if (analyzed.status === "excluded") counts.excluded += 1;
      else if (analyzed.sample?.mode === "explicit-image-crop") counts.explicit += 1;
      else counts.safeAutomatic += 1;

      result[slug] = {
        cover,
        sliver: analyzed.sliver,
        swatches: analyzed.palette.swatches,
        buckets: analyzed.palette.buckets,
        sample: analyzed.sample,
      };
      if (analyzed.sliverAbsolute) sliverBySlug.set(slug, analyzed.sliverAbsolute);
      const auditImage = await writeAuditImage(slug, cover, analyzed.detection, analyzed.sample?.box ?? null);
      auditRows.push({
        name: existing.name || slug,
        slug,
        cover,
        auditImage,
        sliver: analyzed.sliver,
        swatches: analyzed.palette.swatches,
        buckets: analyzed.palette.buckets,
        mode: analyzed.sample?.mode || analyzed.detection?.mode || "missing",
        confidence: Number(analyzed.sample?.confidence ?? analyzed.detection?.confidence ?? 0),
        status: analyzed.status,
        reason: analyzed.reason,
        overrideDisposition: reviewedOverrides[slug]
          ? `${reviewedOverrides[slug].disposition}: ${reviewedOverrides[slug].categories.join(", ")} — ${reviewedOverrides[slug].reason}`
          : "removed or not required; generated slab evidence is canonical",
      });
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
  Object.assign(collageEvidence, await rebuildCollages(result, sliverBySlug));
  await writeAudit(auditRows, counts, collageEvidence);

  console.log(
    `[jw-colors] wrote ${Object.keys(result).length} palettes; ` +
      `detected=${counts["detected-slab-core"]} center-safe=${counts["center-safe"]} ` +
      `hand=${counts["hand-safe-center"]} missing=${counts.missing}`
  );
}

await main();
