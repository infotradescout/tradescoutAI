import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const drivePath = path.join(repoRoot, "docs/audits/data/jw-stone-drive-source-2026-07-13.json");
const inventoryPath = path.join(repoRoot, "client/src/data/jwStoneInventory.generated.json");
const sourceNamesPath = path.join(repoRoot, "client/src/data/jwStoneSourceNames.generated.json");

const drive = JSON.parse(fs.readFileSync(drivePath, "utf8"));
const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const sourceNames = JSON.parse(fs.readFileSync(sourceNamesPath, "utf8"));
const nameById = new Map([
  ...drive.files.map((file) => [file.driveFileId, file.sourceName]),
  ...Object.entries(sourceNames),
]);
const driveOrderById = new Map(drive.files.map((file, index) => [file.driveFileId, index]));

// Share URLs existed before presentation-order ranking. Keep their photo
// ordinals tied to the pre-ranking Drive order so a lead-image improvement
// cannot silently make an existing `photo=N` URL point at another asset.
// Taj Mahal intentionally promoted its second Drive photo before the general
// full-slab ranking landed, so that one baseline lead is preserved explicitly.
const BASELINE_SHARE_LEAD_FILE_IDS = {
  "taj-mahal": "1WhkGLRxAOoWKJhaZznwf-Z9ER9wV5M-b",
};

/**
 * Prefer these drive file ids as lead when present — filename scoring alone
 * still promotes hand/swatch shots that were saved without CLOSE in the name.
 * Keep in sync with client/src/features/jw-stone/coverImages.ts.
 */
const PREFERRED_LEAD_FILE_IDS = {
  "aj-quartz-1": "1GhcyanNTSKcFuVXN3pAggbI-XYAmjx2u",
  "aj-quartz-4": "1V6D5-zXjoklqYg6au4tnAzUiGXeBW7Wc",
  "aj-quartz-5": "1pgK_FzwRM6E5K-1zz6xBrBS2KSBiTEuH",
  "bianco-carrara": "1BoLQprq014WBrpdxTyYU5LErye7D5O0U",
  "carrara-white-brazil-119x75": "13WKoBmd2quSG2-YTG9EpPHFkAHDDoAN1",
  "calacatta-cremo": "12ULnXkUBeSW7ViTBbAA8Wx5rFaPK2T_J",
  "calacatta-macchia": "1vDIoTtWdOceQ1IzY9u2vAl_knKGWJjxu",
  "matarazzo-zucchi": "1pVej6DwGpib3soV3YgLDv-v_X8XEIB4h",
  "marina-black-soapstone": "1tlOUM3_xMx98ZjC3jlpDsWRu7-3Xb-d9",
  "fusion-blue": "1opCWnnzl2Eba_qdW54RvF7B4jn-XD4PB",
  "perla-venata": "1ziFDFgSGEpCpx4dpI-YzlAGXuk69W3rk",
  superiore: "1M-2UdrtDBUyNDhZswqST_VjV5RvN9Zbo",
  "galaxy-white": "1g58rJny4wbYKb-V8z1rug_hCUEcb7DeO",
  "emperor-brown": "1UkwxC3a6LWlHkaUPZLKppFJT18s9f6oQ",
  "mexican-brown": null, // filled below after lookup
  "super-white": "1R9wC8J72zpDBdL31Zf4aMISigDudPaQy",
  "juparana-blue": "1D9v9nEKAm5BCDuSlzYpdn9PwOi0nkjKs",
  "beverly-blue": "1BHaSAxN9B8CbNN9gaKiK2F_HJ-GAyRVy",
  "bianco-superiory": "1-1U8FEyCh3N2_DOxRhNKT_lUW72Jh_RQ",
  "calacatta-amala": "1-8YRVJ9x4_lEyoLWh7RpAY0oFPbJHcFa",
  "fusion-brown": "1-uLJ9IFKldBW-UFnESx2UJ4WdOuAACUv",
  picasso: "17_4UcZBVch7I4OLgVFXx0Zc52KXBUDNu",
  bronzonite: "1_mX4CB3IZ9E9OgMkVyqU90bDQx61vFvJ",
  "shadow-storm": "1yuISE53-4yMFdH_4ElUlxi1y7QHmaCa8",
};

function normalizeName(sourceName = "") {
  return sourceName.toLowerCase().replace(/[_-]+/g, " ");
}

function isPhoneDump(sourceName = "") {
  const compact = normalizeName(sourceName).replace(/\s+/g, "");
  return (
    /^(img_?\d+|dsc_?\d+|photo\d+|pxl_?\d+|heic)/i.test(compact) || /\.heic$/i.test(sourceName)
  );
}

function isCloseUp(sourceName = "") {
  const name = normalizeName(sourceName);
  return /(close\s*up|closeup|close\s*look|\bclose\b|\bdetail\b|\btexture\b|\bswatch\b|scloseup|\bsample\b|\bthumb\b|\bhand\b|\bhands\b|\bholding\b)/.test(
    name
  );
}

/** Hand-on-stone / sample-scale photos — keep in sync with coverImages.ts */
const HAND_COVER_FILE_IDS = new Set([
  "1UDe57h8Vq_IpmDKm9JvV-1jEdrc7TMKW",
  "1fqDCQbCGOI4ieLt5899s8XYZv3OlhJp6",
  "18gmBQeXMlJVXkyVR8CYZcr7S19YLnIvM",
  "1M2IO3m_dOI-OMPWbTE8Y4JgtLZaAVYnD",
  "11ax9DfAdp_SjHdkX2sTHMGu-NVFEGwru",
  "1o_wQm5dke5f0mnIXjslDs4Ai0XE6ttXA",
  "1_SEkFjSzvYBgRoP1PR0_YMJEkv5T9t6z",
  "1BrnNoAJ7X3z5lXuKwKZCPX17Y7G7rg-p",
  "1lfVGyu3oVXcdaAb6amxkgSJBB_w1Rh36",
  "1Sj9EjHRqjwVqTqi5bFZTrjdwMRhIm7ul",
  "1ApF2R6Pbn8aWYpXNHD7VNlJwsFlBsIP4",
  "1Xa7SrSqU8QkEQ2loN5e0MJAiBwqh5d7d",
  "112yUwIti-kOjZj7MZD9O_IRRRMO65hUT",
  "15V13zBDRJlRIWJPRHNwyEEhBj5YFRo7m",
  "1n3tCkEbpG8cwAZqp3rsULP5Npm0fYptH",
  "1aiC_duaWb8dY1HHKkGeK9UjbUMRqnPY0",
  "11_8FYGX-hKzb7MMljH8LGukCR6ofFcaz",
  "1_jxbwi-xAV-_3Zs2ivWlzwNXFnyRgRxL",
  "101ftcLyGe6pWSzuCPcrs94AanpuG5Dnb",
  "1POZ36aWL-ASV2uQSMS_5w11Q22X5nQgY",
  "130CuUhmYEbsQwGynnQ8R6lDIW34E9qKc",
  "1XHgYqAJR548-hOlxH8rx7oCQ8q8feIRP",
  "1sD8kGUwsGE5tymxjMEr6QPEFP9TlRorr",
]);

function isHandScale(fileId = "", sourceName = "") {
  // Phone dumps are score-demoted only — some PHOTO-* files are full slabs.
  return HAND_COVER_FILE_IDS.has(fileId) || isCloseUp(sourceName);
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
  if (isCloseUp(name) || isPhoneDump(sourceName)) return false;
  return (
    /\b(slabs?|bundle|bundles|warehouse|yard|rack|standing)\b/.test(name) || hasDimensions(name)
  );
}

function score(sourceName = "", preferredId = "", fileId = "") {
  const name = normalizeName(sourceName);
  let value = 0;
  const preferredUsable =
    preferredId &&
    !HAND_COVER_FILE_IDS.has(preferredId) &&
    !isCloseUp(nameById.get(preferredId) || "") &&
    !isPhoneDump(nameById.get(preferredId) || "");
  if (preferredUsable && fileId === preferredId) value += 500;
  if (HAND_COVER_FILE_IDS.has(fileId)) value -= 250;
  if (isPhoneDump(sourceName)) value -= 180;
  if (isCloseUp(name)) value -= 100;
  if (isFullSlabContext(sourceName)) value += 50;
  if (/\b(warehouse|yard|rack|standing|full\s*size|full\s*slab)\b/.test(name)) value += 25;
  if (hasDimensions(name) && !isCloseUp(name) && !isPhoneDump(sourceName)) value += 20;
  if (/\bslabs?\b/.test(name) && !isCloseUp(name) && !isPhoneDump(sourceName)) value += 15;
  // Weak tie-breaker only — do not let a higher bundle count demote a clear full-slab lead.
  value += Math.min(slabCount(name), 8);
  return value;
}

// Resolve mexican-brown preferred id from inventory (non-close sibling)
for (const stone of inventory) {
  if (stone.slug !== "mexican-brown") continue;
  const alt = stone.sourceFileIds.find((id) => !isHandScale(id, nameById.get(id) || ""));
  if (alt) PREFERRED_LEAD_FILE_IDS["mexican-brown"] = alt;
}

const examples = [];
let changed = 0;
let closeUpLeadBefore = 0;
let closeUpLeadAfter = 0;
let handLeadBefore = 0;
let handLeadAfter = 0;
const handOnlySlugs = [];

for (const stone of inventory) {
  if (!Array.isArray(stone.sourceFileIds) || stone.sourceFileIds.length < 1) continue;

  const preferredId = PREFERRED_LEAD_FILE_IDS[stone.slug] || "";
  const ranked = stone.sourceFileIds.map((id, index) => {
    const name = nameById.get(id) || "";
    return {
      index,
      id,
      name,
      hand: isHandScale(id, name),
      score: score(name, preferredId, id),
    };
  });
  const baselineShareLeadId = BASELINE_SHARE_LEAD_FILE_IDS[stone.slug] || "";
  const shareOrder = [...ranked].sort((a, b) => {
    if (baselineShareLeadId) {
      if (a.id === baselineShareLeadId) return -1;
      if (b.id === baselineShareLeadId) return 1;
    }
    return (
      (driveOrderById.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (driveOrderById.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    );
  });
  const shareFileIds = shareOrder.map((entry) => entry.id);

  if (ranked[0]?.hand) handLeadBefore += 1;
  if (isCloseUp(ranked[0]?.name)) closeUpLeadBefore += 1;

  const sorted = [...ranked].sort((a, b) => {
    if (a.hand !== b.hand) return a.hand ? 1 : -1;
    return b.score - a.score || a.index - b.index;
  });
  if (sorted[0]?.hand) handLeadAfter += 1;
  if (isCloseUp(sorted[0]?.name)) closeUpLeadAfter += 1;
  if (sorted.every((entry) => entry.hand)) handOnlySlugs.push(stone.slug);

  const displayOrderChanged = !sorted.every((entry, index) => entry.index === ranked[index].index);
  if (displayOrderChanged) {
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
    if (examples.length < 40) {
      examples.push({
        slug: stone.slug,
        before,
        after,
        beforeScore: score(before || "", preferredId, ranked[0]?.id || ""),
        afterScore: score(after || "", preferredId, stone.sourceFileIds[0] || ""),
      });
    }
  }

  const shareImageOrder = shareFileIds.map((id) => stone.sourceFileIds.indexOf(id));
  if (
    shareImageOrder.every((index) => index >= 0) &&
    shareImageOrder.some((displayIndex, shareIndex) => displayIndex !== shareIndex)
  ) {
    stone.shareImageOrder = shareImageOrder;
  } else {
    delete stone.shareImageOrder;
  }
}

fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      changed,
      closeUpLeadBefore,
      closeUpLeadAfter,
      handLeadBefore,
      handLeadAfter,
      handOnlySlugs: handOnlySlugs.sort(),
      examples,
    },
    null,
    2
  )
);
