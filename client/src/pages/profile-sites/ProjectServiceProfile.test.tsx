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
    const choices = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    click(choices[0]);
    click(choices[1]);
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
});
