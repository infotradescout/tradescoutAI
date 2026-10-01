// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import BusinessProfileTheme, { publicProfileUrl } from "./BusinessProfileTheme";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
type Props = ComponentProps<typeof BusinessProfileTheme>;
const request = vi.fn();
const photos = Array.from({ length: 8 }, (_, index) => ({ slug: `photo-${index}`, title: "Existing Business", imageAlt: `Existing photo ${index}`, imageUrl: `/gallery/${index}.jpg` }));
const defaults: Props = { businessName: "Existing Business", services: ["Existing service"], serviceAreas: ["Existing area"], galleryItems: photos, onDirectConnect: request,
  trustActions: <div data-testid="retained-trust">Existing verification</div>,
  tradeScoutHandoff: <footer><a href="https://www.thetradescout.com/">Powered by TradeScout</a></footer> };

describe("shared business profile", () => {
  let host: HTMLDivElement, root: Root;
  beforeEach(() => { request.mockClear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const render = (props: Partial<Props> = {}) => act(() => root.render(<BusinessProfileTheme {...defaults} {...props} />));
  const click = (selector: string) => act(() => { const button = document.querySelector<HTMLButtonElement>(selector); expect(button).not.toBeNull(); button!.click(); });
  const failCover = () => act(() => {
    const image = host.querySelector(".bp-cover img");
    expect(image).not.toBeNull();
    image!.dispatchEvent(new Event("error"));
  });

  it("uses one business heading and preserves supplied sentences without new sales paragraphs", () => {
    render({ heroTitle: "Existing Business", heroText: "Owner supplied introduction.", aboutText: "Owner supplied history." });
    expect(host.querySelectorAll("h1")).toHaveLength(1);
    expect(host.querySelector("h1")?.textContent).toBe("Existing Business");
    expect(host.textContent).toContain("Owner supplied introduction.");
    expect(host.textContent).toContain("Owner supplied history.");
    for (const text of ["Choose what you need.", "Recent work.", "Start here", "Connect with Existing Business.", "Country of origin", "Iran"]) expect(host.textContent).not.toContain(text);
    expect(host.querySelectorAll(".bp-caption h3")).toHaveLength(0);
  });
  it("keeps the request callback and original service context", () => {
    render(); click('[data-testid="business-profile-request"]'); expect(request).toHaveBeenLastCalledWith();
    click('[data-testid="default-profile-service-0"]'); expect(request).toHaveBeenLastCalledWith("Existing service");
    expect(host.querySelectorAll('[data-testid="business-profile-request"]')).toHaveLength(1);
  });
  it("honors contact-disabled profiles for both primary and service controls", () => {
    render({ showContact: false });
    expect(host.querySelector('[data-testid="business-profile-request"]')).toBeNull();
    expect(host.querySelector('[data-testid="default-profile-service-0"]')?.tagName).toBe("DIV");
    expect(request).not.toHaveBeenCalled();
  });
  it("retains every service rather than silently truncating after twelve", () => {
    render({ services: Array.from({ length: 15 }, (_, index) => `Service ${index}`) });
    expect(host.querySelectorAll('[data-testid^="default-profile-service-"]')).toHaveLength(15);
    click('[data-testid="default-profile-service-14"]'); expect(request).toHaveBeenLastCalledWith("Service 14");
  });
  it("makes the entire gallery accessible without opening with a long image wall", () => {
    render(); expect(host.querySelectorAll(".bp-gallery article")).toHaveLength(4);
    click('[aria-controls="business-profile-photos"]'); expect(host.querySelectorAll(".bp-gallery article")).toHaveLength(8);
    click('[aria-controls="business-profile-photos"]'); expect(host.querySelectorAll(".bp-gallery article")).toHaveLength(4);
  });
  it("opens the actual photo and supports next, previous and keyboard navigation", () => {
    render(); click(".bp-cover-main");
    expect(document.querySelector('[role="dialog"] img')?.getAttribute("src")).toBe("/gallery/0.jpg");
    click('[aria-label="Next photo"]'); expect(document.querySelector('[role="dialog"] img')?.getAttribute("src")).toBe("/gallery/1.jpg");
    click('[aria-label="Previous photo"]'); expect(document.querySelector('[role="dialog"] img')?.getAttribute("src")).toBe("/gallery/0.jpg");
    act(() => document.querySelector('[role="dialog"]')?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(document.querySelector('[role="dialog"] img')?.getAttribute("src")).toBe("/gallery/7.jpg");
  });
  it("opens a shared photo beyond the first visible gallery row", () => {
    render({ sharedGallerySlug: "photo-7" });
    expect(document.querySelector('[role="dialog"] img')?.getAttribute("src")).toBe("/gallery/7.jpg");
  });
  it("recovers the cover with the next supplied photo and opens its original lightbox index", () => {
    const share = vi.fn((photo) => <a href={`?gallery=${photo.slug}`}>Share photo</a>);
    render({ renderGalleryShare: share });
    failCover();
    expect(host.querySelector(".bp-cover img")?.getAttribute("src")).toBe("/gallery/1.jpg");
    expect(Array.from(host.querySelectorAll(".bp-gallery article")).map((article) => article.id)).toEqual(photos.slice(0, 4).map((photo) => `profile-gallery-${photo.slug}`));
    click(".bp-cover-main");
    expect(document.querySelector('[role="dialog"] img')?.getAttribute("src")).toBe("/gallery/1.jpg");
    expect(document.querySelector(".bp-lightbox-controls p")?.textContent).toBe("2 / 8");
    expect(document.querySelector('.bp-lightbox-share a')?.getAttribute("href")).toBe("?gallery=photo-1");
  });
  it("cascades through actual media and retains honest business copy and inquiry when exhausted", () => {
    render({ heroImageUrl: "/cover.jpg", galleryItems: [photos[0], { ...photos[1], imageUrl: "javascript:bad" }, photos[2]], heroText: "Owner supplied introduction." });
    failCover();
    expect(host.querySelector(".bp-cover img")?.getAttribute("src")).toBe("/gallery/0.jpg");
    failCover();
    expect(host.querySelector(".bp-cover img")?.getAttribute("src")).toBe("/gallery/2.jpg");
    failCover();
    expect(host.querySelector('[data-testid="business-profile-cover"]')).toBeNull();
    expect(host.querySelector('[data-testid="default-profile-brand-hero"]')).not.toBeNull();
    expect(host.querySelector(".bp-hero")?.textContent).toContain("Owner supplied introduction.");
    expect(host.querySelector("h1")?.textContent).toBe("Existing Business");
    click('[data-testid="business-profile-request"]');
    expect(request).toHaveBeenLastCalledWith();
    expect(Array.from(host.querySelectorAll("img")).every((image) => ["/cover.jpg", "/gallery/0.jpg", "/gallery/2.jpg"].includes(image.getAttribute("src") || ""))).toBe(true);
  });
  it("resets cover failure history when the supplied business or gallery changes", () => {
    render({ galleryItems: photos.slice(0, 2) });
    failCover();
    expect(host.querySelector(".bp-cover img")?.getAttribute("src")).toBe("/gallery/1.jpg");
    render({ galleryItems: [photos[0], photos[2]] });
    expect(host.querySelector(".bp-cover img")?.getAttribute("src")).toBe("/gallery/0.jpg");
    failCover();
    render({ businessName: "Another supplied business", galleryItems: [photos[0], photos[2]] });
    expect(host.querySelector(".bp-cover img")?.getAttribute("src")).toBe("/gallery/0.jpg");
    failCover();
    render({ businessName: "Another supplied business", heroImageUrl: "/new-cover.jpg", galleryItems: [photos[0], photos[2]] });
    expect(host.querySelector(".bp-cover img")?.getAttribute("src")).toBe("/new-cover.jpg");
  });
  it("preserves the shared selection when the cover falls back", () => {
    const share = vi.fn((photo) => <a href={`?gallery=${photo.slug}`}>Share photo</a>);
    render({ sharedGallerySlug: "photo-3", renderGalleryShare: share });
    failCover();
    expect(document.querySelector('[role="dialog"] img')?.getAttribute("src")).toBe("/gallery/3.jpg");
    expect(document.querySelector('.bp-lightbox-share a')?.getAttribute("href")).toBe("?gallery=photo-3");
    expect(host.querySelector(".bp-photo--selected")?.id).toBe("profile-gallery-photo-3");
  });
  it("retains gallery sharing and does not invent a shareable gallery slug for a standalone cover", () => {
    const share = vi.fn((photo) => <a href={`?gallery=${photo.slug}`}>Share photo</a>);
    render({ heroImageUrl: "/cover.jpg", renderGalleryShare: share });
    expect(host.querySelector('a[href="?gallery=profile-cover"]')).toBeNull();
    expect(host.querySelector('a[href="?gallery=photo-0"]')).not.toBeNull();
  });
  it("retains booking, products, verification and the qualified footer without duplicate links", () => {
    render({ bookingSection: <div data-testid="retained-booking">Existing booking</div>, profileItems: <a href="/issa-build/onyx">Onyx</a> });
    expect(host.querySelector('[data-testid="retained-booking"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="profile-trust-section"] [data-testid="retained-trust"]')).not.toBeNull();
    expect(host.querySelector('a[href="/issa-build/onyx"]')).not.toBeNull();
    expect(host.querySelectorAll('a[href="https://www.thetradescout.com/"]')).toHaveLength(1);
    expect(host.querySelector('a[href="/"]')).toBeNull();
  });
  it("keeps empty profiles compact without fabricated photographs, reviews or placeholder claims", () => {
    render({ services: [], serviceAreas: [], galleryItems: [], trustActions: null });
    expect(host.querySelector('[data-testid="business-profile-cover"]')).toBeNull();
    expect(host.querySelector('[data-testid="default-profile-brand-hero"]')).not.toBeNull();
    expect(host.querySelector("img")).toBeNull(); expect(host.querySelector(".bp-nav")).toBeNull();
    expect(host.querySelector(".bp-aside")).toBeNull();
    expect(host.textContent).not.toMatch(/coming soon|review|5 stars|years of experience/i);
  });
  it("shows an honest failure state instead of leaving a broken gallery image", () => {
    render(); const image = host.querySelector(".bp-gallery img");
    act(() => image?.dispatchEvent(new Event("error")));
    expect(host.querySelector(".bp-gallery .bp-photo-unavailable")?.textContent).toBe("Photo unavailable");
  });
  it("keeps negative authored recommendations clearly negative", () => {
    render({ recommendationMode: "authored", recommendations: [{ id: "1", recommendationType: "negative", comment: "Existing warning.", projectType: null, customerName: "", subjectName: "Existing provider", subjectHref: "javascript:alert(1)" }] });
    expect(host.textContent).toContain("Does not recommend"); expect(host.textContent).toContain("Existing warning.");
    expect(host.querySelector('a[href^="javascript:"]')).toBeNull();
  });
  it("rejects executable or protocol-relative URLs and keeps valid encoded media names", () => {
    for (const value of ["javascript:alert(1)", "data:image/svg+xml,bad", "//elsewhere.example/a", "/\\elsewhere", "https://safe.example/\nunsafe"]) expect(publicProfileUrl(value, true)).toBeUndefined();
    expect(publicProfileUrl("/my photo.jpg", true)).toBe("/my%20photo.jpg");
    expect(publicProfileUrl("https://example.com/photo.jpg")).toBe("https://example.com/photo.jpg");
  });
  it("validates brand colors and picks readable text for light and dark surfaces", () => {
    render({ brandColors: { background: "#ffffff", surface: "#ffffff", primary: "bad; background:url(unsafe)" }, lightTrustActions: <span data-testid="light-trust">Light trust</span> });
    const main = host.querySelector<HTMLElement>("main")!;
    expect(main.style.getPropertyValue("--profile-primary")).toBe("#f97316");
    expect(main.style.getPropertyValue("--profile-primary-soft")).toBe("rgba(249,115,22,0.16)");
    expect(main.style.getPropertyValue("--bp-fg")).toBe("#111418");
    expect(host.querySelector('[data-testid="light-trust"]')).not.toBeNull();
    render({ brandColors: { primary: "#123abc" }, shareAction: <button style={{ backgroundColor: "var(--profile-primary-soft)" }}>Share profile</button> });
    expect(main.style.getPropertyValue("--profile-primary-soft")).toBe("rgba(18,58,188,0.16)");
  });
});
