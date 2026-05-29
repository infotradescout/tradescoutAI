import { describe, expect, it } from "vitest";
import { evaluateHomeIdPacketReadiness } from "./homeidPacketReadiness";

describe("evaluateHomeIdPacketReadiness", () => {
  it("returns ready_for_handoff when packet satisfies all readiness rules", () => {
    const result = evaluateHomeIdPacketReadiness({
      homeId: "home_123",
      requestType: "inspection",
      selectedDetailIds: ["detail_1"],
      missingHelpfulInfoCount: 0,
      isDbSaved: true,
    });
    expect(result.state).toBe("ready_for_handoff");
    expect(result.missing).toEqual([]);
  });

  it("returns needs_info when request type is missing", () => {
    const result = evaluateHomeIdPacketReadiness({
      homeId: "home_123",
      requestType: " ",
      selectedDetailIds: ["detail_1"],
      missingHelpfulInfoCount: 0,
      isDbSaved: true,
    });
    expect(result.state).toBe("needs_info");
    expect(result.missing).toContain("Select a request type");
  });

  it("returns needs_info when no detail is selected", () => {
    const result = evaluateHomeIdPacketReadiness({
      homeId: "home_123",
      requestType: "repair",
      selectedDetailIds: [],
      missingHelpfulInfoCount: 0,
      isDbSaved: true,
    });
    expect(result.state).toBe("needs_info");
    expect(result.missing).toContain("Select at least one HomeID detail");
  });

  it("returns draft when packet is not yet DB-saved", () => {
    const result = evaluateHomeIdPacketReadiness({
      homeId: "home_123",
      requestType: "maintenance",
      selectedDetailIds: ["detail_1"],
      missingHelpfulInfoCount: 0,
      isDbSaved: false,
    });
    expect(result.state).toBe("draft");
    expect(result.missing).toContain("Save packet to HomeID persistence");
  });
});
