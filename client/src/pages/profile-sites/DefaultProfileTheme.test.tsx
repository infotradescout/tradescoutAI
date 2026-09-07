// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DefaultProfileTheme from "./DefaultProfileTheme";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const onDirectConnect = vi.fn();

describe("DefaultProfileTheme", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    onDirectConnect.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it("renders Cameron as a complete first-deliverable profile with service-specific Direct Connect", () => {
    act(() => root.render(<DefaultProfileTheme
      businessName="Precision Aerial Services" operatorName="Cameron" presentationVariant="first-deliverable"
      categoryLabel="Drone photo and video" locationLabel="Pensacola, Florida"
      headline="Drone photo and video in Pensacola." heroTitle="A better view." heroText="Drone photo and video."
      logoUrl="/images/profiles/precision-aerial/logo.jpg"
      heroImageUrl="/images/profiles/precision-aerial/real-estate-aerial-01.jpg" heroImageAlt="Aerial property view"
      featuredWorkUrl="https://www.instagram.com/reel/DWRwdNLEcDF/"
      brandColors={{ primary: "#52c8f5", primaryDark: "#087aa8", accent: "#9de6ff", secondary: "#aeb9c5", background: "#05070a", surface: "#101820" }}
      services={["Real estate aerial photo and video", "Construction progress photos", "Roof and property imagery", "Land and farm aerials", "Boats, vehicles, and events"]}
      serviceAreas={["Pensacola, Florida"]} aboutText="Cameron shoots aerial photo and video around Pensacola."
      galleryItems={[
        { slug: "wide", title: "Property overview", imageUrl: "/images/profiles/precision-aerial/real-estate-aerial-01.jpg", imageAlt: "Wide property view" },
        { slug: "close", title: "Closer property view", imageUrl: "/images/profiles/precision-aerial/real-estate-aerial-02.jpg", imageAlt: "Closer property view" },
      ]}
      socials={[
        { label: "Instagram", handle: "@PrecisionAerialService", href: "https://www.instagram.com/precisionaerialservice/", kind: "instagram" },
        { label: "TikTok", handle: "@chillshots", href: "https://www.tiktok.com/@chillshots", kind: "tiktok" },
      ]}
      deliveryCustody="tradescout_pending_owner" onDirectConnect={onDirectConnect}
      trustActions={<div data-testid="trust-actions">Trust</div>}
      tradeScoutHandoff={<footer data-testid="tradescout-handoff">Powered by TradeScout</footer>}
    />));
    const theme = container.querySelector<HTMLElement>('[data-testid="default-profile-theme"]');
    expect(theme?.style.getPropertyValue("--profile-primary")).toBe("#52c8f5");
    expect(theme?.style.getPropertyValue("--profile-bg")).toBe("#05070a");
    expect(theme?.style.getPropertyValue("--profile-hero-fg")).toBe("#ffffff");
    const hero = container.querySelector('[data-testid="default-profile-hero"]');
    expect(hero).not.toBeNull();
    expect(container.querySelector('[data-testid="default-profile-header"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="default-profile-hero-identity"] h1')?.textContent).toBe("A better view.");
    expect(container.querySelector('img[alt="Aerial property view"]')).not.toBeNull();
    expect(container.querySelector('img[alt="Closer property view"]')).not.toBeNull();
    expect(container.querySelector('img[alt="Wide property view"]')).toBeNull();
    for (const text of ["Precision Aerial Services", "Cameron", "A better view.", "Pensacola, Florida", "@PrecisionAerialService", "@chillshots", "Watch reel", "Selected work", "Direct Connect"]) expect(container.textContent).toContain(text);
    for (const text of ["Choose what you need.", "Recent work.", "Featured"]) expect(container.textContent).not.toContain(text);
    expect(hero?.querySelector('[data-testid^="default-profile-service-"]')).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelectorAll('[data-testid^="default-profile-service-"]')).toHaveLength(5);
    expect(container.querySelector('[data-testid="default-profile-service-4"]')?.className).toContain("md:col-span-2");
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="default-profile-service-2"]')?.click());
    expect(onDirectConnect).toHaveBeenCalledWith("Roof and property imagery");
    for (const text of ["TradeScout securely holds requests", "Your details stay private", "private request"]) expect(container.textContent).not.toContain(text);
    expect(container.querySelector('[data-testid="trust-actions"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tradescout-handoff"]')).not.toBeNull();
    expect(container.textContent).toContain("Powered by TradeScout");
  });

  it("uses a deliberate brand-led state when a first-deliverable business has no media", () => {
    act(() => root.render(<DefaultProfileTheme businessName="North Shore Repair" presentationVariant="first-deliverable"
      categoryLabel="Home repair" locationLabel="Milwaukee, Wisconsin" heroTitle="Repairs done right."
      brandColors={{ primary: "#f59e0b", background: "#f8fafc", surface: "#ffffff" }} services={["Home repairs"]}
      serviceAreas={[]} galleryItems={[]} aboutText="" showAbout={false} showServiceAreas={false} showContact={false}
      onDirectConnect={onDirectConnect} trustActions={<div data-testid="dark-trust-actions">Dark trust</div>}
      lightTrustActions={<div data-testid="light-trust-actions">Light trust</div>}
      tradeScoutHandoff={<footer data-testid="tradescout-handoff">Powered by TradeScout</footer>} />));
    expect(container.querySelector('[data-testid="default-profile-brand-hero"]')).not.toBeNull();
    const theme = container.querySelector<HTMLElement>('[data-testid="default-profile-theme"]');
    expect(theme?.style.getPropertyValue("--profile-hero-fg")).toBe("#111418");
    expect(container.querySelector('[data-testid="default-profile-hero-identity"] h1')?.textContent).toBe("Repairs done right.");
    for (const text of ["New photos", "coming soon", "Direct Connect"]) expect(container.textContent).not.toContain(text);
    expect(onDirectConnect).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="dark-trust-actions"]')).toBeNull();
    expect(container.querySelector('[data-testid="light-trust-actions"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tradescout-handoff"]')).not.toBeNull();
    expect(container.textContent).toContain("Powered by TradeScout");
  });

  it("changes palette, content, media, and enabled sections using props only", () => {
    act(() => root.render(<DefaultProfileTheme businessName="Solstice Kitchen" categoryLabel="Restaurant" locationLabel="Austin, Texas"
      heroTitle="Dinner starts here." heroImageUrl="/restaurant/hero.jpg"
      brandColors={{ primary: "#dc2626", secondary: "#f59e0b", background: "#1c1917", surface: "#292524" }}
      services={["Dinner", "Private events"]} serviceAreas={[]} galleryItems={[]} aboutText="A neighborhood kitchen."
      badges={["Restaurant", "Private dining"]} stats={[{ label: "Services", value: "2" }]} showRecommendations={false}
      onDirectConnect={onDirectConnect} trustActions={<div data-testid="trust-actions">Trust</div>}
      tradeScoutHandoff={<footer data-testid="tradescout-handoff">Powered by TradeScout</footer>} />));
    const theme = container.querySelector<HTMLElement>('[data-testid="default-profile-theme"]');
    expect(theme?.style.getPropertyValue("--profile-primary")).toBe("#dc2626");
    expect(container.querySelector('img[src="/restaurant/hero.jpg"]')).not.toBeNull();
    for (const text of ["Solstice Kitchen", "A neighborhood kitchen.", "Private dining", "Services", "Dinner starts here."]) expect(container.textContent).toContain(text);
    // The old test required the filler heading the owner has rejected. Preserve content, not that sentence.
    expect(container.textContent).not.toContain("Choose what you need.");
    expect(container.querySelector('[data-presentation="business-editorial"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="default-profile-hero"]')).toBeNull();
    expect(container.textContent).not.toContain("Recommendations");
  });

  it("keeps service areas independent, drops empty detail shells, and rejects broken hero media", () => {
    act(() => root.render(<DefaultProfileTheme businessName="Harbor Workshop" heroTitle="Made locally."
      heroImageUrl="https://images.example.com/broken.jpg" services={[]} serviceAreas={["Mobile County"]} galleryItems={[]}
      showAbout={false} showServiceAreas showContact={false} onDirectConnect={onDirectConnect}
      trustActions={<div>Trust</div>} tradeScoutHandoff={<footer>Powered by TradeScout</footer>} />));
    expect(container.textContent).toContain("Mobile County");
    expect(container.querySelector('[data-testid="default-profile-details"]')).not.toBeNull();
    const heroImage = container.querySelector<HTMLImageElement>('img[src="https://images.example.com/broken.jpg"]');
    act(() => heroImage?.dispatchEvent(new Event("error")));
    expect(container.querySelector('[data-testid="default-profile-brand-hero"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="business-profile-cover"]')).toBeNull();
    act(() => root.render(<DefaultProfileTheme businessName="Harbor Workshop" services={[]} serviceAreas={[]} galleryItems={[]}
      aboutText="" showAbout showServiceAreas showContact={false} onDirectConnect={onDirectConnect}
      trustActions={<div>Trust</div>} tradeScoutHandoff={<footer>Powered by TradeScout</footer>} />));
    expect(container.querySelector('[data-testid="default-profile-details"]')).toBeNull();
  });

  it("does not present negative received feedback as a testimonial and labels authored targets", () => {
    act(() => root.render(<DefaultProfileTheme businessName="Field Notes" services={[]} serviceAreas={[]} galleryItems={[]}
      recommendations={[
        { id: "positive", recommendationType: "positive", comment: "Excellent work.", projectType: null, customerName: "A customer" },
        { id: "negative", recommendationType: "negative", comment: "Do not promote this as praise.", projectType: null, customerName: "Another customer" },
      ]} recommendationMode="received" showContact={false} onDirectConnect={onDirectConnect}
      trustActions={<div>Trust</div>} tradeScoutHandoff={<footer>Powered by TradeScout</footer>} />));
    expect(container.textContent).toContain("Excellent work.");
    expect(container.textContent).not.toContain("Do not promote this as praise.");
    act(() => root.render(<DefaultProfileTheme businessName="Field Notes" profileKind="community" services={[]} serviceAreas={[]} galleryItems={[]}
      recommendations={[{ id: "authored", recommendationType: "negative", comment: "Clear context.", projectType: null, customerName: "", subjectName: "Example Provider", subjectHref: "/u/example-provider" }]}
      recommendationMode="authored" showContact={false} onDirectConnect={onDirectConnect}
      trustActions={<div>Trust</div>} tradeScoutHandoff={<footer>Powered by TradeScout</footer>} />));
    expect(container.textContent).toContain("Does not recommend");
    expect(container.textContent).toContain("Example Provider");
    expect(container.querySelector('a[href="/u/example-provider"]')).not.toBeNull();
  });
});
