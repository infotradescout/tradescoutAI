import { describe, expect, it } from "vitest";
import { projectScoutWorkItem } from "../scout/scoutWorkOverview";

describe("Scout work defensive input handling", () => {
  it.each(["constructor", "__proto__", "toString", "hasOwnProperty"])("treats %s as an unknown stored status", (status) => {
    const item = projectScoutWorkItem("requests", { id: "request-1", title: "Kitchen project", status });
    expect(item?.state).toBe("unknown");
    expect(item?.statusLabel).toBe("Review status");
  });
  it.each([".", "..", "../other", "//outside.example", "x?next=/other"])("does not create a supply-run route from %s", (id) => {
    expect(projectScoutWorkItem("supply_runs", { id, status: "submitted" })).toBeNull();
  });
  it("retains opaque valid supply-run identifiers", () => {
    expect(projectScoutWorkItem("supply_runs", { id: "supply-run_0123", status: "submitted" })?.nextAction.to)
      .toBe("/utilities/supply-run/supply-run_0123");
  });
});
