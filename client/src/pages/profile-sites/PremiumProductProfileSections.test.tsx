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

describe("PremiumProductProfileSections luxury-material-house behavior", () => {
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

  it("dispatches luxury-material-house to the editorial house showcase", () => {
    expect(data.presentation).toBe("luxury-material-house");
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
    expect(multiGreen?.textContent).toContain("Multi Green Onyx");
    expect(container.textContent).not.toContain("Honey Green");

    const designedImage = designed?.querySelector("img")?.getAttribute("src") || "";
    const honeyApplication = honey?.querySelector("img")?.getAttribute("src") || "";
    expect(designedImage).toMatch(/\/applications\//);
    expect(honeyApplication).toMatch(/\/applications\//);

    const sectionOrder = [
      "designed-with-light",
      "material-chapters",
      "capabilities",
      "showcase",
      "consult",
    ];
    const positions = sectionOrder.map((id) => container.innerHTML.indexOf(`id="${id}"`));
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it("surfaces installation, backlighting, customization, and consultation as business story", () => {
    renderProfile();
    const capabilities = container.querySelector('[data-testid="luxury-house-capabilities"]');
    expect(capabilities?.textContent).toContain("Custom onyx installation");
    expect(capabilities?.textContent).toContain("Backlighting solutions");
    expect(capabilities?.textContent).toContain("Onyx customization");
    expect(capabilities?.textContent).toContain("Project consultation");
    expect(
      container.querySelector('[data-testid="luxury-house-consultation"]')?.textContent
    ).toContain("Tell ISSA Build what you are creating.");
  });

  it("wires Direct Connect with the selected material identity", () => {
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
    ).find((button) => /Direct Connect/i.test(button.textContent || ""));
    expect(consultCta).toBeTruthy();
    act(() => consultCta?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onDirectConnect).toHaveBeenCalledWith("Multi Green Onyx");
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
    expect(onDirectConnect).toHaveBeenCalledWith("Honey Onyx");
    expect(onDirectConnect).toHaveBeenCalledWith("Multi Green Onyx");
    expect(products.map((product) => product.slug)).toEqual(["honey-onyx", "multi-green-onyx"]);
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
