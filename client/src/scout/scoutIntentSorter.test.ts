import { describe, expect, it } from "vitest";
import { sortScoutInfoDump } from "./scoutIntentSorter";

describe("sortScoutInfoDump", () => {
  it("sorts a messy roof leak dump into local help and request paths", () => {
    const intents = sortScoutInfoDump(
      "roof leak over the kitchen, probably need a roofer asap, budget is tight"
    );

    expect(intents.map((intent) => intent.id)).toContain("local-help");
    expect(intents.map((intent) => intent.id)).toContain("saved-request");
    expect(intents[0].cluster.actions?.some((action) => action.label === "Create request")).toBe(
      true
    );
  });

  it("sorts invoice and message language into site search", () => {
    const intents = sortScoutInfoDump("where are my invoices and messages");
    const siteIntent = intents.find((intent) => intent.id === "site-search");

    expect(siteIntent).toBeTruthy();
    expect(siteIntent?.cluster.kind).toBe("site");
    expect(siteIntent?.actions.some((action) => action.to === "/finances")).toBe(true);
    expect(siteIntent?.actions.some((action) => action.to === "/messages")).toBe(true);
  });

  it("sorts equipment and rental language into Exchange", () => {
    const intents = sortScoutInfoDump("need to rent equipment or buy used tools nearby");
    const exchangeIntent = intents.find((intent) => intent.id === "exchange");

    expect(exchangeIntent).toBeTruthy();
    expect(exchangeIntent?.cluster.kind).toBe("marketplace");
    expect(exchangeIntent?.actions.some((action) => action.to === "/exchange")).toBe(true);
  });

  it("sorts permit and code language into rules", () => {
    const intents = sortScoutInfoDump("do I need a permit or inspection for this fence");
    const rulesIntent = intents.find((intent) => intent.id === "rules-permits");

    expect(rulesIntent).toBeTruthy();
    expect(rulesIntent?.cluster.kind).toBe("rules");
    expect(rulesIntent?.actions.some((action) => action.type === "ASK_SCOUT")).toBe(true);
  });
});
