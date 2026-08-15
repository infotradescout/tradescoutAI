import sourceNamesById from "@/data/jwStoneSourceNames.generated.json";

/**
 * Marketplace cover ranking: prefer full-slab context shots over hand / sample /
 * detail close-ups when the stone's image set includes a better lead.
 *
 * Mirrors scripts/reorder-jw-stone-full-slab-leads.mjs scoring, with extra
 * demotions for known hand-scale photos that were saved without CLOSE in the name.
 */

const SOURCE_NAME_BY_ID = sourceNamesById as Record<string, string>;

/** Explicit preferred lead drive file ids (warehouse / full-slab context). */
export const JW_STONE_PREFERRED_COVER_FILE_IDS: Readonly<Record<string, string>> = Object.freeze({
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
  "super-white": "1R9wC8J72zpDBdL31Zf4aMISigDudPaQy",
  "juparana-blue": "1D9v9nEKAm5BCDuSlzYpdn9PwOi0nkjKs",
  "beverly-blue": "1BHaSAxN9B8CbNN9gaKiK2F_HJ-GAyRVy",
  "bianco-superiory": "1-1U8FEyCh3N2_DOxRhNKT_lUW72Jh_RQ",
  "calacatta-amala": "1-8YRVJ9x4_lEyoLWh7RpAY0oFPbJHcFa",
  "fusion-brown": "1-uLJ9IFKldBW-UFnESx2UJ4WdOuAACUv",
  picasso: "17_4UcZBVch7I4OLgVFXx0Zc52KXBUDNu",
  bronzonite: "1_mX4CB3IZ9E9OgMkVyqU90bDQx61vFvJ",
  /** Full-slab face (warehouse rack). Sibling yard/close shots include hands. */
  "shadow-storm": "1yuISE53-4yMFdH_4ElUlxi1y7QHmaCa8",
  /** Full slab outdoors — siblings include clamp-hand and hand-scale close-ups. */
  "aspen-white": "1PGDSTn70sheqEx3u39VgzuJNodBJW0xe",
  /** Face-true white slab — prior lead (BLOCK#22129) was yard/sky blue-washed. */
  "alabama-white": "1pRla8GWSa3dSbWTtgTsrytcJMb8D0Qso",
  /** Slab-face band crop — only photo in set; raw lead has clamp + photographer reflection. */
  "black-pearl": "black-pearl-slab-face",
  /** Honed full slab outdoors — siblings include hand-on-face close-ups (128X80 series). */
  "taj-mahal": "1gDJPWKTjG68NRvI4NXDW3pM3v-oqItXh",
});

/**
 * Drive file ids confirmed as hand-on-stone / sample-scale leads.
 * Keep these out of index 0 whenever any stronger sibling exists.
 */
export const JW_STONE_HAND_COVER_FILE_IDS: ReadonlySet<string> = new Set([
  // Previously confirmed
  "1UDe57h8Vq_IpmDKm9JvV-1jEdrc7TMKW", // steel-gray brushed
  "1fqDCQbCGOI4ieLt5899s8XYZv3OlhJp6", // steel-gray close polished
  "18gmBQeXMlJVXkyVR8CYZcr7S19YLnIvM", // fusion-yellow close
  "1M2IO3m_dOI-OMPWbTE8Y4JgtLZaAVYnD", // dallas-white close look
  "11ax9DfAdp_SjHdkX2sTHMGu-NVFEGwru", // blue-dream close (hand)
  // Visually confirmed hand-on-stone (often misnamed with slab dimensions)
  "1o_wQm5dke5f0mnIXjslDs4Ai0XE6ttXA", // galaxy-white former preferred
  "1_SEkFjSzvYBgRoP1PR0_YMJEkv5T9t6z", // galaxy-white sibling hand
  "1BrnNoAJ7X3z5lXuKwKZCPX17Y7G7rg-p", // juparana-blue hand
  "1lfVGyu3oVXcdaAb6amxkgSJBB_w1Rh36", // juparana-blue hand
  "1Sj9EjHRqjwVqTqi5bFZTrjdwMRhIm7ul", // beverly-blue hand
  "1ApF2R6Pbn8aWYpXNHD7VNlJwsFlBsIP4", // beverly-blue hand
  "1Xa7SrSqU8QkEQ2loN5e0MJAiBwqh5d7d", // bianco-superiory hand
  "112yUwIti-kOjZj7MZD9O_IRRRMO65hUT", // calacatta-amala hand
  "15V13zBDRJlRIWJPRHNwyEEhBj5YFRo7m", // fusion-brown hand
  "1n3tCkEbpG8cwAZqp3rsULP5Npm0fYptH", // picasso hand
  "1aiC_duaWb8dY1HHKkGeK9UjbUMRqnPY0", // bronzonite hand
  // Shadow Storm — dimension names had been boosting hand-on-face scale shots
  "11_8FYGX-hKzb7MMljH8LGukCR6ofFcaz", // shadow-storm hand-on-face scale
  "1_jxbwi-xAV-_3Zs2ivWlzwNXFnyRgRxL", // shadow-storm hand-on-face
  "101ftcLyGe6pWSzuCPcrs94AanpuG5Dnb", // shadow-storm hand-on-face
  "1POZ36aWL-ASV2uQSMS_5w11Q22X5nQgY", // shadow-storm yard hand + clamp
  "130CuUhmYEbsQwGynnQ8R6lDIW34E9qKc", // shadow-storm yard hand + clamp
  "1XHgYqAJR548-hOlxH8rx7oCQ8q8feIRP", // shadow-storm warehouse hand on edge
  "1sD8kGUwsGE5tymxjMEr6QPEFP9TlRorr", // shadow-storm merge sibling hand-on-face
  // Aspen White — clamp-hand lead + hand-scale sibling (misnamed with slab dims)
  "1CtB0-MY_RP50AEdeSHvwHYJzSwGYs8Ae", // aspen-white hand on clamp
  "1T9OTfK4VWe5j0wMuIof2BUdeo7RZ57_R", // aspen-white hand-on-face scale
  // AJ Quartz — hand-scale close siblings (misnamed with slab dims)
  "1ippYy4EpV8TV6C8orM8B_KWwMrNZI2NE", // aj-quartz hand-on-face
  "1Fxc4jXM4YxGC1rPSVpCN-UD1hme2HKKK", // aj-quartz hand-on-face
  // Black Pearl — outdoor yard lead with clamp + photographer reflection
  "1AehD2Gk37gaaQNfAUqoIA0X2nbeVBvNs", // black-pearl reflection/clamp lead
  "black-pearl-face-1AehD2Gk37gaaQNfAUqoIA0X2nbeVBvNs", // botched crop — still shows clamp + reflection
  // Taj Mahal — hand-on-face yard shots (misnamed with slab dimensions)
  "16683MPLP7Tbr_zWA29ito0eVct7ooffq", // taj-mahal 128X80 hand-on-face (series lead)
  "1QJ3LbaifHqRv24aZ5hWSnmlU_IL1XjfX", // taj-mahal 128X80 hand-on-face sibling
  "1wca7RSqaHX7QSKjERH3zQLUT9-dVr8rW", // taj-mahal hand on face
  "1WhkGLRxAOoWKJhaZznwf-Z9ER9wV5M-b", // taj-mahal Granos hand-scale
  "1L42L_3HT_2rFzdCTWT46k_AS_ytajWF-", // taj-mahal Granos hand-scale
  "1KlXD4-B96IBcvKjfCPGTM-aR8AwmD446", // taj-mahal close-up hand-scale
]);

function normalizeName(sourceName = ""): string {
  return sourceName.toLowerCase().replace(/[_-]+/g, " ");
}

export function driveFileIdFromImagePath(imagePath: string): string {
  const base = imagePath.split("/").pop() || "";
  return base.replace(/\.[^.]+$/, "");
}

export function sourceNameForImagePath(imagePath: string): string {
  return SOURCE_NAME_BY_ID[driveFileIdFromImagePath(imagePath)] || "";
}

/** Phone-camera / WhatsApp dumps — score-demoted (some are still full slabs). */
export function isPhoneDumpSourceName(sourceName = ""): boolean {
  const compact = normalizeName(sourceName).replace(/\s+/g, "");
  return (
    /^(img_?\d+|dsc_?\d+|photo\d+|pxl_?\d+|heic)/i.test(compact) || /\.heic$/i.test(sourceName)
  );
}

export function isCloseUpSourceName(sourceName = ""): boolean {
  const name = normalizeName(sourceName);
  return /(close\s*up|closeup|close\s*look|\bclose\b|\bdetail\b|\btexture\b|\bswatch\b|scloseup|\bsample\b|\bthumb\b|\bhand\b|\bhands\b|\bholding\b)/.test(
    name
  );
}

export function isFullSlabSourceName(sourceName = ""): boolean {
  const name = normalizeName(sourceName);
  if (isCloseUpSourceName(name) || isPhoneDumpSourceName(sourceName)) return false;
  return (
    /\b(slabs?|bundle|bundles|warehouse|yard|rack|standing|full\s*size|full\s*slab)\b/.test(name) ||
    /\d+\s*[x×"']\s*\d+/.test(name)
  );
}

/**
 * True when this path is a confirmed hand-scale or close-named shot.
 * Phone dumps are score-demoted separately — some PHOTO-* files are full slabs.
 */
export function isHandScaleCoverImage(imagePath: string, sourceName?: string): boolean {
  const fileId = driveFileIdFromImagePath(imagePath);
  const name = sourceName ?? sourceNameForImagePath(imagePath);
  return JW_STONE_HAND_COVER_FILE_IDS.has(fileId) || isCloseUpSourceName(name);
}

/** True when at least one image is a non-hand / non-close lead candidate. */
export function hasNonHandCoverCandidate(images: readonly string[]): boolean {
  return images.some((imagePath) => !isHandScaleCoverImage(imagePath));
}

/**
 * Stones whose entire set is close-up / hand / phone-dump — no full-slab
 * cover can be chosen without inventing photos.
 */
export function isHandOnlyStone(images: readonly string[]): boolean {
  if (!images.length) return true;
  return !hasNonHandCoverCandidate(images);
}

function slabCount(sourceName = ""): number {
  const match = normalizeName(sourceName).match(/(\d+)\s*slabs?\b/);
  return match ? Number(match[1]) : 0;
}

function hasDimensions(sourceName = ""): boolean {
  return /\d+\s*[x×"']\s*\d+/.test(normalizeName(sourceName));
}

export function scoreImageForCover(args: {
  imagePath: string;
  sourceName?: string;
  preferredFileId?: string;
}): number {
  const fileId = driveFileIdFromImagePath(args.imagePath);
  const name = normalizeName(args.sourceName || sourceNameForImagePath(args.imagePath));
  const rawName = args.sourceName || sourceNameForImagePath(args.imagePath);
  let value = 0;

  // Never boost a preferred id that is itself a confirmed hand / close / phone dump.
  const preferredIsUsable =
    Boolean(args.preferredFileId) &&
    !JW_STONE_HAND_COVER_FILE_IDS.has(args.preferredFileId!) &&
    !isCloseUpSourceName(SOURCE_NAME_BY_ID[args.preferredFileId!] || "") &&
    !isPhoneDumpSourceName(SOURCE_NAME_BY_ID[args.preferredFileId!] || "");

  if (preferredIsUsable && fileId === args.preferredFileId) value += 500;
  if (JW_STONE_HAND_COVER_FILE_IDS.has(fileId)) value -= 250;
  if (isPhoneDumpSourceName(rawName)) value -= 180;
  if (isCloseUpSourceName(name)) value -= 100;
  if (isFullSlabSourceName(rawName)) value += 50;
  if (/\b(warehouse|yard|rack|standing|full\s*size|full\s*slab)\b/.test(name)) value += 25;
  if (hasDimensions(name) && !isCloseUpSourceName(name) && !isPhoneDumpSourceName(rawName)) {
    value += 20;
  }
  if (/\bslabs?\b/.test(name) && !isCloseUpSourceName(name) && !isPhoneDumpSourceName(rawName)) {
    value += 15;
  }
  value += Math.min(slabCount(name), 8);
  return value;
}

export function rankImagePathsForCover(
  images: readonly string[],
  options?: { stoneSlug?: string; preferredFileId?: string }
): number[] {
  if (images.length < 2) return images.map((_, index) => index);

  const preferredFileId =
    options?.preferredFileId ||
    (options?.stoneSlug ? JW_STONE_PREFERRED_COVER_FILE_IDS[options.stoneSlug] : undefined) ||
    "";

  return images
    .map((imagePath, index) => ({
      index,
      score: scoreImageForCover({ imagePath, preferredFileId }),
      hand: isHandScaleCoverImage(imagePath),
    }))
    .sort((a, b) => {
      // Hard rule: any non-hand image outranks every hand/close/phone image.
      if (a.hand !== b.hand) return a.hand ? 1 : -1;
      return b.score - a.score || a.index - b.index;
    })
    .map((entry) => entry.index);
}

export function orderImagesForCover<T extends string>(
  images: readonly T[],
  options?: { stoneSlug?: string; preferredFileId?: string }
): T[] {
  const rank = rankImagePathsForCover(images, options);
  if (rank.every((oldIndex, newIndex) => oldIndex === newIndex)) return [...images];
  return rank.map((oldIndex) => images[oldIndex]!);
}

/** Remap share ordinal → display index after a presentation reorder. */
export function remapShareImageOrder(
  shareImageOrder: readonly number[] | undefined,
  permutation: readonly number[],
  imageCount: number
): number[] | undefined {
  if (!shareImageOrder || shareImageOrder.length !== imageCount) {
    return shareImageOrder ? [...shareImageOrder] : undefined;
  }
  const oldToNew = new Map(permutation.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  return shareImageOrder.map((oldDisplayIndex) => oldToNew.get(oldDisplayIndex) ?? oldDisplayIndex);
}

export function reorderParallelByPermutation<T>(
  values: readonly T[] | undefined,
  permutation: readonly number[]
): T[] | undefined {
  if (!values || values.length !== permutation.length) return values ? [...values] : undefined;
  return permutation.map((oldIndex) => values[oldIndex]!);
}

/**
 * Stones whose current lead cannot be improved to a full-slab context shot
 * because every supplied photograph is a close-up / hand / sample view.
 */
export function listStonesWithoutFullSlabCover(
  args: {
    slug: string;
    images: readonly string[];
  }[]
): string[] {
  return args
    .filter(({ images }) => {
      if (!images.length) return true;
      return !images.some((imagePath) => {
        const name = sourceNameForImagePath(imagePath);
        const fileId = driveFileIdFromImagePath(imagePath);
        return (
          isFullSlabSourceName(name) &&
          !isCloseUpSourceName(name) &&
          !isPhoneDumpSourceName(name) &&
          !JW_STONE_HAND_COVER_FILE_IDS.has(fileId)
        );
      });
    })
    .map(({ slug }) => slug)
    .sort();
}

/** Hand-only / close-only stone ids (no inventable full-slab cover). */
export function listHandOnlyStoneIds(
  args: {
    slug: string;
    images: readonly string[];
  }[]
): string[] {
  return args
    .filter(({ images }) => isHandOnlyStone(images))
    .map(({ slug }) => slug)
    .sort();
}
