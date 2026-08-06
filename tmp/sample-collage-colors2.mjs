import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

async function sample(file) {
  const { data, info } = await sharp(file)
    .resize(80, 80, { fit: "cover", position: "centre" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0;
  let g = 0;
  let b = 0;
  const n = info.width * info.height;
  for (let i = 0; i < data.length; i += 3) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  r = Math.round(r / n);
  g = Math.round(g / n);
  b = Math.round(b / n);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : Math.round(((max - min) / max) * 100);
  return { r, g, b, sat, redBias: r - Math.max(g, b) };
}

const dirs = [
  "marble/alabama-rose",
  "onyx/honey-onyx",
  "marble/calacatta-gold",
  "granite/preto-sao-gabriel",
  "granite/fantasy-black",
  "granite/black-pearl",
  "quartzite/blue-dream",
  "quartzite/blue-deep",
  "granite/blue-goias",
  "marble/emerald-pearl",
  "quartzite/marbella-green",
  "quartzite/amazonic-green",
  "granite/arizona-gold",
  "quartzite/taj-mahal",
  "marble/aspen-white",
  "quartzite/rhino-white",
  "quartzite/steel-gray",
  "marble/chocolate-brown",
  "marble/mexican-brown",
  "marble/emperor-brown",
];

for (const rel of dirs) {
  const dir = path.resolve("client/public/images/businesses/jw-stone/inventory", rel);
  if (!fs.existsSync(dir)) {
    console.log("MISSING", rel);
    continue;
  }
  const files = fs.readdirSync(dir).filter((f) => /\.(webp|jpe?g|png)$/i.test(f));
  let best = null;
  for (const f of files) {
    const s = await sample(path.join(dir, f));
    const row = { file: f, ...s };
    if (
      !best ||
      (rel.includes("alabama") || rel.includes("honey") || rel.includes("gold")
        ? row.redBias > best.redBias
        : rel.includes("blue")
          ? row.b - Math.max(row.r, row.g) > best.b - Math.max(best.r, best.g)
          : rel.includes("black") || rel.includes("preto")
            ? row.r + row.g + row.b < best.r + best.g + best.b
            : row.sat > best.sat)
    ) {
      best = row;
    }
  }
  console.log(
    rel.padEnd(32),
    String(files.length).padStart(2),
    "imgs best",
    best.file.padEnd(8),
    `rgb(${best.r},${best.g},${best.b})`,
    `sat${best.sat}`,
    `redBias${best.redBias}`
  );
}
