import { describe, expect, it } from "vitest";
import { runScoutDecisionPipeline } from "../scout/scoutDecisionPipeline";
import { buildDecisionPipelineBehaviorResponse } from "../scout/scoutBehaviorHandlers";
import { resolveProviderBrowseIntent } from "../scout/scoutProviderBrowseIntent";
import { finalizeScoutResponse } from "../scout/scoutResponseContract";
import { validateAction } from "../../client/src/scout/actionValidation";
import { canOpenScoutWorkArea } from "../../client/src/scout/scoutWorkAreas";
import {
  parseBusinessesWorkspaceRoute,
  resolveBusinessesWorkspaceState,
} from "../../client/src/pages/direct-connect/businessesWorkspaceState";

describe("Scout provider browsing", () => {
  it("takes an explicit roofer search from Scout to a filtered in-site directory", () => {
    const message = "My roof is leaking; show me roofers in Maricopa County, AZ";
    const context = { countyCode: "Orange", stateCode: "FL" };
    const decision = runScoutDecisionPipeline({
      message,
      isAuthenticated: false,
      ...context,
    });
    expect(decision).toMatchObject({
      type: "server_behavior_handler",
      behaviorKey: "contractor_search_routing",
    });

    const response = buildDecisionPipelineBehaviorResponse({
      behaviorKey: decision.behaviorKey || "",
      message,
      ...context,
    });
    expect(response?.actions).toHaveLength(1);
    expect(response?.actions[0]).toMatchObject({
      type: "NAVIGATE",
      primary: true,
      to: "/direct-connect/pros?source=scout&state=AZ&county=04013&trade=roofing&q=&selected=",
    });
    expect(response?.message).toContain("Maricopa County, AZ");

    const contract = finalizeScoutResponse(response, { requestMessage: message }) as {
      allowed_actions: Array<{ type: string; target?: string }>;
      intent: string;
    };
    expect(contract.intent).toBe("provider_search");
    expect(contract.allowed_actions[0]).toMatchObject({
      type: "NAVIGATE",
      target: response?.actions[0].to,
    });

    const action = validateAction(response!.actions[0]);
    expect(action?.type).toBe("NAVIGATE");
    expect(canOpenScoutWorkArea(action?.to)).toBe(true);
    const route = parseBusinessesWorkspaceRoute(new URL(action!.to!, "https://tradescout.test").search);
    expect(route.values).toMatchObject({
      stateCode: "AZ",
      countyFips: "04013",
      tradeSlug: "roofing",
    });
    const staleWorkspace = {
      stateCode: "FL",
      countyFips: "12095",
      tradeSlug: "plumbing",
      searchQuery: "Old Provider",
      selectedProviderId: "old-provider",
    };
    const storage = {
      getItem: () => JSON.stringify(staleWorkspace),
    } as unknown as Storage;
    expect(resolveBusinessesWorkspaceState({
      search: new URL(action!.to!, "https://tradescout.test").search,
      storage,
      authenticatedUserId: "synthetic-user",
      pathname: "/direct-connect/pros",
    })).toEqual({
      stateCode: "AZ",
      countyFips: "04013",
      tradeSlug: "roofing",
      searchQuery: "",
      selectedProviderId: "",
    });
  });

  it("keeps saved local context for a generic browse and does not invent an area", () => {
    expect(resolveProviderBrowseIntent("Find a contractor", {
      countyCode: "Orange",
      stateCode: "FL",
    })?.path).toBe("/direct-connect/pros?source=scout&state=FL&county=12095&trade=&q=&selected=");
    expect(resolveProviderBrowseIntent("Compare plumbers")?.path).toBe(
      "/direct-connect/pros?source=scout&state=&county=&trade=plumbing&q=&selected="
    );
  });

  it("does not reuse a saved county when the user selects another state", () => {
    expect(resolveProviderBrowseIntent("Show me roofers in AZ", {
      countyCode: "Orange",
      stateCode: "FL",
    })?.path).toBe("/direct-connect/pros?source=scout&state=AZ&county=&trade=roofing&q=&selected=");
    expect(resolveProviderBrowseIntent("Show me roofers in az", {
      countyCode: "Orange",
      stateCode: "FL",
    })?.countyFips).toBeNull();
    expect(resolveProviderBrowseIntent("Show me roofers in AZ", {
      countyCode: "Maricopa",
      stateCode: "AZ",
    })?.path).toBe("/direct-connect/pros?source=scout&state=AZ&county=&trade=roofing&q=&selected=");
  });

  it("resolves a unique named county without inheriting the saved state", () => {
    expect(resolveProviderBrowseIntent("Show me roofers in Maricopa County", {
      countyCode: "Orange",
      stateCode: "FL",
    })).toMatchObject({
      stateCode: "AZ",
      countyFips: "04013",
      areaNeedsSelection: false,
    });
  });

  it("asks for a county when the named place cannot be uniquely resolved", () => {
    const savedFloridaArea = { countyCode: "Orange", stateCode: "FL" };
    expect(resolveProviderBrowseIntent("Show me roofers in Washington County", savedFloridaArea))
      .toMatchObject({
        stateCode: null,
        countyFips: null,
        areaNeedsSelection: true,
      });
    expect(resolveProviderBrowseIntent("Show me roofers in Phoenix, AZ", savedFloridaArea))
      .toMatchObject({
        stateCode: "AZ",
        countyFips: null,
        areaNeedsSelection: true,
      });
    expect(resolveProviderBrowseIntent("Show me roofers in Phoenix, AZ", {
      countyCode: "Maricopa",
      stateCode: "AZ",
    })?.countyFips).toBeNull();
    expect(resolveProviderBrowseIntent("Show me roofers in Phoenix, AZ", savedFloridaArea)?.path)
      .toBe("/direct-connect/pros?source=scout&state=AZ&county=&trade=roofing&q=&selected=&require_area=1");
  });

  it("recognizes companies as providers while leaving private request replies alone", () => {
    expect(resolveProviderBrowseIntent("Find roofing companies near me", {
      countyCode: "Maricopa",
      stateCode: "AZ",
    })?.tradeSlug).toBe("roofing");
    expect(resolveProviderBrowseIntent("Show me the contractors who replied to my request"))
      .toBeNull();
    expect(resolveProviderBrowseIntent("Show me the contractors who replied to my requests"))
      .toBeNull();
    expect(resolveProviderBrowseIntent("Show me the contractors who responded to my jobs"))
      .toBeNull();
  });

  it("leaves request creation and Exchange searches with their existing owners", () => {
    expect(resolveProviderBrowseIntent("Need a plumber for a leaking pipe tonight")).toBeNull();
    expect(resolveProviderBrowseIntent("Show me businesses on the Exchange")).toBeNull();
    expect(resolveProviderBrowseIntent("Show me my business requests")).toBeNull();
    expect(resolveProviderBrowseIntent("List my business")).toBeNull();
    expect(runScoutDecisionPipeline({
      message: "Show me businesses on the Exchange",
      isAuthenticated: false,
    }).behaviorKey).toBe("explicit_navigation");
  });
});
