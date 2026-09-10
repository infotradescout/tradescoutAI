import {
  buildStoneDesignerPhotoKey,
  STONE_DESIGNER_SELECTION_PARAM,
  STONE_DESIGNER_PHOTO_PARAM,
} from "@/pages/profile-sites/steel-home-project-tools/stoneDesignerImages";
import type { JwStoneCatalogItem } from "./types";

/** Carry one exact named inventory photograph to the existing planner, never a starter plan. */
export function stoneRoomDestination(
  stone: JwStoneCatalogItem,
  imageHref: string,
  baseHref: string
): string | null {
  if (stone.anonymous || !stone.shareSlug || !stone.images.includes(imageHref)) return null;
  const photoKey = buildStoneDesignerPhotoKey(imageHref);
  if (!photoKey) return null;
  const params = new URLSearchParams({
    [STONE_DESIGNER_SELECTION_PARAM]: stone.shareSlug,
    [STONE_DESIGNER_PHOTO_PARAM]: photoKey,
  });
  return `${baseHref}?${params}`;
}

export default function StoneRoomLink({
  stone,
  imageHref,
  baseHref,
  className,
  detail = false,
}: {
  stone: JwStoneCatalogItem;
  imageHref: string;
  baseHref: string;
  className: string;
  detail?: boolean;
}) {
  const href = stoneRoomDestination(stone, imageHref, baseHref);
  return href ? (
    <a
      href={href}
      data-testid={detail ? "jw-stone-detail-room" : `jw-stone-room-${stone.id}`}
      className={`inline-flex items-center justify-center ${detail ? "min-h-12 w-full px-5" : "min-h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"} ${className}`}
    >
      View in room
    </a>
  ) : null;
}
