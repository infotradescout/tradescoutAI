/**
 * Build face-only vertical strips for Browse by color.
 * Hard-crop to stone surface only — no sky, clamps, hands, ground, gear, reflections of people.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const outDir = "client/public/images/businesses/jw-stone/color-collage";
const previewDir = "tmp/color-collage-face-preview";
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(previewDir, { recursive: true });

/** Normalized crop boxes: fractions of source width/height. */
const STRIPS = [
  {
    id: "01-white",
    alt: "White stone face",
    src: "client/public/images/businesses/jw-stone/inventory/quartzite/rhino-white/4.webp",
    box: { left: 0.22, top: 0.18, width: 0.56, height: 0.64 },
  },
  {
    id: "02-warm",
    alt: "Warm stone face",
    src: "client/public/images/businesses/jw-stone/inventory/quartzite/taj-mahal/4.webp",
    box: { left: 0.25, top: 0.2, width: 0.5, height: 0.6 },
  },
  {
    id: "03-gray",
    alt: "Gray stone face",
    src: "client/public/images/businesses/jw-stone/inventory/marble/grigio-fantasy/1.webp",
    box: { left: 0.34, top: 0.28, width: 0.32, height: 0.55 },
  },
  {
    id: "04-black",
    alt: "Black stone face",
    // Fantasy Black #2 — close face, no photographer reflection (Black Pearl reflects camera person).
    src: "client/public/images/businesses/jw-stone/inventory/granite/fantasy-black/2.webp",
    box: { left: 0.2, top: 0.12, width: 0.6, height: 0.55 },
  },
  {
    id: "05-brown",
    alt: "Brown gold stone face",
    src: "client/public/images/businesses/jw-stone/inventory/granite/arizona-gold/2.webp",
    // Keep well above the fingertip at the bottom-left of the source photo.
    box: { left: 0.28, top: 0.1, width: 0.48, height: 0.4 },
  },
  {
    id: "06-green",
    alt: "Green stone face",
    src: "client/public/images/businesses/jw-stone/inventory/quartzite/marbella-green/1.webp",
    box: { left: 0.32, top: 0.3, width: 0.36, height: 0.52 },
  },
  {
    id: "07-blue",
    alt: "Blue stone face",
    src: "client/public/images/businesses/jw-stone/inventory/granite/blue-goias/1.webp",
    box: { left: 0.15, top: 0.1, width: 0.7, height: 0.8 },
  },
  {
    id: "08-red",
    alt: "Red burgundy stone face",
    src: "client/public/images/businesses/jw-stone/first-cut/02.jpg",
    box: { left: 0.05, top: 0.28, width: 0.55, height: 0.6 },
  },
];

for (const strip of STRIPS) {
  if (!fs.existsSync(strip.src)) throw new Error(`Missing source ${strip.src}`);
  const meta = await sharp(strip.src).metadata();
  const W = meta.width;
  const H = meta.height;
  const extract = {
    left: Math.round(strip.box.left * W),
    top: Math.round(strip.box.top * H),
    width: Math.round(strip.box.width * W),
    height: Math.round(strip.box.height * H),
  };
  extract.width = Math.min(extract.width, W - extract.left);
  extract.height = Math.min(extract.height, H - extract.top);

  const outPath = path.join(outDir, `${strip.id}.webp`);
  await sharp(strip.src)
    .extract(extract)
    .resize(360, 960, { fit: "cover", position: "centre" })
    .webp({ quality: 88 })
    .toFile(outPath);

  await sharp(outPath)
    .jpeg({ quality: 90 })
    .toFile(path.join(previewDir, `${strip.id}.jpg`));

  console.log(strip.id, path.basename(strip.src), `${extract.width}x${extract.height}`);
}

console.log("wrote", STRIPS.length, "face strips to", outDir);
