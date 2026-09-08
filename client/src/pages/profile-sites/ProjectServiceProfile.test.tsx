// @vitest-environment jsdom
import { act, useState, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProjectServiceProfile from "./ProjectServiceProfile";
import ExpressDirectConnectPanel from "./ExpressDirectConnectPanel";
import { LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION as presentation } from "@shared/louisianaStoneSolutionsProfile";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
vi.mock("@/components/ShareButton", () => ({
  ShareButton: ({ label, destination }: any) => (
    <button data-destination={destination}>{label}</button>
  ),
}));
vi.mock("wouter", () => ({ Link: ({ href, children }: any) => <a href={href}>{children}</a> }));

const base: ComponentProps<typeof ProjectServiceProfile> = {
  profileSlug: "louisiana-stone-solutions",
  businessName: "Louisiana Stone Solutions",
  presentation,
  onDirectConnect: () => {},
  canCall: false,
  hasViewerSession: false,
  tradeScoutReturnHref: "/",
  profileShareDestination: "/u/louisiana-stone-solutions",
  trustActions: null,
  verifiedBadge: false,
  verificationStatus: "pending",
  communityVerification: null,
  galleryItems: [
    {
      itemType: "gallery",
      title: "Kitchen photo",
      hasPublicTitle: true,
      description: "Photo shared by the business.",
      imageUrl: presentation.heroImage,
      imageAlt: presentation.heroImageAlt,
      slug: "countertop-kitchen",
      blockIndex: 5,
      imageIndex: 0,
    },
  ],
};

function installVisibilityObserver() {
  const instances: TestVisibilityObserver[] = [];
  class TestVisibilityObserver {
    observe = vi.fn<(target: Element) => void>();
    disconnect = vi.fn();

    constructor(private readonly callback: IntersectionObserverCallback) {
      instances.push(this);
    }

    emit(isIntersecting: boolean) {
      const target = this.observe.mock.calls.at(-1)?.[0];
      expect(target).toBeInstanceOf(HTMLElement);
      act(() =>
        this.callback(
          [
            {
              target,
              isIntersecting,
              intersectionRatio: isIntersecting ? 1 : 0,
            } as IntersectionObserverEntry,
          ],
          this as unknown as IntersectionObserver
        )
      );
    }
  }
  vi.stubGlobal("IntersectionObserver", TestVisibilityObserver);
  return instances;
}

describe("Project service profile review", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: vi.fn(() => true),
    });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  const click = (element: HTMLElement | null) => {
    expect(element).not.toBeNull();
    act(() => element?.click());
  };

  it("carries all chosen services into the actual request form, with no request sent on selection or opening", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    function Journey() {
      const [open, setOpen] = useState(false);
      const [service, setService] = useState<string>();
      return (
        <>
          <ProjectServiceProfile
            {...base}
            onDirectConnect={(name) => {
              setService(name);
              setOpen(true);
            }}
          />
          <ExpressDirectConnectPanel
            open={open}
            onClose={() => setOpen(false)}
            profileSlug={base.profileSlug}
            businessName={base.businessName}
            hasViewerSession={false}
            allowCall={false}
            requestMode="service"
            initialServiceName={service}
            initialView="request"
            stayInProfile
          />
        </>
      );
    }
    act(() => root.render(<Journey />));
    const servicePicker = container.querySelector<HTMLDetailsElement>("details");
    expect(servicePicker?.open).toBe(false);
    click(servicePicker?.querySelector("summary") || null);
    expect(servicePicker?.open).toBe(true);
    const choices = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    click(choices[0]);
    click(choices[1]);
    expect(servicePicker?.querySelector("summary")?.textContent).toContain("2 services selected");
    click(servicePicker?.querySelector("summary") || null);
    expect(servicePicker?.open).toBe(false);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    click(container.querySelector<HTMLButtonElement>(".service-profile-request button"));
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("Louisiana Stone Solutions");
    expect(dialog?.querySelector("textarea")?.value).toBe("I'm interested in Countertops, Tile.");
    expect(dialog?.querySelector("select")?.value).toBe("request_service");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("allows correction and a general request without forcing a service selection", () => {
    const onDirectConnect = vi.fn();
    act(() => root.render(<ProjectServiceProfile {...base} onDirectConnect={onDirectConnect} />));
    const servicePicker = container.querySelector<HTMLDetailsElement>("details");
    expect(servicePicker?.open).toBe(false);
    click(container.querySelector<HTMLButtonElement>(".service-profile-request button"));
    expect(onDirectConnect).toHaveBeenLastCalledWith(undefined);
    click(servicePicker?.querySelector("summary") || null);
    const first = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    click(first);
    click(first);
    click(container.querySelector<HTMLButtonElement>(".service-profile-request button"));
    expect(onDirectConnect).toHaveBeenCalledWith(undefined);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe("");
  });

  it("shows the sole photo once, retains its shared destination and opens the full image", () => {
    act(() =>
      root.render(<ProjectServiceProfile {...base} sharedGallerySlug="countertop-kitchen" />)
    );
    expect(container.querySelectorAll(`img[src="${presentation.heroImage}"]`)).toHaveLength(1);
    expect(
      container.querySelector("#profile-gallery-countertop-kitchen")?.getAttribute("data-shared")
    ).toBe("true");
    const photo = container.querySelector<HTMLButtonElement>('[aria-label="View full photo"]');
    photo?.focus();
    click(photo);
    expect(container.querySelector('[role="dialog"] img')?.getAttribute("src")).toBe(
      presentation.heroImage
    );
    expect(container.querySelector('[aria-label="Next photo"]')).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(photo);
    expect(document.body.style.overflow).toBe("");
  });

  it("does not invent a phone, badge, credentials, reviews or About section for the sparse admin profile", () => {
    act(() => root.render(<ProjectServiceProfile {...base} />));
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(6);
    expect(container.querySelector("#company")).toBeNull();
    expect(container.textContent).not.toMatch(
      /Verified business|Credentials|Customer recommendations|Call|Sign in/
    );
    expect(container.innerHTML).not.toMatch(/href="(?:tel|mailto):/);
    expect(container.querySelector("h1")?.textContent).toBe(base.businessName);
  });

  it("keeps a hero-only profile viewable when no gallery block exists", () => {
    act(() => root.render(<ProjectServiceProfile {...base} galleryItems={[]} />));
    click(container.querySelector<HTMLButtonElement>('[aria-label="View full photo"]'));
    expect(container.querySelector('[role="dialog"] img')?.getAttribute("src")).toBe(
      presentation.heroImage
    );
  });

  it("keeps a request available without reserving a photo element when media is absent", () => {
    const onDirectConnect = vi.fn();
    act(() =>
      root.render(
        <ProjectServiceProfile
          {...base}
          presentation={{ ...presentation, heroImage: "", heroImageAlt: "", logoImage: "" }}
          galleryItems={[]}
          onDirectConnect={onDirectConnect}
        />
      )
    );
    expect(container.querySelector("figure")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[aria-label="Photos"]')).toBeNull();
    expect(container.querySelector('[aria-label="View full photo"]')).toBeNull();
    expect(container.querySelector("h1")?.textContent).toBe(base.businessName);
    click(container.querySelector<HTMLButtonElement>(".service-profile-request button"));
    expect(onDirectConnect).toHaveBeenCalledWith(undefined);
  });

  it("keeps gallery items and their exact shared destination available without a hero", () => {
    act(() =>
      root.render(
        <ProjectServiceProfile
          {...base}
          presentation={{ ...presentation, heroImage: "", heroImageAlt: "" }}
          sharedGallerySlug="countertop-kitchen"
        />
      )
    );
    expect(container.querySelector("figure")).toBeNull();
    expect(container.querySelectorAll(`img[src="${presentation.heroImage}"]`)).toHaveLength(1);
    const galleryItem = container.querySelector("#profile-gallery-countertop-kitchen");
    expect(galleryItem?.getAttribute("data-shared")).toBe("true");
    click(galleryItem?.querySelector("button") || null);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.querySelector("img")?.getAttribute("src")).toBe(presentation.heroImage);
    expect(dialog?.querySelector("[data-destination]")?.getAttribute("data-destination")).toBe(
      "/u/louisiana-stone-solutions/gallery/countertop-kitchen"
    );
  });

  it("shows the mobile request only when the main action is outside view and preserves its service context", () => {
    const observers = installVisibilityObserver();
    const onDirectConnect = vi.fn();
    act(() => root.render(<ProjectServiceProfile {...base} onDirectConnect={onDirectConnect} />));
    const primary = container.querySelector<HTMLButtonElement>(".service-profile-request button");
    const mobile = container.querySelector<HTMLElement>(".service-profile-mobile-request");
    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalledExactlyOnceWith(primary);
    observers[0].emit(true);
    expect(mobile?.hidden).toBe(true);
    observers[0].emit(false);
    expect(mobile?.hidden).toBe(false);
    click(container.querySelector("details summary"));
    click(container.querySelector<HTMLInputElement>('input[type="checkbox"]'));
    click(mobile?.querySelector("button") || null);
    expect(onDirectConnect).toHaveBeenCalledExactlyOnceWith("Countertops");
    expect(mobile?.querySelector("button")?.textContent).toBe(primary?.textContent);
    observers[0].emit(true);
    expect(mobile?.hidden).toBe(true);
  });

  it("keeps keyboard focus on an available action when the primary request scrolls into view", () => {
    const observers = installVisibilityObserver();
    act(() => root.render(<ProjectServiceProfile {...base} />));
    const primary = container.querySelector<HTMLButtonElement>(".service-profile-request button");
    const mobile = container.querySelector<HTMLButtonElement>(
      ".service-profile-mobile-request button"
    );
    observers[0].emit(false);
    mobile?.focus();
    expect(document.activeElement).toBe(mobile);
    observers[0].emit(true);
    expect([primary, mobile]).toContain(document.activeElement);
    expect(document.activeElement?.closest("[hidden]")).toBeNull();
  });

  it("disconnects visibility observers and clears selected services when the profile changes", () => {
    const observers = installVisibilityObserver();
    const onDirectConnect = vi.fn();
    act(() => root.render(<ProjectServiceProfile {...base} onDirectConnect={onDirectConnect} />));
    click(container.querySelector("details summary"));
    click(container.querySelector<HTMLInputElement>('input[type="checkbox"]'));
    act(() =>
      root.render(
        <ProjectServiceProfile
          {...base}
          profileSlug="other-local-business"
          onDirectConnect={onDirectConnect}
        />
      )
    );
    expect(observers).toHaveLength(2);
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(
      false
    );
    click(container.querySelector<HTMLButtonElement>(".service-profile-request button"));
    expect(onDirectConnect).toHaveBeenCalledExactlyOnceWith(undefined);
    act(() => root.render(null));
    expect(observers[1].disconnect).toHaveBeenCalledOnce();
  });
});
