/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { getCatalogItemById, JW_STONE_CATALOG } from "./catalog";
import { stoneRoomDestination } from "./StoneRoomLink";
import { stoneRoomBasePath } from "./marketplaceRoutes";
import { buildStoneDesignerPhotoKey } from "@/pages/profile-sites/steel-home-project-tools/stoneDesignerImages";

afterEach(() => vi.unstubAllGlobals());

describe("stone room destinations", () => {
  const stone = getCatalogItemById("arizona-gold")!;

  it("links the exact inventory photo to the canonical planner without a starter snapshot", () => {
    const url = new URL(
      stoneRoomDestination(stone, stone.images[1]!, stoneRoomBasePath())!,
      "https://example.com"
    );
    expect(url.pathname).toBe("/u/steel-home-packages/builders/countertops");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      stone: stone.shareSlug,
      photo: buildStoneDesignerPhotoKey(stone.images[1]!),
    });
  });

  it("returns to TradeScout when leaving the JW Stone custom domain", () => {
    vi.stubGlobal("__TS_CUSTOM_DOMAIN_PROFILE_SLUG__", "jw-stone");
    expect(stoneRoomDestination(stone, stone.images[0]!, stoneRoomBasePath())).toMatch(
      /^https:\/\/www\.thetradescout\.com\/u\/steel-home-packages\/builders\/countertops\?/
    );
  });

  it("omits anonymous inventory and foreign photos", () => {
    const anonymous = JW_STONE_CATALOG.find((entry) => entry.anonymous)!;
    expect(stoneRoomDestination(anonymous, anonymous.images[0]!, stoneRoomBasePath())).toBeNull();
    expect(
      stoneRoomDestination(stone, getCatalogItemById("taj-mahal")!.images[0]!, stoneRoomBasePath())
    ).toBeNull();
  });
});
