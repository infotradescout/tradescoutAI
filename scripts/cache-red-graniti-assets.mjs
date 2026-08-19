#!/usr/bin/env node

/**
 * Cache the official R.E.D. Graniti images used by the dedicated company
 * profile. The TradeScout page intentionally follows the structure and visual
 * language of R.E.D. Graniti's existing website, but serves the images from
 * TradeScout's own origin so CSP, hotlinking, and source-host outages cannot
 * leave the public profile blank.
 *
 * A labeled fallback SVG is written when an outside image is temporarily
 * unavailable. The build therefore remains deterministic and never publishes
 * an empty image frame.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = resolve(
  __dirname,
  "../client/public/images/businesses/red-graniti/source"
);

const ASSETS = [
  {
    id: "home-hero",
    label: "R.E.D. Graniti natural stone quarry",
    sourceUrl:
      "https://www.redgraniti.com/wp-content/uploads/2018/06/lemurian-blue-1.jpg",
    outputFile: "home-hero.svg",
    accent: "#453433",
  },
  {
    id: "business-blocks",
    label: "R.E.D. Graniti rough blocks",
    sourceUrl:
      "https://www.redgraniti.com/wp-content/uploads/2016/05/blocchi-grezzi.png",
    outputFile: "business-blocks.svg",
    accent: "#6f4e43",
  },
  {
    id: "business-slabs",
    label: "R.E.D. Graniti natural stone slabs",
    sourceUrl: "https://www.redgraniti.com/wp-content/uploads/2016/05/lastre.png",
    outputFile: "business-slabs.svg",
    accent: "#8e8178",
  },
  {
    id: "business-distribution",
    label: "R.E.D. Graniti worldwide distribution",
    sourceUrl:
      "https://www.redgraniti.com/wp-content/uploads/2016/05/commercializzazione.png",
    outputFile: "business-distribution.svg",
    accent: "#675853",
  },
  {
    id: "lemurian-blue",
    label: "Madagascar labradorite source region",
    sourceUrl:
      "https://www.redgraniti.com/wp-content/uploads/2018/06/lemurian-blue-1.jpg",
    outputFile: "lemurian-blue.svg",
    accent: "#38606f",
  },
  {
    id: "nero-africa",
    label: "South Africa black granite source region",
    sourceUrl:
      "https://www.redgraniti.com/wp-content/uploads/2018/06/nero-africa-1.jpg",
    outputFile: "nero-africa.svg",
    accent: "#5b514b",
  },
  {
    id: "eureka-danby",
    label: "Vermont Danby marble source region",
    sourceUrl:
      "https://www.redgraniti.com/wp-content/uploads/2018/06/eureka-danby-1.jpg",
    outputFile: "eureka-danby.svg",
    accent: "#aaa39a",
  },
  {
    id: "project-arkansas-office",
    label: "The Arkansas Office project",
    sourceUrl:
      "https://www.redgraniti.com/wp-content/uploads/2017/08/ark-off-01.jpg",
    outputFile: "project-arkansas-office.svg",
    accent: "#7b6a60",
  },
  {
    id: "project-colorado-bank",
    label: "Colorado National Bank Building project",
    sourceUrl:
      "https://www.redgraniti.com/wp-content/uploads/2018/08/colorado-national-bank-building.jpg",
    outputFile: "project-colorado-bank.svg",
    accent: "#847970",
  },
  {
    id: "project-lincoln-memorial",
    label: "Lincoln Memorial project",
    sourceUrl:
      "https://www.redgraniti.com/wp-content/uploads/2018/08/LincolnMemorialWashington.jpg",
    outputFile: "project-lincoln-memorial.svg",
    accent: "#aca59b",
  },
  {
    id: "project-mansion-dubai",
    label: "Mansion in Dubai project",
    sourceUrl:
      "https://www.redgraniti.com/wp-content/uploads/2018/08/MansioninDubai.jpg",
    outputFile: "project-mansion-dubai.svg",
    accent: "#9a836d",
  },
];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrappedSourceSvg({ dataUri, label }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="${escapeXml(label)}">
  <title>${escapeXml(label)}</title>
  <rect width="1600" height="1000" fill="#171313"/>
  <image href="${dataUri}" width="1600" height="1000" preserveAspectRatio="xMidYMid slice"/>
</svg>
`;
}

function fallbackSourceSvg({ label, accent }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="${escapeXml(label)}">
  <title>${escapeXml(label)}</title>
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#171313"/>
      <stop offset="0.58" stop-color="${accent}"/>
      <stop offset="1" stop-color="#0d0b0b"/>
    </linearGradient>
    <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f2eee8"/>
      <stop offset="0.42" stop-color="#b8aea4"/>
      <stop offset="1" stop-color="#625852"/>
    </linearGradient>
    <filter id="grain" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="17" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0" result="mono"/>
      <feBlend in="SourceGraphic" in2="mono" mode="soft-light"/>
    </filter>
  </defs>
  <rect width="1600" height="1000" fill="url(#sky)"/>
  <path d="M0 640 L210 390 L390 515 L610 260 L820 500 L1010 295 L1240 480 L1420 330 L1600 500 L1600 1000 L0 1000 Z" fill="#211c1c" opacity="0.84"/>
  <path d="M0 760 L250 565 L480 690 L760 420 L1040 685 L1310 500 L1600 660 L1600 1000 L0 1000 Z" fill="url(#stone)" filter="url(#grain)"/>
  <g opacity="0.86" filter="url(#grain)">
    <rect x="170" y="650" width="305" height="210" rx="8" fill="#c9c0b8" transform="rotate(-4 170 650)"/>
    <rect x="515" y="610" width="360" height="245" rx="8" fill="#8e827a" transform="rotate(3 515 610)"/>
    <rect x="920" y="640" width="285" height="205" rx="8" fill="#d8d0c9" transform="rotate(-2 920 640)"/>
    <rect x="1230" y="600" width="245" height="230" rx="8" fill="#756a64" transform="rotate(4 1230 600)"/>
  </g>
  <rect y="835" width="1600" height="165" fill="#120f0f" opacity="0.76"/>
  <text x="82" y="912" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" letter-spacing="3">R.E.D. GRANITI</text>
  <text x="82" y="956" fill="#ffffff" opacity="0.72" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="1.5">${escapeXml(label).toUpperCase()}</text>
</svg>
`;
}

async function cacheAsset(asset) {
  const outputPath = resolve(OUTPUT_DIR, asset.outputFile);
  try {
    const response = await fetch(asset.sourceUrl, {
      headers: {
        "user-agent":
          "TradeScout production asset cache/1.0 (+https://www.thetradescout.com/u/red-graniti)",
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const contentType = String(response.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new Error(`unexpected content type ${contentType || "unknown"}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 512) {
      throw new Error(`image response was only ${bytes.length} bytes`);
    }
    const dataUri = `data:${contentType};base64,${bytes.toString("base64")}`;
    await writeFile(outputPath, wrappedSourceSvg({ dataUri, label: asset.label }), "utf8");
    console.log(
      `[red-graniti-assets] cached ${asset.id} from official source (${bytes.length} bytes)`
    );
  } catch (error) {
    await writeFile(
      outputPath,
      fallbackSourceSvg({ label: asset.label, accent: asset.accent }),
      "utf8"
    );
    console.warn(
      `[red-graniti-assets] official image unavailable for ${asset.id}; wrote branded fallback: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

await mkdir(OUTPUT_DIR, { recursive: true });
await Promise.all(ASSETS.map(cacheAsset));
