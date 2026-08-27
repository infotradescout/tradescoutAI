/**
 * Rebuild the original face-only material rail covers from a separately
 * restored, verified JW source-media checkout.
 * No outdoor mirror slabs as the first thing shoppers see.
 * This recovery/provenance tool is never part of the production build. Outputs
 * must be migrated through the pinned public-media manifest before release.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const outDir = "client/public/images/businesses/jw-stone/material-covers";
const previewDir = "tmp/material-cover-picks";
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(previewDir, { recursive: true });

const COVERS = [
  {
    id: "granite",
    // Honed/matte speckled face — not a polished mirror yard lead.
    src: "client/public/images/businesses/jw-stone/inventory-source/18BSjjnytEcHiaw-Q7llzo52STAUDUrUT.webp",
    box: { left: 0.22, top: 0.18, width: 0.56, height: 0.62 },
  },
  {
    id: "marble",
    // Mugla full slab — clamp-free; crop below top edge / yard chrome.
    src: "client/public/images/businesses/jw-stone/inventory-source/1yee6EBDuEx1nt7c90Rq7_YaLjH9fksyP.webp",
    box: { left: 0.22, top: 0.18, width: 0.56, height: 0.58 },
  },
  {
    id: "quartzite",
    src: "client/public/images/businesses/jw-stone/inventory-source/1ezrfvabq5YUy3X8wO9_oA0ZOiprbATtX.webp",
    box: { left: 0.22, top: 0.18, width: 0.56, height: 0.58 },
  },
  {
    id: "quartz",
    // Face fill below clamp / label — never portrait hand-scale siblings.
    src: "client/public/images/businesses/jw-stone/inventory-source/1XgEjSm_sihmCB7-VON9Ck8gw46ho2r5J.webp",
    box: { left: 0.18, top: 0.28, width: 0.64, height: 0.5 },
  },
  {
    id: "onyx",
    // Backlit face crop — no hands, no scale props.
    src: "client/public/images/businesses/jw-stone/inventory/onyx/honey-onyx/6.jpg",
    box: { left: 0.12, top: 0.28, width: 0.32, height: 0.48 },
  },
  {
    id: "soapstone",
    src: "client/public/images/businesses/jw-stone/inventory-source/1tlOUM3_xMx98ZjC3jlpDsWRu7-3Xb-d9.webp",
    box: { left: 0.28, top: 0.2, width: 0.44, height: 0.58 },
  },
  {
    id: "basalt",
    src: "client/public/images/businesses/jw-stone/inventory-source/1ZcGVAg76xGKbQ1l9v7kO64Qqf-Nt-U74.webp",
    box: { left: 0.24, top: 0.18, width: 0.52, height: 0.6 },
  },
];

for (const cover of COVERS) {
  if (!fs.existsSync(cover.src)) {
    // Fallbacks for missing preferred files
    const fallbacks = {
      marble: "client/public/images/businesses/jw-stone/inventory/marble/mugla/1.webp",
      quartzite: "client/public/images/businesses/jw-stone/inventory/quartzite/taj-mahal/4.webp",
      onyx: "client/public/images/businesses/jw-stone/inventory/onyx/honey-onyx/4.jpg",
    };
    const fb = fallbacks[cover.id];
    if (fb && fs.existsSync(fb)) {
      cover.src = fb;
      console.log(cover.id, "fallback ->", fb);
    } else {
      throw new Error(`Missing ${cover.id} source ${cover.src}`);
    }
  }

  const meta = await sharp(cover.src).metadata();
  const extract = {
    left: Math.round(cover.box.left * meta.width),
    top: Math.round(cover.box.top * meta.height),
    width: Math.round(cover.box.width * meta.width),
    height: Math.round(cover.box.height * meta.height),
  };
  extract.width = Math.min(extract.width, meta.width - extract.left);
  extract.height = Math.min(extract.height, meta.height - extract.top);

  const outPath = path.join(outDir, `${cover.id}.webp`);
  await sharp(cover.src)
    .extract(extract)
    .resize(1600, 900, { fit: "cover", position: "centre", kernel: "lanczos3" })
    .webp({ quality: 92, effort: 5 })
    .toFile(outPath);

  await sharp(outPath)
    .jpeg({ quality: 92 })
    .toFile(path.join(previewDir, `cover-${cover.id}.jpg`));

  console.log(cover.id, path.basename(cover.src), `${extract.width}x${extract.height}`);
}

console.log("wrote", COVERS.length, "material covers");
