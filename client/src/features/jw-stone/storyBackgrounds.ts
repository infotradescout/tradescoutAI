import { JW_STONE_PROFILE_PRESENTATION_BLOCK } from "@/data/jwStoneProfilePresentation";

/**
 * Profile-owned quarry + finished-space photography from `/u/jw-stone`.
 * Marketplace story section mounts the full sequence (quarry first).
 * Browse rails must NOT surface story/editorial captions as section chrome.
 */
const storyImages = JW_STONE_PROFILE_PRESENTATION_BLOCK.data.story.images;

export const JW_STORY_BACKGROUNDS = {
  quarry: {
    src: storyImages[0]!.src,
    alt: storyImages[0]!.alt,
    label: storyImages[0]!.label,
  },
  livingRoom: {
    src: storyImages[1]!.src,
    alt: storyImages[1]!.alt,
    label: storyImages[1]!.label,
  },
  fireplace: {
    src: storyImages[2]!.src,
    alt: storyImages[2]!.alt,
    label: storyImages[2]!.label,
  },
  montBlancBar: {
    src: storyImages[3]!.src,
    alt: storyImages[3]!.alt,
    label: storyImages[3]!.label,
  },
} as const;

type CollageStrip = Readonly<{
  src: string;
  alt: string;
}>;

/**
 * Browse-by-color atmosphere: one clean representative face per color family
 * (no yard chrome and no multi-stone composite inside an individual strip).
 * Available picker colors L→R: white → beige → gray → black → brown → gold → green → blue.
 * The same representative slivers are used by the expanded color picker.
 */
export const COLOR_COLLAGE_STRIPS: readonly CollageStrip[] = Object.freeze([
  {
    src: "/images/businesses/jw-stone/color-slivers/alabama-white.webp",
    alt: "White stone face",
  },
  {
    src: "/images/businesses/jw-stone/color-slivers/calacatta-gold.webp",
    alt: "Beige stone face",
  },
  {
    src: "/images/businesses/jw-stone/color-slivers/blue-dunes.webp",
    alt: "Gray stone face",
  },
  {
    src: "/images/businesses/jw-stone/color-slivers/preto-sao-gabriel.webp",
    alt: "Black stone face",
  },
  {
    src: "/images/businesses/jw-stone/color-slivers/emperor-brown.webp",
    alt: "Brown stone face",
  },
  {
    src: "/images/businesses/jw-stone/color-slivers/gold-macaubas.webp",
    alt: "Gold stone face",
  },
  {
    src: "/images/businesses/jw-stone/color-slivers/marbella-green.webp",
    alt: "Green stone face",
  },
  {
    src: "/images/businesses/jw-stone/color-slivers/blue-dream.webp",
    alt: "Blue stone face",
  },
]);

/**
 * Browse-by-material atmosphere: a concise run of distinct real material-face
 * covers. Five strips communicate variety while staying lighter than the old
 * single raw warehouse frame; CollageBand defers them until near the viewport.
 */
export const MATERIAL_COLLAGE_STRIPS: readonly CollageStrip[] = Object.freeze([
  {
    src: "/images/businesses/jw-stone/material-covers/granite.webp",
    alt: "Granite stone face",
  },
  {
    src: "/images/businesses/jw-stone/material-covers/marble.webp",
    alt: "Marble stone face",
  },
  {
    src: "/images/businesses/jw-stone/material-covers/quartzite.webp",
    alt: "Quartzite stone face",
  },
  {
    src: "/images/businesses/jw-stone/material-covers/quartz.webp",
    alt: "Quartz stone face",
  },
  {
    src: "/images/businesses/jw-stone/material-covers/onyx.webp",
    alt: "Onyx stone face",
  },
]);

/**
 * Browse-by-material — warehouse slab atmosphere (materials in inventory),
 * not finished-room photography. Same yard frame used as the profile browse CTA.
 */
export const MATERIAL_SECTION_BACKGROUND = {
  src: "/images/businesses/jw-stone/inventory-source/10hwbokQWc-hgPGqXhdKkuLRjs4a6Zbfd.webp",
  alt: "Detailed natural stone slab from the JW Stone inventory",
} as const;

/** Full inventory — outdoor slab-yard atmosphere (no editorial caption). */
export const INVENTORY_SECTION_BACKGROUND = {
  src: "/images/businesses/jw-stone/story/full-inventory-yard.webp",
  alt: "Natural stone slabs on A-frames in the JW Stone yard",
} as const;

/** @deprecated Prefer JW_STORY_BACKGROUNDS — kept for residual imports. */
export const FINISHED_WORK_BRIDGE_BACKGROUND = JW_STORY_BACKGROUNDS.montBlancBar;

/**
 * Finished-space frames only (no quarry). Marketplace gallery uses the full
 * story sequence via profile presentation; this subset remains for asset checks.
 */
export const JW_FINISHED_WORK_PHOTOS = Object.freeze([
  {
    src: JW_STORY_BACKGROUNDS.livingRoom.src,
    alt: JW_STORY_BACKGROUNDS.livingRoom.alt,
    label: "Living spaces",
  },
  {
    src: JW_STORY_BACKGROUNDS.fireplace.src,
    alt: JW_STORY_BACKGROUNDS.fireplace.alt,
    label: "Architectural installs",
  },
  {
    src: JW_STORY_BACKGROUNDS.montBlancBar.src,
    alt: JW_STORY_BACKGROUNDS.montBlancBar.alt,
    label: "Bars & entertaining",
  },
]);
