// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./steel-home-project-tools/CountertopDesigner", () => ({
  default: ({ onRequest }: { onRequest: (intent: "stone" | "fabricator") => void }) => (
    <div data-testid="mock-countertop-planner">
      <button
        type="button"
        data-testid="mock-countertop-stone-request"
        onClick={() => onRequest("stone")}
      >
        Request stone
      </button>
      <button
        type="button"
        data-testid="mock-countertop-fabricator-request"
        onClick={() => onRequest("fabricator")}
      >
        Find fabricator
      </button>
    </div>
  ),
}));

vi.mock("./steel-home-project-tools/CabinetDesigner", () => ({
  default: ({ onRequest }: { onRequest: () => void }) => (
    <div data-testid="mock-cabinet-planner">
      <button type="button" data-testid="mock-cabinet-request" onClick={onRequest}>
        Request cabinet quote
      </button>
    </div>
  ),
}));

vi.mock("./steel-home-project-tools/BuildingDesigner", () => ({
  default: ({ onRequest }: { onRequest: () => void }) => (
    <div data-testid="mock-building-planner">
      <button type="button" data-testid="mock-building-request" onClick={onRequest}>
        Request building quote
      </button>
    </div>
  ),
}));

import SteelHomePackagesProfile from "./SteelHomePackagesProfile";
import type { SteelHomePlanner } from "./steel-home-project-tools/SteelHomeBuilderDirectory";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const requestHref =
  "/direct-connect?profile=steel-home-packages&profileName=Steel%20Home%20Planning%20Tools&source=steel_home_planning_tools&subject=product";
const laborRequestHref = "/direct-connect?source=steel_home_planning_tools_labor&subject=service";

function click(container: HTMLElement, testId: string) {
  const element = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!element) throw new Error(`Missing ${testId}`);
  act(() => element.click());
  return element;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function waitForTestId(container: HTMLElement, testId: string) {
  await act(async () => {
    await Promise.resolve();
  });
  await vi.waitFor(() => {
    expect(container.querySelector(`[data-testid="${testId}"]`)).not.toBeNull();
  });
}

async function clickAndWaitForTestId(
  container: HTMLElement,
  clickTestId: string,
  resultTestId: string
) {
  const element = container.querySelector<HTMLElement>(`[data-testid="${clickTestId}"]`);
  if (!element) throw new Error(`Missing ${clickTestId}`);
  await act(async () => {
    element.click();
    await Promise.resolve();
  });
  await vi.waitFor(() => {
    expect(container.querySelector(`[data-testid="${resultTestId}"]`)).not.toBeNull();
  });
}

describe("SteelHomePackagesProfile planner orchestration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await Promise.all([
      import("./steel-home-project-tools/CountertopDesigner"),
      import("./steel-home-project-tools/CabinetDesigner"),
      import("./steel-home-project-tools/BuildingDesigner"),
    ]);
    window.localStorage.clear();
    window.history.replaceState(null, "", "/u/steel-home-packages");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    document.body.style.overflow = "";
  });

  async function renderProfile(
    props: Partial<{
      initialBuilder: SteelHomePlanner | null;
      onNavigateBuilder: (builder: SteelHomePlanner | null) => void;
    }> = {}
  ) {
    act(() => {
      root.render(
        <SteelHomePackagesProfile
          requestHref={requestHref}
          laborRequestHref={laborRequestHref}
          {...props}
        />
      );
    });
    await flushEffects();
  }

  it("shows exactly three independent planner launchers", async () => {
    await renderProfile();

    expect(container.querySelector('[data-testid="steel-home-builder-directory"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid^="steel-home-builder-card-"]')).toHaveLength(3);
    expect(
      container.querySelector('[data-testid="steel-home-builder-open-countertops"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="steel-home-builder-open-cabinets"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="steel-home-builder-open-building"]')
    ).not.toBeNull();
    expect(container.textContent).toContain("Three stand-alone planners");
    expect(container.textContent).toContain("Stone ordering covers material supply only");
    expect(container.textContent).not.toMatch(/early price estimate|planning range/i);
  });

  it("opens and closes each planner without requiring another planner", async () => {
    await renderProfile();

    const cases: Array<[SteelHomePlanner, string]> = [
      ["countertops", "mock-countertop-planner"],
      ["cabinets", "mock-cabinet-planner"],
      ["building", "mock-building-planner"],
    ];

    for (const [planner, previewTestId] of cases) {
      await clickAndWaitForTestId(container, `steel-home-builder-open-${planner}`, previewTestId);
      expect(
        container.querySelector(
          `[data-testid="steel-home-builder-workbench"][data-builder="${planner}"]`
        )
      ).not.toBeNull();
      expect(container.querySelector('[data-testid="steel-home-builder-directory"]')).toBeNull();

      click(container, "steel-home-builder-close");
      expect(
        container.querySelector('[data-testid="steel-home-builder-directory"]')
      ).not.toBeNull();
    }
  });

  it("supports a direct builder route and reports navigation changes", async () => {
    const onNavigateBuilder = vi.fn<(builder: SteelHomePlanner | null) => void>();
    await renderProfile({ initialBuilder: "cabinets", onNavigateBuilder });

    await waitForTestId(container, "mock-cabinet-planner");
    click(container, "steel-home-builder-close");
    expect(onNavigateBuilder).toHaveBeenLastCalledWith(null);

    act(() => {
      root.render(
        <SteelHomePackagesProfile
          requestHref={requestHref}
          laborRequestHref={laborRequestHref}
          initialBuilder={null}
          onNavigateBuilder={onNavigateBuilder}
        />
      );
    });
    await flushEffects();
    click(container, "steel-home-builder-open-building");
    expect(onNavigateBuilder).toHaveBeenLastCalledWith("building");
  });

  it("keeps stone supply and fabricator matching as separate request intents", async () => {
    await renderProfile({ initialBuilder: "countertops" });
    await waitForTestId(container, "mock-countertop-planner");

    click(container, "mock-countertop-stone-request");
    let dialog = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-planner-request"] [role="dialog"]'
    );
    expect(dialog?.dataset.planner).toBe("countertops");
    expect(dialog?.dataset.requestIntent).toBe("stone");
    expect(container.textContent).toContain("Material only");
    click(container, "steel-home-planner-request-close");

    click(container, "mock-countertop-fabricator-request");
    dialog = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-planner-request"] [role="dialog"]'
    );
    expect(dialog?.dataset.planner).toBe("countertops");
    expect(dialog?.dataset.requestIntent).toBe("fabricator");
    expect(container.textContent).toContain("Local service only");
  });

  it("opens quote-required cabinet and building request drawers with only the active planner", async () => {
    await renderProfile({ initialBuilder: "cabinets" });
    await waitForTestId(container, "mock-cabinet-planner");
    click(container, "mock-cabinet-request");

    let dialog = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-planner-request"] [role="dialog"]'
    );
    expect(dialog?.dataset.planner).toBe("cabinets");
    expect(dialog?.dataset.requestIntent).toBe("builder");
    expect(container.textContent).toContain("Only this planner goes into the request");
    expect(container.textContent).toContain("Quote required");
    click(container, "steel-home-planner-request-close");

    act(() => {
      root.render(
        <SteelHomePackagesProfile
          requestHref={requestHref}
          laborRequestHref={laborRequestHref}
          initialBuilder="building"
        />
      );
    });
    await flushEffects();
    await waitForTestId(container, "mock-building-planner");
    click(container, "mock-building-request");

    dialog = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-planner-request"] [role="dialog"]'
    );
    expect(dialog?.dataset.planner).toBe("building");
    expect(dialog?.dataset.requestIntent).toBe("builder");
    expect(container.textContent).toContain("Metal building planning scope");
    expect(container.textContent).toContain("Quote required");
  });
});
