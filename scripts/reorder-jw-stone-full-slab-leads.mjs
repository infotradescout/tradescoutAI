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

/**
 * Prefer these drive file ids as lead when present — filename scoring alone
 * still promotes hand/swatch shots that were saved without CLOSE in the name.
 */
const PREFERRED_LEAD_FILE_IDS = {
  "galaxy-white": "1o_wQm5dke5f0mnIXjslDs4Ai0XE6ttXA",
  "emperor-brown": "1UkwxC3a6LWlHkaUPZLKppFJT18s9f6oQ",
  "mexican-brown": null, // filled below after lookup
  "super-white": "1R9wC8J72zpDBdL31Zf4aMISigDudPaQy",
};

function normalizeName(sourceName = "") {
  return sourceName.toLowerCase().replace(/[_-]+/g, " ");
}

function isCloseUp(sourceName = "") {
  const name = normalizeName(sourceName);
  return /(close\s*up|closeup|close\s*look|\bclose\b|\bdetail\b|\btexture\b|\bswatch\b)/.test(
    name
  );
}

function slabCount(sourceName = "") {
  const name = normalizeName(sourceName);
  const match = name.match(/(\d+)\s*slabs?\b/);
  return match ? Number(match[1]) : 0;
}

function hasDimensions(sourceName = "") {
  return /\d+\s*[x×”"]\s*\d+/.test(normalizeName(sourceName));
}

function isFullSlabContext(sourceName = "") {
  const name = normalizeName(sourceName);
  if (isCloseUp(name)) return false;
  return /\b(slabs?|bundle|bundles|warehouse|yard|rack|standing)\b/.test(name) || hasDimensions(name);
}

function score(sourceName = "", preferredId = "", fileId = "") {
  const name = normalizeName(sourceName);
  let value = 0;
  if (preferredId && fileId === preferredId) value += 500;
  if (isCloseUp(name)) value -= 100;
  if (isFullSlabContext(name)) value += 50;
  if (/\b(warehouse|yard|rack|standing|full\s*size|full\s*slab)\b/.test(name)) value += 25;
  if (hasDimensions(name) && !isCloseUp(name)) value += 20;
  if (/\bslabs?\b/.test(name) && !isCloseUp(name)) value += 15;
  // Weak tie-breaker only — do not let a higher bundle count demote a clear full-slab lead.
  value += Math.min(slabCount(name), 8);
  return value;
}

// Resolve mexican-brown preferred id from inventory (non-close sibling)
for (const stone of inventory) {
  if (stone.slug !== "mexican-brown") continue;
  const alt = stone.sourceFileIds.find((id) => !isCloseUp(nameById.get(id) || ""));
  if (alt) PREFERRED_LEAD_FILE_IDS["mexican-brown"] = alt;
}

const examples = [];
let changed = 0;
let closeUpLeadBefore = 0;
let closeUpLeadAfter = 0;

for (const stone of inventory) {
  if (!Array.isArray(stone.sourceFileIds) || stone.sourceFileIds.length < 1) continue;

  const preferredId = PREFERRED_LEAD_FILE_IDS[stone.slug] || "";
  const ranked = stone.sourceFileIds.map((id, index) => {
    const name = nameById.get(id) || "";
    return { index, id, name, score: score(name, preferredId, id) };
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
  if (examples.length < 30) {
    examples.push({
      slug: stone.slug,
      before,
      after,
      beforeScore: score(before || "", preferredId, ranked[0]?.id || ""),
      afterScore: score(after || "", preferredId, stone.sourceFileIds[0] || ""),
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
