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
    const onDirectConnect = renderProfile();

    // ProfileSiteView resolves the query after the profile payload arrives, so
    // the component must react to updated props rather than only its first render.
    renderProfile(onDirectConnect, "multi-green-onyx", 2);

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("aria-label")).toBe("Multi Green Onyx photo gallery");
    expect(dialog?.textContent?.replace(/\s+/g, " ")).toContain("03 / 07");
    expect(dialog?.querySelector("img")?.getAttribute("src")).toBe(products[1].images[2]);
  });

  it("keeps the shared-photo counter after closing a deep-linked lightbox", async () => {
    const onDirectConnect = renderProfile();
    renderProfile(onDirectConnect, "multi-green-onyx", 2);

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      container.querySelector('[aria-live="polite"]')?.textContent?.replace(/\s+/g, " ")
    ).toContain("03 / 07");

    await act(async () => {
      container
        .querySelector('button[aria-label="Close expanded gallery"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(
      container.querySelector('[aria-live="polite"]')?.textContent?.replace(/\s+/g, " ")
    ).toContain("03 / 07");
  });

  it("switches the full showcase and keeps CTA context product-specific", () => {
    const onDirectConnect = renderProfile();
    const multiGreenToggle = Array.from(container.querySelectorAll("button")).find(
      (button) =>
        button.getAttribute("aria-pressed") !== null &&
        button.textContent?.includes("Multi Green Onyx")
    );

    expect(multiGreenToggle).toBeTruthy();
    act(() => multiGreenToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(
      container.querySelector('[role="region"][aria-label="Multi Green Onyx horizontal showcase"]')
    ).not.toBeNull();
    expect(container.querySelector("#connect")?.textContent).toContain("Inquire privately.");

    const cta = Array.from(container.querySelectorAll("#connect button")).find((button) =>
      /Direct Connect/i.test(button.textContent || "")
    );
    expect(cta).toBeTruthy();
    act(() => cta?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onDirectConnect).toHaveBeenCalledWith("Multi Green Onyx");
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

  it("keeps dialog navigation focus stable and returns focus after Escape", async () => {
    renderProfile();
    const expand = container.querySelector<HTMLButtonElement>('button[aria-label="Expand Suite"]');
    expect(expand).toBeTruthy();
    act(() => expand?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    const close = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close expanded gallery"]'
    );
    expect(close).toBeTruthy();
    close?.focus();
    expect(document.activeElement).toBe(close);

    const next = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Next expanded image"]'
    );
    next?.focus();
    act(() => next?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.querySelector('[role="dialog"]')?.textContent?.replace(/\s+/g, " ")).toContain(
      "02 / 08"
    );
    expect(document.activeElement).toBe(next);

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })));
    expect(container.querySelector('[role="dialog"]')?.textContent?.replace(/\s+/g, " ")).toContain(
      "03 / 08"
    );
    expect(document.activeElement).toBe(next);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(expand);
  });

  it("provides real section targets and a visible keyboard focus treatment for the rail", () => {
    renderProfile();
    expect(container.querySelector("#collection")).not.toBeNull();
    expect(container.querySelector("#why-us")).toBeNull();
    expect(container.querySelector("#connect")).not.toBeNull();
    expect(
      container.querySelector('[role="region"][aria-label$="horizontal showcase"]')?.className
    ).toContain("focus-visible:ring-2");
  });
});
