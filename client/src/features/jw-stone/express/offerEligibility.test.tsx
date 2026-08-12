// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_ANONYMOUS_CATALOG, JW_STONE_CATALOG, JW_STONE_NAMED_CATALOG } from "../catalog";
import { firstCutPhotoAsDetailStone, JW_STONE_FIRST_CUT_PHOTO_SLOTS } from "../firstCut";
import { StoneCard } from "../StoneCard";
import { ExpressOfferEntryProvider } from "./ExpressOfferEntryContext";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("Current Inventory offer eligibility", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("offers every real named and anonymous listing, but not First Cut", () => {
    const named = JW_STONE_NAMED_CATALOG[0]!;
    const anonymous = JW_STONE_ANONYMOUS_CATALOG[0]!;
    const firstCut = firstCutPhotoAsDetailStone(JW_STONE_FIRST_CUT_PHOTO_SLOTS[0]!);
    const inventoryIds = new Set(JW_STONE_CATALOG.map((stone) => stone.id));
    const makeOffer = vi.fn();
    const card = (stone: typeof named) => (
      <StoneCard
        stone={stone}
        saved={false}
        onToggleSaved={vi.fn()}
        onOpen={vi.fn()}
        onAsk={vi.fn()}
      />
    );

    act(() =>
      root.render(
        <ExpressOfferEntryProvider
          canMakeOffer={(stone) => inventoryIds.has(stone.id)}
          makeOffer={makeOffer}
        >
          <div data-testid="named">{card(named)}</div>
          <div data-testid="anonymous">{card(anonymous)}</div>
          <div data-testid="first-cut">{card(firstCut)}</div>
        </ExpressOfferEntryProvider>
      )
    );

    expect(
      host.querySelector('[data-testid="named"] [data-testid="jw-stone-card-make-offer"]')
    ).not.toBeNull();
    expect(
      host.querySelector('[data-testid="anonymous"] [data-testid="jw-stone-card-make-offer"]')
    ).not.toBeNull();
    expect(
      host.querySelector('[data-testid="first-cut"] [data-testid="jw-stone-card-make-offer"]')
    ).toBeNull();
  });
});
