import { JW_STONE_PROFILE_PRESENTATION_BLOCK } from "@/data/jwStoneProfilePresentation";

/**
 * Profile-owned quarry + finished-space photography from `/u/jw-stone`.
 * Finished-work bridge may reuse story frames; browse rails must NOT surface
 * story/editorial captions ("Wagner…", quarry labels) as section chrome.
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

type ColorCollageStrip = Readonly<{
  src: string;
  alt: string;
}>;

/**
 * Browse-by-color atmosphere: pre-cropped stone-face strips (no yard chrome).
 * Spectrum L→R: white → warm → gray → black → brown → green → blue → red.
 * Assets built by tmp/build-color-collage-faces.mjs into color-collage/.
 */
export const COLOR_COLLAGE_STRIPS: readonly ColorCollageStrip[] = Object.freeze([
  {
    src: "/images/businesses/jw-stone/color-collage/01-white.webp",
    alt: "White stone face",
  },
  {
    src: "/images/businesses/jw-stone/color-collage/02-warm.webp",
    alt: "Warm stone face",
  },
  {
    src: "/images/businesses/jw-stone/color-collage/03-gray.webp",
    alt: "Gray stone face",
  },
  {
    src: "/images/businesses/jw-stone/color-collage/04-black.webp",
    alt: "Black stone face",
  },
  {
    src: "/images/businesses/jw-stone/color-collage/05-brown.webp",
    alt: "Brown gold stone face",
  },
  {
    src: "/images/businesses/jw-stone/color-collage/06-green.webp",
    alt: "Green stone face",
  },
  {
    src: "/images/businesses/jw-stone/color-collage/07-blue.webp",
    alt: "Blue stone face",
  },
  {
    src: "/images/businesses/jw-stone/color-collage/08-red.webp",
    alt: "Red burgundy stone face",
  },
]);

/**
 * Browse-by-material — warehouse slab atmosphere (materials in inventory),
 * not finished-room photography. Same yard frame used as the profile browse CTA.
 */
export const MATERIAL_SECTION_BACKGROUND = {
  src: "/images/businesses/jw-stone/inventory-source/1YaoUMDs2-E_UvX7aqoNXRboo4M323utd.webp",
  alt: "Natural stone slabs in the JW Stone warehouse",
} as const;

/** Full inventory — architectural interior atmosphere (no editorial caption). */
export const INVENTORY_SECTION_BACKGROUND = {
  src: JW_STORY_BACKGROUNDS.livingRoom.src,
  alt: "JW Stone collection for browsing the full inventory",
} as const;

/** @deprecated Prefer JW_FINISHED_WORK_PHOTOS — kept for any residual imports. */
export const FINISHED_WORK_BRIDGE_BACKGROUND = JW_STORY_BACKGROUNDS.montBlancBar;

/**
 * Finished-work gallery — original profile finished-space frames only
 * (no quarry / yard). Shown as its own separated section below inventory.
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
