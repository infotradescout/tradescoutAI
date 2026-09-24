import { describe, expect, it } from "vitest";
import { shouldAutoOpenStartGuideAtLocation } from "./startGuideVisibility";

describe("automatic Start here guide", () => {
  it("leaves direct Scout visits clear for a first-time user", () => {
    expect(shouldAutoOpenStartGuideAtLocation("/scout", true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/scout?county=04013", true)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/scout/saved/thread-1", true)).toBe(false);
  });

  it("keeps automatic orientation on other app pages", () => {
    expect(shouldAutoOpenStartGuideAtLocation("/", true)).toBe(true);
    expect(shouldAutoOpenStartGuideAtLocation("/contractors?county=04013", true)).toBe(true);
    expect(shouldAutoOpenStartGuideAtLocation("/direct-connect/active", true)).toBe(true);
    expect(shouldAutoOpenStartGuideAtLocation("/scouting", true)).toBe(true);
  });

  it("does not cover an embedded post or business view with a second guide", () => {
    expect(shouldAutoOpenStartGuideAtLocation("/community/posts/post-1", false)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/contractors", false)).toBe(false);
    expect(shouldAutoOpenStartGuideAtLocation("/", false)).toBe(false);
  });
});
