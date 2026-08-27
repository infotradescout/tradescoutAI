import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  path.join(path.resolve(import.meta.dirname, "..", ".."), "runner.cjs")
);
const sharp = require("sharp");

const repoRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(repoRoot, "..");
const inventorySource = JSON.parse(
  fs.readFileSync(path.join(workspaceRoot, "jw_reconcile/source_unique.json"), "utf8")
);
const currentModule = fs.readFileSync(
  path.join(repoRoot, "client/src/data/jwStoneInventory.ts"),
  "utf8"
);
const assetSpecs = currentModule
  .match(/const ASSET_SPECS = `([\s\S]*?)`\.trim\(\);/)[1]
  .trim()
  .split("\n")
  .map((line) => line.split("|")[0].split("/")[1]);

const outputRoot = path.join(repoRoot, "client/public/images/businesses/jw-stone/inventory-source");
const dataOutput = path.join(repoRoot, "client/src/data/jwStoneInventory.generated.json");
const auditOutput = path.join(
  repoRoot,
  "docs/audits/data/jw-stone-image-reconciliation-2026-07-13.json"
);

// Three Honey Onyx source files are not browser-ready, but their approved
// conversions are already preserved in the versioned inventory tree. Keep the
// complete six-photo product set when this reconciliation script is rerun.
const supplementalPublishedImagesBySlug = {
  "honey-onyx": {
    images: [
      "/uploads/jw-stone/inventory/onyx/honey-onyx/2.jpg",
      "/uploads/jw-stone/inventory/onyx/honey-onyx/6.jpg",
      "/uploads/jw-stone/inventory/onyx/honey-onyx/1.webp",
      "/uploads/jw-stone/inventory/onyx/honey-onyx/3.jpg",
      "/uploads/jw-stone/inventory/onyx/honey-onyx/4.jpg",
      "/uploads/jw-stone/inventory/onyx/honey-onyx/5.jpg",
    ],
    sourceFileIds: [
      "1Kfn1NfVZwueiPoGrpteEjSdBm9WTIVIC",
      "1ldPDW2qNe82fjs33B-67cnwrz6k7jC5S",
      "189iSyURMwlxoeYfM1ksoLwgkJNSvFzCB",
      "1yJx_wc5icvkwJCU4r7weJtOvpWztrXK-",
      "1_9h4B1GmZNrClfPk3ehT72bt55OQN_-i",
      "1VzCA95gOYzhCA7CP6GaL9f73Ijv05QCf",
    ],
  },
};

const directCategoryByFolder = {
  Basalt: "basalt",
  Granite: "granite",
  Marble: "marble",
  Onyx: "onyx",
  Quartz: "quartz",
  Quartzite: "quartzite",
  Soapstone: "soapstone",
};

const aliases = [
  [/\bmatrixbasalt\b/, "matrix-basalt"],
  [/\bcarrara white brazil\b/, "carrara-white-brazil-119x75"],
  [/\bbianco carrara\b|\bbianco cararra\b/, "bianco-carrara"],
  [/\bquartz from aj 1\b/, "aj-quartz-1"],
  [/\bquartz aj 4\b/, "aj-quartz-4"],
  [/\bquartz from aj 5\b/, "aj-quartz-5"],
  [/\bcalacatta macchia\b/, "calacatta-macchia"],
  [/\bmatarazzo zucchi\b/, "matarazzo-zucchi"],
  [/\bmarina black soapstone\b/, "marina-black-soapstone"],
  [/\bfusion blue\b/, "fusion-blue"],
  [/\bsuperiore\b/, "superiore"],
  [/\bcristallp\b|\bcrystalo\b/, "cristallo"],
  [/\btajmahal\b|\btak mahal\b/, "taj-mahal"],
  [/\bcherrokee\b/, "cherokee-marble"],
  [/\bshadow storm\b/, "shadow-storm"],
  [/\ba j quartz\b/, "aj-quartz"],
  [/\bfusion yellon\b/, "fusion-yellow"],
  [/\bwhite santorine\b/, "white-santorini"],
  [/\bsoap stone\b/, "soapstone-117x70"],
  [/\bstell gray\b/, "steel-gray"],
  [/\bvalle nevada\b/, "valle-nevada-luna-pearl"],
  [/\bversarce\b/, "versace"],
  [/\bbeverley blue\b/, "beverly-blue"],
];

const displayNames = {
  "aj-quartz": "AJ Quartz",
  "aj-quartz-1": "AJ Quartz 1",
  "aj-quartz-4": "AJ Quartz 4",
  "aj-quartz-5": "AJ Quartz 5",
  "bianco-carrara": "Bianco Carrara",
  "bianco-superiory": "Bianco Superior",
  "calacatta-dor": "Calacatta D'Or",
  "carrara-white-brazil-119x75": "Carrara White Brazil",
  "cristal-2cm-united": "Cristal",
  "galaxy-white": "White Galaxy",
  "giallo-ornamental": "Giallo Ornamental",
  "jaguar-leather": "Jaguar",
  "kolkata-vegi-marble": "Kolkata Vegi",
  "marina-black-soapstone": "Marina Black Soapstone",
  "matrix-basalt": "Matrix Basalt",
  "nilo-river": "Nilo River",
  panda: "Panda White",
  "preto-sao-gabriel": "Preto Sao Gabriel",
  "rhino-white": "White Rhino",
  "soapstone-117x70": "Soapstone",
  superiore: "Superiore",
  "titanium-black-leathered": "Titanium Black",
  "valle-nevada-luna-pearl": "Valle Nevada (Luna Pearl)",
  "zucci-marble": "Zucci",
};

function normalize(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleFromSlug(slug) {
  return (
    displayNames[slug] ||
    slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

function identifyStone(sourceName, folder) {
  const normalized = normalize(sourceName);
  if (folder === "Onyx" && normalized.startsWith("copy of whatsapp image 2025 08 20")) {
    return "honey-onyx";
  }
  for (const [pattern, slug] of aliases) {
    if (pattern.test(normalized)) return slug;
  }
  const padded = ` ${normalized} `;
  let best = null;
  for (const slug of assetSpecs) {
    const tokens = normalize(slug).split(" ");
    if (!tokens.every((token) => padded.includes(` ${token} `))) continue;
    const score = tokens.length * 100 + slug.length;
    if (!best || score > best.score) best = { slug, score };
  }
  return best?.slug || null;
}

const identified = inventorySource.map((source) => ({
  ...source,
  slug: identifyStone(source.sourceName, source.folder),
}));

// A named stone only enters a material collection when at least one source image
// for that same stone lives in exactly one authoritative material folder.
const categoryEvidence = new Map();
for (const item of identified) {
  if (!item.slug || !directCategoryByFolder[item.folder]) continue;
  const evidence = categoryEvidence.get(item.slug) || new Set();
  evidence.add(directCategoryByFolder[item.folder]);
  categoryEvidence.set(item.slug, evidence);
}

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

const usable = [];
const rejected = [];
for (let index = 0; index < identified.length; index += 1) {
  const item = identified[index];
  const input = path.join(workspaceRoot, "jw_source_images", `${item.driveFileId}.${item.ext}`);
  const relativeImage = `/uploads/jw-stone/inventory-source/${item.driveFileId}.webp`;
  try {
    await sharp(input)
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90, effort: 5 })
      .toFile(path.join(outputRoot, `${item.driveFileId}.webp`));
    usable.push({ ...item, image: relativeImage });
  } catch (error) {
    rejected.push({
      driveFileId: item.driveFileId,
      sourceName: item.sourceName,
      folder: item.folder,
      reason: error.message,
    });
  }
  if ((index + 1) % 25 === 0 || index + 1 === identified.length) {
    console.log(`Optimized ${index + 1}/${identified.length}`);
  }
}

const groups = new Map();
const trendingUnidentified = [];
for (const item of usable) {
  if (!item.slug) {
    trendingUnidentified.push(item);
    continue;
  }
  const evidence = categoryEvidence.get(item.slug);
  const categorySlug = evidence?.size === 1 ? [...evidence][0] : "unconfirmed";
  const key = `${categorySlug}/${item.slug}`;
  const group = groups.get(key) || {
    categorySlug,
    name: titleFromSlug(item.slug),
    slug: item.slug,
    images: [],
    sourceFolders: new Set(),
    sourceFileIds: [],
  };
  group.images.push(item.image);
  group.sourceFolders.add(item.folder);
  group.sourceFileIds.push(item.driveFileId);
  groups.set(key, group);
}

// Unnamed, generic, or ambiguous files remain visible without inventing a stone
// or material assignment. Small batches keep the catalog usable on mobile.
for (let index = 0; index < trendingUnidentified.length; index += 8) {
  const batch = trendingUnidentified.slice(index, index + 8);
  const number = String(index / 8 + 1).padStart(2, "0");
  groups.set(`unconfirmed/trending-selection-${number}`, {
    categorySlug: "unconfirmed",
    name: `Trending Selection ${number}`,
    slug: `trending-selection-${number}`,
    images: batch.map((item) => item.image),
    sourceFolders: new Set(batch.map((item) => item.folder)),
    sourceFileIds: batch.map((item) => item.driveFileId),
  });
}

for (const group of groups.values()) {
  const supplemental = supplementalPublishedImagesBySlug[group.slug];
  if (!supplemental) continue;
  group.images = supplemental.images;
  group.sourceFileIds = supplemental.sourceFileIds;
}

const catalog = [...groups.values()]
  .map((group) => ({
    ...group,
    sourceFolders: [...group.sourceFolders].sort(),
  }))
  .sort((a, b) => a.categorySlug.localeCompare(b.categorySlug) || a.name.localeCompare(b.name));

fs.writeFileSync(dataOutput, `${JSON.stringify(catalog, null, 2)}\n`);
fs.writeFileSync(
  auditOutput,
  `${JSON.stringify(
    {
      capturedOn: "2026-07-13",
      sourceFileRecords: 515,
      browserReadySourceRecords: 497,
      uniqueBrowserReadyCandidates: inventorySource.length,
      publishedUsableImages: usable.length,
      rejectedBrowserReadyImages: rejected,
      nonBrowserReadyImages: { heif: 14, dng: 1 },
      sourceVideos: 3,
      catalogGroups: catalog.map((group) => ({
        categorySlug: group.categorySlug,
        name: group.name,
        slug: group.slug,
        imageCount: group.images.length,
        sourceFolders: group.sourceFolders,
        sourceFileIds: group.sourceFileIds,
      })),
    },
    null,
    2
  )}\n`
);

console.log(
  JSON.stringify({
    usableImages: usable.length,
    rejectedImages: rejected.length,
    groups: catalog.length,
    trendingImages: catalog
      .filter((group) => group.categorySlug === "unconfirmed")
      .reduce((sum, group) => sum + group.images.length, 0),
  })
);