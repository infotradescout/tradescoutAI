import { describe, expect, it } from "vitest";
import { maybeHandleHomeProjectRouting } from "../scout/scoutHomeProjectRouting";

describe("maybeHandleHomeProjectRouting", () => {
  it("returns project planning and local help instead of a single path", () => {
    const result = maybeHandleHomeProjectRouting({
      message: "I need to build a deck",
      countyCode: "Tangipahoa Parish",
      stateCode: "LA",
    });

    expect(result?.intent).toBe("home_project_decking");
    expect(result?.suggestedActions).toEqual(["Plan this project", "Find decking help"]);
    expect(result?.actions.map((action) => action.label)).toContain("Plan this project");
    expect(result?.actions.map((action) => action.label)).toContain("Find decking help");
    expect(result?.message.toLowerCase()).not.toContain("do you want");
  });

  it("uses the same planning pattern for non-deck project actions", () => {
    const result = maybeHandleHomeProjectRouting({
      message: "I need to replace a fence",
      countyCode: "Tangipahoa Parish",
      stateCode: "LA",
    });

    expect(result?.intent).toBe("home_project_fencing");
    expect(result?.suggestedActions).toEqual(["Plan this project", "Find fencing help"]);
    expect(result?.actions.map((action) => action.label)).toContain("Plan this project");
    expect(result?.actions.map((action) => action.label)).toContain("Find fencing help");
  });

  it("keeps contractor client work on scope and material prep", () => {
    const result = maybeHandleHomeProjectRouting({
      message: "I am a contractor building a deck for my client",
    });

    expect(result?.intent).toBe("client_project_decking");
    expect(result?.suggestedActions).toEqual([
      "Scope the client job",
      "Start materials or quote prep",
    ]);
    expect(result?.actions.some((action) => action.to === "/utilities/supply-run")).toBe(true);
    expect(result?.actions.some((action) => action.to === "/finances")).toBe(true);
    expect(result?.message).toContain("approve anything before it is sent");
  });
});
