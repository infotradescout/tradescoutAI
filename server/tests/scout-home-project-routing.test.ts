import { describe, expect, it } from "vitest";
import { maybeHandleHomeProjectRouting } from "../scout/scoutHomeProjectRouting";

describe("maybeHandleHomeProjectRouting", () => {
  it("returns project planning and deck help instead of a single path", () => {
    const result = maybeHandleHomeProjectRouting({
      message: "I need to build a deck",
      countyCode: "Tangipahoa Parish",
      stateCode: "LA",
    });

    expect(result?.intent).toBe("home_project_decking");
    expect(result?.suggestedActions).toEqual(["Plan the deck project", "Find deck help"]);
    expect(result?.actions.map((action) => action.label)).toContain("Plan the deck project");
    expect(result?.actions.map((action) => action.label)).toContain("Find deck help");
    expect(result?.message.toLowerCase()).not.toContain("do you want");
  });

  it("keeps contractor client deck work on scope and material prep", () => {
    const result = maybeHandleHomeProjectRouting({
      message: "I am a contractor building a deck for my client",
    });

    expect(result?.intent).toBe("client_project_decking");
    expect(result?.suggestedActions).toEqual([
      "Scope the client deck job",
      "Start materials or quote prep",
    ]);
    expect(result?.actions.some((action) => action.to === "/utilities/supply-run")).toBe(true);
    expect(result?.actions.some((action) => action.to === "/finances")).toBe(true);
    expect(result?.message).toContain("approve anything before it is sent");
  });
});
