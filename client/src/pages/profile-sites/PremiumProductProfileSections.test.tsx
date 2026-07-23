// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ISSA_BUILD_PROFILE_CONTENT_BLOCKS } from "@shared/issaBuildProfile";
import type { PremiumProductProfileData } from "@shared/premiumProductProfile";
import PremiumProductProfileSections from "./PremiumProductProfileSections";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const { shareMock } = vi.hoisted(() => ({ shareMock: vi.fn() }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));

vi.mock("@/utils/share", () => ({
  inferShareKind: () => "profile",
  share: shareMock,
}));

const inventoryBlock = ISSA_BUILD_PROFILE_CONTENT_BLOCKS.find(
  (block) => block.type === "inventoryCatalog"
);
const premiumBlock = ISSA_BUILD_PROFILE_CONTENT_BLOCKS.find(
  (block) => block.type === "premiumProduct"
);
const inventoryData = inventoryBlock?.data as unknown as {
  categories: Array<{
    stones: Array<{
      name: string;
      slug: string;
      images: string[];
      shareImageOrder?: number[];
    }>;
  }>;
};
const products = inventoryData.categories[0].stones.map((stone) => ({
  name: stone.name,
  slug: stone.slug,
  images: stone.images,
  shareImageOrder: stone.shareImageOrder,
}));
const data = premiumBlock?.data as PremiumProductProfileData;

describe("PremiumProductProfileSections multi-offering behavior", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    shareMock.mockReset();
    shareMock.mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderProfile(
    onDirectConnect = vi.fn(),
    initialProductSlug?: string,
    initialPhotoIndex = 0
  ) {
    act(() => {
      root.render(
        <PremiumProductProfileSections
          profileName="ISSA Build"
          product={products[0]}
          products={products}
          initialProductSlug={initialProductSlug}
          initialPhotoIndex={initialPhotoIndex}
          data={data}
          trustFacts={[]}
          faqItems={[]}
          profileShareDestination="/u/issa-build"
          onDirectConnect={onDirectConnect}
        />
      );
    });
    return onDirectConnect;
  }

  it("opens the exact product and photo carried by a shared inventory link", () => {
    renderProfile(vi.fn(), "multi-green-onyx", 2);

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("aria-label")).toBe("Multi Green Onyx photo gallery");
    expect(dialog?.textContent).toContain("Photo 3 of 7");
    expect(dialog?.querySelector("img")?.getAttribute("src")).toBe(products[1].images[2]);
  });

  it("opens either full collection and preserves product-specific or generic CTA context", () => {
    const onDirectConnect = renderProfile();
    const multiGreenCard = Array.from(container.querySelectorAll("article")).find((article) =>
      article.textContent?.includes("Multi Green Onyx")
    );
    const viewCollection = Array.from(multiGreenCard?.querySelectorAll("button") || []).find(
      (button) => button.textContent?.includes("View collection")
    );

    act(() => viewCollection?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe(
      "Multi Green Onyx photo gallery"
    );

    act(() =>
      container
        .querySelector('button[aria-label="Close gallery"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    act(() =>
      multiGreenCard
        ?.querySelector('button[aria-label="Direct Connect about Multi Green Onyx"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    expect(onDirectConnect).toHaveBeenCalledWith("Multi Green Onyx");

    act(() =>
      container
        .querySelector('button[aria-label="Direct Connect with ISSA Build"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    expect(onDirectConnect).toHaveBeenLastCalledWith(null);
  });

  it("shares the stable photo ordinal when presentation order differs", async () => {
    const reorderedProduct = {
      name: "Reordered Onyx",
      slug: "reordered-onyx",
      images: ["/reordered-1.jpg", "/reordered-2.jpg", "/reordered-3.jpg"],
      shareImageOrder: [2, 0, 1],
    };

    act(() => {
      root.render(
        <PremiumProductProfileSections
          profileName="ISSA Build"
          product={products[0]}
          products={[...products, reorderedProduct]}
          initialProductSlug={reorderedProduct.slug}
          initialPhotoIndex={0}
          data={data}
          trustFacts={[]}
          faqItems={[]}
          profileShareDestination="/u/issa-build"
          onDirectConnect={vi.fn()}
        />
      );
    });

    await act(async () => {
      container
        .querySelector('button[aria-label="Share Reordered Onyx"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("/u/issa-build?stone=reordered-onyx&photo=2"),
      })
    );
  });
});
