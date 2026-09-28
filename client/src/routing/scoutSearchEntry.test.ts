import { describe, expect, it } from "vitest";
import {
  SCOUT_SEARCH_ENTRY_DRAFT_KEY,
  scoutSearchEntryDraft,
  takeScoutSearchEntryDraft,
  writeScoutSearchEntryDraft,
} from "./scoutSearchEntry";

describe("legacy search entry to Scout", () => {
  it("consumes a query only for the account that opened it", () => {
    const entries = new Map<string, string>();
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); },
      removeItem: (key: string) => { entries.delete(key); },
    };
    expect(writeScoutSearchEntryDraft("posts and deals", "user:A", storage)).toBe(true);
    expect(takeScoutSearchEntryDraft("user:B", storage)).toBe("");
    expect(entries.has(SCOUT_SEARCH_ENTRY_DRAFT_KEY)).toBe(false);

    expect(writeScoutSearchEntryDraft("posts and deals", "user:A", storage)).toBe(true);
    expect(takeScoutSearchEntryDraft("user:A", storage)).toBe("posts and deals");
    expect(takeScoutSearchEntryDraft("user:A", storage)).toBe("");
    expect(writeScoutSearchEntryDraft("posts and deals", null, storage)).toBe(false);
  });

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
