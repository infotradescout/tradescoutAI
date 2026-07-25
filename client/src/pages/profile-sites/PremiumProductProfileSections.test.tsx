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

const FORBIDDEN_RENDER_STRINGS = [
  "profile-inventory-card",
  "Search by stone name",
  "Current collection",
  "View details",
  "slab count",
  "bundle count",
  "Material to confirm",
  "Featured stones",
  "Browse full inventory",
  "warehouse",
  "stone yard",
  "Lookbook",
  "Honey Green",
];

describe("PremiumProductProfileSections lux behavior", () => {
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
    initialPhotoIndex = 0,
    overrideProducts = products
  ) {
    act(() => {
      root.render(
        <PremiumProductProfileSections
          profileName="ISSA Build"
          product={overrideProducts[0]}
          products={overrideProducts}
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

  it("dispatches lux to the editorial house showcase", () => {
    expect(data.presentation).toBe("lux");
    renderProfile();
    expect(
      container.querySelector('[data-testid="luxury-material-house-showcase"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="onyx-stone-showcase"]')).toBeNull();
    expect(container.querySelector('[data-testid="premium-product-profile-sections"]')).toBeNull();
  });

  it("leads with installed-interior sections and keeps materials separate", () => {
    renderProfile();
    const designed = container.querySelector('[data-testid="luxury-house-designed-with-light"]');
    const chapters = container.querySelector('[data-testid="luxury-house-material-chapters"]');
    const honey = container.querySelector('[data-testid="luxury-house-chapter-honey-onyx"]');
    const multiGreen = container.querySelector(
      '[data-testid="luxury-house-chapter-multi-green-onyx"]'
    );

    expect(designed).not.toBeNull();
    expect(chapters).not.toBeNull();
    expect(honey?.textContent).toContain("Honey Onyx");
    expect(honey?.textContent).toContain("Warm, luminous, unmistakable.");
    expect(multiGreen?.textContent).toContain("Multi Green Onyx");
    expect(multiGreen?.textContent).toContain("A deeper architectural tone.");
    expect(container.textContent).not.toContain("Honey Green");

    const designedImage = designed?.querySelector("img")?.getAttribute("src") || "";
    const honeyApplication = honey?.querySelector("img")?.getAttribute("src") || "";
    expect(designedImage).toMatch(/\/applications\//);
    expect(honeyApplication).toMatch(/\/applications\//);

    const samples = container.querySelector('[data-testid="luxury-house-material-samples"]');
    expect(samples).not.toBeNull();
    expect(samples?.textContent).toContain("MATERIAL SAMPLES");
    expect(samples?.textContent).toContain("Honey Onyx");
    expect(samples?.textContent).toContain("Multi Green Onyx");
    const sampleImgs = Array.from(samples?.querySelectorAll("img") || []).map((img) =>
      img.getAttribute("src")
    );
    expect(sampleImgs.length).toBeGreaterThan(0);
    for (const src of sampleImgs) {
      expect(String(src)).toMatch(/\/slabs\//);
    }

    const sectionOrder = [
      "designed-with-light",
      "material-chapters",
      "capabilities",
      "showcase",
      "material-samples",
      "consult",
    ];
    const positions = sectionOrder.map((id) => container.innerHTML.indexOf(`id="${id}"`));
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }

    // Platform engagement (when provided) sits after showcase, before consult.
    const onDirectConnect = vi.fn();
    act(() => {
      root.render(
        <PremiumProductProfileSections
          profileName="ISSA Build"
          product={products[0]}
          products={products}
          data={data}
          trustFacts={[]}
          faqItems={[]}
          profileShareDestination="/u/issa-build"
          onDirectConnect={onDirectConnect}
          platformEngagement={<div data-testid="profile-trust-section">Trust</div>}
        />
      );
    });
    const engagementPos = container.innerHTML.indexOf(
      'data-testid="luxury-house-platform-engagement"'
    );
    const showcasePos = container.innerHTML.indexOf('id="showcase"');
    const consultPos = container.innerHTML.indexOf('id="consult"');
    expect(engagementPos).toBeGreaterThan(showcasePos);
    expect(consultPos).toBeGreaterThan(engagementPos);
  });

  it("surfaces installation, backlighting, customization, and consultation as business story", () => {
    renderProfile();
    const capabilities = container.querySelector('[data-testid="luxury-house-capabilities"]');
    expect(capabilities?.textContent).toContain("Material selection");
    expect(capabilities?.textContent).toContain("Custom cutting and shaping");
    expect(capabilities?.textContent).toContain("Backlighting");
    expect(capabilities?.textContent).toContain("Custom installation");
    expect(capabilities?.textContent).toContain("Residential and commercial projects");
    expect(capabilities?.textContent).toContain("Private project consultation");
    expect(
      container.querySelector('[data-testid="luxury-house-consultation"]')?.textContent
    ).toContain("Start with the room.");
    expect(
      container.querySelector('[data-testid="luxury-house-consultation"]')?.textContent
    ).toContain("Discuss your project");
    expect(container.textContent).not.toContain("A useful first message includes");
    expect(container.querySelector("#connect")).toBeNull();
  });

  it("wires Direct Connect with stable itemId slug, not only display name", () => {
    const onDirectConnect = renderProfile();
    const multiGreenToggle = Array.from(container.querySelectorAll("button")).find(
      (button) =>
        button.getAttribute("aria-pressed") !== null &&
        button.textContent?.includes("Multi Green Onyx")
    );
    expect(multiGreenToggle).toBeTruthy();
    act(() => multiGreenToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    const consultCta = Array.from(
      container.querySelectorAll('[data-testid="luxury-house-consultation"] button')
    ).find((button) => /Discuss your project/i.test(button.textContent || ""));
    expect(consultCta).toBeTruthy();
    act(() => consultCta?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onDirectConnect).toHaveBeenCalledWith({
      itemId: "multi-green-onyx",
      itemName: "Multi Green Onyx",
    });
  });

  it("preserves honey-onyx and multi-green-onyx identity through chapter CTAs", () => {
    const onDirectConnect = renderProfile();
    const honeyCta = Array.from(container.querySelectorAll("button")).find((button) =>
      /Discuss Honey Onyx/i.test(button.textContent || "")
    );
    const multiCta = Array.from(container.querySelectorAll("button")).find((button) =>
      /Discuss Multi Green Onyx/i.test(button.textContent || "")
    );
    expect(honeyCta).toBeTruthy();
    expect(multiCta).toBeTruthy();
    act(() => honeyCta?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => multiCta?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onDirectConnect).toHaveBeenCalledWith({
      itemId: "honey-onyx",
      itemName: "Honey Onyx",
    });
    expect(onDirectConnect).toHaveBeenCalledWith({
      itemId: "multi-green-onyx",
      itemName: "Multi Green Onyx",
    });
    expect(products.map((product) => product.slug)).toEqual(["honey-onyx", "multi-green-onyx"]);
  });

  it("opens the exact shared stone photo from initialProductSlug + initialPhotoIndex", () => {
    const multiGreen = products.find((product) => product.slug === "multi-green-onyx");
    expect(multiGreen).toBeTruthy();
    const photoIndex = 3;
    expect(multiGreen!.images[photoIndex]).toBeTruthy();

    renderProfile(vi.fn(), "multi-green-onyx", photoIndex);

    const lightbox = container.querySelector('[data-testid="luxury-house-deep-link-lightbox"]');
    expect(lightbox).not.toBeNull();
    expect(lightbox?.getAttribute("data-stone-slug")).toBe("multi-green-onyx");
    expect(lightbox?.getAttribute("data-photo-index")).toBe(String(photoIndex));

    const image = container.querySelector('[data-testid="luxury-house-deep-link-image"]');
    expect(image?.getAttribute("src")).toBe(multiGreen!.images[photoIndex]);
    expect(image?.getAttribute("data-photo-index")).toBe(String(photoIndex));
  });

  it("does not render inventory or catalog chrome strings", () => {
    renderProfile();
    const text = (container.textContent || "").toLowerCase();
    const html = container.innerHTML.toLowerCase();
    for (const forbidden of FORBIDDEN_RENDER_STRINGS) {
      expect(text).not.toContain(forbidden.toLowerCase());
      expect(html).not.toContain(forbidden.toLowerCase());
    }
  });

  it("renders lux from chapter identity without inventoryCatalog products", () => {
    const chapterOnlyProducts =
      data.luxuryHouse?.materialChapters.map((chapter) => ({
        name: chapter.name,
        slug: chapter.slug,
        images: [chapter.applicationImage, chapter.detailImage],
      })) || [];
    expect(chapterOnlyProducts.length).toBeGreaterThan(0);

    const onDirectConnect = renderProfile(vi.fn(), undefined, 0, chapterOnlyProducts);
    expect(
      container.querySelector('[data-testid="luxury-material-house-showcase"]')
    ).not.toBeNull();

    const text = (container.textContent || "").toLowerCase();
    const html = container.innerHTML.toLowerCase();
    for (const forbidden of FORBIDDEN_RENDER_STRINGS) {
      expect(text).not.toContain(forbidden.toLowerCase());
      expect(html).not.toContain(forbidden.toLowerCase());
    }

    const honeyCta = Array.from(container.querySelectorAll("button")).find((button) =>
      /Discuss Honey Onyx/i.test(button.textContent || "")
    );
    act(() => honeyCta?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onDirectConnect).toHaveBeenCalledWith({
      itemId: "honey-onyx",
      itemName: "Honey Onyx",
    });
  });

  it("keeps horizontal-luxury-showcase on OnyxStoneShowcase for non-house profiles", () => {
    const horizontalData: PremiumProductProfileData = {
      ...data,
      presentation: "horizontal-luxury-showcase",
      luxuryHouse: undefined,
    };
    act(() => {
      root.render(
        <PremiumProductProfileSections
          profileName="Legacy Showcase"
          product={products[0]}
          products={products}
          data={horizontalData}
          trustFacts={[]}
          faqItems={[]}
          profileShareDestination="/u/legacy"
          onDirectConnect={vi.fn()}
        />
      );
    });
    expect(container.querySelector('[data-testid="onyx-stone-showcase"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="luxury-material-house-showcase"]')).toBeNull();
    expect(container.textContent).toContain("Lookbook");
  });
});
