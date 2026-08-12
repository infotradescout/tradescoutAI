// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_ANONYMOUS_CATALOG, JW_STONE_NAMED_CATALOG } from "@/features/jw-stone/catalog";
import {
  STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH,
  STEEL_HOME_PACKAGES_PROFILE_CONTENT as content,
  STEEL_HOME_PACKAGES_START_REQUEST_PATH,
} from "@shared/steelHomePackagesProfile";
import SteelHomePackagesProfile from "./SteelHomePackagesProfile";
import { STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY } from "./steel-home-project-tools/projectModel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("./TradeScoutProfileHandoff", () => ({
  default: () => <footer data-testid="tradescout-handoff">Powered by TradeScout</footer>,
}));

const FORBIDDEN_PUBLIC_COPY = [
  "Worldwide Steel Buildings",
  "JW Stone Logistics",
  "A+ Cabinets",
  "TradePartner",
  "complete home package",
  "turnkey home",
  "one package quote",
];

function setControlValue(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function setSelectValue(control: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function flushUi() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("SteelHomePackagesProfile", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  function renderProfile(platformBaseHref = "") {
    act(() => {
      root.render(
        <SteelHomePackagesProfile
          requestHref={STEEL_HOME_PACKAGES_START_REQUEST_PATH}
          laborRequestHref={STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH}
          platformBaseHref={platformBaseHref}
        />
      );
    });
  }

  it("renders three working TradeScout design tools without exposing fulfillment names", () => {
    renderProfile();

    const text = container.textContent || "";
    expect(text).toContain(content.hero.headline);
    expect(text).toContain(content.toolIntro.title);
    expect(text).toContain(content.tools.building.title);
    expect(text).toContain(content.tools.countertops.title);
    expect(text).toContain(content.tools.cabinets.title);
    expect(text).toContain(content.review.title);
    expect(text).toContain(content.disclosure);

    for (const forbidden of FORBIDDEN_PUBLIC_COPY) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
      expect(container.innerHTML.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }

    const profile = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-packages-profile"]'
    );
    expect(profile?.dataset.releaseState).toBe("unlisted");
    expect(profile?.className).toContain("pt-[72px]");
    expect(profile?.querySelector("header")?.className).toContain("fixed");

    for (const testId of [
      "steel-home-building-designer",
      "steel-home-countertop-designer",
      "steel-home-cabinet-designer",
      "steel-home-project-review",
    ]) {
      expect(container.querySelector(`[data-testid="${testId}"]`)).not.toBeNull();
    }
    expect(container.querySelector('[data-testid="steel-home-building-preview"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="steel-home-countertop-preview"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="steel-home-cabinet-preview"]')).not.toBeNull();
    expect(text).not.toMatch(/\$\s?\d/);
  });

  it("offers only real named stone records and uses their neutral exact-image route", () => {
    renderProfile();

    const selector = container.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-countertop-all-stones"]'
    );
    const options = Array.from(selector?.options || []);
    expect(options).toHaveLength(JW_STONE_NAMED_CATALOG.length);
    expect(options.map((option) => option.value)).toEqual(
      [...JW_STONE_NAMED_CATALOG]
        .sort((a, b) => a.publicLabel.localeCompare(b.publicLabel))
        .map((stone) => stone.id)
    );
    expect(options.map((option) => option.value)).not.toEqual(
      expect.arrayContaining(JW_STONE_ANONYMOUS_CATALOG.map((stone) => stone.id))
    );

    const quickStoneImages = Array.from(
      container.querySelectorAll<HTMLImageElement>(
        '[data-testid^="steel-home-countertop-stone-"] img'
      )
    );
    expect(quickStoneImages).toHaveLength(6);
    for (const image of quickStoneImages) {
      expect(image.src).toMatch(/\/images\/stone-designer\/[a-z0-9-]+\/1\.webp$/);
      expect(image.src.toLowerCase()).not.toContain("jw-stone");
      expect(image.alt).toMatch(/real stone inventory photograph$/);
    }

    const previewImage = container.querySelector("svg image");
    expect(previewImage?.getAttribute("href")).toBe("/images/stone-designer/cristallo/1.webp");
  });

  it("updates live designs and sends the exact completed brief instead of a blank template", () => {
    renderProfile();

    const width = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-building-width"]'
    );
    if (!width) throw new Error("Building width control missing");
    setControlValue(width, "");
    expect(width.value).toBe("");
    setControlValue(width, "5");
    expect(
      container.querySelector<SVGElement>('[data-testid="steel-home-building-preview"]')
        ?.textContent
    ).toContain("40' × 60' × 14'");
    setControlValue(width, "54");
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-building-include"]')
        ?.click();
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-stone-taj-mahal"]')
        ?.click();
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-include"]')
        ?.click();
    });
    const cabinetLayout = container.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-cabinet-layout"]'
    );
    const cabinetDoorStyle = container.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-cabinet-door-style"]'
    );
    if (!cabinetLayout || !cabinetDoorStyle) throw new Error("Cabinet style controls missing");
    setSelectValue(cabinetLayout, "u-shape");
    setSelectValue(cabinetDoorStyle, "Glass accent");
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-cabinet-finish-navy"]')
        ?.click();
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-cabinet-include"]')
        ?.click();
    });

    const location = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-project-location"]'
    );
    const state = container.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-state"]'
    );
    const timing = container.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-timing"]'
    );
    if (!location || !state || !timing) throw new Error("Project detail controls missing");
    setControlValue(location, "Ocean Springs, MS 39564");
    setSelectValue(state, "MS");
    const county = container.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-county"]'
    );
    if (!county) throw new Error("Project county control missing");
    setSelectValue(county, "28059");
    setSelectValue(timing, "Within 6 months");

    const buildingPreview = container.querySelector<SVGElement>(
      '[data-testid="steel-home-building-preview"]'
    );
    expect(buildingPreview?.textContent).toContain("54' × 60' × 14'");
    expect(container.querySelector("svg image")?.getAttribute("href")).toBe(
      "/images/stone-designer/taj-mahal/1.webp"
    );
    const cabinetPreview = container.querySelector<SVGElement>(
      '[data-testid="steel-home-cabinet-preview"]'
    );
    expect(cabinetPreview?.textContent).toContain("U-SHAPED");
    expect(cabinetPreview?.querySelector('rect[fill="#334658"]')).not.toBeNull();
    expect(cabinetPreview?.querySelector('rect[fill="rgba(120,164,168,.5)"]')).not.toBeNull();

    const brief = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-project-brief"]'
    )?.textContent;
    expect(brief).toContain("Designs ready for review: Building, Countertops, Cabinets");
    expect(brief).toContain("Project location: Ocean Springs, MS 39564 — Jackson County, MS");
    expect(brief).toContain("54' wide × 60' long × 14' eave");
    expect(brief).toContain("Selected real stone: Taj Mahal — Quartzite");
    expect(brief).toContain("Stone record: taj-mahal");
    expect(brief).toContain("Stone image: /images/stone-designer/taj-mahal/1.webp");
    expect(brief).toContain("Style: Glass accent; Navy; Matte black");

    const request = container.querySelector<HTMLAnchorElement>(
      'a[data-testid="steel-home-project-request"]'
    );
    expect(request).not.toBeNull();
    const url = new URL(request?.getAttribute("href") || "", "https://www.thetradescout.com");
    expect(url.pathname).toBe("/direct-connect");
    expect(url.searchParams.get("profileName")).toBe("TradeScout project desk");
    expect(url.searchParams.get("title")).toBe(
      "Steel-home design review: Building + Countertops + Cabinets"
    );
    expect(url.searchParams.get("description")).toBe(brief);
    expect(url.searchParams.get("location")).toBe("Ocean Springs, MS 39564");
    expect(url.searchParams.get("county")).toBe("28059");
    expect(url.searchParams.get("state")).toBe("MS");
    expect(url.searchParams.get("when")).toBe("Within 6 months");

    for (const forbidden of FORBIDDEN_PUBLIC_COPY.slice(0, 4)) {
      expect(request?.href.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("saves the working draft across a remount and keeps labor separate and untargeted", async () => {
    renderProfile();
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-stone-blue-goias"]')
        ?.click();
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-include"]')
        ?.click();
    });
    const location = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-project-location"]'
    );
    const state = container.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-state"]'
    );
    if (!location || !state) throw new Error("Project location controls missing");
    setControlValue(location, "Biloxi, MS");
    setSelectValue(state, "MS");
    const county = container.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-county"]'
    );
    if (!county) throw new Error("Project county control missing");
    setSelectValue(county, "28047");
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-labor-stone-fabrication"]')
        ?.click();
    });
    await flushUi();
    expect(window.localStorage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toContain(
      '"stoneId":"blue-goias"'
    );

    act(() => root.unmount());
    root = createRoot(container);
    renderProfile();
    await flushUi();

    expect(
      container.querySelector<HTMLSelectElement>('[data-testid="steel-home-countertop-all-stones"]')
        ?.value
    ).toBe("blue-goias");
    expect(
      container.querySelector<HTMLInputElement>('[data-testid="steel-home-project-location"]')
        ?.value
    ).toBe("Biloxi, MS");
    expect(
      container.querySelector<HTMLSelectElement>('[data-testid="steel-home-project-state"]')?.value
    ).toBe("MS");
    expect(
      container.querySelector<HTMLSelectElement>('[data-testid="steel-home-project-county"]')?.value
    ).toBe("28047");

    const labor = container.querySelector<HTMLAnchorElement>(
      'a[data-testid="steel-home-labor-request"]'
    );
    expect(labor).not.toBeNull();
    const laborUrl = new URL(labor?.getAttribute("href") || "", "https://www.thetradescout.com");
    expect(laborUrl.searchParams.get("subject")).toBe("service");
    expect(laborUrl.searchParams.get("source")).toBe("steel_home_project_tools_labor");
    expect(laborUrl.searchParams.get("county")).toBe("28047");
    expect(laborUrl.searchParams.get("state")).toBe("MS");
    expect(laborUrl.searchParams.get("description")).toContain(
      "Countertop concept: Kitchen; Blue Goias (blue-goias)"
    );
    for (const forbiddenTarget of [
      "profile",
      "profileName",
      "target",
      "targetProviderId",
      "contractorId",
    ]) {
      expect(laborUrl.searchParams.has(forbiddenTarget)).toBe(false);
    }
  });

  it("changes designer geometry when porch, run, return-wall, and ceiling controls change", () => {
    renderProfile();

    const porch = container.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-building-porch"]'
    );
    const porchDepth = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-building-porch-depth"]'
    );
    if (!porch || !porchDepth) throw new Error("Building porch controls missing");
    expect(
      container.querySelector('[data-testid="steel-home-building-front-porch-preview"]')
    ).not.toBeNull();
    setSelectValue(porch, "side");
    expect(
      container.querySelector('[data-testid="steel-home-building-front-porch-preview"]')
    ).toBeNull();
    const sidePorch = container.querySelector(
      '[data-testid="steel-home-building-side-porch-preview"]'
    );
    expect(sidePorch).not.toBeNull();
    expect(sidePorch?.getAttribute("data-porch-depth")).toBe("8");
    setControlValue(porchDepth, "16");
    expect(
      container
        .querySelector('[data-testid="steel-home-building-side-porch-preview"]')
        ?.getAttribute("data-porch-depth")
    ).toBe("16");

    const countertopPath = container.querySelector<SVGPathElement>(
      '[data-testid="steel-home-countertop-layout-preview"]'
    );
    const countertopRun = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-countertop-run-a"]'
    );
    if (!countertopPath || !countertopRun) throw new Error("Countertop geometry controls missing");
    const initialCountertopPath = countertopPath.getAttribute("d");
    setControlValue(countertopRun, "220");
    expect(
      container
        .querySelector('[data-testid="steel-home-countertop-layout-preview"]')
        ?.getAttribute("d")
    ).not.toBe(initialCountertopPath);

    const cabinetPath = container.querySelector<SVGPathElement>(
      '[data-testid="steel-home-cabinet-layout-preview"]'
    );
    const returnWall = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-cabinet-return-wall"]'
    );
    const ceiling = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-cabinet-ceiling-height"]'
    );
    const ceilingLine = container.querySelector<SVGLineElement>(
      '[data-testid="steel-home-cabinet-ceiling-preview"]'
    );
    if (!cabinetPath || !returnWall || !ceiling || !ceilingLine) {
      throw new Error("Cabinet geometry controls missing");
    }
    const initialCabinetPath = cabinetPath.getAttribute("d");
    const initialCeilingY = ceilingLine.getAttribute("y1");
    setControlValue(returnWall, "300");
    setControlValue(ceiling, "132");
    expect(
      container
        .querySelector('[data-testid="steel-home-cabinet-layout-preview"]')
        ?.getAttribute("d")
    ).not.toBe(initialCabinetPath);
    expect(
      container
        .querySelector('[data-testid="steel-home-cabinet-ceiling-preview"]')
        ?.getAttribute("y1")
    ).not.toBe(initialCeilingY);
  });

  it("keeps in-page navigation on the profile and gives every raster image useful alt text", () => {
    renderProfile("https://www.thetradescout.com");

    const target = container.querySelector<HTMLElement>("#countertop-designer");
    const scrollIntoView = vi.fn();
    if (target) target.scrollIntoView = scrollIntoView;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-hero-tool-countertops"]')
        ?.click();
    });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')).toHaveLength(0);

    const images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
    expect(images.length).toBeGreaterThanOrEqual(9);
    expect(images.every((image) => Boolean(image.alt.trim()))).toBe(true);
  });
});
