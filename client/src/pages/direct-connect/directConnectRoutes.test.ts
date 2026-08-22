import { describe, expect, it } from "vitest";
import {
  buildDirectConnectHref,
  getDirectConnectEntry,
  getDirectConnectSection,
  shouldRenderDirectConnectSectionChrome,
  shouldResolveDirectConnectEntry,
} from "./directConnectRoutes";

describe("directConnectRoutes", () => {
  it("accepts compatibility paths and emits canonical task paths", () => {
    expect(getDirectConnectSection("/direct-connect/engagements")).toBe("engagements");
    expect(getDirectConnectSection("/direct-connect/active")).toBe("engagements");
    expect(getDirectConnectSection("/direct-connect/employment")).toBe("employment");
    expect(getDirectConnectSection("/direct-connect/opportunities")).toBe("employment");
    expect(getDirectConnectSection("/direct-connect/pros")).toBe("pros");
    expect(getDirectConnectSection("/direct-connect/businesses")).toBe("pros");
    expect(buildDirectConnectHref("engagements")).toBe("/direct-connect/active");
    expect(buildDirectConnectHref("employment")).toBe("/direct-connect/opportunities");
    expect(buildDirectConnectHref("pros")).toBe("/direct-connect/businesses");
  });

  it("preserves directory query entry behavior", () => {
    expect(getDirectConnectSection("/direct-connect?intent=local_search")).toBe("pros");
    expect(getDirectConnectSection("/direct-connect?mode=directory")).toBe("pros");
  });

  it("resolves only known automatic entry modes", () => {
    expect(getDirectConnectEntry("/direct-connect?entry=onboarding")).toBe("onboarding");
    expect(shouldResolveDirectConnectEntry("onboarding")).toBe(true);
    expect(shouldResolveDirectConnectEntry("unknown")).toBe(false);
  });

  it("lets Jobs and the composer own their hierarchy without removing sibling chrome", () => {
    expect(shouldRenderDirectConnectSectionChrome("employment")).toBe(false);
    expect(shouldRenderDirectConnectSectionChrome("post")).toBe(false);
    expect(shouldRenderDirectConnectSectionChrome("board")).toBe(true);
    expect(shouldRenderDirectConnectSectionChrome("inbox")).toBe(true);
    expect(shouldRenderDirectConnectSectionChrome("pros")).toBe(true);
    expect(shouldRenderDirectConnectSectionChrome("engagements")).toBe(true);
  });
});
