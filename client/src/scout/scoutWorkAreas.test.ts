import { describe, expect, it } from "vitest";
import {
  canOpenScoutWorkArea,
  resolveScoutWorkAreaAction,
  titleFromScoutWorkAreaUrl,
} from "./scoutWorkAreas";
import type { ScoutAction } from "./state";

describe("Scout work areas", () => {
  it("opens key normal user Scout destinations in place", () => {
    const routes = [
      "/utilities/supply-run",
      "/homes",
      "/vehicles",
      "/messages",
      "/direct-connect",
      "/finances",
    ];

    for (const route of routes) {
      expect(canOpenScoutWorkArea(route)).toBe(true);
    }
  });

  it("turns card navigation actions into embedded page targets", () => {
    const actions: ScoutAction[] = [
      { type: "NAVIGATE", label: "Start a material run", to: "/utilities/supply-run" },
      { type: "NAVIGATE", label: "Open Home Vault", to: "/homes" },
      { type: "NAVIGATE", label: "Open Vehicle Vault", to: "/vehicles" },
      { type: "NAVIGATE", label: "Open messages", to: "/messages" },
      { type: "NAVIGATE", label: "Find local help", to: "/direct-connect" },
      { type: "NAVIGATE", label: "Open invoices", to: "/finances" },
    ];

    for (const action of actions) {
      const result = resolveScoutWorkAreaAction(action);
      expect(result).toEqual({ url: action.to, title: action.label });
    }
  });

  it("does not embed unsafe or unsupported destinations", () => {
    expect(canOpenScoutWorkArea("https://example.com")).toBe(false);
    expect(canOpenScoutWorkArea("/admin/panel")).toBe(false);
    expect(resolveScoutWorkAreaAction({ type: "ASK_SCOUT", prompt: "hello" })).toBeNull();
  });

  it("uses public titles for embedded pages", () => {
    expect(titleFromScoutWorkAreaUrl("/utilities/supply-run?draft=1")).toBe("Supply Run");
    expect(titleFromScoutWorkAreaUrl("/homes")).toBe("Homes");
    expect(titleFromScoutWorkAreaUrl("/vehicles")).toBe("Vehicles");
    expect(titleFromScoutWorkAreaUrl("/messages")).toBe("Messages");
    expect(titleFromScoutWorkAreaUrl("/direct-connect")).toBe("Direct Connect");
    expect(titleFromScoutWorkAreaUrl("/finances")).toBe("Invoices & payments");
    expect(titleFromScoutWorkAreaUrl("/unknown")).toBe("Page");
  });
});
