/**
 * Build face-only vertical strips for Browse by color.
 * Hard-crop to stone surface only — no sky, clamps, hands, ground, gear, reflections of people.
 *
 * Outputs ~900×2400 @ webp q92 so full-bleed collage bands stay sharp on desktop.
 * Prefer inventory-source (≤1600px) over nested inventory/** (often 1000px).
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const outDir = "client/public/images/businesses/jw-stone/color-collage";
const previewDir = "tmp/color-collage-face-preview";
const OUT_W = 900;
const OUT_H = 2400;
const WEBP_QUALITY = 92;

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(previewDir, { recursive: true });

/** Normalized crop boxes: fractions of source width/height. */
const STRIPS = [
  {
    id: "01-white",
    alt: "White stone face",
    // Alabama White face with visible gray veining; crop stays left of the clamp.
    src: "client/public/images/businesses/jw-stone/inventory-source/1pRla8GWSa3dSbWTtgTsrytcJMb8D0Qso.webp",
    box: { left: 0.05, top: 0.18, width: 0.3, height: 0.65 },
  },
  {
    id: "02-warm",
    alt: "Beige stone face",
    // Cristallo face reads unmistakably cream/beige; side crop avoids the clamp.
    src: "client/public/images/businesses/jw-stone/inventory-source/1D8bvWASTFtKs4ri4KK553drHwWXeAzxQ.webp",
    box: { left: 0.08, top: 0.18, width: 0.32, height: 0.68 },
  },
  {
    id: "03-gray",
    alt: "Gray stone face",
    // Steel Gray edge crop stays clear of the hand while remaining distinct from Black.
    src: "client/public/images/businesses/jw-stone/inventory-source/1UDe57h8Vq_IpmDKm9JvV-1jEdrc7TMKW.webp",
    box: { left: 0.02, top: 0.1, width: 0.18, height: 0.75 },
  },
  {
    id: "04-black",
    alt: "Black stone face",
    // Preto Sao Gabriel — near-solid black surface, below the clamp.
    src: "client/public/images/businesses/jw-stone/inventory-source/1uJRgq-Ds5tUtASBGdpn5YHKQ-R0H0gLh.webp",
    box: { left: 0.18, top: 0.28, width: 0.64, height: 0.58 },
  },
  {
    id: "05-brown",
    alt: "Brown stone face",
    src: "client/public/images/businesses/jw-stone/inventory-source/1UkwxC3a6LWlHkaUPZLKppFJT18s9f6oQ.webp",
    box: { left: 0.08, top: 0.3, width: 0.32, height: 0.52 },
  },
  {
    id: "09-gold",
    alt: "Gold stone face",
    src: "client/public/images/businesses/jw-stone/inventory-source/1AanF14cJoQLShcrHgHAIMAWX21qpfZUn.webp",
    box: { left: 0.08, top: 0.06, width: 0.84, height: 0.88 },
  },
  {
    id: "06-green",
    alt: "Green stone face",
    src: "client/public/images/businesses/jw-stone/inventory-source/1qQNSzUB6ObrUq6oadLxqKn_JxWRpSH2a.webp",
    box: { left: 0.32, top: 0.3, width: 0.36, height: 0.52 },
  },
  {
    id: "07-blue",
    alt: "Blue stone face",
    src: "client/public/images/businesses/jw-stone/inventory-source/19PB3hiee2ils34FffQnjFS0SvcR9fX16.webp",
    box: { left: 0.15, top: 0.1, width: 0.7, height: 0.8 },
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
    .resize(OUT_W, OUT_H, { fit: "cover", position: "centre", kernel: "lanczos3" })
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toFile(outPath);

  await sharp(outPath)
    .jpeg({ quality: 92 })
    .toFile(path.join(previewDir, `${strip.id}.jpg`));

  const outStat = fs.statSync(outPath);
  console.log(
    strip.id,
    path.basename(strip.src),
    `crop ${extract.width}x${extract.height}`,
    `-> ${OUT_W}x${OUT_H}`,
    `${Math.round(outStat.size / 1024)}KB`,
  );
}

console.log("wrote", STRIPS.length, "face strips to", outDir);
