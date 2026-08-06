import sharp from "sharp";
import path from "node:path";

const picks = [
  "granite/blue-bahia/1.webp",
  "quartzite/blue-dream/1.webp",
  "quartzite/fusion-blue/1.webp",
  "quartzite/beverly-blue/1.webp",
  "granite/juparana-blue/1.webp",
  "quartzite/blue-mare/1.webp",
  "granite/blue-fantasy/1.webp",
  "marble/alabama-rose/1.webp",
  "granite/black-pearl/1.webp",
  "granite/fantasy-black/1.webp",
  "granite/preto-sao-gabriel/1.webp",
  "quartzite/black-dunes/1.webp",
  "marble/venta-black/1.webp",
  "quartzite/steel-gray/1.webp",
  "marble/chocolate-brown/1.webp",
  "quartzite/taj-mahal/1.webp",
  "granite/arizona-gold/1.webp",
  "marble/aspen-white/1.webp",
  "quartzite/amazonic-green/1.webp",
  "quartzite/marbella-green/1.webp",
  "granite/giallo-ornamental/1.webp",
  "quartzite/fusion-brown/1.webp",
  "granite/picasso/1.webp",
];

for (const rel of picks) {
  const file = path.resolve("client/public/images/businesses/jw-stone/inventory", rel);
  const { data, info } = await sharp(file)
    .resize(64, 64, { fit: "cover" })
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
  const hueHint =
    max === min
      ? "gray"
      : max === r && r > g && r > b
        ? "red-ish"
        : max === b && b >= g
          ? "blue-ish"
          : max === g
            ? "green-ish"
            : r >= g && g >= b
              ? "warm"
              : "mixed";
  console.log(
    rel.padEnd(40),
    `rgb(${String(r).padStart(3)},${String(g).padStart(3)},${String(b).padStart(3)})`,
    `sat${String(sat).padStart(2)}`,
    hueHint
  );
}
