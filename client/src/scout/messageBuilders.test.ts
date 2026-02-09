import { describe, it, expect } from "vitest";
import { buildConnectionFallback, buildExplicitNavigationMessage } from "./messageBuilders";

describe("messageBuilders", () => {
  it("builds explicit navigation messages with nav target", () => {
    const msg = buildExplicitNavigationMessage({ to: "/direct-connect", label: "Direct Connect" });
    expect(msg.role).toBe("assistant");
    expect(msg.navTarget).toBe("/direct-connect");
    expect(msg.content.toLowerCase()).toContain("opening direct connect");
    expect(msg.clusters?.[0]?.primaryAction?.to).toBe("/direct-connect");
  });

  it("builds fallback payload with deterministic actions", () => {
    const { message, actions } = buildConnectionFallback({
      contractorsRoute: "/contractors",
      communityRoute: "/community",
    });

    expect(actions).toHaveLength(3);
    expect(actions[0].to).toBe("/direct-connect");
    expect(actions[1].to).toBe("/contractors");
    expect(actions[2].to).toBe("/community");
    expect(message.clusters?.[0]?.actions).toHaveLength(3);
  });
});
