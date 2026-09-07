// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BusinessProfileTheme, { splitProfileLead } from "./BusinessProfileTheme";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
type Props = ComponentProps<typeof BusinessProfileTheme>;
const scope = "Kitchens, bathrooms, cabinets and countertops in Pensacola and surrounding areas.";
const defaults: Props = {
  businessName: "Owner Business", categoryLabel: "Kitchen Remodeling", locationLabel: "Pensacola, FL",
  heroTitle: "Owner Business", heroText: scope,
  services: ["Kitchen projects in Pensacola"], serviceAreas: ["Pensacola, FL"],
  galleryItems: Array.from({ length: 6 }, (_, index) => ({ slug: `photo-${index}`, title: `Owner photo ${index}`, imageAlt: `Owner photo ${index}`, imageUrl: `/owner-${index}.jpg` })),
  onDirectConnect: vi.fn(), trustActions: null, tradeScoutHandoff: null,
};

describe("business copy hierarchy", () => {
  it("separates only the existing matching city clause and preserves every character", () => {
    const parts = splitProfileLead(scope, "Pensacola, FL");
    expect(parts.main).toBe("Kitchens, bathrooms, cabinets and countertops");
    expect(parts.location).toBe(" in Pensacola and surrounding areas.");
    expect(parts.main + parts.location).toBe(scope);
  });
  it("does not split a partial city name, unrelated location or missing location", () => {
    for (const [text, location] of [["Work in Pensacolas", "Pensacola, FL"], [scope, "Mobile, AL"], [scope, ""], ["Built with care.", "Pensacola, FL"]]) {
      expect(splitProfileLead(text, location)).toEqual({ main: text, location: "" });
    }
  });
  it("retains original capitalization, punctuation and spacing", () => {
    const text = "Owner's exact wording in PENSACOLA — and beyond.";
    const parts = splitProfileLead(text, "Pensacola, FL");
    expect(parts.main + parts.location).toBe(text);
    expect(parts.location).toBe(" in PENSACOLA — and beyond.");
  });
});

describe("photo-first business presentation", () => {
  let host: HTMLDivElement, root: Root;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const render = (props: Partial<Props> = {}) => act(() => root.render(<BusinessProfileTheme {...defaults} {...props} />));
  it("keeps the complete supplied sentence while removing repeated category and location from the hero", () => {
    render();
    expect(host.querySelector(".bp-headline")?.textContent).toBe(scope);
    expect(host.querySelector(".bp-headline-main")?.textContent).toBe("Kitchens, bathrooms, cabinets and countertops");
    expect(host.querySelector(".bp-headline-location")?.textContent).toBe(" in Pensacola and surrounding areas.");
    expect(host.querySelector(".bp-hero .bp-category")).toBeNull();
    expect(host.querySelector(".bp-meta")?.textContent).toBe("");
    expect(host.querySelector("#profile-services .bp-category")?.textContent).toBe("Kitchen Remodeling");
    expect(host.querySelector(".bp-areas")?.textContent).toContain("Pensacola, FL");
  });
  it("does not repeat the cover first and opens the actual clicked gallery photo", () => {
    render();
    expect(host.querySelector(".bp-cover img")?.getAttribute("src")).toBe("/owner-0.jpg");
    expect(host.querySelector(".bp-gallery img")?.getAttribute("src")).toBe("/owner-1.jpg");
    act(() => host.querySelector<HTMLButtonElement>(".bp-gallery article > button")!.click());
    expect(document.querySelector('[role="dialog"] img')?.getAttribute("src")).toBe("/owner-1.jpg");
  });
  it("retains the complete gallery including the cover without duplicate asset URLs", () => {
    render();
    act(() => host.querySelector<HTMLButtonElement>('[aria-controls="business-profile-photos"]')!.click());
    const urls = [...host.querySelectorAll<HTMLImageElement>(".bp-gallery img")].map((image) => image.getAttribute("src"));
    expect(urls).toHaveLength(6);
    expect(new Set(urls).size).toBe(6);
    expect(urls).toContain("/owner-0.jpg");
  });
  it("keeps the single-photo gallery usable", () => {
    render({ galleryItems: defaults.galleryItems.slice(0, 1) });
    act(() => host.querySelector<HTMLButtonElement>(".bp-gallery article > button")!.click());
    expect(document.querySelector('[role="dialog"] img')?.getAttribute("src")).toBe("/owner-0.jpg");
    expect(document.querySelector<HTMLButtonElement>('[aria-label="Next photo"]')?.disabled).toBe(true);
  });
  it("retains category information when the service section is disabled", () => {
    render({ showServices: false });
    expect(host.querySelector("#profile-services")).toBeNull();
    expect(host.querySelector(".bp-hero .bp-category")?.textContent).toBe("Kitchen Remodeling");
  });
});
