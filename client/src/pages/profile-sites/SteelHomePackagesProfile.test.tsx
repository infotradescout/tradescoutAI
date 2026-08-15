// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_ANONYMOUS_CATALOG, JW_STONE_NAMED_CATALOG } from "@/features/jw-stone/catalog";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
import { readStagedDirectConnectEntryContext } from "@/pages/direct-connect/stagedDirectConnectEntryContext";
import { SHARE_CARD_EVENT, type ShareCardPayload } from "@/utils/share";
import {
  STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH,
  STEEL_HOME_PACKAGES_START_REQUEST_PATH,
} from "@shared/steelHomePackagesProfile";
import { buildSteelHomeBuilderPath } from "@shared/steelHomeBuilderRoutes";
import SteelHomePackagesProfile from "./SteelHomePackagesProfile";
import { buildCountertopStudioShareUrl } from "./steel-home-project-tools/countertopStudioShare";
import { buildNamedStoneDesignerImageHref } from "./steel-home-project-tools/stoneDesignerImages";
import {
  STEEL_HOME_BUILDERS,
  plannerLauncherId,
  type SteelHomePlanner,
  plannerPanelId,
} from "./steel-home-project-tools/SteelHomeBuilderDirectory";
import {
  STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY,
  createEmptySteelHomeProjectDraft,
} from "./steel-home-project-tools/projectModel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const FORBIDDEN_PUBLIC_COPY = [
  "Worldwide Steel Buildings",
  "JW Stone Logistics",
  "A+ Cabinets",
  "TradePartner",
  "supplier cost",
  "wholesale cost",
  "markup",
  "margin",
  "commission",
  "owner-builder",
  "owner builder",
  "owner-built",
  "owner built",
  "project dashboard",
  "project setup",
  "whole home",
  "whole-home",
  "summary & request",
  "project workspace",
  "previous planner",
  "next planner",
  "selected packages",
  "handoff",
  "staged",
  "payload",
  "provider id",
  "profile slug",
  "release state",
  "fips",
];

const BUILDER_REQUEST_DETAILS_STORAGE_KEY = "tradescout:steel-home-builders:request-details:v1";
const LEGACY_V7_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY =
  "tradescout:steel-home-project-tools:draft:v7";

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

function typeCharacterByCharacter(control: HTMLInputElement, value: string) {
  setControlValue(control, "");
  for (const character of value) {
    setControlValue(control, `${control.value}${character}`);
  }
}

function setSelectValue(control: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Required test element missing: ${selector}`);
  return element;
}

function namedStonePhotoHref(stoneId: string, imageIndex = 0): string {
  const stone = JW_STONE_NAMED_CATALOG.find((item) => item.id === stoneId);
  if (!stone) throw new Error(`Named stone missing: ${stoneId}`);
  const href = buildNamedStoneDesignerImageHref(
    stone.shareSlug || "",
    stone.images[imageIndex] || ""
  );
  if (!href) throw new Error(`Named stone photo missing: ${stoneId} photo ${imageIndex + 1}`);
  return href;
}

function enableCountertopIsland(panel: ParentNode) {
  const toggle = requiredElement<HTMLInputElement>(
    panel,
    '[data-testid="steel-home-countertop-island"]'
  );
  if (!toggle.checked) act(() => toggle.click());
}

function pressKey(control: Element, key: string, options: KeyboardEventInit = {}) {
  act(() => {
    control.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key, ...options }));
  });
}

async function flushUi() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function userFacingText(container: HTMLElement): string {
  return [
    container.textContent || "",
    ...Array.from(container.querySelectorAll<HTMLElement>("[aria-label], [title]"), (item) =>
      [item.getAttribute("aria-label"), item.getAttribute("title")].filter(Boolean).join(" ")
    ),
    ...Array.from(
      container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[placeholder]"),
      (item) => item.placeholder
    ),
    ...Array.from(container.querySelectorAll<HTMLImageElement>("img[alt]"), (item) => item.alt),
  ].join("\n");
}

describe("SteelHomePackagesProfile three-planner experience", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/u/steel-home-packages");
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.style.overflow = "";
  });

  function renderProfile(platformBaseHref = "") {
    act(() => {
      root.render(
        <SteelHomePackagesProfile
          requestHref={qualifyPublicProfileItemDestination(
            STEEL_HOME_PACKAGES_START_REQUEST_PATH,
            platformBaseHref
          )}
          laborRequestHref={qualifyPublicProfileItemDestination(
            STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH,
            platformBaseHref
          )}
          platformBaseHref={platformBaseHref}
        />
      );
    });
  }

  function openPlanner(planner: SteelHomePlanner) {
    const openWorkbench = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-builder-workbench"]'
    );
    if (openWorkbench && openWorkbench.dataset.builder !== planner) {
      const close = openWorkbench.querySelector<HTMLButtonElement>(
        '[data-testid="steel-home-builder-close"]'
      );
      if (!close) throw new Error("Open builder close action missing");
      act(() => close.click());
    }

    if (!container.querySelector(`[data-testid="${plannerPanelId(planner)}"]`)) {
      const launcher = container.querySelector<HTMLButtonElement>(
        `[data-testid="${plannerLauncherId(planner)}"]`
      );
      if (!launcher) throw new Error(`${planner} builder launcher missing`);
      act(() => launcher.click());
    }

    const panel = container.querySelector<HTMLElement>(`#${plannerPanelId(planner)}`);
    const workbench = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-builder-workbench"]'
    );
    if (!panel || !workbench) throw new Error(`${planner} builder workbench missing`);
    expect(workbench.dataset.builder).toBe(planner);
    return panel;
  }

  function startRequest(
    planner: SteelHomePlanner,
    countertopIntent: "stone" | "fabricator" = "stone"
  ) {
    const panel = openPlanner(planner);
    const button =
      planner === "countertops"
        ? panel.querySelector<HTMLButtonElement>(
            `[data-testid="steel-home-countertop-${
              countertopIntent === "stone" ? "request-stone" : "find-fabricator"
            }"]`
          )
        : panel.querySelector<HTMLButtonElement>(
            `[data-testid="steel-home-${planner === "cabinets" ? "cabinet" : "building"}-include"]`
          );
    if (!button) throw new Error(`${planner} request action missing`);
    expect(button.textContent).toContain(
      planner === "countertops"
        ? countertopIntent === "stone"
          ? "Request this stone"
          : "Find a fabricator"
        : "Start a Request"
    );
    act(() => button.click());
    const drawer = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-planner-request"]'
    );
    if (!drawer) throw new Error(`${planner} request drawer missing`);
    const dialog = drawer.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("data-planner")).toBe(planner);
    expect(dialog?.getAttribute("data-request-intent")).toBe(
      planner === "countertops" ? countertopIntent : "builder"
    );
    return drawer;
  }

  function closeRequest() {
    const close = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-planner-request-close"]'
    );
    if (!close) throw new Error("Request drawer close button missing");
    act(() => close.click());
    expect(container.querySelector('[data-testid="steel-home-planner-request"]')).toBeNull();
  }

  function completeRequestDetails(drawer: HTMLElement, locationText: string) {
    const role = drawer.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-project-role-self-contracted"]'
    );
    const location = drawer.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-project-location"]'
    );
    const state = drawer.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-state"]'
    );
    if (!role || !location || !state) throw new Error("Request intake controls missing");

    expect(role.textContent).toContain("Self-contracted homeowner");
    act(() => role.click());
    typeCharacterByCharacter(location, locationText);
    expect(location.value).toBe(locationText);
    setSelectValue(state, "MS");

    const county = drawer.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-county"]'
    );
    if (!county) throw new Error("County control missing");
    setSelectValue(county, "28059");
  }

  it("shows three peer builders on one page with no default, sequence, or shared project", async () => {
    renderProfile();
    await flushUi();

    const profile = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-packages-profile"]'
    );
    const directory = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-builder-directory"]'
    );
    if (!profile || !directory) throw new Error("Three-builder directory missing");
    expect(profile.dataset.releaseState).toBe("unlisted");
    expect(profile.textContent).toContain("Planning Tools");
    expect(profile.textContent).toContain("Three stand-alone builders");

    const cards = Array.from(
      directory.querySelectorAll<HTMLElement>('[data-testid^="steel-home-builder-card-"]')
    );
    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.dataset.testid)).toEqual([
      "steel-home-builder-card-countertops",
      "steel-home-builder-card-cabinets",
      "steel-home-builder-card-building",
    ]);
    expect(
      STEEL_HOME_BUILDERS.map(
        (builder) =>
          directory.querySelector(`[data-testid="${plannerLauncherId(builder.key)}"]`)?.textContent
      )
    ).toEqual([
      expect.stringContaining("Open Countertop Builder"),
      expect.stringContaining("Open Cabinet Builder"),
      expect.stringContaining("Open Metal Building Builder"),
    ]);
    expect(
      STEEL_HOME_BUILDERS.map((builder) =>
        directory
          .querySelector<HTMLAnchorElement>(`[data-testid="${plannerLauncherId(builder.key)}"]`)
          ?.getAttribute("href")
      )
    ).toEqual(STEEL_HOME_BUILDERS.map((builder) => buildSteelHomeBuilderPath(builder.key)));

    const countertopSupplyBoundary = directory.querySelector<HTMLElement>(
      '[data-testid="steel-home-countertop-supply-boundary"]'
    );
    expect(countertopSupplyBoundary?.textContent).toContain(
      "Stone ordering covers material supply only."
    );
    expect(countertopSupplyBoundary?.textContent).toContain("separate independent fabricator");
    expect(countertopSupplyBoundary?.className).not.toContain("line-clamp");

    expect(container.querySelector('[data-testid="steel-home-builder-workbench"]')).toBeNull();
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelector('[role="tabpanel"]')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-building-designer"]')).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-cabinet-designer"]')).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-countertop-designer"]')).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-project-location"]')).toBeNull();
    expect(container.querySelector("aside")).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-project-summary"]')).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-project-review"]')).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-whole-home"]')).toBeNull();
    expect(
      Array.from(container.querySelectorAll("button, a")).some((item) =>
        /^(?:previous|next)(?::|\s)/i.test(
          item.getAttribute("aria-label") || item.textContent || ""
        )
      )
    ).toBe(false);
  });

  it("opens each builder at its real URL, closes to the directory, and resolves direct paths", async () => {
    renderProfile();
    await flushUi();
    const pushState = vi.spyOn(window.history, "pushState");

    const panel = openPlanner("building");
    expect(panel.id).toBe(plannerPanelId("building"));
    expect(window.location.pathname).toBe(buildSteelHomeBuilderPath("building"));
    expect(window.location.hash).toBe("");
    expect(pushState).toHaveBeenLastCalledWith(null, "", buildSteelHomeBuilderPath("building"));

    const close = container.querySelector<HTMLAnchorElement>(
      '[data-testid="steel-home-builder-close"]'
    );
    if (!close) throw new Error("Builder close action missing");
    expect(close.getAttribute("href")).toBe("/u/steel-home-packages");
    act(() => close.click());
    expect(window.location.pathname).toBe("/u/steel-home-packages");
    expect(container.querySelector('[data-testid="steel-home-builder-workbench"]')).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-builder-directory"]')).not.toBeNull();

    act(() => {
      window.history.replaceState(null, "", buildSteelHomeBuilderPath("countertops"));
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(container.querySelector(`#${plannerPanelId("countertops")}`)).not.toBeNull();

    act(() => {
      window.history.replaceState(null, "", buildSteelHomeBuilderPath("cabinets"));
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(container.querySelector(`#${plannerPanelId("cabinets")}`)).not.toBeNull();
    expect(container.querySelector('[data-testid="steel-home-countertop-designer"]')).toBeNull();
  });

  it("shows and announces a terminal save failure on a 390px viewport", async () => {
    vi.stubGlobal("innerWidth", 390);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is unavailable", "QuotaExceededError");
    });

    renderProfile();
    await flushUi();
    openPlanner("countertops");
    await flushUi();

    const status = requiredElement<HTMLElement>(
      container,
      '[data-testid="steel-home-builder-save-status"]'
    );
    expect(status.textContent).toContain("Save failed");
    expect(status.textContent).not.toContain("Saving");
    expect(status.className).toMatch(/\bflex\b/);
    expect(status.className).not.toMatch(/\bhidden\b/);
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("aria-label")).toContain("Changes remain available in this tab");
  });

  it("asks before replacing a saved countertop design from a shared studio link", async () => {
    const savedDraft = createEmptySteelHomeProjectDraft();
    savedDraft.countertops.stoneId = "aj-quartz";
    window.localStorage.setItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY, JSON.stringify(savedDraft));

    const sharedDesign = {
      ...savedDraft.countertops,
      room: "Living room" as const,
      stoneId: "taj-mahal",
      textureImageIndex: 2,
    };
    const sharedUrl = buildCountertopStudioShareUrl(
      sharedDesign,
      `https://example.com${buildSteelHomeBuilderPath("countertops")}`
    );
    const parsedSharedUrl = new URL(sharedUrl!);
    window.history.replaceState(null, "", `${parsedSharedUrl.pathname}${parsedSharedUrl.search}`);

    renderProfile();
    await flushUi();

    expect(
      requiredElement<HTMLElement>(
        container,
        '[data-testid="steel-home-countertop-shared-design-prompt"]'
      ).textContent
    ).toContain("ready to review");
    expect(
      JSON.parse(window.localStorage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY) || "{}")
        .countertops.stoneId
    ).toBe("aj-quartz");

    const loadShared = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Load shared design"
    );
    if (!loadShared) throw new Error("Load shared design action missing");
    act(() => loadShared.click());
    await flushUi();

    expect(container.textContent).toContain("Taj Mahal");
    expect(
      JSON.parse(window.localStorage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY) || "{}")
        .countertops.stoneId
    ).toBe("taj-mahal");
    expect(window.location.search).not.toContain("studio=");
  });

  it("shares a countertop studio design without an affiliate lookup or other network request", async () => {
    renderProfile();
    await flushUi();
    const panel = openPlanner("countertops");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const sharedPayloads: ShareCardPayload[] = [];
    const captureShare = (event: Event) => {
      sharedPayloads.push((event as CustomEvent<ShareCardPayload>).detail);
    };
    window.addEventListener(SHARE_CARD_EVENT, captureShare);

    act(() => {
      requiredElement<HTMLButtonElement>(
        panel,
        '[data-testid="steel-home-countertop-share-studio"]'
      ).click();
    });
    await flushUi();
    window.removeEventListener(SHARE_CARD_EVENT, captureShare);

    expect(fetchSpy).not.toHaveBeenCalled();
    const sharedPayload = sharedPayloads[0];
    expect(sharedPayload).toBeDefined();
    if (!sharedPayload) throw new Error("Countertop share payload missing");
    expect(new URL(sharedPayload.url).searchParams.has("studio")).toBe(true);
    expect(new URL(sharedPayload.url).searchParams.has("ref")).toBe(false);
  });

  it("keeps each planner independent while updating its estimate, area, and preview", async () => {
    renderProfile();
    await flushUi();

    let panel = openPlanner("building");
    const buildingEstimate = panel.querySelector<HTMLElement>(
      '[data-testid="steel-home-building-planning-estimate"]'
    );
    const width = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-building-width"]'
    );
    if (!buildingEstimate || !width) throw new Error("Building result missing");
    expect(buildingEstimate.textContent).toContain("$80,400–$124,050");
    setControlValue(width, "54");
    expect(buildingEstimate.textContent).not.toContain("$80,400–$124,050");
    expect(
      panel.querySelector('[data-testid="steel-home-building-preview"]')?.textContent
    ).toContain("54' × 60' × 14'");

    panel = openPlanner("countertops");
    const initialPath = panel
      .querySelector('[data-testid="steel-home-countertop-layout-preview"]')
      ?.getAttribute("d");
    const run = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-countertop-run-a"]'
    );
    if (!run) throw new Error("Countertop run missing");
    expect(panel.textContent).toContain("Gross countertop layout footprint");
    expect(panel.textContent).toContain("Stone quote needed");
    setControlValue(run, "220");
    expect(
      panel.querySelector('[data-testid="steel-home-countertop-layout-preview"]')?.getAttribute("d")
    ).not.toBe(initialPath);

    panel = openPlanner("cabinets");
    const cabinetEstimate = panel.querySelector<HTMLElement>(
      '[data-testid="steel-home-cabinet-planning-estimate"]'
    );
    const layout = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-cabinet-layout"]'
    );
    if (!cabinetEstimate || !layout) throw new Error("Cabinet result missing");
    expect(cabinetEstimate.textContent).toContain("$15,650–$26,950");
    setSelectValue(layout, "u-shape");
    expect(
      panel.querySelector('[data-testid="steel-home-cabinet-preview"]')?.textContent
    ).toContain("U-SHAPED");

    panel = openPlanner("building");
    expect(
      panel.querySelector<HTMLInputElement>('[data-testid="steel-home-building-width"]')?.value
    ).toBe("54");
    expect(container.querySelector('[data-testid="steel-home-countertop-designer"]')).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-cabinet-designer"]')).toBeNull();

    panel = openPlanner("countertops");
    expect(
      panel.querySelector<HTMLInputElement>('[data-testid="steel-home-countertop-run-a"]')?.value
    ).toBe("220");
    expect(container.querySelector('[data-testid="steel-home-building-designer"]')).toBeNull();

    panel = openPlanner("cabinets");
    expect(
      panel.querySelector<HTMLSelectElement>('[data-testid="steel-home-cabinet-layout"]')?.value
    ).toBe("u-shape");
    expect(
      panel.querySelector<HTMLInputElement>('[data-testid="steel-home-cabinet-primary-wall"]')
        ?.value
    ).toBe("216");
    expect(container.querySelector('[data-testid="steel-home-countertop-designer"]')).toBeNull();
  });

  it("makes every countertop control family update the live layout, area, or selected surface", async () => {
    renderProfile();
    await flushUi();
    const panel = openPlanner("countertops");
    enableCountertopIsland(panel);
    const preview = requiredElement<SVGSVGElement>(
      panel,
      '[data-testid="steel-home-countertop-preview"]'
    );
    const summary = requiredElement<HTMLElement>(
      panel,
      '[data-testid="steel-home-countertop-live-summary"]'
    );
    const initialArea = summary.textContent?.match(/About ([0-9.]+) sq\. ft\./)?.[1];
    const initialPath = requiredElement<SVGPathElement>(
      panel,
      '[data-testid="steel-home-countertop-layout-preview"]'
    ).getAttribute("d");

    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-room"]'),
      "Laundry"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-layout"]'),
      "u-shape"
    );
    expect(preview.dataset.room).toBe("Laundry");
    expect(preview.dataset.layout).toBe("u-shape");
    expect(
      requiredElement<SVGPathElement>(
        panel,
        '[data-testid="steel-home-countertop-layout-preview"]'
      ).getAttribute("d")
    ).not.toBe(initialPath);

    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-countertop-run-a"]'),
      "180"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-countertop-run-b"]'),
      "144"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-countertop-run-c"]'),
      "108"
    );
    expect(preview.textContent).toContain('180" main run');
    expect(preview.textContent).toContain('144"');
    expect(preview.textContent).toContain('108"');

    const islandBefore = requiredElement<SVGRectElement>(
      panel,
      '[data-testid="steel-home-countertop-island-preview"]'
    );
    const initialIslandSize = [
      islandBefore.getAttribute("width"),
      islandBefore.getAttribute("height"),
    ];
    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-island-length"]'
      ),
      "120"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-island-width"]'
      ),
      "60"
    );
    const islandAfter = requiredElement<SVGRectElement>(
      panel,
      '[data-testid="steel-home-countertop-island-preview"]'
    );
    expect([islandAfter.getAttribute("width"), islandAfter.getAttribute("height")]).not.toEqual(
      initialIslandSize
    );
    expect(preview.textContent).toContain('Island 120" × 60"');

    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-edge"]'),
      "Mitered"
    );
    const areaBeforeBacksplash = summary.textContent?.match(/About ([0-9.]+) sq\. ft\./)?.[1];
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-backsplash"]'),
      "Full-height"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-sink"]'),
      "None"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-cooktop"]'),
      "None"
    );
    expect(preview.dataset.edge).toBe("Mitered");
    expect(preview.dataset.backsplash).toBe("Full-height");
    expect(preview.dataset.sink).toBe("None");
    expect(preview.dataset.cooktop).toBe("None");
    expect(preview.textContent).toContain("GROSS FOOTPRINT");
    expect(panel.querySelector('[data-testid="steel-home-countertop-sink-preview"]')).toBeNull();
    expect(panel.querySelector('[data-testid="steel-home-countertop-cooktop-preview"]')).toBeNull();
    expect(summary.textContent).toContain("Laundry · U-shaped · Mitered edge");
    expect(summary.textContent).toContain("Full-height backsplash · No cutouts or openings");
    expect(summary.textContent).toContain(
      "Gross layout footprint · backsplash excluded · range gaps not deducted"
    );
    expect(summary.textContent?.match(/About ([0-9.]+) sq\. ft\./)?.[1]).toBe(areaBeforeBacksplash);
    expect(panel.textContent).toContain("Gross countertop layout footprint · Stone quote needed");
    expect(panel.textContent).toContain("Backsplash excluded · range gaps not deducted");
    expect(panel.textContent).toContain("final slab quantity requires measurement");

    const islandToggle = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-island"]'
    );
    act(() => islandToggle.click());
    expect(islandToggle.checked).toBe(false);
    expect(panel.querySelector('[data-testid="steel-home-countertop-island-preview"]')).toBeNull();
    expect(summary.textContent?.match(/About ([0-9.]+) sq\. ft\./)?.[1]).not.toBe(initialArea);

    act(() =>
      requiredElement<HTMLButtonElement>(
        panel,
        '[data-testid="steel-home-countertop-surface-open"]'
      ).click()
    );
    const gallery = requiredElement<HTMLElement>(
      panel,
      '[data-testid="steel-home-countertop-surface-gallery"]'
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        gallery,
        '[data-testid="steel-home-countertop-material-filter"]'
      ),
      "Engineered Quartz"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(
        gallery,
        '[data-testid="steel-home-countertop-stone-search"]'
      ),
      "AJ Quartz"
    );
    const filteredSurfaces = Array.from(
      gallery.querySelectorAll<HTMLButtonElement>(
        'button[data-testid^="steel-home-countertop-stone-"]'
      )
    );
    expect(filteredSurfaces.length).toBeGreaterThan(0);
    expect(
      filteredSurfaces.every((surface) => surface.textContent?.includes("Engineered Quartz"))
    ).toBe(true);
    const exactAjQuartz = filteredSurfaces.find((surface) =>
      surface.matches('[data-testid="steel-home-countertop-stone-aj-quartz"]')
    );
    expect(exactAjQuartz?.textContent).toContain("AJ Quartz");
    act(() => exactAjQuartz?.click());
    expect(
      requiredElement<HTMLImageElement>(
        panel,
        '[data-testid="steel-home-countertop-selected-surface-image"]'
      ).getAttribute("src")
    ).toBe("/images/stone-designer/aj-quartz/1.webp");
    expect(requiredElement<SVGImageElement>(panel, "svg image").getAttribute("href")).toBe(
      namedStonePhotoHref("aj-quartz")
    );
  });

  it("places two-axis openings, treats range gaps as full-depth, and blocks impossible fabrication", async () => {
    renderProfile();
    await flushUi();
    const panel = openPlanner("countertops");
    enableCountertopIsland(panel);
    const summary = requiredElement<HTMLElement>(
      panel,
      '[data-testid="steel-home-countertop-live-summary"]'
    );
    const initialArea = summary.textContent?.match(/About ([0-9.]+) sq\. ft\./)?.[1];
    const stoneRequest = requiredElement<HTMLButtonElement>(
      panel,
      '[data-testid="steel-home-countertop-request-stone"]'
    );
    const fabricatorRequest = requiredElement<HTMLButtonElement>(
      panel,
      '[data-testid="steel-home-countertop-find-fabricator"]'
    );
    expect(stoneRequest.textContent).toContain("Request this stone");
    expect(fabricatorRequest.textContent).toContain("Find a fabricator");
    expect(stoneRequest.disabled).toBe(false);
    expect(fabricatorRequest.disabled).toBe(false);

    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-sink"]'),
      "Single-bowl undermount"
    );
    expect(
      requiredElement<HTMLElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-item-sink"]'
      ).getAttribute("aria-invalid")
    ).toBe("true");
    expect(panel.textContent).toContain("Sink — Single-bowl undermount needs a location.");
    expect(stoneRequest.disabled).toBe(false);
    expect(fabricatorRequest.disabled).toBe(true);

    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-surface"]'
      ),
      "island"
    );
    const sinkPosition = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-position"]'
    );
    const sinkFrontPosition = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-front-position"]'
    );
    expect(sinkPosition.value).toBe("42");
    expect(sinkFrontPosition.value).toBe("21");
    let sinkHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-sink"]'
    );
    expect(sinkHandle.dataset.surfaceId).toBe("island");
    expect(sinkHandle.dataset.positionIn).toBe("42");
    expect(sinkHandle.dataset.frontPositionIn).toBe("21");

    setControlValue(sinkPosition, "44");
    sinkHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-sink"]'
    );
    expect(sinkHandle.dataset.positionIn).toBe("44");
    const transformBeforeFrontEdit = sinkHandle.getAttribute("transform");
    setControlValue(sinkFrontPosition, "12");
    sinkHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-sink"]'
    );
    expect(sinkHandle.dataset.frontPositionIn).toBe("12");
    expect(sinkHandle.getAttribute("transform")).not.toBe(transformBeforeFrontEdit);
    expect(
      panel.querySelector('[data-testid="steel-home-countertop-sink-preview"]')
    ).not.toBeNull();

    pressKey(sinkHandle, "ArrowRight");
    sinkHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-sink"]'
    );
    expect(sinkHandle.dataset.positionIn).toBe("45");
    expect(sinkHandle.dataset.frontPositionIn).toBe("12");
    pressKey(sinkHandle, "ArrowUp");
    sinkHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-sink"]'
    );
    expect(sinkHandle.dataset.positionIn).toBe("45");
    expect(sinkHandle.dataset.frontPositionIn).toBe("13");
    pressKey(sinkHandle, "ArrowUp", { shiftKey: true });
    sinkHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-sink"]'
    );
    expect(sinkHandle.dataset.positionIn).toBe("45");
    expect(sinkHandle.dataset.frontPositionIn).toBe("19");
    expect(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-front-position"]'
      ).value
    ).toBe("19");

    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-cooktop"]'),
      "36-inch range gap"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-surface"]'
      ),
      "main"
    );
    expect(
      panel.querySelector('[data-testid="steel-home-countertop-cutout-front-position"]')
    ).toBeNull();
    expect(panel.textContent).toContain(
      "Range gap spans the full countertop depth; only its run position is needed."
    );
    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-position"]'
      ),
      "80"
    );
    const rangeHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-cooktop"]'
    );
    expect(rangeHandle.dataset.kind).toBe("range");
    expect(rangeHandle.dataset.surfaceId).toBe("main");
    expect(rangeHandle.dataset.positionIn).toBe("80");
    expect(rangeHandle.dataset.frontPositionIn).toBe("");
    expect(rangeHandle.getAttribute("aria-label")).toContain("full-depth range gap");
    const rangeGapPreview = requiredElement<SVGRectElement>(
      rangeHandle,
      '[data-testid="steel-home-countertop-cooktop-preview"] > rect'
    );
    const wallDepthVisual = Number(
      requiredElement<SVGSVGElement>(panel, '[data-testid="steel-home-countertop-preview"]').dataset
        .wallDepthVisual
    );
    expect(Number(rangeGapPreview.getAttribute("y"))).toBeCloseTo(-wallDepthVisual / 2);
    expect(Number(rangeGapPreview.getAttribute("height"))).toBeCloseTo(wallDepthVisual);

    act(() =>
      requiredElement<HTMLButtonElement>(
        panel,
        '[data-testid="steel-home-countertop-add-other-cutout"]'
      ).click()
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-type"]'
      ),
      "Pop-up outlet"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-width"]'
      ),
      "6"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-depth"]'
      ),
      "4"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-surface"]'
      ),
      "left-return"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-position"]'
      ),
      "40"
    );
    const otherHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-other-1"]'
    );
    expect(otherHandle.dataset.kind).toBe("other");
    expect(otherHandle.dataset.surfaceId).toBe("left-return");
    expect(otherHandle.dataset.positionIn).toBe("40");
    expect(otherHandle.dataset.frontPositionIn).toBe("12.75");
    expect(
      panel.querySelector('[data-testid="steel-home-countertop-cutout-validation"]')
    ).toBeNull();
    expect(fabricatorRequest.disabled).toBe(false);

    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-depth"]'
      ),
      "24"
    );
    const impossiblePlacement = requiredElement<HTMLElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-validation"]'
    );
    expect(impossiblePlacement.textContent).toContain(
      'Pop-up outlet is 24" deep and cannot fit on the 25.5"-deep left return.'
    );
    expect(panel.textContent).toContain(
      "This opening is too deep for the selected surface. Enter the manufacturer's smaller cutout depth or choose a deeper island."
    );
    expect(stoneRequest.disabled).toBe(false);
    expect(fabricatorRequest.disabled).toBe(true);

    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-depth"]'
      ),
      "4"
    );
    expect(
      panel.querySelector('[data-testid="steel-home-countertop-cutout-validation"]')
    ).toBeNull();
    expect(fabricatorRequest.disabled).toBe(false);
    expect(summary.textContent).toContain("3 planned openings");
    expect(summary.textContent?.match(/About ([0-9.]+) sq\. ft\./)?.[1]).toBe(initialArea);
  });

  it("uses one explicit wall-top depth for room choice, footprint, preview, and front bounds", async () => {
    renderProfile();
    await flushUi();
    const panel = openPlanner("countertops");
    enableCountertopIsland(panel);
    const preview = requiredElement<SVGSVGElement>(
      panel,
      '[data-testid="steel-home-countertop-preview"]'
    );
    const layoutPreview = requiredElement<SVGPathElement>(
      panel,
      '[data-testid="steel-home-countertop-layout-preview"]'
    );
    const summary = requiredElement<HTMLElement>(
      panel,
      '[data-testid="steel-home-countertop-live-summary"]'
    );
    const wallDepth = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-wall-depth"]'
    );
    const initialPath = layoutPreview.getAttribute("d");
    const initialArea = summary.textContent?.match(/About ([0-9.]+) sq\. ft\./)?.[1];

    expect(wallDepth.type).toBe("number");
    expect(wallDepth.value).toBe("25.5");
    expect(wallDepth.min).toBe("12");
    expect(wallDepth.max).toBe("72");
    expect(wallDepth.step).toBe("0.5");
    expect(wallDepth.inputMode).toBe("decimal");
    act(() => {
      wallDepth.focus();
      wallDepth.blur();
    });
    expect(wallDepth.value).toBe("25.5");
    expect(preview.dataset.wallDepthIn).toBe("25.5");
    expect(wallDepth.closest("label")?.textContent).toContain("Wall-top depth");
    expect(wallDepth.closest("label")?.textContent).toContain("in");
    expect(panel.textContent).toContain(
      "Measure from the wall or back edge to the finished room-facing edge."
    );
    expect(panel.textContent).toContain(
      "Enter the real top depth for this room—bathroom vanities are often shallower than kitchen tops."
    );

    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-room"]'),
      "Primary bathroom"
    );
    expect(wallDepth.value).toBe("25.5");
    expect(preview.dataset.wallDepthIn).toBe("25.5");
    expect(summary.textContent?.match(/About ([0-9.]+) sq\. ft\./)?.[1]).toBe(initialArea);

    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-sink"]'),
      "Single-bowl undermount"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-surface"]'
      ),
      "main"
    );
    let sinkFront = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-front-position"]'
    );
    expect(sinkFront.value).toBe("12.75");
    expect(sinkFront.min).toBe("10");
    expect(sinkFront.max).toBe("15.5");
    expect(sinkFront.step).toBe("0.125");
    const initialSinkTransform = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-sink"]'
    ).getAttribute("transform");

    setControlValue(wallDepth, "22");
    expect(wallDepth.value).toBe("22");
    expect(preview.dataset.wallDepthIn).toBe("22");
    expect(Number(preview.dataset.wallDepthVisual)).toBeCloseTo(48.4);
    expect(layoutPreview.getAttribute("d")).not.toBe(initialPath);
    expect(preview.textContent).toContain('120" main run × 22" deep');
    expect(preview.textContent).toContain('96" × 22" deep');
    expect(summary.textContent).toContain("About 54.1 sq. ft.");
    expect(summary.textContent?.match(/About ([0-9.]+) sq\. ft\./)?.[1]).not.toBe(initialArea);

    sinkFront = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-front-position"]'
    );
    expect(sinkFront.value).toBe("12");
    expect(sinkFront.min).toBe("10");
    expect(sinkFront.max).toBe("12");
    expect(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-front-position-range"]'
      ).max
    ).toBe("12");
    const updatedSinkHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-sink"]'
    );
    expect(updatedSinkHandle.dataset.frontPositionIn).toBe("12");
    expect(updatedSinkHandle.getAttribute("transform")).not.toBe(initialSinkTransform);
  });

  it("preserves a half-inch wall depth through live area updates and reload", async () => {
    renderProfile();
    await flushUi();
    let panel = openPlanner("countertops");
    enableCountertopIsland(panel);
    let wallDepth = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-wall-depth"]'
    );
    const summary = requiredElement<HTMLElement>(
      panel,
      '[data-testid="steel-home-countertop-live-summary"]'
    );
    const initialArea = summary.textContent?.match(/About ([0-9.]+) sq\. ft\./)?.[1];
    const initialPath = requiredElement<SVGPathElement>(
      panel,
      '[data-testid="steel-home-countertop-layout-preview"]'
    ).getAttribute("d");

    act(() => {
      wallDepth.focus();
      wallDepth.blur();
    });
    expect(wallDepth.value).toBe("25.5");

    setControlValue(wallDepth, "22.5");
    expect(wallDepth.value).toBe("22.5");
    expect(
      requiredElement<SVGSVGElement>(panel, '[data-testid="steel-home-countertop-preview"]').dataset
        .wallDepthIn
    ).toBe("22.5");
    expect(
      requiredElement<SVGPathElement>(
        panel,
        '[data-testid="steel-home-countertop-layout-preview"]'
      ).getAttribute("d")
    ).not.toBe(initialPath);
    expect(summary.textContent).toContain("About 54.7 sq. ft.");
    expect(summary.textContent?.match(/About ([0-9.]+) sq\. ft\./)?.[1]).not.toBe(initialArea);

    await flushUi();
    expect(
      JSON.parse(window.localStorage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY) || "{}")
    ).toMatchObject({
      version: 9,
      countertops: { wallDepthIn: 22.5 },
    });

    act(() => root.unmount());
    root = createRoot(container);
    renderProfile();
    await flushUi();
    panel = openPlanner("countertops");
    wallDepth = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-wall-depth"]'
    );
    expect(wallDepth.value).toBe("22.5");
    expect(
      requiredElement<HTMLElement>(panel, '[data-testid="steel-home-countertop-live-summary"]')
        .textContent
    ).toContain("About 54.7 sq. ft.");
  });

  it("keeps eighth-inch other-opening measurements in controls, preview state, and request text", async () => {
    renderProfile();
    await flushUi();
    const panel = openPlanner("countertops");
    enableCountertopIsland(panel);
    act(() =>
      requiredElement<HTMLButtonElement>(
        panel,
        '[data-testid="steel-home-countertop-add-other-cutout"]'
      ).click()
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-type"]'
      ),
      "Pop-up outlet"
    );
    const width = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-width"]'
    );
    const depth = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-depth"]'
    );
    expect(width.step).toBe("0.125");
    expect(depth.step).toBe("0.125");
    setControlValue(width, "1.375");
    setControlValue(depth, "1.625");
    expect(width.value).toBe("1.375");
    expect(depth.value).toBe("1.625");
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-surface"]'
      ),
      "island"
    );
    const along = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-position"]'
    );
    const front = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-front-position"]'
    );
    expect(along.step).toBe("0.125");
    expect(front.step).toBe("0.125");
    setControlValue(along, "12.5");
    setControlValue(front, "12.5");
    expect(along.value).toBe("12.5");
    expect(front.value).toBe("12.5");
    expect(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-position-range"]'
      ).step
    ).toBe("0.125");
    expect(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-front-position-range"]'
      ).step
    ).toBe("0.125");
    const handle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-other-1"]'
    );
    expect(handle.dataset.positionIn).toBe("12.5");
    expect(handle.dataset.frontPositionIn).toBe("12.5");
    expect(
      panel.querySelector('[data-testid="steel-home-countertop-cutout-validation"]')
    ).toBeNull();
    expect(
      requiredElement<HTMLButtonElement>(
        panel,
        '[data-testid="steel-home-countertop-find-fabricator"]'
      ).disabled
    ).toBe(false);

    await flushUi();
    expect(window.localStorage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toContain(
      '"widthIn":1.375'
    );
    expect(window.localStorage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toContain(
      '"depthIn":1.625'
    );
    expect(window.localStorage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toContain(
      '"positionIn":12.5'
    );
    expect(window.localStorage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toContain(
      '"frontPositionIn":12.5'
    );

    const drawer = startRequest("countertops", "fabricator");
    completeRequestDetails(drawer, "Ocean Springs, MS 39564");
    setSelectValue(
      requiredElement<HTMLSelectElement>(drawer, '[data-testid="steel-home-project-timing"]'),
      "Within 6 months"
    );
    const request = requiredElement<HTMLAnchorElement>(
      container,
      'a[data-testid="steel-home-planner-request-fabricator-submit"]'
    );
    act(() => request.focus());
    const context = readStagedDirectConnectEntryContext(request.getAttribute("href") || "");
    expect(context?.description).toContain(
      '- Pop-up outlet — Island, center 12.5" from the start edge'
    );
    expect(context?.description).toContain(
      'center 12.5" inward from the front long edge facing away from the main run'
    );
    expect(context?.description).toContain('approximately 1.375" × 1.625"');
  });

  it("blocks fabricator matching when a faucet hole sits inside an undermount sink", async () => {
    renderProfile();
    await flushUi();
    const panel = openPlanner("countertops");
    const stoneRequest = requiredElement<HTMLButtonElement>(
      panel,
      '[data-testid="steel-home-countertop-request-stone"]'
    );
    const fabricatorRequest = requiredElement<HTMLButtonElement>(
      panel,
      '[data-testid="steel-home-countertop-find-fabricator"]'
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-sink"]'),
      "Single-bowl undermount"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-surface"]'
      ),
      "main"
    );
    act(() =>
      requiredElement<HTMLButtonElement>(
        panel,
        '[data-testid="steel-home-countertop-add-other-cutout"]'
      ).click()
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-type"]'
      ),
      "Faucet hole"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-width"]'
      ),
      "1"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-depth"]'
      ),
      "1"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-surface"]'
      ),
      "main"
    );

    const sinkHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-sink"]'
    );
    const faucetHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-other-1"]'
    );
    expect(faucetHandle.dataset.positionIn).toBe(sinkHandle.dataset.positionIn);
    expect(faucetHandle.dataset.frontPositionIn).toBe(sinkHandle.dataset.frontPositionIn);
    expect(
      requiredElement<HTMLElement>(panel, '[data-testid="steel-home-countertop-cutout-validation"]')
        .textContent
    ).toContain(
      "Sink — Single-bowl undermount and Faucet hole are too close together on main run."
    );
    expect(stoneRequest.disabled).toBe(false);
    expect(fabricatorRequest.disabled).toBe(true);
  });

  it("shows front-edge sinks and scales opening footprints without shrinking keyboard targets", async () => {
    renderProfile();
    await flushUi();
    const panel = openPlanner("countertops");

    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-sink"]'),
      "Farmhouse"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-surface"]'
      ),
      "main"
    );

    const farmhouseItem = requiredElement<HTMLButtonElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-item-sink"]'
    );
    const farmhouseHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-sink"]'
    );
    expect(farmhouseItem.textContent).toContain("apron/front-edge opening");
    expect(farmhouseHandle.getAttribute("aria-label")).toContain(
      "apron opening at the room-facing edge"
    );
    expect(farmhouseHandle.dataset.frontPositionIn).toBe("");
    expect(
      panel.querySelector('[data-testid="steel-home-countertop-cutout-front-position"]')
    ).toBeNull();
    expect(panel.textContent).toContain("Apron-front opening: set its position along the run.");
    const farmhousePreview = requiredElement<SVGGElement>(
      farmhouseHandle,
      '[data-testid="steel-home-countertop-sink-preview"]'
    );
    expect(farmhousePreview.querySelectorAll("path")).toHaveLength(2);
    expect(farmhousePreview.querySelector("rect")).toBeNull();

    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-sink"]'),
      "None"
    );
    act(() =>
      requiredElement<HTMLButtonElement>(
        panel,
        '[data-testid="steel-home-countertop-add-other-cutout"]'
      ).click()
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-type"]'
      ),
      "Pop-up outlet"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-width"]'
      ),
      "1"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-depth"]'
      ),
      "1"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-surface"]'
      ),
      "main"
    );

    let otherHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-other-1"]'
    );
    const smallFootprint = requiredElement<SVGRectElement>(
      otherHandle,
      '[data-testid="steel-home-countertop-other-preview-other-1"] > rect'
    );
    const smallWidth = Number(smallFootprint.getAttribute("width"));
    const smallDepth = Number(smallFootprint.getAttribute("height"));
    const smallHitTarget = requiredElement<SVGRectElement>(otherHandle, ":scope > rect");
    const hitTargetWidth = Number(smallHitTarget.getAttribute("width"));
    const hitTargetHeight = Number(smallHitTarget.getAttribute("height"));
    expect(otherHandle.getAttribute("role")).toBe("button");
    expect(otherHandle.tabIndex).toBe(0);
    expect(otherHandle.getAttribute("aria-label")).toContain("Pop-up outlet");
    expect(hitTargetWidth).toBeGreaterThanOrEqual(44);
    expect(hitTargetHeight).toBeGreaterThanOrEqual(44);

    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-width"]'
      ),
      "23"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-depth"]'
      ),
      "23"
    );
    otherHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-other-1"]'
    );
    const largeFootprint = requiredElement<SVGRectElement>(
      otherHandle,
      '[data-testid="steel-home-countertop-other-preview-other-1"] > rect'
    );
    expect(Number(largeFootprint.getAttribute("width"))).toBeGreaterThan(smallWidth);
    expect(Number(largeFootprint.getAttribute("height"))).toBeGreaterThan(smallDepth);
    const largeHitTarget = requiredElement<SVGRectElement>(otherHandle, ":scope > rect");
    expect(Number(largeHitTarget.getAttribute("width"))).toBe(hitTargetWidth);
    expect(Number(largeHitTarget.getAttribute("height"))).toBe(hitTargetHeight);
    expect(otherHandle.getAttribute("role")).toBe("button");
    expect(otherHandle.tabIndex).toBe(0);
  });

  it("publishes and enforces layout-aware minimum countertop runs", async () => {
    renderProfile();
    await flushUi();
    const panel = openPlanner("countertops");
    const layout = requiredElement<HTMLSelectElement>(
      panel,
      '[data-testid="steel-home-countertop-layout"]'
    );

    setSelectValue(layout, "straight");
    let mainRun = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-run-a"]'
    );
    expect(mainRun.min).toBe("24");
    setControlValue(mainRun, "20");
    act(() => {
      mainRun.focus();
      mainRun.blur();
    });
    mainRun = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-run-a"]'
    );
    expect(mainRun.value).toBe("24");
    expect(panel.querySelector('[data-testid="steel-home-countertop-run-b"]')).toBeNull();

    setSelectValue(layout, "l-shape");
    mainRun = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-run-a"]'
    );
    let leftReturn = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-run-b"]'
    );
    expect(mainRun.min).toBe("26");
    expect(mainRun.value).toBe("26");
    expect(leftReturn.min).toBe("26");
    setControlValue(leftReturn, "20");
    act(() => {
      leftReturn.focus();
      leftReturn.blur();
    });
    leftReturn = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-run-b"]'
    );
    expect(leftReturn.value).toBe("26");

    setSelectValue(layout, "u-shape");
    mainRun = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-run-a"]'
    );
    expect(mainRun.min).toBe("52");
    expect(mainRun.value).toBe("52");
    expect(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-countertop-run-b"]').min
    ).toBe("26");
    expect(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-countertop-run-c"]').min
    ).toBe("26");
  });

  it("makes every cabinet control family update the cabinet drawing, fit, or estimate", async () => {
    renderProfile();
    await flushUi();
    const panel = openPlanner("cabinets");
    const preview = requiredElement<SVGSVGElement>(
      panel,
      '[data-testid="steel-home-cabinet-preview"]'
    );
    const summary = requiredElement<HTMLElement>(
      panel,
      '[data-testid="steel-home-cabinet-live-summary"]'
    );
    const estimate = requiredElement<HTMLElement>(
      panel,
      '[data-testid="steel-home-cabinet-planning-estimate"]'
    );
    const initialEstimate = estimate.textContent;
    const initialLayoutPath = requiredElement<SVGPathElement>(
      panel,
      '[data-testid="steel-home-cabinet-layout-preview"]'
    ).getAttribute("d");
    const initialCeiling = requiredElement<SVGLineElement>(
      panel,
      '[data-testid="steel-home-cabinet-ceiling-preview"]'
    ).getAttribute("y1");

    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-cabinet-room"]'),
      "Laundry"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-cabinet-layout"]'),
      "galley"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-cabinet-primary-wall"]'),
      "300"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-cabinet-return-wall"]'),
      "180"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-cabinet-ceiling-height"]'),
      "120"
    );
    expect(preview.dataset.room).toBe("Laundry");
    expect(preview.dataset.layout).toBe("galley");
    expect(
      requiredElement<SVGPathElement>(
        panel,
        '[data-testid="steel-home-cabinet-layout-preview"]'
      ).getAttribute("d")
    ).not.toBe(initialLayoutPath);
    expect(
      requiredElement<SVGLineElement>(
        panel,
        '[data-testid="steel-home-cabinet-ceiling-preview"]'
      ).getAttribute("y1")
    ).not.toBe(initialCeiling);
    expect(preview.textContent).toContain('of 300"');
    expect(preview.textContent).toContain('120" ceiling');

    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-cabinet-door-style"]'),
      "Slab"
    );
    act(() =>
      requiredElement<HTMLButtonElement>(
        panel,
        '[data-testid="steel-home-cabinet-finish-sage"]'
      ).click()
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-cabinet-hardware"]'),
      "Brushed brass"
    );
    expect(preview.dataset.doorStyle).toBe("Slab");
    expect(preview.dataset.finish).toBe("sage");
    expect(preview.dataset.hardware).toBe("Brushed brass");

    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-cabinet-refrigerator"]'),
      "48"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-cabinet-range"]'),
      "48"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-cabinet-sink-base"]'),
      "33"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-cabinet-upper-height"]'),
      "42"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-cabinet-pantry-count"]'),
      "3"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-cabinet-drawer-count"]'),
      "4"
    );
    expect(preview.querySelector('[data-module="fridge"]')?.getAttribute("data-width")).toBe("48");
    expect(preview.querySelector('[data-module="range"]')?.getAttribute("data-width")).toBe("48");
    expect(preview.querySelector('[data-module="sink"]')?.getAttribute("data-width")).toBe("33");
    expect(preview.querySelectorAll('[data-module^="pantry-"]')).toHaveLength(3);
    expect(preview.querySelectorAll('[data-module^="drawers-"]')).toHaveLength(4);
    expect(preview.textContent).toContain('42" uppers');

    const initialIslandBody = requiredElement<SVGRectElement>(
      panel,
      '[data-testid="steel-home-cabinet-island-preview"] > rect:nth-of-type(2)'
    );
    const initialIslandSize = [
      initialIslandBody.getAttribute("width"),
      initialIslandBody.getAttribute("height"),
    ];
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-cabinet-island-length"]'),
      "120"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-cabinet-island-width"]'),
      "60"
    );
    const updatedIslandBody = requiredElement<SVGRectElement>(
      panel,
      '[data-testid="steel-home-cabinet-island-preview"] > rect:nth-of-type(2)'
    );
    expect([
      updatedIslandBody.getAttribute("width"),
      updatedIslandBody.getAttribute("height"),
    ]).not.toEqual(initialIslandSize);
    const islandToggle = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-cabinet-island"]'
    );
    act(() => islandToggle.click());
    expect(islandToggle.checked).toBe(false);
    expect(panel.querySelector('[data-testid="steel-home-cabinet-island-preview"]')).toBeNull();

    expect(summary.textContent).toContain("Laundry · Galley · Slab");
    expect(summary.textContent).toContain("Sage · Brushed brass · 3 pantry · 4 drawer bases");
    expect(estimate.textContent).not.toBe(initialEstimate);
  });

  it("makes every metal-building control family update the drawing, openings, or estimate", async () => {
    renderProfile();
    await flushUi();
    const panel = openPlanner("building");
    const preview = requiredElement<SVGSVGElement>(
      panel,
      '[data-testid="steel-home-building-preview"]'
    );
    const summary = requiredElement<HTMLElement>(
      panel,
      '[data-testid="steel-home-building-live-summary"]'
    );
    const estimate = requiredElement<HTMLElement>(
      panel,
      '[data-testid="steel-home-building-planning-estimate"]'
    );
    const initialEstimate = estimate.textContent;

    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-building-use"]'),
      "garage-or-workshop"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-building-roof"]'),
      "monitor"
    );
    const roofBeforePitch = requiredElement<SVGPolygonElement>(
      panel,
      '[data-testid="steel-home-building-roof-preview"] polygon'
    ).getAttribute("points");
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-building-roof-pitch"]'),
      "6:12"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-building-width"]'),
      "54"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-building-length"]'),
      "90"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-building-height"]'),
      "20"
    );
    expect(preview.dataset.use).toBe("garage-or-workshop");
    expect(preview.dataset.roof).toBe("monitor");
    expect(preview.dataset.roofPitch).toBe("6:12");
    expect(preview.textContent).toContain("54' × 90' × 20'");
    expect(
      requiredElement<SVGPolygonElement>(
        panel,
        '[data-testid="steel-home-building-roof-preview"] polygon'
      ).getAttribute("points")
    ).not.toBe(roofBeforePitch);

    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-building-garage-doors"]'),
      "4"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-building-walk-doors"]'),
      "2"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-building-windows"]'),
      "3"
    );
    expect(preview.dataset.garageDoors).toBe("4");
    expect(preview.dataset.walkDoors).toBe("2");
    expect(preview.dataset.windows).toBe("3");
    expect(
      preview.querySelectorAll('[data-testid="steel-home-building-garage-preview"]')
    ).toHaveLength(4);
    expect(
      preview.querySelectorAll('[data-testid="steel-home-building-walk-door-preview"]')
    ).toHaveLength(2);
    expect(
      preview.querySelectorAll('[data-testid="steel-home-building-window-preview"]')
    ).toHaveLength(3);

    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-building-porch"]'),
      "wrap"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-building-porch-depth"]'),
      "14"
    );
    expect(preview.dataset.porch).toBe("wrap");
    expect(
      requiredElement<SVGGElement>(panel, '[data-testid="steel-home-building-front-porch-preview"]')
        .dataset.porchDepth
    ).toBe("14");
    expect(
      requiredElement<SVGGElement>(panel, '[data-testid="steel-home-building-side-porch-preview"]')
        .dataset.porchDepth
    ).toBe("14");

    act(() =>
      requiredElement<HTMLButtonElement>(
        panel,
        '[data-testid="steel-home-building-wall-color-sage"]'
      ).click()
    );
    act(() =>
      requiredElement<HTMLButtonElement>(
        panel,
        '[data-testid="steel-home-building-roof-color-black"]'
      ).click()
    );
    act(() =>
      requiredElement<HTMLButtonElement>(
        panel,
        '[data-testid="steel-home-building-trim-color-warm-white"]'
      ).click()
    );
    expect(preview.dataset.wallColor).toBe("sage");
    expect(preview.dataset.roofColor).toBe("black");
    expect(preview.dataset.trimColor).toBe("warm-white");
    expect(
      requiredElement<SVGPolygonElement>(
        preview,
        '[data-testid="steel-home-building-wall-preview"]'
      ).getAttribute("fill")
    ).toBe("#78877a");
    expect(
      requiredElement<SVGPolygonElement>(
        preview,
        '[data-testid="steel-home-building-roof-preview"] polygon'
      ).getAttribute("fill")
    ).toBe("#242625");

    expect(summary.textContent).toContain("Garage or workshop · Monitor · 6:12");
    expect(summary.textContent).toContain("4,860 sq. ft. · Wraparound porch · Roof included");
    expect(estimate.textContent).not.toBe(initialEstimate);
  });

  it("uses exact named surfaces and exposes AJ Quartz as Engineered Quartz on neutral image routes", async () => {
    renderProfile();
    await flushUi();
    const panel = openPlanner("countertops");
    const cristallo = JW_STONE_NAMED_CATALOG.find((stone) => stone.id === "cristallo")!;
    const patternImage = requiredElement<SVGImageElement>(
      panel,
      '[data-testid="steel-home-countertop-pattern-image"]'
    );
    expect(patternImage.getAttribute("href")).toBe(
      buildNamedStoneDesignerImageHref(cristallo.shareSlug || "", cristallo.images[0]!)
    );
    act(() =>
      requiredElement<HTMLButtonElement>(
        panel,
        '[data-testid="steel-home-countertop-texture-image-1"]'
      ).click()
    );
    expect(patternImage.getAttribute("href")).toBe(
      buildNamedStoneDesignerImageHref(cristallo.shareSlug || "", cristallo.images[1]!)
    );

    const openGallery = panel.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-countertop-surface-open"]'
    );
    if (!openGallery) throw new Error("Surface gallery action missing");
    act(() => openGallery.click());
    const gallery = panel.querySelector<HTMLElement>(
      '[data-testid="steel-home-countertop-surface-gallery"]'
    );
    if (!gallery) throw new Error("Surface gallery missing");

    const surfaceIds = Array.from(
      gallery.querySelectorAll<HTMLButtonElement>(
        'button[data-testid^="steel-home-countertop-stone-"]'
      )
    ).map((button) => button.dataset.testid?.replace("steel-home-countertop-stone-", ""));
    expect(surfaceIds).toEqual(
      [...JW_STONE_NAMED_CATALOG]
        .sort((a, b) => a.publicLabel.localeCompare(b.publicLabel))
        .map((stone) => stone.id)
    );
    expect(surfaceIds).not.toEqual(
      expect.arrayContaining(JW_STONE_ANONYMOUS_CATALOG.map((stone) => stone.id))
    );

    const ajQuartz = gallery.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-countertop-stone-aj-quartz"]'
    );
    const tajMahal = gallery.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-countertop-stone-taj-mahal"]'
    );
    if (!ajQuartz || !tajMahal) throw new Error("Required surface cards missing");
    expect(ajQuartz.textContent).toContain("AJ Quartz");
    expect(ajQuartz.textContent).toContain("Engineered Quartz");
    expect(ajQuartz.querySelector("img")?.getAttribute("src")).toBe(
      "/images/stone-designer/aj-quartz/1.webp"
    );
    expect(tajMahal.textContent).toContain("Quartzite");

    act(() => ajQuartz.click());
    expect(panel.querySelector('[data-testid="steel-home-countertop-surface-gallery"]')).toBeNull();
    expect(
      panel
        .querySelector('[data-testid="steel-home-countertop-selected-surface-image"]')
        ?.getAttribute("src")
    ).toBe("/images/stone-designer/aj-quartz/1.webp");
    const selectedAjQuartz = JW_STONE_NAMED_CATALOG.find((stone) => stone.id === "aj-quartz")!;
    expect(patternImage.getAttribute("href")).toBe(
      buildNamedStoneDesignerImageHref(
        selectedAjQuartz.shareSlug || "",
        selectedAjQuartz.images[0]!
      )
    );
    act(() => openGallery.click());
    for (const image of panel.querySelectorAll<HTMLImageElement>(
      '[data-testid^="steel-home-countertop-stone-"] img'
    )) {
      expect(image.src).toMatch(/\/images\/stone-designer\/[a-z0-9-]+\/1\.webp$/);
      expect(image.src.toLowerCase()).not.toContain("jw-stone");
    }
  });

  it("persists design state and live geometry across planner switches and reloads", async () => {
    renderProfile();
    await flushUi();

    let panel = openPlanner("building");
    const porch = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-building-porch"]'
    );
    const porchDepth = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-building-porch-depth"]'
    );
    if (!porch || !porchDepth) throw new Error("Building geometry controls missing");
    setSelectValue(porch, "side");
    setControlValue(porchDepth, "16");
    expect(
      panel
        .querySelector('[data-testid="steel-home-building-side-porch-preview"]')
        ?.getAttribute("data-porch-depth")
    ).toBe("16");

    panel = openPlanner("countertops");
    enableCountertopIsland(panel);
    const countertopPath = panel
      .querySelector('[data-testid="steel-home-countertop-layout-preview"]')
      ?.getAttribute("d");
    const countertopRun = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-countertop-run-a"]'
    );
    const countertopDepth = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-countertop-wall-depth"]'
    );
    if (!countertopRun || !countertopDepth) throw new Error("Countertop geometry control missing");
    setControlValue(countertopRun, "220");
    setControlValue(countertopDepth, "22");
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-surface-open"]')
        ?.click()
    );
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-stone-aj-quartz"]')
        ?.click()
    );
    expect(
      panel.querySelector('[data-testid="steel-home-countertop-layout-preview"]')?.getAttribute("d")
    ).not.toBe(countertopPath);
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-sink"]'),
      "Single-bowl undermount"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-surface"]'
      ),
      "island"
    );
    const sinkFrontPosition = requiredElement<HTMLInputElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-front-position"]'
    );
    expect(sinkFrontPosition.value).toBe("21");
    const sinkTransformBeforeFrontEdit = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-sink"]'
    ).getAttribute("transform");
    setControlValue(sinkFrontPosition, "17");
    const persistedSinkTransform = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-sink"]'
    ).getAttribute("transform");
    expect(
      requiredElement<SVGGElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-handle-sink"]'
      ).dataset.frontPositionIn
    ).toBe("17");
    expect(persistedSinkTransform).not.toBe(sinkTransformBeforeFrontEdit);

    panel = openPlanner("cabinets");
    const cabinetPath = panel
      .querySelector('[data-testid="steel-home-cabinet-layout-preview"]')
      ?.getAttribute("d");
    const ceilingY = panel
      .querySelector('[data-testid="steel-home-cabinet-ceiling-preview"]')
      ?.getAttribute("y1");
    const returnWall = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-cabinet-return-wall"]'
    );
    const ceiling = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-cabinet-ceiling-height"]'
    );
    if (!returnWall || !ceiling) throw new Error("Cabinet geometry controls missing");
    setControlValue(returnWall, "300");
    setControlValue(ceiling, "132");
    expect(
      panel.querySelector('[data-testid="steel-home-cabinet-layout-preview"]')?.getAttribute("d")
    ).not.toBe(cabinetPath);
    expect(
      panel.querySelector('[data-testid="steel-home-cabinet-ceiling-preview"]')?.getAttribute("y1")
    ).not.toBe(ceilingY);

    panel = openPlanner("countertops");
    await flushUi();
    expect(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-countertop-wall-depth"]')
        .value
    ).toBe("22");
    expect(
      requiredElement<SVGSVGElement>(panel, '[data-testid="steel-home-countertop-preview"]').dataset
        .wallDepthIn
    ).toBe("22");
    expect(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-front-position"]'
      ).value
    ).toBe("17");
    const switchedSinkHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-sink"]'
    );
    expect(switchedSinkHandle.dataset.frontPositionIn).toBe("17");
    expect(switchedSinkHandle.getAttribute("transform")).toBe(persistedSinkTransform);

    panel = openPlanner("cabinets");

    await flushUi();
    expect(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY).toBe(
      "tradescout:steel-home-project-tools:draft:v9"
    );
    const savedDraft = window.localStorage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    expect(savedDraft).toContain('"version":9');
    expect(savedDraft).toContain('"porchDepthFt":16');
    expect(savedDraft).toContain('"wallAIn":220');
    expect(savedDraft).toContain('"wallDepthIn":22');
    expect(savedDraft).toContain('"stoneId":"aj-quartz"');
    expect(savedDraft).toContain('"sinkFrontPositionIn":17');
    expect(savedDraft).toContain('"returnWallIn":300');
    expect(savedDraft).toContain('"ceilingHeightIn":132');

    act(() => root.unmount());
    root = createRoot(container);
    renderProfile();
    await flushUi();

    panel = openPlanner("building");
    expect(
      panel.querySelector<HTMLInputElement>('[data-testid="steel-home-building-porch-depth"]')
        ?.value
    ).toBe("16");
    expect(
      panel
        .querySelector('[data-testid="steel-home-building-side-porch-preview"]')
        ?.getAttribute("data-porch-depth")
    ).toBe("16");

    panel = openPlanner("countertops");
    expect(
      panel
        .querySelector('[data-testid="steel-home-countertop-selected-surface-image"]')
        ?.getAttribute("src")
    ).toBe("/images/stone-designer/aj-quartz/1.webp");
    expect(panel.querySelector("svg image")?.getAttribute("href")).toBe(
      namedStonePhotoHref("aj-quartz")
    );
    await flushUi();
    expect(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-countertop-wall-depth"]')
        .value
    ).toBe("22");
    expect(
      requiredElement<SVGSVGElement>(panel, '[data-testid="steel-home-countertop-preview"]').dataset
        .wallDepthIn
    ).toBe("22");
    expect(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-front-position"]'
      ).value
    ).toBe("17");
    const reloadedSinkHandle = requiredElement<SVGGElement>(
      panel,
      '[data-testid="steel-home-countertop-cutout-handle-sink"]'
    );
    expect(reloadedSinkHandle.dataset.frontPositionIn).toBe("17");
    expect(reloadedSinkHandle.getAttribute("transform")).toBe(persistedSinkTransform);

    panel = openPlanner("cabinets");
    expect(
      panel.querySelector<HTMLInputElement>('[data-testid="steel-home-cabinet-return-wall"]')?.value
    ).toBe("300");
    expect(
      panel.querySelector<HTMLInputElement>('[data-testid="steel-home-cabinet-ceiling-height"]')
        ?.value
    ).toBe("132");
  });

  it("opens intake only after planning and preserves spaces typed one character at a time", async () => {
    renderProfile();
    await flushUi();
    expect(container.querySelector('[data-testid="steel-home-project-location"]')).toBeNull();

    const drawer = startRequest("building");
    expect(drawer.textContent).toContain("Metal Building builder request");
    expect(drawer.textContent).toContain("Early metal building estimate");
    expect(drawer.textContent).toContain("Only this builder goes into the request");
    const disabledAction = drawer.querySelector<HTMLElement>(
      '[data-testid="steel-home-planner-request-submit"]'
    );
    expect(disabledAction?.tagName).toBe("SPAN");
    expect(disabledAction?.getAttribute("aria-disabled")).toBe("true");
    expect(disabledAction?.textContent).toContain("Continue to contact details");

    const locationText = "Ocean Springs, MS 39564";
    completeRequestDetails(drawer, locationText);
    const location = drawer.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-project-location"]'
    );
    expect(location?.value).toBe(locationText);

    const readyAction = drawer.querySelector<HTMLAnchorElement>(
      'a[data-testid="steel-home-planner-request-submit"]'
    );
    expect(readyAction).not.toBeNull();
    expect(readyAction?.textContent).toContain("Continue to contact details");

    pressKey(drawer.querySelector<HTMLElement>('[role="dialog"]') || drawer, "Escape");
    expect(container.querySelector('[data-testid="steel-home-planner-request"]')).toBeNull();
  });

  it("keeps role, jobsite, and timing drafts isolated between builder requests", async () => {
    renderProfile();
    await flushUi();

    let drawer = startRequest("building");
    const buildingLocation = "Ocean Springs, MS 39564";
    completeRequestDetails(drawer, buildingLocation);
    setSelectValue(
      requiredElement<HTMLSelectElement>(drawer, '[data-testid="steel-home-project-timing"]'),
      "Within 6 months"
    );
    expect(
      requiredElement<HTMLButtonElement>(
        drawer,
        '[data-testid="steel-home-project-role-self-contracted"]'
      ).getAttribute("aria-pressed")
    ).toBe("true");
    closeRequest();

    drawer = startRequest("cabinets");
    expect(
      requiredElement<HTMLInputElement>(drawer, '[data-testid="steel-home-project-location"]').value
    ).toBe("");
    expect(
      requiredElement<HTMLSelectElement>(drawer, '[data-testid="steel-home-project-state"]').value
    ).toBe("");
    expect(
      requiredElement<HTMLSelectElement>(drawer, '[data-testid="steel-home-project-county"]').value
    ).toBe("");
    expect(
      requiredElement<HTMLSelectElement>(drawer, '[data-testid="steel-home-project-timing"]').value
    ).toBe("");
    expect(
      Array.from(
        drawer.querySelectorAll<HTMLButtonElement>('[data-testid^="steel-home-project-role-"]')
      ).some((role) => role.getAttribute("aria-pressed") === "true")
    ).toBe(false);
    closeRequest();

    drawer = startRequest("building");
    expect(
      requiredElement<HTMLInputElement>(drawer, '[data-testid="steel-home-project-location"]').value
    ).toBe(buildingLocation);
    expect(
      requiredElement<HTMLSelectElement>(drawer, '[data-testid="steel-home-project-state"]').value
    ).toBe("MS");
    expect(
      requiredElement<HTMLSelectElement>(drawer, '[data-testid="steel-home-project-county"]').value
    ).toBe("28059");
    expect(
      requiredElement<HTMLSelectElement>(drawer, '[data-testid="steel-home-project-timing"]').value
    ).toBe("Within 6 months");
    expect(
      requiredElement<HTMLButtonElement>(
        drawer,
        '[data-testid="steel-home-project-role-self-contracted"]'
      ).getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("migrates legacy request details once, then preserves per-builder isolation", async () => {
    const legacyDetails = {
      location: "Legacy saved jobsite, MS 39564",
      stateCode: "MS",
      countyFips: "28059",
      countyName: "Jackson County",
      timing: "Within 12 months",
      projectRole: "has-builder" as const,
    };
    const legacyDraft = createEmptySteelHomeProjectDraft();
    const legacyCountertops = { ...legacyDraft.countertops } as Record<string, unknown>;
    delete legacyCountertops.wallDepthIn;
    window.localStorage.setItem(
      LEGACY_V7_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        ...legacyDraft,
        version: 7,
        ...legacyDetails,
        countertops: legacyCountertops,
      })
    );
    expect(window.localStorage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(BUILDER_REQUEST_DETAILS_STORAGE_KEY)).toBeNull();

    renderProfile();
    await flushUi();

    expect(window.localStorage.getItem(LEGACY_V7_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toBeNull();
    expect(
      JSON.parse(window.localStorage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY) || "{}")
    ).toMatchObject({
      version: 9,
      ...legacyDetails,
      countertops: { wallDepthIn: 25.5 },
    });

    const expectRequestDetails = (
      drawer: HTMLElement,
      expected: Pick<typeof legacyDetails, "location" | "stateCode" | "countyFips" | "timing">,
      role: "has-builder" | "builder-or-contractor" = "has-builder"
    ) => {
      expect(
        requiredElement<HTMLInputElement>(drawer, '[data-testid="steel-home-project-location"]')
          .value
      ).toBe(expected.location);
      expect(
        requiredElement<HTMLSelectElement>(drawer, '[data-testid="steel-home-project-state"]').value
      ).toBe(expected.stateCode);
      expect(
        requiredElement<HTMLSelectElement>(drawer, '[data-testid="steel-home-project-county"]')
          .value
      ).toBe(expected.countyFips);
      expect(
        requiredElement<HTMLSelectElement>(drawer, '[data-testid="steel-home-project-timing"]')
          .value
      ).toBe(expected.timing);
      expect(
        requiredElement<HTMLButtonElement>(
          drawer,
          `[data-testid="steel-home-project-role-${role}"]`
        ).getAttribute("aria-pressed")
      ).toBe("true");
    };

    for (const planner of ["countertops", "cabinets", "building"] as const) {
      const drawer = startRequest(planner);
      expectRequestDetails(drawer, legacyDetails);
      closeRequest();
    }

    await flushUi();
    expect(
      JSON.parse(window.localStorage.getItem(BUILDER_REQUEST_DETAILS_STORAGE_KEY) || "{}")
    ).toMatchObject({
      countertops: legacyDetails,
      cabinets: legacyDetails,
      building: legacyDetails,
    });

    let drawer = startRequest("building");
    const buildingOnlyDetails = {
      ...legacyDetails,
      location: "Building-only jobsite, MS 39564",
      timing: "Within 3 months",
      projectRole: "builder-or-contractor" as const,
    };
    setControlValue(
      requiredElement<HTMLInputElement>(drawer, '[data-testid="steel-home-project-location"]'),
      buildingOnlyDetails.location
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(drawer, '[data-testid="steel-home-project-timing"]'),
      buildingOnlyDetails.timing
    );
    act(() =>
      requiredElement<HTMLButtonElement>(
        drawer,
        '[data-testid="steel-home-project-role-builder-or-contractor"]'
      ).click()
    );
    closeRequest();

    drawer = startRequest("cabinets");
    expectRequestDetails(drawer, legacyDetails);
    closeRequest();
    await flushUi();

    const isolatedDetails = JSON.parse(
      window.localStorage.getItem(BUILDER_REQUEST_DETAILS_STORAGE_KEY) || "{}"
    );
    expect(isolatedDetails).toMatchObject({
      countertops: legacyDetails,
      cabinets: legacyDetails,
      building: buildingOnlyDetails,
    });

    window.localStorage.setItem(
      STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        ...createEmptySteelHomeProjectDraft(),
        location: "Stale shared draft must not win",
        stateCode: "AL",
        countyFips: "01001",
        countyName: "Autauga County",
        timing: "More than 12 months away",
        projectRole: "self-contracted",
      })
    );
    act(() => root.unmount());
    root = createRoot(container);
    renderProfile();
    await flushUi();

    drawer = startRequest("building");
    expectRequestDetails(drawer, buildingOnlyDetails, "builder-or-contractor");
    closeRequest();
    drawer = startRequest("countertops");
    expectRequestDetails(drawer, legacyDetails);
  });

  it("requires a visible contracting role when an older saved role is no longer offered", async () => {
    window.localStorage.setItem(
      STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        ...createEmptySteelHomeProjectDraft(),
        projectRole: "whole-build-help",
        location: "Ocean Springs, MS 39564",
        stateCode: "MS",
        countyFips: "28059",
        countyName: "Jackson County",
      })
    );
    renderProfile();
    await flushUi();

    const drawer = startRequest("countertops");
    expect(drawer.textContent).toContain("Choose who is planning the request.");
    expect(
      Array.from(
        drawer.querySelectorAll<HTMLButtonElement>('[data-testid^="steel-home-project-role-"]')
      ).some((role) => role.getAttribute("aria-pressed") === "true")
    ).toBe(false);
    const action = drawer.querySelector<HTMLElement>(
      '[data-testid="steel-home-planner-request-stone-submit"]'
    );
    expect(action?.tagName).toBe("SPAN");
    expect(action?.getAttribute("aria-disabled")).toBe("true");
  });

  it("keeps all three request drawers scoped to their active planner", async () => {
    renderProfile();
    await flushUi();

    const expectations: Array<{
      planner: SteelHomePlanner;
      required: string[];
      forbidden: string[];
    }> = [
      {
        planner: "countertops",
        required: [
          "Gross countertop layout footprint",
          "Backsplash excluded",
          "Range gaps not deducted",
          "Quote needed",
        ],
        forbidden: ["Early metal building estimate", "Early cabinet estimate"],
      },
      {
        planner: "cabinets",
        required: ["Early cabinet estimate", "main wall"],
        forbidden: ["Early metal building estimate", "Gross countertop layout footprint"],
      },
      {
        planner: "building",
        required: ["Early metal building estimate", "metal building with roof"],
        forbidden: ["Gross countertop layout footprint", "Early cabinet estimate"],
      },
    ];

    for (const item of expectations) {
      const drawer = startRequest(item.planner);
      const result = drawer.querySelector<HTMLElement>(
        '[data-testid="steel-home-planner-request-result"]'
      );
      if (!result) throw new Error(`${item.planner} request result missing`);
      for (const text of item.required) expect(result.textContent).toContain(text);
      for (const text of item.forbidden) expect(result.textContent).not.toContain(text);
      closeRequest();
    }
  });

  it("keeps stone purchasing and local fabricator handoffs separate, private, and scoped", async () => {
    renderProfile();
    await flushUi();

    let panel = openPlanner("building");
    const width = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-building-width"]'
    );
    if (!width) throw new Error("Building width missing");
    setControlValue(width, "54");
    startRequest("building");
    closeRequest();

    panel = openPlanner("cabinets");
    const layout = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-cabinet-layout"]'
    );
    if (!layout) throw new Error("Cabinet layout missing");
    setSelectValue(layout, "u-shape");
    startRequest("cabinets");
    closeRequest();

    panel = openPlanner("countertops");
    enableCountertopIsland(panel);
    setControlValue(
      requiredElement<HTMLInputElement>(panel, '[data-testid="steel-home-countertop-wall-depth"]'),
      "22"
    );
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-surface-open"]')
        ?.click()
    );
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-stone-aj-quartz"]')
        ?.click()
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-sink"]'),
      "Single-bowl undermount"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-surface"]'
      ),
      "main"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-position"]'
      ),
      "44"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(panel, '[data-testid="steel-home-countertop-cooktop"]'),
      "36-inch range gap"
    );
    setSelectValue(
      requiredElement<HTMLSelectElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-surface"]'
      ),
      "island"
    );
    setControlValue(
      requiredElement<HTMLInputElement>(
        panel,
        '[data-testid="steel-home-countertop-cutout-position"]'
      ),
      "36"
    );

    let drawer = startRequest("countertops", "stone");
    expect(drawer.textContent).toContain("Request AJ Quartz");
    expect(drawer.textContent).toContain("Material only");
    expect(drawer.textContent).toContain("Fabrication and installation stay separate");
    completeRequestDetails(drawer, "Ocean Springs, MS 39564");
    const timing = drawer.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-timing"]'
    );
    if (!timing) throw new Error("Timing control missing");
    setSelectValue(timing, "Within 6 months");
    const refreshedDrawer = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-planner-request"]'
    );
    if (!refreshedDrawer) throw new Error("Updated countertop request drawer missing");
    drawer = refreshedDrawer;

    const stoneRequest = drawer.querySelector<HTMLAnchorElement>(
      'a[data-testid="steel-home-planner-request-stone-submit"]'
    );
    if (!stoneRequest) throw new Error("Ready stone request action missing");
    expect(stoneRequest.textContent).toContain("Continue to material request");
    const stoneFallback = new URL(stoneRequest.getAttribute("href") || "", "http://localhost");
    expect(stoneFallback.pathname).toBe("/direct-connect");
    expect(stoneFallback.searchParams.get("profile")).toBe("steel-home-packages");
    expect(stoneFallback.searchParams.get("profileName")).toBe("Steel Home Planning Tools");
    expect(stoneFallback.searchParams.get("source")).toBe("steel_home_planning_tools");
    expect(stoneFallback.searchParams.get("subject")).toBe("product");
    expect(stoneFallback.searchParams.has("description")).toBe(false);
    expect(stoneFallback.searchParams.has("location")).toBe(false);
    expect(stoneRequest.outerHTML).not.toContain("Ocean Springs");

    act(() => stoneRequest.focus());
    const stagedStoneHref = stoneRequest.getAttribute("href") || "";
    const stagedStoneUrl = new URL(stagedStoneHref, "http://localhost");
    const stoneToken = stagedStoneUrl.searchParams.get("staged");
    expect(stoneToken).toMatch(/^[a-f0-9]{64}$/);
    expect(stagedStoneUrl.searchParams.has("description")).toBe(false);
    expect(stagedStoneUrl.searchParams.has("location")).toBe(false);

    const stoneContext = readStagedDirectConnectEntryContext(stagedStoneHref);
    expect(stoneContext).toMatchObject({
      targetName: "Steel Home Planning Tools",
      targetSelector: "steel-home-packages",
      contextType: "profile",
      contextId: "steel-home-packages",
      source: "steel_home_planning_tools",
      subjectType: "product",
      title: "TradeScout Stone Material Request — AJ Quartz",
      location: "Ocean Springs, MS 39564",
      countyFips: "28059",
      stateCode: "MS",
      timing: "Within 6 months",
    });
    expect(stoneContext?.description).toContain("TradeScout Stone Material Request");
    expect(stoneContext?.description).toContain(
      "Project location: Ocean Springs, MS 39564 — Jackson County, MS"
    );
    expect(stoneContext?.description).toContain("Contracting setup: Self-contracted homeowner");
    expect(stoneContext?.description).toContain("Requested surface: AJ Quartz — Engineered Quartz");
    expect(stoneContext?.description).toContain('Wall runs: Main run: 120"; Left return: 96"');
    expect(stoneContext?.description).toContain('Wall-top depth: 22"');
    expect(stoneContext?.description).toContain(
      "Gross countertop layout footprint (backsplash excluded; range gaps not deducted): About 54.1 sq. ft."
    );
    expect(stoneContext?.description).toContain(
      "Backsplash and range-gap deductions are excluded from the footprint shown. Slab quantity, backsplash height, seams, waste, and final material quantity require field measurement and slab layout."
    );
    expect(stoneContext?.description).toContain("Material request only");
    expect(stoneContext?.description).toContain(
      "JW Stone does not provide field templating, fabrication, cutting, or countertop installation."
    );
    expect(stoneContext?.description).not.toContain("Work needed: Stone fabrication");
    expect(stoneContext?.description).not.toContain("Planned openings");
    expect(stoneContext?.description).not.toContain("Single-bowl undermount");
    expect(stoneContext?.description).not.toContain("Building Details");
    expect(stoneContext?.description).not.toContain("Cabinet Details");
    expect(stoneContext?.description).not.toContain("54' wide");
    expect(stoneContext?.description).not.toContain("U-shaped");

    closeRequest();
    drawer = startRequest("countertops", "fabricator");
    expect(drawer.textContent).toContain("Find a countertop fabricator");
    expect(drawer.textContent).toContain("Local service only");
    expect(drawer.textContent).toContain("selected stone purchase stays separate");
    expect(
      requiredElement<HTMLInputElement>(drawer, '[data-testid="steel-home-project-location"]').value
    ).toBe("Ocean Springs, MS 39564");
    expect(
      requiredElement<HTMLSelectElement>(drawer, '[data-testid="steel-home-project-timing"]').value
    ).toBe("Within 6 months");

    const fabricatorRequest = drawer.querySelector<HTMLAnchorElement>(
      'a[data-testid="steel-home-planner-request-fabricator-submit"]'
    );
    if (!fabricatorRequest) throw new Error("Ready fabricator request action missing");
    expect(fabricatorRequest.textContent).toContain("Continue to fabricator matching");
    const fabricatorFallback = new URL(
      fabricatorRequest.getAttribute("href") || "",
      "http://localhost"
    );
    expect(fabricatorFallback.pathname).toBe("/direct-connect");
    expect(fabricatorFallback.searchParams.get("source")).toBe("steel_home_planning_tools_labor");
    expect(fabricatorFallback.searchParams.get("subject")).toBe("service");
    expect(fabricatorFallback.searchParams.has("profile")).toBe(false);
    expect(fabricatorFallback.searchParams.has("profileName")).toBe(false);
    expect(fabricatorFallback.searchParams.has("description")).toBe(false);
    expect(fabricatorFallback.searchParams.has("location")).toBe(false);
    expect(fabricatorRequest.outerHTML).not.toContain("Ocean Springs");

    act(() => fabricatorRequest.focus());
    const stagedFabricatorHref = fabricatorRequest.getAttribute("href") || "";
    const stagedFabricatorUrl = new URL(stagedFabricatorHref, "http://localhost");
    const fabricatorToken = stagedFabricatorUrl.searchParams.get("staged");
    expect(fabricatorToken).toMatch(/^[a-f0-9]{64}$/);
    expect(fabricatorToken).not.toBe(stoneToken);
    expect(stagedFabricatorUrl.searchParams.has("description")).toBe(false);
    expect(stagedFabricatorUrl.searchParams.has("location")).toBe(false);

    const fabricatorContext = readStagedDirectConnectEntryContext(stagedFabricatorHref);
    expect(fabricatorContext).toMatchObject({
      source: "steel_home_planning_tools_labor",
      subjectType: "service",
      title: "TradeScout Countertop Fabricator Request",
      location: "Jackson County, MS",
      countyFips: "28059",
      stateCode: "MS",
      timing: "Within 6 months",
    });
    expect(fabricatorContext?.targetName).toBeUndefined();
    expect(fabricatorContext?.targetSelector).toBeUndefined();
    expect(fabricatorContext?.targetProviderId).toBeUndefined();
    expect(fabricatorContext?.contextType).toBeUndefined();
    expect(fabricatorContext?.contextId).toBeUndefined();
    expect(fabricatorContext?.description).toContain("Service area: Jackson County, MS");
    expect(fabricatorContext?.description).toContain("Work needed: Stone fabrication");
    expect(fabricatorContext?.description).toContain("Room and layout: Kitchen, L-shaped");
    expect(fabricatorContext?.description).toContain(
      "Stone reference: AJ Quartz — Engineered Quartz"
    );
    expect(fabricatorContext?.description).toContain('Wall runs: Main run: 120"; Left return: 96"');
    expect(fabricatorContext?.description).toContain('Wall-top depth: 22"');
    expect(fabricatorContext?.description).toContain(
      "Gross countertop layout footprint (backsplash excluded; range gaps not deducted): About 54.1 sq. ft."
    );
    expect(fabricatorContext?.description).toContain("Planned openings");
    expect(fabricatorContext?.description).toContain(
      "Return runs start at their top/wall-side outer end; the first 22 inches includes the shared corner zone where the return meets the main run."
    );
    expect(fabricatorContext?.description).toContain(
      '- Sink — Single-bowl undermount — Main run, center 44" from the start edge (left end); left/right are as viewed while standing in the room facing the run, center 11" inward from the room-facing front edge; measure inward toward the wall or back edge, approximately 30" × 18"'
    );
    expect(fabricatorContext?.description).toContain(
      '- 36-inch range gap — Island, center 36" from the start edge (left end while standing at the long edge facing away from the main run), full-depth run gap (not a countertop cutout), nominal 36" width'
    );
    expect(fabricatorContext?.description).toContain(
      "Planning brief only. The fabricator must field-template and confirm every opening"
    );
    expect(fabricatorContext?.description).not.toContain("Ocean Springs");
    expect(fabricatorContext?.description).not.toContain("inside corner");
    expect(fabricatorContext?.description).not.toContain("Material request only");
    expect(fabricatorContext?.description).not.toContain("TradeScout Stone Material Request");
    expect(fabricatorContext?.description).not.toContain("Building Details");
    expect(fabricatorContext?.description).not.toContain("Cabinet Details");
    expect(fabricatorContext?.description).not.toContain("54' wide");
    expect(fabricatorContext?.description).not.toContain("U-shaped");
  });

  it("uses a private-detail-free fallback when Direct Connect is cross-origin", async () => {
    const platformBaseHref = "https://www.thetradescout.com";
    expect(new URL(platformBaseHref).origin).not.toBe(window.location.origin);
    renderProfile(platformBaseHref);
    await flushUi();

    const drawer = startRequest("cabinets");
    completeRequestDetails(drawer, "Private jobsite, MS 39564");
    const request = drawer.querySelector<HTMLAnchorElement>(
      'a[data-testid="steel-home-planner-request-submit"]'
    );
    if (!request) throw new Error("Cross-origin request action missing");

    const fallback = new URL(request.getAttribute("href") || "");
    expect(fallback.origin).toBe(platformBaseHref);
    expect(fallback.pathname).toBe("/direct-connect");
    expect(fallback.searchParams.get("profile")).toBe("steel-home-packages");
    expect(fallback.searchParams.get("source")).toBe("steel_home_planning_tools");
    expect(fallback.searchParams.has("description")).toBe(false);
    expect(fallback.searchParams.has("location")).toBe(false);
    expect(request.outerHTML).not.toContain("Private jobsite");

    request.addEventListener("click", (event) => event.preventDefault(), { once: true });
    act(() => request.click());
    expect(request.getAttribute("href")).toBe(fallback.toString());
    expect(window.sessionStorage.length).toBe(0);
  });

  it("uses literal customer language without partner, internal, or owner-build copy", async () => {
    renderProfile();
    await flushUi();
    const observedText: string[] = [];

    for (const planner of STEEL_HOME_BUILDERS) {
      const panel = openPlanner(planner.key);
      if (planner.key === "countertops") {
        act(() =>
          requiredElement<HTMLButtonElement>(
            panel,
            '[data-testid="steel-home-countertop-surface-open"]'
          ).click()
        );
      }
      observedText.push(userFacingText(panel));
      if (planner.key === "countertops") {
        act(() =>
          requiredElement<HTMLButtonElement>(
            panel,
            '[data-testid="steel-home-countertop-surface-close"]'
          ).click()
        );
      }
      const drawer = startRequest(planner.key);
      observedText.push(userFacingText(drawer));
      closeRequest();
    }

    const publicText = observedText.join("\n").toLowerCase();
    expect(publicText).toContain("self-contracted homeowner");
    expect(publicText).toContain("quartzite");
    expect(publicText).toContain("engineered quartz");
    expect(publicText).toContain("continue to contact details");
    for (const forbidden of FORBIDDEN_PUBLIC_COPY) {
      expect(publicText).not.toContain(forbidden.toLowerCase());
    }
  });
});
