import { describe, expect, it } from "vitest";
import { shouldAutoOpenStartGuideAtLocation } from "./startGuideVisibility";

describe("automatic Start here guide", () => {
  it("leaves direct Scout visits clear for a first-time user", () => {
    expect(shouldAutoOpenStartGuideAtLocation("/scout")).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/scout?county=04013")).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/scout/saved/thread-1")).toBe(false);
  });

  it("keeps automatic orientation on other app pages", () => {
    expect(shouldAutoOpenStartGuideAtLocation("/")).toBe(true);
    expect(shouldAutoOpenStartGuideAtLocation("/contractors?county=04013")).toBe(true);
    expect(shouldAutoOpenStartGuideAtLocation("/direct-connect/active")).toBe(true);
    expect(shouldAutoOpenStartGuideAtLocation("/scouting")).toBe(true);
  });
});
