import { afterEach, describe, expect, it, vi } from "vitest";
import { executeScoutActions, type ScoutActionHelpers } from "./ScoutActionRouter";
import type { ScoutAction } from "./state";

function makeHelpers() {
  const navigate = vi.fn();
  const prefillInput = vi.fn();
  const openAppDrawer = vi.fn();
  const openToolsDrawer = vi.fn();

  const helpers: ScoutActionHelpers = {
    navigate,
    prefillInput,
    openAppDrawer,
    openToolsDrawer,
  };

  return { helpers, navigate, prefillInput };
}

function mockGuardAllowsActions() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    }) as any
  );
}

describe("ScoutActionRouter structured prefill routing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("routes direct connect structured prefill to composer URL", async () => {
    mockGuardAllowsActions();
    const { helpers, navigate, prefillInput } = makeHelpers();

    const action: ScoutAction = {
      type: "PREFILL_INPUT",
      payload: {
        target: "direct_connect_request",
        route: "/direct-connect",
        prefill: {
          jobType: "roofing",
          scope: "Need roof leak repair",
          urgency: "high",
          budgetMin: 500,
          budgetMax: 900,
        },
      },
    };

    await executeScoutActions([action], helpers);

    expect(prefillInput).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);

    const routedTo = String(navigate.mock.calls[0][0]);
    expect(routedTo.startsWith("/direct-connect?")).toBe(true);

    const params = new URLSearchParams(routedTo.split("?")[1] || "");
    expect(params.get("title")).toBe("roofing request");
    expect(params.get("description")).toBe("Need roof leak repair");
    expect(params.get("urgency")).toBe("high");
    expect(params.get("trade")).toBe("roofing");
    expect(params.get("budgetMin")).toBe("500");
    expect(params.get("budgetMax")).toBe("900");
    expect(params.get("source")).toBe("scout");
  });

  it("routes exchange structured prefill to sell tab URL", async () => {
    mockGuardAllowsActions();
    const { helpers, navigate } = makeHelpers();

    const action: ScoutAction = {
      type: "PREFILL_INPUT",
      payload: {
        target: "exchange_listing",
        route: "/exchange",
        prefill: {
          title: "Used miter saw",
          description: "Works great, lightly used",
          location: "Orange County, FL",
          price: 180,
        },
      },
    };

    await executeScoutActions([action], helpers);

    expect(navigate).toHaveBeenCalledTimes(1);
    const routedTo = String(navigate.mock.calls[0][0]);
    expect(routedTo.startsWith("/exchange?")).toBe(true);

    const params = new URLSearchParams(routedTo.split("?")[1] || "");
    expect(params.get("tab")).toBe("sell");
    expect(params.get("title")).toBe("Used miter saw");
    expect(params.get("description")).toBe("Works great, lightly used");
    expect(params.get("loc")).toBe("Orange County, FL");
    expect(params.get("price")).toBe("180");
  });

  it("routes community structured prefill to compose URL", async () => {
    mockGuardAllowsActions();
    const { helpers, navigate } = makeHelpers();

    const action: ScoutAction = {
      type: "PREFILL_INPUT",
      payload: {
        target: "community_post",
        route: "/community",
        prefill: {
          title: "Need roofer recommendation",
          body: "Who has had a good experience in Orange County?",
        },
      },
    };

    await executeScoutActions([action], helpers);

    expect(navigate).toHaveBeenCalledTimes(1);
    const routedTo = String(navigate.mock.calls[0][0]);
    expect(routedTo.startsWith("/community?")).toBe(true);

    const params = new URLSearchParams(routedTo.split("?")[1] || "");
    expect(params.get("compose")).toBe("1");
    expect(params.get("prefill")).toContain("Need roofer recommendation");
    expect(params.get("prefill")).toContain("Who has had a good experience in Orange County?");
  });

  it("lets SAVE_PROFILE complete through the server guard without local navigation", async () => {
    mockGuardAllowsActions();
    const { helpers, navigate, prefillInput } = makeHelpers();

    const action: ScoutAction = {
      type: "SAVE_PROFILE",
      label: "Save profile update",
      payload: {
        profilePatch: { firstName: "Jane" },
      },
    };

    await executeScoutActions([action], helpers);

    expect(fetch).toHaveBeenCalledWith(
      "/api/scout/execute-action",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("SAVE_PROFILE"),
      })
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(prefillInput).not.toHaveBeenCalled();
  });

  it("requires approval before agentic send/publish-style tool actions execute", async () => {
    mockGuardAllowsActions();
    const { helpers } = makeHelpers();
    const confirmAction = vi.fn().mockResolvedValue(false);
    helpers.confirmAction = confirmAction;

    const action: ScoutAction = {
      type: "CALL_TOOL",
      label: "Send message",
      payload: { name: "messages.send", text: "Hello" },
    };

    await executeScoutActions([action], helpers);

    expect(confirmAction).toHaveBeenCalledWith(action);
  });

  it("does not require approval for normal local navigation", async () => {
    mockGuardAllowsActions();
    const { helpers, navigate } = makeHelpers();
    const confirmAction = vi.fn();
    helpers.confirmAction = confirmAction;

    await executeScoutActions(
      [{ type: "NAVIGATE", label: "Open Home Vault", to: "/homes" }],
      helpers
    );

    expect(confirmAction).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/homes");
  });

  it("never executes payment actions and only routes to payment workspace", async () => {
    mockGuardAllowsActions();
    const { helpers, navigate } = makeHelpers();
    const confirmAction = vi.fn().mockResolvedValue(true);
    helpers.confirmAction = confirmAction;

    await executeScoutActions(
      [
        {
          type: "START_PLATFORM_SUPPORT",
          label: "Pay platform support",
          payload: { amount: 25 },
        },
      ],
      helpers
    );

    expect(confirmAction).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("routes checkout tool actions instead of executing them", async () => {
    mockGuardAllowsActions();
    const { helpers, navigate } = makeHelpers();
    const confirmAction = vi.fn().mockResolvedValue(true);
    helpers.confirmAction = confirmAction;

    await executeScoutActions(
      [
        {
          type: "CALL_TOOL",
          label: "Create checkout",
          payload: { name: "payments.charge", route: "/finances" },
        },
      ],
      helpers
    );

    expect(confirmAction).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/finances");
  });
});
