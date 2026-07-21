import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const drivePath = path.join(
  repoRoot,
  "docs/audits/data/jw-stone-drive-source-2026-07-13.json"
);
const inventoryPath = path.join(
  repoRoot,
  "client/src/data/jwStoneInventory.generated.json"
);

const drive = JSON.parse(fs.readFileSync(drivePath, "utf8"));
const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const nameById = new Map(drive.files.map((file) => [file.driveFileId, file.sourceName]));

function normalizeName(sourceName = "") {
  return sourceName.toLowerCase().replace(/[_-]+/g, " ");
}

function isCloseUp(sourceName = "") {
  const name = normalizeName(sourceName);
  return /(close\s*up|closeup|close\s*look|scloseup|\bdetail\b|\btexture\b)/.test(name);
}

function isFullSlabContext(sourceName = "") {
  const name = normalizeName(sourceName);
  if (isCloseUp(name)) return false;
  return /\b(slabs?|bundle|bundles|warehouse|yard|rack)\b/.test(name);
}

function score(sourceName = "") {
  const name = normalizeName(sourceName);
  let value = 0;
  if (isCloseUp(name)) value -= 100;
  if (isFullSlabContext(name)) value += 50;
  if (/\b(warehouse|yard|rack|standing|full)\b/.test(name)) value += 20;
  if (/\d+\s*[x×]\s*\d+/.test(name) && /\bslabs?\b/.test(name) && !isCloseUp(name)) {
    value += 15;
  }
  return value;
}

const examples = [];
let changed = 0;
let closeUpLeadBefore = 0;
let closeUpLeadAfter = 0;

for (const stone of inventory) {
  if (!Array.isArray(stone.sourceFileIds) || stone.sourceFileIds.length < 2) continue;

  const ranked = stone.sourceFileIds.map((id, index) => {
    const name = nameById.get(id) || "";
    return { index, id, name, score: score(name) };
  });

  if (isCloseUp(ranked[0]?.name)) closeUpLeadBefore += 1;

  const sorted = [...ranked].sort((a, b) => b.score - a.score || a.index - b.index);
  if (isCloseUp(sorted[0]?.name)) closeUpLeadAfter += 1;

  if (sorted.every((entry, index) => entry.index === ranked[index].index)) continue;

  const permutation = sorted.map((entry) => entry.index);
  const reorder = (values) =>
    Array.isArray(values) && values.length === permutation.length
      ? permutation.map((index) => values[index])
      : values;

  const before = ranked[0]?.name || null;
  stone.images = reorder(stone.images);
  stone.sourceFileIds = reorder(stone.sourceFileIds);
  stone.slabCounts = reorder(stone.slabCounts);
  const after = nameById.get(stone.sourceFileIds[0]) || null;
  changed += 1;
  if (examples.length < 20) {
    examples.push({
      slug: stone.slug,
      before,
      after,
      beforeScore: score(before || ""),
      afterScore: score(after || ""),
    });
  }
}

fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      changed,
      closeUpLeadBefore,
      closeUpLeadAfter,
      examples,
    },
    null,
    2
  )
);
