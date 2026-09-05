// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDirectConnectSection } from "./directConnectRoutes";
import { parseDirectConnectEntryContext } from "./directConnectEntryContext";
import { useDirectConnectLocation } from "./useDirectConnectLocation";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("Direct Connect query navigation", () => {
  let container: HTMLDivElement;
  let root: Root;
  let navigate: ReturnType<typeof useDirectConnectLocation>[1];

  function RouteView() {
    const [location, setLocation] = useDirectConnectLocation();
    navigate = setLocation;
    const { countyFips, source } = parseDirectConnectEntryContext(location);
    return (
      <output>
        {JSON.stringify({ section: getDirectConnectSection(location), countyFips, source })}
      </output>
    );
  }

  const renderedRoute = () => JSON.parse(container.querySelector("output")!.textContent!);

  beforeEach(() => {
    window.history.replaceState(null, "", "/direct-connect?intent=local_search&county=22105");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<RouteView />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("switches from directory to request without a reload, and follows browser Back", async () => {
    expect(renderedRoute()).toMatchObject({ section: "pros", countyFips: "22105" });

    act(() => navigate("/direct-connect"));
    expect(window.location.pathname).toBe("/direct-connect");
    expect(renderedRoute()).toEqual({ section: "post" });

    await act(async () => {
      const restored = new Promise<void>((resolve) =>
        window.addEventListener("popstate", () => resolve(), { once: true })
      );
      window.history.back();
      await restored;
    });
    expect(renderedRoute()).toMatchObject({ section: "pros", countyFips: "22105" });
  });

  it("refreshes the task, county and source on query-only replacement", () => {
    act(() => navigate("/direct-connect?county=12033&source=discovery", { replace: true }));
    expect(renderedRoute()).toEqual({
      section: "post",
      countyFips: "12033",
      source: "discovery",
    });
  });
});
