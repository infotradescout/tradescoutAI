import {
  getDisplayLatestStatus,
  getDisplayRequestDescription,
  getDisplayRequestTitle,
  looksLikeHiddenOrTestRequest,
} from "./requestCardPresentation";

describe("requestCardPresentation", () => {
  it("formats raw enum title copy to user-facing title", () => {
    expect(getDisplayRequestTitle({ title: "inspection request for single_family" })).toBe(
      "Home inspection request"
    );
  });

  it("hides internal HomeID preview copy on request cards", () => {
    expect(
      getDisplayRequestDescription({
        description: "Prepared from HomeID handoff preview.\nIncluded HomeID details: ...",
      })
    ).toBe("Direct Connect is preparing this request for local providers.");
  });

  it("hides preview/test artifacts from normal board", () => {
    expect(looksLikeHiddenOrTestRequest({ isHomeIdPreviewDraft: true })).toBe(true);
    expect(
      looksLikeHiddenOrTestRequest({
        title: "Inspection request",
        description: "Prepared from HomeID request preview.",
      })
    ).toBe(true);
  });

  it("keeps real user requests visible", () => {
    expect(
      looksLikeHiddenOrTestRequest({
        title: "Need roof repair estimate",
        description: "Leak over garage. Looking for licensed local pros.",
      })
    ).toBe(false);
  });

  it("uses non-contradictory status copy for ready-to-send and routed states", () => {
    expect(
      getDisplayLatestStatus({ status: "open", latestStatus: "Waiting for local businesses" })
    ).toBe("Ready to send");
    expect(
      getDisplayLatestStatus({ status: "routed", latestStatus: "Waiting for local businesses" })
    ).toBe("Waiting on pros");
  });
});
