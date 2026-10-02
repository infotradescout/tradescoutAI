// @vitest-environment jsdom
import { act, useState, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProjectServiceProfile from "./ProjectServiceProfile";
import { ShareCardHost } from "@/components/share/ShareCardHost";
import { SHARE_CARD_EVENT } from "@/utils/share";
import ExpressDirectConnectPanel from "./ExpressDirectConnectPanel";
import { LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION as presentation } from "@shared/louisianaStoneSolutionsProfile";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
vi.mock("@/components/ShareButton", () => ({
  ShareButton: ({ label, destination }: any) => (
    <button data-destination={destination}>{label}</button>
  ),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
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

const photos = [
  base.galleryItems![0],
  {
    ...base.galleryItems![0],
    title: "Second photo",
    description: "Second description",
    imageUrl: "/second-photo.jpg",
    imageAlt: "Second project",
    slug: "second-photo",
    imageIndex: 1,
  },
];
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
    document.body.style.overflow = "";
    vi.unstubAllGlobals();
  });
  const click = (element: HTMLElement | null) => {
    expect(element).not.toBeNull();
    act(() => element?.click());
  };

  it("moves both service links into the chooser without creating a fragment entry or opening a request", () => {
    const onDirectConnect = vi.fn();
    act(() => root.render(<ProjectServiceProfile {...base} onDirectConnect={onDirectConnect} />));
    const heading = container.querySelector<HTMLHeadingElement>("#service-profile-services-title")!;
    heading.scrollIntoView = vi.fn();
    const previousUrl = window.location.href;
    const previousHistoryLength = window.history.length;
    for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href="#services"]')) {
      const navigation = new MouseEvent("click", { bubbles: true, cancelable: true });
      act(() => link.dispatchEvent(navigation));
      expect(navigation.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(heading);
    }
    expect(window.location.href).toBe(previousUrl);
    expect(window.history.length).toBe(previousHistoryLength);
    expect(onDirectConnect).not.toHaveBeenCalled();
  });

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
    const choices = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    click(choices[0]);
    click(choices[1]);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "2 selected: Countertops, Tile"
    );
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
    click(container.querySelector<HTMLButtonElement>(".service-profile-request button"));
    expect(onDirectConnect).toHaveBeenLastCalledWith(undefined);
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
    act(() =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      )
    );
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
  it("delegates focus, Tab and Escape to the native portaled share card before resuming the gallery", async () => {
    act(() =>
      root.render(
        <ProjectServiceProfile {...base} galleryItems={photos} trustActions={<ShareCardHost />} />
      )
    );
    const opener = container.querySelector<HTMLButtonElement>('[aria-label="Open Second photo"]')!;
    act(() => opener.click());
    const gallery = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const share = gallery.querySelector<HTMLButtonElement>("[data-destination]")!;
    await act(async () => {
      share.focus();
      window.dispatchEvent(
        new CustomEvent(SHARE_CARD_EVENT, {
          detail: {
            url: `https://www.thetradescout.com${share.dataset.destination}`,
            title: "Second photo",
            text: "Second description",
            kind: "profile",
          },
        })
      );
    });
    const card = document.querySelector<HTMLElement>('[data-testid="share-card"]')!;
    expect(card).not.toBeNull();
    expect(container.contains(card)).toBe(false);
    expect(card.contains(document.activeElement)).toBe(true);
    const note = card.querySelector<HTMLTextAreaElement>("textarea")!;
    act(() => note.focus());
    expect(document.activeElement).toBe(note);
    act(() =>
      note.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    );
    act(() =>
      note.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }))
    );
    expect(gallery.textContent).toContain("2 of 2");
    const buttons = [...card.querySelectorAll<HTMLButtonElement>("button")];
    act(() => buttons[buttons.length - 1].focus());
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    act(() => document.activeElement?.dispatchEvent(tab));
    expect(tab.defaultPrevented).toBe(true);
    expect(card.contains(document.activeElement)).toBe(true);
    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.querySelector('[data-testid="share-card"]')).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBe(gallery);
    expect(gallery.contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    act(() =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      )
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("retains navigation focus and restores the original opener and body style", () => {
    document.body.style.overflow = "scroll";
    act(() => root.render(<ProjectServiceProfile {...base} galleryItems={photos} />));
    const opener = container.querySelector<HTMLButtonElement>('[aria-label="View full photo"]')!;
    opener.focus();
    click(opener);
    const gallery = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const next = gallery.querySelector<HTMLButtonElement>('[aria-label="Next photo"]')!;
    next.focus();
    click(next);
    expect(document.activeElement).toBe(next);
    expect(gallery.textContent).toContain("2 of 2");
    act(() =>
      next.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    );
    expect(gallery.textContent).toContain("1 of 2");
    expect(document.activeElement).toBe(next);
    click(gallery.querySelector('[aria-label="Close gallery"]'));
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe("scroll");
    document.body.style.overflow = "";
  });

  it("closes on source changes without restoring focus to a reused thumbnail, and never revives stale selection", () => {
    act(() => root.render(<ProjectServiceProfile {...base} galleryItems={photos} />));
    const opener = container.querySelector<HTMLButtonElement>('[aria-label="View full photo"]')!;
    click(opener);
    const focus = vi.spyOn(opener, "focus");
    const changed = photos.map((item) => ({ ...item, description: "Updated source" }));
    act(() => root.render(<ProjectServiceProfile {...base} galleryItems={changed} />));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(focus).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe("");
    act(() => root.render(<ProjectServiceProfile {...base} galleryItems={photos} />));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    click(opener);
    act(() =>
      root.render(
        <ProjectServiceProfile {...base} profileSlug="other-business" galleryItems={photos} />
      )
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("");
    focus.mockRestore();
  });

  it("keeps equivalent photo sources open and injects the missing hero first without changing item slugs", () => {
    act(() => root.render(<ProjectServiceProfile {...base} galleryItems={[photos[1]]} />));
    click(container.querySelector('[aria-label="View full photo"]'));
    const gallery = container.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(gallery.textContent).toContain("1 of 2");
    expect(gallery.querySelector("[data-destination]")?.getAttribute("data-destination")).toBe(
      "/u/louisiana-stone-solutions/gallery/profile-photo"
    );
    click(gallery.querySelector('[aria-label="Next photo"]'));
    expect(gallery.querySelector("img")?.getAttribute("src")).toBe(photos[1].imageUrl);
    expect(gallery.querySelector("[data-destination]")?.getAttribute("data-destination")).toBe(
      "/u/louisiana-stone-solutions/gallery/second-photo"
    );
    act(() => root.render(<ProjectServiceProfile {...base} galleryItems={[{ ...photos[1] }]} />));
    expect(container.querySelector('[role="dialog"]')).toBe(gallery);
    expect(gallery.textContent).toContain("2 of 2");
    act(() => root.render(null));
    expect(document.body.style.overflow).toBe("");
  });

  it.each([
    { galleryItems: [photos[1], photos[0]] },
    { galleryItems: [photos[0]] },
    { presentation: { ...presentation, heroImage: "/new-hero.jpg" } },
    { profileShareDestination: "/u/new-destination" },
    {
      publicRouteContentBlocks: [
        { type: "publicDiscovery", data: { routes: { gallery: "photos" } } },
      ],
    },
  ])("closes the active gallery when its effective source changes: %j", (change) => {
    act(() => root.render(<ProjectServiceProfile {...base} galleryItems={photos} />));
    click(container.querySelector('[aria-label="Open Second photo"]'));
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => root.render(<ProjectServiceProfile {...base} galleryItems={photos} {...change} />));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("ignores consumed and unrelated arrow events and closes on the gallery backdrop", () => {
    act(() => root.render(<ProjectServiceProfile {...base} galleryItems={photos} />));
    const opener = container.querySelector<HTMLButtonElement>('[aria-label="View full photo"]')!;
    click(opener);
    const gallery = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const consumed = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    consumed.preventDefault();
    act(() => document.activeElement?.dispatchEvent(consumed));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })));
    expect(gallery.textContent).toContain("1 of 2");
    act(() => gallery.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe("");
  });
});
