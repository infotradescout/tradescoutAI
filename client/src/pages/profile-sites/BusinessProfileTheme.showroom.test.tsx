// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BusinessProfileTheme from "./BusinessProfileTheme";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
type Props = ComponentProps<typeof BusinessProfileTheme>;
const request = vi.fn();
const defaults: Props = {
  businessName: "Owner Business", categoryLabel: "Kitchen Remodeling", locationLabel: "Pensacola, FL",
  heroTitle: "Owner's exact remodeling headline.", heroText: "Owner's exact supporting sentence.",
  logoUrl: "/original-logo.png", heroImageUrl: "/original-cover.jpg", heroImageAlt: "Original completed room",
  services: ["Kitchen projects in Pensacola", "Bathroom projects in Pensacola"], serviceAreas: ["Pensacola, FL"],
  galleryItems: Array.from({ length: 6 }, (_, index) => ({ slug: `work-${index}`, title: `Original title ${index}`, imageAlt: `Original room ${index}`, imageUrl: `/original-work-${index}.jpg` })),
  onDirectConnect: request,
  trustActions: null,
  tradeScoutHandoff: null,
};

describe("project-led business website composition", () => {
  let host: HTMLDivElement, root: Root;
  beforeEach(() => { request.mockClear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const render = (props: Partial<Props> = {}) => act(() => root.render(<BusinessProfileTheme {...defaults} {...props} />));
  it("uses a company masthead and one room photograph rather than a profile collage", () => {
    render();
    expect(host.querySelectorAll(".bp-masthead h1")).toHaveLength(1);
    expect(host.querySelector(".bp-masthead h1")?.textContent).toBe("Owner Business");
    expect(host.querySelectorAll(".bp-cover img")).toHaveLength(1);
    expect(host.querySelector(".bp-cover img")?.getAttribute("src")).toBe("/original-cover.jpg");
    expect(host.querySelector(".bp-cover-side")).toBeNull();
    expect(host.querySelector(".bp-cover--mosaic")).toBeNull();
    expect(host.querySelector("main")?.getAttribute("data-layout")).toBe("project-led");
  });
  it("leads with the supplied headline without composing a replacement", () => {
    render();
    expect(host.querySelector(".bp-headline")?.textContent).toBe(defaults.heroTitle);
    expect(host.querySelector(".bp-summary")?.textContent).toBe(defaults.heroText);
    expect(host.textContent).not.toMatch(/one.day install|lifetime warranty|award.winning|five.star|luxury homes|wealthy|Bath Fitter/i);
  });
  it("promotes the supplied full-service scope instead of a category-only heading", () => {
    const scope = "Kitchens, bathrooms, cabinets and countertops in Pensacola and surrounding areas.";
    render({ heroTitle: "Owner Business", heroText: scope });
    expect(host.querySelector(".bp-headline")?.textContent).toBe(scope);
    expect(host.querySelector(".bp-summary")).toBeNull();
    expect(host.querySelector(".bp-category")?.textContent).toBe("Kitchen Remodeling");
    expect(host.querySelectorAll("h1")).toHaveLength(1);
  });
  it("places work before services and keeps business details outside the content column", () => {
    render({ aboutText: "Original company history." });
    const sectionIds = [...host.querySelectorAll(".bp-content > section")].map((node) => node.id);
    expect(sectionIds.slice(0, 3)).toEqual(["profile-gallery", "profile-services", "profile-about"]);
    expect(host.querySelector(".bp-body--aside")).toBeNull();
    expect(host.querySelector(".bp-content .bp-aside")).toBeNull();
    expect(host.querySelector(".bp-body > .bp-aside")).not.toBeNull();
  });
  it("has one real primary request and preserves the selected service", () => {
    render();
    expect(host.querySelectorAll('[data-testid="business-profile-request"]')).toHaveLength(1);
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="default-profile-service-1"]')!.click());
    expect(request).toHaveBeenLastCalledWith("Bathroom projects in Pensacola");
  });
  it("keeps every displayed navigation link attached to an existing section", () => {
    render({ profileItems: <a href="/issa-build/onyx">Onyx</a> });
    for (const anchor of host.querySelectorAll<HTMLAnchorElement>(".bp-nav a")) expect(host.querySelector(anchor.getAttribute("href")!)).not.toBeNull();
    expect(host.querySelector('a[href="/issa-build/onyx"]')).not.toBeNull();
    expect(host.querySelector(".bp-hero")?.textContent).not.toMatch(/Iran|2 cm|country of origin/i);
  });
  it("does not substitute unrelated photography for an empty gallery", () => {
    render({ galleryItems: [], heroImageUrl: undefined });
    expect(host.querySelector(".bp-cover")).toBeNull();
    expect(host.querySelector(".bp-hero--text")).not.toBeNull();
    expect(host.querySelectorAll("img")).toHaveLength(1);
    expect(host.querySelector("img")?.getAttribute("src")).toBe("/original-logo.png");
  });
});
