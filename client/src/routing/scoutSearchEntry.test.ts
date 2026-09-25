import { describe, expect, it } from "vitest";
import { scoutSearchEntryDraft } from "./scoutSearchEntry";

describe("legacy search entry to Scout", () => {
  it.each(["/advanced-search", "/search"])(
    "keeps a typed query as a visible Scout draft from %s",
    (entry) => {
      const target = scoutSearchEntryDraft(`${entry}?q=roofers+in+Maricopa+County`);
      expect(target).toBe("roofers in Maricopa County");
    }
  );

  it("discards caller-controlled launch metadata that could auto-submit a draft", () => {
    const target = scoutSearchEntryDraft(
      "/search?source=onboarding_result&intent=publish&prompt=Show+me+roofers"
    );
    expect(target).toBe("Show me roofers");
    expect(target).not.toContain("onboarding_result");
  });

  it("opens the Scout command bar without a stale or empty query", () => {
    expect(scoutSearchEntryDraft("/advanced-search")).toBe("");
    expect(scoutSearchEntryDraft("/search?q=%20%20&source=onboarding_result"))
      .toBe("");
  });
});
