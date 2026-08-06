import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const dir = "client/public/images/businesses/jw-stone/inventory/marble/alabama-rose";
for (const f of fs.readdirSync(dir).sort()) {
  const file = path.join(dir, f);
  // center strip crop like collage (tall thin)
  const meta = await sharp(file).metadata();
  const stripW = Math.floor(meta.width * 0.18);
  const left = Math.floor((meta.width - stripW) / 2);
  const { data, info } = await sharp(file)
    .extract({ left, top: 0, width: stripW, height: meta.height })
    .resize(40, 120, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0,
    g = 0,
    b = 0,
    n = info.width * info.height;
  let rosePx = 0;
  for (let i = 0; i < data.length; i += 3) {
    const rr = data[i],
      gg = data[i + 1],
      bb = data[i + 2];
    r += rr;
    g += gg;
    b += bb;
    if (rr > gg + 8 && rr > bb + 8 && rr > 90) rosePx++;
  }
  console.log(
    f,
    `avg rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`,
    `rosePx%${Math.round((rosePx / n) * 100)}`,
    `${meta.width}x${meta.height}`
  );
}

// also scan a few known warm/reddish names
const extras = [
  "marble/alabama-rose/3.webp",
  "marble/alabama-rose/5.webp",
  "marble/alabama-rose/7.webp",
  "onyx/honey-onyx/1.webp",
  "onyx/honey-onyx/2.jpg",
  "granite/blue-goias/1.webp",
  "quartzite/blue-dream/1.webp",
  "granite/preto-sao-gabriel/1.webp",
  "marble/emperor-brown/1.webp",
  "marble/emperor-brown/2.webp",
  "quartzite/marbella-green/1.webp",
  "quartzite/marbella-green/2.webp",
];
console.log("---extras full cover---");
for (const rel of extras) {
  const file = path.resolve("client/public/images/businesses/jw-stone/inventory", rel);
  if (!fs.existsSync(file)) continue;
  const { data, info } = await sharp(file)
    .resize(48, 96, { fit: "cover", position: "centre" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0,
    g = 0,
    b = 0,
    n = info.width * info.height,
    rosePx = 0,
    bluePx = 0,
    darkPx = 0;
  for (let i = 0; i < data.length; i += 3) {
    const rr = data[i],
      gg = data[i + 1],
      bb = data[i + 2];
    r += rr;
    g += gg;
    b += bb;
    if (rr > gg + 10 && rr > bb + 10) rosePx++;
    if (bb > rr + 10 && bb > gg + 5) bluePx++;
    if (rr + gg + bb < 180) darkPx++;
  }
  console.log(
    rel,
    `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`,
    `rose${Math.round((rosePx / n) * 100)} blue${Math.round((bluePx / n) * 100)} dark${Math.round((darkPx / n) * 100)}`
  );
}
