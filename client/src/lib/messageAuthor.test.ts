import { describe, expect, it } from "vitest";
import { getMessageAuthorLabel } from "./messageAuthor";

describe("getMessageAuthorLabel", () => {
  it("identifies staff-authored assisted messages explicitly", () => {
    expect(
      getMessageAuthorLabel(
        {
          senderId: "staff-user",
          senderType: "staff",
          metadata: { staffAssisted: true },
        },
        "requester-user",
        "Accepted Provider"
      )
    ).toBe("TradeScout staff");
  });

  it("does not let participant-controlled metadata impersonate staff", () => {
    expect(
      getMessageAuthorLabel(
        {
          senderId: "provider-user",
          senderType: "contractor",
          metadata: {
            staffAssisted: true,
            staffActorUserId: "staff-user",
            representedProviderUserId: "provider-user",
          },
        },
        "requester-user",
        "Accepted Provider"
      )
    ).toBe("Provider");
  });

  it("labels the viewer's own message as You", () => {
    expect(
      getMessageAuthorLabel({ senderId: "viewer-user", senderType: "homeowner" }, "viewer-user")
    ).toBe("You");
  });

  it("retains role labels and a safe participant fallback", () => {
    expect(
      getMessageAuthorLabel({ senderId: "provider-user", senderType: "contractor" }, "viewer-user")
    ).toBe("Provider");
    expect(
      getMessageAuthorLabel(
        { senderId: "other-user", senderType: "unknown" },
        "viewer-user",
        "Jordan"
      )
    ).toBe("Jordan");
  });
});
