// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_ANONYMOUS_CATALOG, JW_STONE_NAMED_CATALOG } from "@/features/jw-stone/catalog";
import {
  STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH,
  STEEL_HOME_PACKAGES_START_REQUEST_PATH,
} from "@shared/steelHomePackagesProfile";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
import { readStagedDirectConnectEntryContext } from "@/pages/direct-connect/stagedDirectConnectEntryContext";
import SteelHomePackagesProfile from "./SteelHomePackagesProfile";
import {
  STEEL_HOME_WORKSPACES,
  type SteelHomeWorkspace,
  workspacePanelId,
  workspaceTabId,
} from "./steel-home-project-tools/SteelHomeWorkspaceNav";
import { STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY } from "./steel-home-project-tools/projectModel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const FORBIDDEN_PUBLIC_COPY = [
  "Worldwide Steel Buildings",
  "JW Stone Logistics",
  "A+ Cabinets",
  "TradePartner",
  "complete home package",
  "turnkey home",
  "one package quote",
  "supplier cost",
  "wholesale cost",
  "markup",
  "margin",
  "commission",
];

const FORBIDDEN_CUSTOMER_JARGON = [
  "owner-builder",
  "owner builder",
  "owner-built",
  "owner built",
  "owner-building",
  "owner building",
  "scope",
  "brief",
  "handoff",
  "staged",
  "payload",
  "context",
  "target provider",
  "provider id",
  "profile slug",
  "release state",
  "fips",
  "record id",
  "fulfillment",
  "planning range",
  "planning estimate",
  "allowance",
  "concept",
  "local review",
  "price after review",
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

describe("SteelHomePackagesProfile workspace", () => {
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
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as unknown as { scrollTo?: unknown }).scrollTo;
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

  function openWorkspace(workspace: SteelHomeWorkspace, mobile = false) {
    const tab = container.querySelector<HTMLButtonElement>(
      `[data-testid="${workspaceTabId(workspace, mobile)}"]`
    );
    if (!tab) throw new Error(`${workspace} workspace tab missing`);
    act(() => tab.click());

    const panel = container.querySelector<HTMLElement>(`#${workspacePanelId(workspace)}`);
    if (!panel) throw new Error(`${workspace} workspace panel missing`);
    expect(panel.hidden).toBe(false);
    expect(activePanel()).toBe(panel);
    expect(
      container
        .querySelector(`[data-testid="${workspaceTabId(workspace)}"]`)
        ?.getAttribute("aria-selected")
    ).toBe("true");
    expect(
      container
        .querySelector(`[data-testid="${workspaceTabId(workspace, true)}"]`)
        ?.getAttribute("aria-selected")
    ).toBe("true");
    return panel;
  }

  it("starts in Project only and exposes matching desktop and mobile workspace tabs", () => {
    renderProfile();

    const profile = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-packages-profile"]'
    );
    expect(profile?.dataset.releaseState).toBe("unlisted");
    expect(profile?.className).toContain("xl:h-screen");
    expect(profile?.querySelector("header")?.className).not.toContain("fixed");

    const initialPanels = container.querySelectorAll<HTMLElement>('[role="tabpanel"]');
    expect(initialPanels).toHaveLength(STEEL_HOME_WORKSPACES.length);
    expect(initialPanels[0]?.id).toBe(workspacePanelId("project"));
    expect(initialPanels[0]?.hidden).toBe(false);
    expect(initialPanels[0]?.getAttribute("aria-label")).toBe("Project Setup");
    expect(
      Array.from(initialPanels)
        .slice(1)
        .every((panel) => panel.hidden)
    ).toBe(true);

    for (const mobile of [false, true]) {
      const nav = container.querySelector<HTMLElement>(
        `[data-testid="${mobile ? "steel-home-mobile-nav" : "steel-home-workspace-tabs"}"]`
      );
      if (!nav) throw new Error(`${mobile ? "Mobile" : "Desktop"} workspace navigation missing`);
      expect(nav.getAttribute("aria-label")).toBe("Project sections");
      const tablist = nav.querySelector<HTMLElement>('[role="tablist"]');
      expect(tablist?.getAttribute("aria-orientation")).toBe(mobile ? "horizontal" : "vertical");

      const tabs = Array.from(nav.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
      expect(tabs.map((tab) => tab.id)).toEqual(
        STEEL_HOME_WORKSPACES.map((workspace) => workspaceTabId(workspace.key, mobile))
      );
      tabs.forEach((tab, index) => {
        const workspace = STEEL_HOME_WORKSPACES[index];
        expect(tab.textContent).toContain(mobile ? workspace.shortLabel : workspace.label);
        expect(tab.getAttribute("aria-controls")).toBe(workspacePanelId(workspace.key));
        expect(tab.getAttribute("aria-selected")).toBe(index === 0 ? "true" : "false");
        expect(tab.tabIndex).toBe(index === 0 ? 0 : -1);
        expect(tab.getAttribute("aria-current")).toBe(mobile && index === 0 ? "page" : null);
      });
    }

    const expectedToolByWorkspace: Partial<Record<SteelHomeWorkspace, string>> = {
      building: "steel-home-building-designer",
      countertops: "steel-home-countertop-designer",
      cabinets: "steel-home-cabinet-designer",
      "whole-home": "steel-home-whole-home",
      review: "steel-home-project-review",
    };
    for (const workspace of STEEL_HOME_WORKSPACES.slice(1)) {
      const panel = openWorkspace(workspace.key);
      const toolTestId = expectedToolByWorkspace[workspace.key];
      expect(panel.querySelector(`[data-testid="${toolTestId}"]`)).not.toBeNull();
    }

    expect(container.querySelectorAll<HTMLElement>('[role="tabpanel"]')).toHaveLength(
      STEEL_HOME_WORKSPACES.length
    );
    expect(visiblePanels()).toHaveLength(1);
  });

  it("activates tabs with arrows, Home, and End in both navigation layouts", () => {
    renderProfile();

    for (const mobile of [false, true]) {
      openWorkspace("project", mobile);
      let tab = container.querySelector<HTMLButtonElement>(
        `[data-testid="${workspaceTabId("project", mobile)}"]`
      );
      if (!tab) throw new Error("Project tab missing");
      tab.focus();

      pressKey(tab, mobile ? "ArrowRight" : "ArrowDown");
      tab = container.querySelector<HTMLButtonElement>(
        `[data-testid="${workspaceTabId("building", mobile)}"]`
      );
      expect(activePanel().id).toBe(workspacePanelId("building"));
      expect(document.activeElement).toBe(tab);

      if (!tab) throw new Error("Building tab missing");
      pressKey(tab, "End");
      tab = container.querySelector<HTMLButtonElement>(
        `[data-testid="${workspaceTabId("review", mobile)}"]`
      );
      expect(activePanel().id).toBe(workspacePanelId("review"));
      expect(document.activeElement).toBe(tab);

      if (!tab) throw new Error("Summary tab missing");
      pressKey(tab, "Home");
      tab = container.querySelector<HTMLButtonElement>(
        `[data-testid="${workspaceTabId("project", mobile)}"]`
      );
      expect(activePanel().id).toBe(workspacePanelId("project"));
      expect(document.activeElement).toBe(tab);

      if (!tab) throw new Error("Project tab missing after Home");
      pressKey(tab, mobile ? "ArrowLeft" : "ArrowUp");
      expect(activePanel().id).toBe(workspacePanelId("review"));
    }
  });

  it("keeps mobile navigation available and resets position when the workspace changes", async () => {
    renderProfile();
    await flushUi();
    const profile = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-packages-profile"]'
    );
    const mobileNav = container.querySelector<HTMLElement>('[data-testid="steel-home-mobile-nav"]');
    const workbench = container.querySelector<HTMLElement>('[data-testid="steel-home-workbench"]');
    if (!profile || !mobileNav || !workbench) throw new Error("Workspace navigation missing");
    expect(profile.className).toContain("overflow-x-clip");
    expect(profile.className).not.toContain("overflow-x-hidden");
    expect(mobileNav.className).toContain("sticky");

    const workbenchScroll = vi.fn();
    workbench.scrollTo = workbenchScroll;
    const windowScroll = vi.mocked(window.scrollTo);
    windowScroll.mockClear();

    const next = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label") === "Next: Building + Roof"
    );
    if (!next) {
      throw new Error(
        `Next workspace control missing: ${Array.from(
          container.querySelectorAll<HTMLButtonElement>("button")
        )
          .map((button) => button.getAttribute("aria-label") || button.textContent?.trim())
          .join(" | ")}`
      );
    }
    act(() => next.click());

    expect(workbenchScroll).toHaveBeenCalledWith({ top: 0 });
    expect(windowScroll).toHaveBeenCalledWith({ top: 0 });
    expect(document.activeElement?.id).toBe(workspacePanelId("building"));
  });

  it("uses self-contracted language and removes internal or outdated customer language", () => {
    renderProfile();

    const projectPanel = activePanel();
    const selfContracted = projectPanel.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-project-role-self-contracted"]'
    );
    if (!selfContracted) throw new Error("Self-contracted role missing");
    expect(selfContracted.textContent).toContain("Self-contracted homeowner");
    expect(selfContracted.textContent).toContain("Plan the packages and list the trades you need");
    act(() => selfContracted.click());

    for (const workspace of STEEL_HOME_WORKSPACES.slice(1)) openWorkspace(workspace.key);

    const publicText = [
      container.textContent || "",
      ...Array.from(container.querySelectorAll<HTMLElement>("[aria-label], [title]"), (item) =>
        [item.getAttribute("aria-label"), item.getAttribute("title")].filter(Boolean).join(" ")
      ),
      ...Array.from(
        container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[placeholder]"),
        (item) => item.placeholder
      ),
      ...Array.from(container.querySelectorAll<HTMLImageElement>("img[alt]"), (item) => item.alt),
    ]
      .join("\n")
      .toLowerCase();
    expect(publicText).toContain("self-contracted");
    expect(publicText).toContain("quartzite");
    expect(publicText).toContain("engineered quartz");
    expect(publicText).not.toContain("stone or quartz");
    for (const forbidden of [...FORBIDDEN_PUBLIC_COPY, ...FORBIDDEN_CUSTOMER_JARGON]) {
      expect(publicText).not.toContain(forbidden.toLowerCase());
    }
  });

  it("offers only real named stones through neutral exact-image routes", () => {
    renderProfile();
    const panel = openWorkspace("countertops");

    const selector = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-countertop-all-stones"]'
    );
    if (!selector) throw new Error("Named-stone selector missing");
    const options = Array.from(selector.options);
    expect(options).toHaveLength(JW_STONE_NAMED_CATALOG.length);
    expect(options.map((option) => option.value)).toEqual(
      [...JW_STONE_NAMED_CATALOG]
        .sort((a, b) => a.publicLabel.localeCompare(b.publicLabel))
        .map((stone) => stone.id)
    );
    expect(options.map((option) => option.value)).not.toEqual(
      expect.arrayContaining(JW_STONE_ANONYMOUS_CATALOG.map((stone) => stone.id))
    );

    const search = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-countertop-stone-search"]'
    );
    if (!search) throw new Error("Stone search missing");
    setControlValue(search, "blue");
    const filteredValues = Array.from(selector.options).map((option) => option.value);
    expect(filteredValues.length).toBeLessThan(JW_STONE_NAMED_CATALOG.length);
    expect(filteredValues).toContain("blue-goias");
    expect(filteredValues).toContain("cristallo");
    expect(filteredValues).not.toContain("taj-mahal");
    setControlValue(search, "");

    const quickStoneImages = Array.from(
      panel.querySelectorAll<HTMLImageElement>('[data-testid^="steel-home-countertop-stone-"] img')
    );
    expect(quickStoneImages).toHaveLength(6);
    for (const image of quickStoneImages) {
      expect(image.src).toMatch(/\/images\/stone-designer\/[a-z0-9-]+\/1\.webp$/);
      expect(image.src.toLowerCase()).not.toContain("jw-stone");
      expect(image.alt).toMatch(/ surface$/);
    }

    expect(panel.querySelector("svg image")?.getAttribute("href")).toBe(
      "/images/stone-designer/cristallo/1.webp"
    );
  });

  it("keeps design choices across workspace switches and updates the persistent summary", () => {
    renderProfile();

    const summary = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-project-summary"]'
    );
    const progress = summary?.querySelector<HTMLElement>(
      '[data-testid="steel-home-project-progress"]'
    );
    if (!summary || !progress) throw new Error("Persistent project summary missing");
    expect(progress.getAttribute("aria-valuenow")).toBe("0");
    expect(summary.textContent).toContain("No package estimate yet");

    const projectPanel = activePanel();
    act(() =>
      projectPanel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-project-role-self-contracted"]')
        ?.click()
    );
    const location = projectPanel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-project-location"]'
    );
    const state = projectPanel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-state"]'
    );
    if (!location || !state) throw new Error("Project details missing");
    setControlValue(location, "Ocean Springs, MS 39564");
    setSelectValue(state, "MS");
    const county = projectPanel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-county"]'
    );
    if (!county) throw new Error("County selector missing");
    setSelectValue(county, "28059");
    expect(progress.getAttribute("aria-valuenow")).toBe("2");

    let panel = openWorkspace("building");
    expect(
      panel.querySelector('[data-testid="steel-home-building-planning-estimate"]')?.textContent
    ).toContain("$80,400–$124,050");
    const width = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-building-width"]'
    );
    if (!width) throw new Error("Building width missing");
    setControlValue(width, "54");
    const updatedBuildingEstimate = panel
      .querySelector('[data-testid="steel-home-building-planning-estimate"]')
      ?.textContent?.match(/\$[\d,]+–\$[\d,]+/)?.[0];
    expect(updatedBuildingEstimate).toMatch(/^\$[\d,]+–\$[\d,]+$/);
    act(() =>
      panel.querySelector<HTMLButtonElement>('[data-testid="steel-home-building-include"]')?.click()
    );
    expect(progress.getAttribute("aria-valuenow")).toBe("3");
    expect(summary.textContent).toContain("Building + roof");
    expect(summary.textContent).toContain(updatedBuildingEstimate);

    panel = openWorkspace("countertops");
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-stone-taj-mahal"]')
        ?.click()
    );
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-include"]')
        ?.click()
    );
    expect(summary.textContent).toContain("Countertops");

    panel = openWorkspace("cabinets");
    expect(
      panel.querySelector('[data-testid="steel-home-cabinet-planning-estimate"]')?.textContent
    ).toContain("$15,650–$26,950");
    const layout = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-cabinet-layout"]'
    );
    if (!layout) throw new Error("Cabinet layout missing");
    setSelectValue(layout, "u-shape");
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-cabinet-finish-navy"]')
        ?.click()
    );
    act(() =>
      panel.querySelector<HTMLButtonElement>('[data-testid="steel-home-cabinet-include"]')?.click()
    );
    expect(summary.textContent).toContain("Cabinets");

    openWorkspace("whole-home");
    openWorkspace("project");

    panel = openWorkspace("building");
    expect(
      panel.querySelector<HTMLInputElement>('[data-testid="steel-home-building-width"]')?.value
    ).toBe("54");
    expect(
      panel.querySelector('[data-testid="steel-home-building-preview"]')?.textContent
    ).toContain("54' × 60' × 14'");

    panel = openWorkspace("countertops");
    expect(
      panel.querySelector<HTMLSelectElement>('[data-testid="steel-home-countertop-all-stones"]')
        ?.value
    ).toBe("taj-mahal");
    expect(panel.querySelector("svg image")?.getAttribute("href")).toBe(
      "/images/stone-designer/taj-mahal/1.webp"
    );

    panel = openWorkspace("cabinets");
    expect(
      panel.querySelector<HTMLSelectElement>('[data-testid="steel-home-cabinet-layout"]')?.value
    ).toBe("u-shape");
    expect(
      panel.querySelector('[data-testid="steel-home-cabinet-preview"]')?.textContent
    ).toContain("U-SHAPED");
    expect(
      panel.querySelector('[data-testid="steel-home-cabinet-preview"] rect[fill="#334658"]')
    ).not.toBeNull();
  });

  it("stages the exact completed project summary only after the user starts the request", () => {
    renderProfile();

    let panel = activePanel();
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-project-role-self-contracted"]')
        ?.click()
    );
    const location = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-project-location"]'
    );
    const state = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-state"]'
    );
    const timing = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-timing"]'
    );
    if (!location || !state || !timing) throw new Error("Project details missing");
    setControlValue(location, "Ocean Springs, MS 39564");
    setSelectValue(state, "MS");
    const county = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-county"]'
    );
    if (!county) throw new Error("County selector missing");
    setSelectValue(county, "28059");
    setSelectValue(timing, "Within 6 months");

    panel = openWorkspace("building");
    const width = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-building-width"]'
    );
    if (!width) throw new Error("Building width missing");
    setControlValue(width, "54");
    act(() =>
      panel.querySelector<HTMLButtonElement>('[data-testid="steel-home-building-include"]')?.click()
    );

    panel = openWorkspace("countertops");
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-stone-taj-mahal"]')
        ?.click()
    );
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-include"]')
        ?.click()
    );

    panel = openWorkspace("cabinets");
    const cabinetLayout = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-cabinet-layout"]'
    );
    const cabinetDoorStyle = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-cabinet-door-style"]'
    );
    if (!cabinetLayout || !cabinetDoorStyle) throw new Error("Cabinet style controls missing");
    setSelectValue(cabinetLayout, "u-shape");
    setSelectValue(cabinetDoorStyle, "Glass accent");
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-cabinet-finish-navy"]')
        ?.click()
    );
    act(() =>
      panel.querySelector<HTMLButtonElement>('[data-testid="steel-home-cabinet-include"]')?.click()
    );

    panel = openWorkspace("review");
    expect(panel.textContent).toContain("Self-contracted");
    const visibleDetails = panel.querySelector<HTMLElement>(
      '[data-testid="steel-home-project-brief"]'
    )?.textContent;
    expect(visibleDetails).toContain("54' wide × 60' long × 14' eave");
    expect(visibleDetails).toContain("Taj Mahal — Quartzite");
    expect(visibleDetails).toContain("Glass accent; Navy; Matte black");
    expect(visibleDetails).not.toContain("Stone record:");
    expect(visibleDetails).not.toContain("Stone image:");

    const request = panel.querySelector<HTMLAnchorElement>(
      'a[data-testid="steel-home-project-request"]'
    );
    expect(request).not.toBeNull();
    const safeProjectFallback = new URL(
      request?.getAttribute("href") || "",
      "https://www.thetradescout.com"
    );
    expect(safeProjectFallback.pathname).toBe("/direct-connect");
    expect(safeProjectFallback.searchParams.get("profile")).toBe("steel-home-packages");
    expect(safeProjectFallback.searchParams.get("source")).toBe("steel_home_project_center");
    expect(safeProjectFallback.searchParams.has("description")).toBe(false);
    expect(request?.outerHTML).not.toContain("Ocean Springs");
    act(() => request?.focus());
    const focusPreparedToken = new URL(
      request?.getAttribute("href") || "",
      "https://www.thetradescout.com"
    ).searchParams.get("staged");
    expect(focusPreparedToken).toMatch(/^[a-f0-9]{64}$/);
    request?.addEventListener("click", (event) => event.preventDefault(), { once: true });
    act(() => request?.click());

    const stagedHref = request?.getAttribute("href") || "";
    const url = new URL(stagedHref, "https://www.thetradescout.com");
    expect(url.pathname).toBe("/direct-connect");
    expect(url.searchParams.get("staged")).toMatch(/^[a-f0-9]{64}$/);
    expect(url.searchParams.get("staged")).not.toBe(focusPreparedToken);
    expect(url.searchParams.get("profile")).toBe("steel-home-packages");
    expect(url.searchParams.get("profileName")).toBe("Steel Home Project Workspace");
    expect(url.searchParams.get("source")).toBe("steel_home_project_center");
    expect(url.searchParams.get("subject")).toBe("product");
    expect(url.searchParams.has("description")).toBe(false);
    expect(url.searchParams.size).toBe(5);

    const stagedContext = readStagedDirectConnectEntryContext(stagedHref);
    expect(stagedContext).toMatchObject({
      targetName: "Steel Home Project Workspace",
      source: "steel_home_project_center",
      title: "TradeScout Steel Home Project Request — Building + roof, Countertops, Cabinets",
      location: "Ocean Springs, MS 39564",
      countyFips: "28059",
      stateCode: "MS",
      timing: "Within 6 months",
    });
    expect(stagedContext?.description).toContain(
      "Selected packages: Building + roof, Countertops, Cabinets"
    );
    expect(stagedContext?.description).toContain("Contracting setup: Self-contracted homeowner");
    expect(stagedContext?.description).toContain("54' wide × 60' long × 14' eave");
    expect(stagedContext?.description).toContain("Selected surface: Taj Mahal — Quartzite");
    expect(stagedContext?.description).toContain("Style: Glass accent; Navy; Matte black");
    expect(stagedContext?.description).not.toContain("Stone record:");
    expect(stagedContext?.description).not.toContain("Stone image:");
    for (const forbidden of FORBIDDEN_PUBLIC_COPY) {
      expect(stagedHref.toLowerCase()).not.toContain(forbidden.toLowerCase());
      expect(stagedContext?.description?.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("restores the saved project and keeps the local trade request separate and untargeted", async () => {
    renderProfile();

    let panel = openWorkspace("countertops");
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-stone-blue-goias"]')
        ?.click()
    );
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-include"]')
        ?.click()
    );

    panel = openWorkspace("project");
    const location = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-project-location"]'
    );
    const state = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-state"]'
    );
    if (!location || !state) throw new Error("Project location controls missing");
    setControlValue(location, "Biloxi, MS");
    setSelectValue(state, "MS");
    const county = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-county"]'
    );
    if (!county) throw new Error("Project county control missing");
    setSelectValue(county, "28047");

    panel = openWorkspace("whole-home");
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-labor-stone-fabrication"]')
        ?.click()
    );
    await flushUi();
    expect(window.localStorage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toContain(
      '"stoneId":"blue-goias"'
    );

    act(() => root.unmount());
    root = createRoot(container);
    renderProfile();
    await flushUi();

    panel = openWorkspace("countertops");
    expect(
      panel.querySelector<HTMLSelectElement>('[data-testid="steel-home-countertop-all-stones"]')
        ?.value
    ).toBe("blue-goias");

    panel = openWorkspace("project");
    expect(
      panel.querySelector<HTMLInputElement>('[data-testid="steel-home-project-location"]')?.value
    ).toBe("Biloxi, MS");
    expect(
      panel.querySelector<HTMLSelectElement>('[data-testid="steel-home-project-state"]')?.value
    ).toBe("MS");
    expect(
      panel.querySelector<HTMLSelectElement>('[data-testid="steel-home-project-county"]')?.value
    ).toBe("28047");

    panel = openWorkspace("review");
    const labor = panel.querySelector<HTMLAnchorElement>(
      'a[data-testid="steel-home-labor-request"]'
    );
    expect(labor).not.toBeNull();
    const safeTradeFallback = new URL(
      labor?.getAttribute("href") || "",
      "https://www.thetradescout.com"
    );
    expect(safeTradeFallback.pathname).toBe("/direct-connect");
    expect(safeTradeFallback.searchParams.get("source")).toBe("steel_home_project_tools_labor");
    expect(safeTradeFallback.searchParams.has("description")).toBe(false);
    labor?.addEventListener("click", (event) => event.preventDefault(), { once: true });
    act(() => labor?.click());
    const stagedLaborHref = labor?.getAttribute("href") || "";
    const laborUrl = new URL(stagedLaborHref, "https://www.thetradescout.com");
    expect(laborUrl.searchParams.get("staged")).toMatch(/^[a-f0-9]{64}$/);
    expect(laborUrl.searchParams.get("source")).toBe("steel_home_project_tools_labor");
    expect(laborUrl.searchParams.get("subject")).toBe("service");
    expect(laborUrl.searchParams.has("description")).toBe(false);
    expect(laborUrl.searchParams.size).toBe(3);
    const stagedLaborContext = readStagedDirectConnectEntryContext(stagedLaborHref);
    expect(stagedLaborContext).toMatchObject({
      subjectType: "service",
      source: "steel_home_project_tools_labor",
      countyFips: "28047",
      stateCode: "MS",
    });
    expect(stagedLaborContext?.description).toContain(
      "Countertop details: Kitchen; Blue Goias — Granite; About 58.2 sq. ft."
    );
    expect(stagedLaborContext?.contextType).toBeUndefined();
    expect(stagedLaborContext?.targetSelector).toBeUndefined();
  });

  it("keeps safe routing but no private details in cross-origin fallbacks", () => {
    const platformBaseHref = "https://www.thetradescout.com";
    expect(new URL(platformBaseHref).origin).not.toBe(window.location.origin);
    renderProfile(platformBaseHref);

    let panel = activePanel();
    act(() =>
      panel
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-project-role-self-contracted"]')
        ?.click()
    );
    const location = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-project-location"]'
    );
    const state = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-state"]'
    );
    if (!location || !state) throw new Error("Project location controls missing");
    setControlValue(location, "Private jobsite, MS 39564");
    setSelectValue(state, "MS");
    const county = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-project-county"]'
    );
    if (!county) throw new Error("Project county control missing");
    setSelectValue(county, "28059");

    panel = openWorkspace("building");
    act(() =>
      panel.querySelector<HTMLButtonElement>('[data-testid="steel-home-building-include"]')?.click()
    );
    panel = openWorkspace("whole-home");
    act(() =>
      panel.querySelector<HTMLButtonElement>('[data-testid="steel-home-labor-site-work"]')?.click()
    );

    panel = openWorkspace("review");
    const projectRequest = panel.querySelector<HTMLAnchorElement>(
      'a[data-testid="steel-home-project-request"]'
    );
    const laborRequest = panel.querySelector<HTMLAnchorElement>(
      'a[data-testid="steel-home-labor-request"]'
    );
    const projectFallback = new URL(projectRequest?.getAttribute("href") || "");
    const laborFallback = new URL(laborRequest?.getAttribute("href") || "");
    expect(projectFallback.origin).toBe(platformBaseHref);
    expect(projectFallback.pathname).toBe("/direct-connect");
    expect(projectFallback.searchParams.get("profile")).toBe("steel-home-packages");
    expect(projectFallback.searchParams.get("source")).toBe("steel_home_project_center");
    expect(laborFallback.origin).toBe(platformBaseHref);
    expect(laborFallback.pathname).toBe("/direct-connect");
    expect(laborFallback.searchParams.get("source")).toBe("steel_home_project_tools_labor");
    expect(projectFallback.searchParams.has("description")).toBe(false);
    expect(laborFallback.searchParams.has("description")).toBe(false);
    expect(projectRequest?.outerHTML).not.toContain("Private jobsite");
    expect(laborRequest?.outerHTML).not.toContain("Private jobsite");

    projectRequest?.addEventListener("click", (event) => event.preventDefault(), { once: true });
    laborRequest?.addEventListener("click", (event) => event.preventDefault(), { once: true });
    act(() => {
      projectRequest?.click();
      laborRequest?.click();
    });

    expect(projectRequest?.getAttribute("href")).toBe(projectFallback.toString());
    expect(laborRequest?.getAttribute("href")).toBe(laborFallback.toString());
    expect(window.sessionStorage.length).toBe(0);
  });

  it("changes each planner preview geometry after that workspace is opened", () => {
    renderProfile();

    let panel = openWorkspace("building");
    const porch = panel.querySelector<HTMLSelectElement>(
      '[data-testid="steel-home-building-porch"]'
    );
    const porchDepth = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-building-porch-depth"]'
    );
    if (!porch || !porchDepth) throw new Error("Building porch controls missing");
    expect(
      panel.querySelector('[data-testid="steel-home-building-front-porch-preview"]')
    ).not.toBeNull();
    setSelectValue(porch, "side");
    expect(
      panel.querySelector('[data-testid="steel-home-building-front-porch-preview"]')
    ).toBeNull();
    expect(
      panel
        .querySelector('[data-testid="steel-home-building-side-porch-preview"]')
        ?.getAttribute("data-porch-depth")
    ).toBe("8");
    setControlValue(porchDepth, "16");
    expect(
      panel
        .querySelector('[data-testid="steel-home-building-side-porch-preview"]')
        ?.getAttribute("data-porch-depth")
    ).toBe("16");

    panel = openWorkspace("countertops");
    const countertopPath = panel.querySelector<SVGPathElement>(
      '[data-testid="steel-home-countertop-layout-preview"]'
    );
    const countertopRun = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-countertop-run-a"]'
    );
    if (!countertopPath || !countertopRun) throw new Error("Countertop geometry controls missing");
    const initialCountertopPath = countertopPath.getAttribute("d");
    setControlValue(countertopRun, "220");
    expect(
      panel.querySelector('[data-testid="steel-home-countertop-layout-preview"]')?.getAttribute("d")
    ).not.toBe(initialCountertopPath);

    panel = openWorkspace("cabinets");
    const cabinetPath = panel.querySelector<SVGPathElement>(
      '[data-testid="steel-home-cabinet-layout-preview"]'
    );
    const returnWall = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-cabinet-return-wall"]'
    );
    const ceiling = panel.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-cabinet-ceiling-height"]'
    );
    const ceilingLine = panel.querySelector<SVGLineElement>(
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
      panel.querySelector('[data-testid="steel-home-cabinet-layout-preview"]')?.getAttribute("d")
    ).not.toBe(initialCabinetPath);
    expect(
      panel.querySelector('[data-testid="steel-home-cabinet-ceiling-preview"]')?.getAttribute("y1")
    ).not.toBe(initialCeilingY);
  });
});
