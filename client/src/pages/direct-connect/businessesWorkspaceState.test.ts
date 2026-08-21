/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildCanonicalBusinessesWorkspaceHref,
  clearBusinessesWorkspaceState,
  getBusinessesWorkspaceStorageKey,
  resolveBusinessesWorkspaceCountyChange,
  resolveBusinessesWorkspaceEffectiveArea,
  resolveBusinessesWorkspaceState,
  resolveBusinessesWorkspaceViewerCoordinates,
  resolveSelectedWorkspaceProvider,
  writeBusinessesWorkspaceState,
  type BusinessesWorkspaceState,
} from "./businessesWorkspaceState";

const storedState: BusinessesWorkspaceState = {
  stateCode: "FL",
  countyFips: "12033",
  tradeSlug: "roofing",
  searchQuery: "saved search",
  selectedProviderId: "provider-saved",
};

describe("Businesses workspace state", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("lets explicit URL fields win while restoring only absent fields from scoped storage", () => {
    writeBusinessesWorkspaceState({
      storage: window.sessionStorage,
      authenticatedUserId: "user-1",
      pathname: "/contractors",
      state: storedState,
    });

    expect(
      resolveBusinessesWorkspaceState({
        search: "?query=flooring&countyFips=12091&selected=provider-url",
        storage: window.sessionStorage,
        authenticatedUserId: "user-1",
        pathname: "/contractors",
      })
    ).toEqual({
      stateCode: "FL",
      countyFips: "12091",
      tradeSlug: "roofing",
      searchQuery: "flooring",
      selectedProviderId: "provider-url",
    });
  });

  it("isolates storage by authenticated account and pathname and never creates a guest key", () => {
    const userOneContractors = getBusinessesWorkspaceStorageKey("user-1", "/contractors");
    const userTwoContractors = getBusinessesWorkspaceStorageKey("user-2", "/contractors");
    const userOneDirectConnect = getBusinessesWorkspaceStorageKey(
      "user-1",
      "/direct-connect/businesses"
    );

    expect(userOneContractors).not.toBe(userTwoContractors);
    expect(userOneContractors).not.toBe(userOneDirectConnect);
    expect(getBusinessesWorkspaceStorageKey(null, "/contractors")).toBeNull();
  });

  it("canonicalizes aliases, preserves unrelated parameters, and bounds unsafe values", () => {
    const href = buildCanonicalBusinessesWorkspaceHref({
      pathname: "/contractors",
      currentSearch: "?query=old&city=Pensacola&countyFips=12033&source=taskbar",
      state: {
        stateCode: "fl",
        countyFips: "12033",
        tradeSlug: "FLOORING",
        searchQuery: `  tile   ${"x".repeat(200)}\u202E  `,
        selectedProviderId: "provider-2",
      },
    });
    const url = new URL(href, "https://www.thetradescout.com");

    expect(url.searchParams.get("state")).toBe("FL");
    expect(url.searchParams.get("county")).toBe("12033");
    expect(url.searchParams.get("trade")).toBe("flooring");
    expect(url.searchParams.get("q")?.startsWith("tile x")).toBe(true);
    expect(Array.from(url.searchParams.get("q") || "")).toHaveLength(160);
    expect(url.searchParams.get("selected")).toBe("provider-2");
    expect(url.searchParams.get("source")).toBe("taskbar");
    expect(url.searchParams.has("query")).toBe(false);
    expect(url.searchParams.has("city")).toBe(false);
    expect(url.searchParams.has("countyFips")).toBe(false);
  });

  it("removes scoped storage on explicit clear", () => {
    writeBusinessesWorkspaceState({
      storage: window.sessionStorage,
      authenticatedUserId: "user-1",
      pathname: "/contractors",
      state: storedState,
    });
    expect(window.sessionStorage.length).toBe(1);

    clearBusinessesWorkspaceState({
      storage: window.sessionStorage,
      authenticatedUserId: "user-1",
      pathname: "/contractors",
    });
    expect(window.sessionStorage.length).toBe(0);

    expect(
      buildCanonicalBusinessesWorkspaceHref({
        pathname: "/contractors",
        currentSearch: "?q=flooring&trade=roofing&selected=provider-1",
        state: {
          stateCode: "",
          countyFips: "",
          tradeSlug: "",
          searchQuery: "",
          selectedProviderId: "",
        },
      })
    ).toBe("/contractors");
  });

  it("resolves selection only from the current safe result set", () => {
    const providers = [
      { id: "provider-1", name: "One" },
      { id: "provider-2", name: "Two" },
    ];

    expect(resolveSelectedWorkspaceProvider(providers, "provider-2")).toEqual(providers[1]);
    expect(resolveSelectedWorkspaceProvider(providers, "stale-provider")).toBeNull();
    expect(resolveSelectedWorkspaceProvider([], "provider-2")).toBeNull();
  });

  it("materializes the saved state and invalidates selection when the county changes", () => {
    expect(
      resolveBusinessesWorkspaceCountyChange({
        countyFips: "12091",
        workspaceStateCode: "",
        locationStateCode: "fl",
      })
    ).toEqual({
      stateCode: "FL",
      countyFips: "12091",
      selectedProviderId: "",
    });

    expect(
      resolveBusinessesWorkspaceViewerCoordinates({
        workspaceStateCode: "FL",
        workspaceCountyFips: "12091",
        locationStateCode: "FL",
        locationCountyFips: "12033",
        locationLat: 30.4213,
        locationLng: -87.2169,
      })
    ).toEqual({ lat: undefined, lng: undefined });

    expect(
      resolveBusinessesWorkspaceViewerCoordinates({
        workspaceStateCode: "FL",
        workspaceCountyFips: "12033",
        locationStateCode: "FL",
        locationCountyFips: "12033",
        locationLat: 30.4213,
        locationLng: -87.2169,
      })
    ).toEqual({ lat: 30.4213, lng: -87.2169 });
  });

  it("keeps an interstate state change through the selector's automatic county clear", () => {
    const afterStateChange = {
      stateCode: "AL",
      countyFips: "",
      selectedProviderId: "",
    };

    expect(
      resolveBusinessesWorkspaceCountyChange({
        countyFips: "",
        workspaceStateCode: afterStateChange.stateCode,
        locationStateCode: "FL",
      })
    ).toEqual(afterStateChange);
    expect(
      resolveBusinessesWorkspaceEffectiveArea({
        workspaceStateCode: afterStateChange.stateCode,
        workspaceCountyFips: afterStateChange.countyFips,
        locationStateCode: "FL",
        locationCountyFips: "12033",
      })
    ).toEqual({ stateCode: "AL", countyFips: "" });
    expect(
      resolveBusinessesWorkspaceViewerCoordinates({
        workspaceStateCode: afterStateChange.stateCode,
        workspaceCountyFips: afterStateChange.countyFips,
        locationStateCode: "FL",
        locationCountyFips: "12033",
        locationLat: 30.4213,
        locationLng: -87.2169,
      })
    ).toEqual({ lat: undefined, lng: undefined });

    expect(
      resolveBusinessesWorkspaceCountyChange({
        countyFips: "01003",
        workspaceStateCode: afterStateChange.stateCode,
        locationStateCode: "FL",
      })
    ).toEqual({ stateCode: "AL", countyFips: "01003", selectedProviderId: "" });
  });
});
