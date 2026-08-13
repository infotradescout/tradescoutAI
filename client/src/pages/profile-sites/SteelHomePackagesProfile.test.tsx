// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_ANONYMOUS_CATALOG, JW_STONE_NAMED_CATALOG } from "@/features/jw-stone/catalog";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
import { readStagedDirectConnectEntryContext } from "@/pages/direct-connect/stagedDirectConnectEntryContext";
import {
  STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH,
  STEEL_HOME_PACKAGES_START_REQUEST_PATH,
} from "@shared/steelHomePackagesProfile";
import SteelHomePackagesProfile from "./SteelHomePackagesProfile";
import {
  STEEL_HOME_PLANNERS,
  type SteelHomePlanner,
  plannerPanelId,
  plannerTabId,
} from "./steel-home-project-tools/SteelHomePlannerNav";
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

function pressKey(control: HTMLElement, key: string) {
  act(() => {
    control.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
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

  function visiblePanels() {
    return Array.from(container.querySelectorAll<HTMLElement>('[role="tabpanel"]')).filter(
      (panel) => !panel.hidden
    );
  }

  function activePanel() {
    const panels = visiblePanels();
    expect(panels).toHaveLength(1);
    return panels[0];
  }

  function openPlanner(planner: SteelHomePlanner) {
    const tab = container.querySelector<HTMLButtonElement>(
      `[data-testid="${plannerTabId(planner)}"]`
    );
    if (!tab) throw new Error(`${planner} planner tab missing`);
    act(() => tab.click());

    const panel = container.querySelector<HTMLElement>(`#${plannerPanelId(planner)}`);
    if (!panel) throw new Error(`${planner} planner panel missing`);
    expect(panel.hidden).toBe(false);
    expect(activePanel()).toBe(panel);
    expect(tab.getAttribute("aria-selected")).toBe("true");
    return panel;
  }

  function startRequest(planner: SteelHomePlanner) {
    const panel = openPlanner(planner);
    const plannerName =
      planner === "countertops" ? "countertop" : planner === "cabinets" ? "cabinet" : "building";
    const button = panel.querySelector<HTMLButtonElement>(
      `[data-testid="steel-home-${plannerName}-include"]`
    );
    if (!button) throw new Error(`${planner} Start a Request button missing`);
    expect(button.textContent).toContain("Start a Request");
    act(() => button.click());
    const drawer = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-planner-request"]'
    );
    if (!drawer) throw new Error(`${planner} request drawer missing`);
    expect(drawer.querySelector('[role="dialog"]')?.getAttribute("data-planner")).toBe(planner);
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

  it("renders Countertops, Cabinets, and Metal Buildings in that order and defaults to Countertops", async () => {
    renderProfile();
    await flushUi();

    const profile = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-packages-profile"]'
    );
    const nav = container.querySelector<HTMLElement>('[data-testid="steel-home-planner-tabs"]');
    if (!profile || !nav) throw new Error("Three-planner shell missing");
    expect(profile.dataset.releaseState).toBe("unlisted");
    expect(profile.textContent).toContain("Steel Home Planning Tools");
    expect(profile.textContent).toContain("Three separate planners");
    expect(nav.getAttribute("aria-label")).toBe("Steel home planners");

    const tabs = Array.from(nav.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs).toHaveLength(3);
    expect(tabs.map((tab) => tab.id)).toEqual(
      STEEL_HOME_PLANNERS.map((planner) => plannerTabId(planner.key))
    );
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "CountertopsCountertop Planner",
      "CabinetsCabinet Planner",
      "Metal BuildingsMetal Building Planner",
    ]);
    tabs.forEach((tab, index) => {
      const planner = STEEL_HOME_PLANNERS[index];
      expect(tab.getAttribute("aria-controls")).toBe(plannerPanelId(planner.key));
      expect(tab.getAttribute("aria-selected")).toBe(index === 0 ? "true" : "false");
      expect(tab.tabIndex).toBe(index === 0 ? 0 : -1);
    });

    const panels = Array.from(container.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
    expect(panels).toHaveLength(3);
    expect(activePanel().id).toBe(plannerPanelId("countertops"));
    expect(
      activePanel().querySelector('[data-testid="steel-home-countertop-designer"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="steel-home-building-designer"]')).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-cabinet-designer"]')).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-project-location"]')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
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

  it("keeps hash, browser history, and keyboard tab behavior aligned", async () => {
    renderProfile();
    await flushUi();
    const pushState = vi.spyOn(window.history, "pushState");

    const panel = openPlanner("cabinets");
    expect(panel.id).toBe(plannerPanelId("cabinets"));
    expect(window.location.hash).toBe("#cabinets");
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/u/steel-home-packages#cabinets");

    let tab = container.querySelector<HTMLButtonElement>(
      `[data-testid="${plannerTabId("cabinets")}"]`
    );
    if (!tab) throw new Error("Cabinet tab missing");
    tab.focus();
    pressKey(tab, "ArrowRight");
    tab = container.querySelector<HTMLButtonElement>(`[data-testid="${plannerTabId("building")}"]`);
    expect(activePanel().id).toBe(plannerPanelId("building"));
    expect(document.activeElement).toBe(tab);

    if (!tab) throw new Error("Metal building tab missing");
    pressKey(tab, "Home");
    tab = container.querySelector<HTMLButtonElement>(
      `[data-testid="${plannerTabId("countertops")}"]`
    );
    expect(activePanel().id).toBe(plannerPanelId("countertops"));
    expect(document.activeElement).toBe(tab);

    if (!tab) throw new Error("Countertop tab missing");
    pressKey(tab, "ArrowLeft");
    expect(activePanel().id).toBe(plannerPanelId("building"));

    act(() => {
      window.history.replaceState(null, "", "/u/steel-home-packages#countertops");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(activePanel().id).toBe(plannerPanelId("countertops"));

    act(() => {
      window.history.replaceState(null, "", "/u/steel-home-packages#cabinet-designer");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(activePanel().id).toBe(plannerPanelId("cabinets"));
    expect(visiblePanels()).toHaveLength(1);
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
    expect(panel.textContent).toContain("Estimated area");
    expect(panel.textContent).toContain("Quote needed");
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
  });

  it("uses exact named surfaces and exposes AJ Quartz as Engineered Quartz on neutral image routes", async () => {
    renderProfile();
    await flushUi();
    const panel = openPlanner("countertops");
    const selector = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-countertop-all-stones"]'
    );
    if (!selector) throw new Error("Named surface selector missing");

    expect(Array.from(selector.options).map((option) => option.value)).toEqual(
      [...JW_STONE_NAMED_CATALOG]
        .sort((a, b) => a.publicLabel.localeCompare(b.publicLabel))
        .map((stone) => stone.id)
    );
    expect(Array.from(selector.options).map((option) => option.value)).not.toEqual(
      expect.arrayContaining(JW_STONE_ANONYMOUS_CATALOG.map((stone) => stone.id))
    );

    const ajQuartz = panel.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-countertop-stone-aj-quartz"]'
    );
    const tajMahal = panel.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-countertop-stone-taj-mahal"]'
    );
    if (!ajQuartz || !tajMahal) throw new Error("Required quick surface cards missing");
    expect(ajQuartz.textContent).toContain("AJ Quartz");
    expect(ajQuartz.textContent).toContain("Engineered Quartz");
    expect(ajQuartz.querySelector("img")?.getAttribute("src")).toBe(
      "/images/stone-designer/aj-quartz/1.webp"
    );
    expect(tajMahal.textContent).toContain("Quartzite");

    act(() => ajQuartz.click());
    expect(selector.value).toBe("aj-quartz");
    expect(panel.querySelector("svg image")?.getAttribute("href")).toBe(
      "/images/stone-designer/aj-quartz/1.webp"
    );
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
    const countertopPath = panel
      .querySelector('[data-testid="steel-home-countertop-layout-preview"]')
      ?.getAttribute("d");
    const countertopRun = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-countertop-run-a"]'
    );
    if (!countertopRun) throw new Error("Countertop geometry control missing");
    setControlValue(countertopRun, "220");
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-stone-aj-quartz"]')
        ?.click()
    );
    expect(
      panel.querySelector('[data-testid="steel-home-countertop-layout-preview"]')?.getAttribute("d")
    ).not.toBe(countertopPath);

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

    await flushUi();
    const savedDraft = window.localStorage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    expect(savedDraft).toContain('"porchDepthFt":16');
    expect(savedDraft).toContain('"wallAIn":220');
    expect(savedDraft).toContain('"stoneId":"aj-quartz"');
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
      panel.querySelector<HTMLSelectElement>('[data-testid="steel-home-countertop-all-stones"]')
        ?.value
    ).toBe("aj-quartz");
    expect(panel.querySelector("svg image")?.getAttribute("href")).toBe(
      "/images/stone-designer/aj-quartz/1.webp"
    );

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
    expect(drawer.textContent).toContain("Start a Metal Building Request");
    expect(drawer.textContent).toContain("Early metal building estimate");
    expect(drawer.textContent).toContain("Only this planner goes into the request");
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
      '[data-testid="steel-home-planner-request-submit"]'
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
        required: ["Approximate countertop area", "Quote needed"],
        forbidden: ["Early metal building estimate", "Early cabinet estimate"],
      },
      {
        planner: "cabinets",
        required: ["Early cabinet estimate", "main wall"],
        forbidden: ["Early metal building estimate", "Approximate countertop area"],
      },
      {
        planner: "building",
        required: ["Early metal building estimate", "metal building with roof"],
        forbidden: ["Approximate countertop area", "Early cabinet estimate"],
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

  it("stages private details securely and includes only the active planner", async () => {
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
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-stone-aj-quartz"]')
        ?.click()
    );
    let drawer = startRequest("countertops");
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

    const request = drawer.querySelector<HTMLAnchorElement>(
      'a[data-testid="steel-home-planner-request-submit"]'
    );
    if (!request) throw new Error("Ready request action missing");
    const fallback = new URL(request.getAttribute("href") || "", "http://localhost");
    expect(fallback.pathname).toBe("/direct-connect");
    expect(fallback.searchParams.get("profile")).toBe("steel-home-packages");
    expect(fallback.searchParams.get("source")).toBe("steel_home_planning_tools");
    expect(fallback.searchParams.has("description")).toBe(false);
    expect(request.outerHTML).not.toContain("Ocean Springs");

    act(() => request.focus());
    const stagedHref = request.getAttribute("href") || "";
    const stagedUrl = new URL(stagedHref, "http://localhost");
    expect(stagedUrl.searchParams.get("staged")).toMatch(/^[a-f0-9]{64}$/);
    expect(stagedUrl.searchParams.has("description")).toBe(false);
    expect(stagedUrl.searchParams.has("location")).toBe(false);

    const context = readStagedDirectConnectEntryContext(stagedHref);
    expect(context).toMatchObject({
      targetName: "Steel Home Planning Tools",
      source: "steel_home_planning_tools",
      subjectType: "product",
      title: "TradeScout Countertop Planning Request",
      location: "Ocean Springs, MS 39564",
      countyFips: "28059",
      stateCode: "MS",
      timing: "Within 6 months",
    });
    expect(context?.description).toContain("Planner: Countertops");
    expect(context?.description).toContain("Contracting setup: Self-contracted homeowner");
    expect(context?.description).toContain("Selected surface: AJ Quartz — Engineered Quartz");
    expect(context?.description).not.toContain("Building Details");
    expect(context?.description).not.toContain("Cabinet Details");
    expect(context?.description).not.toContain("54' wide");
    expect(context?.description).not.toContain("U-shaped");
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

    for (const planner of STEEL_HOME_PLANNERS) {
      const panel = openPlanner(planner.key);
      observedText.push(userFacingText(panel));
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
