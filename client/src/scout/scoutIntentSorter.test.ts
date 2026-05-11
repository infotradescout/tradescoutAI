import { describe, expect, it } from "vitest";
import { sortScoutInfoDump } from "./scoutIntentSorter";

function visibleIntentCopy(intents: ReturnType<typeof sortScoutInfoDump>): string {
  return JSON.stringify(
    intents.map((intent) => ({
      label: intent.label,
      reason: intent.reason,
      title: intent.cluster.title,
      body: intent.cluster.body,
      items: intent.cluster.items,
      actions: intent.actions.map((action) => ({
        label: action.label,
        subtitle: action.subtitle,
        prompt: action.prompt,
      })),
    }))
  ).toLowerCase();
}

describe("sortScoutInfoDump", () => {
  it("sorts a messy roof leak dump into local help and request paths", () => {
    const intents = sortScoutInfoDump(
      "roof leak over the kitchen, probably need a roofer asap, budget is tight"
    );

    expect(intents.map((intent) => intent.id)).toContain("local-help");
    expect(intents.map((intent) => intent.id)).toContain("saved-request");
    const requestAction = intents[0].cluster.actions?.find((action) =>
      String(action.label || "").includes("Create roofing request")
    );
    expect(requestAction).toBeTruthy();
    expect(requestAction?.payload?.prefill).toMatchObject({
      jobType: "roofing",
      tradeId: "roofing",
      urgency: "high",
    });
  });

  it("extracts budget ranges into the saved request prefill", () => {
    const intents = sortScoutInfoDump("need plumber this week budget $500-$900 for a sink leak");
    const localHelp = intents.find((intent) => intent.id === "local-help");
    const requestAction = localHelp?.actions.find((action) =>
      String(action.label || "").includes("Create plumbing request")
    );

    expect(requestAction?.payload?.prefill).toMatchObject({
      jobType: "plumbing",
      tradeId: "plumbing",
      budgetMin: 500,
      budgetMax: 900,
    });
    expect(localHelp?.cluster.items?.some((item) => item.label === "Budget: $500-$900")).toBe(true);
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

  it("returns two concrete deck options instead of asking the user to choose", () => {
    const intents = sortScoutInfoDump("i need to build a deck");
    const visibleCopy = visibleIntentCopy(intents);

    expect(intents.map((intent) => intent.label)).toEqual([
      "Plan the deck project",
      "Find deck help",
    ]);
    expect(visibleCopy).not.toContain("do you want");
    expect(visibleCopy).not.toContain("likely type");
    expect(visibleCopy).not.toContain("timing: normal");
    expect(visibleCopy).not.toContain("route");
  });

  it("switches deck options when the user is building for a client", () => {
    const intents = sortScoutInfoDump("I am a contractor building a deck for a client");
    const visibleCopy = visibleIntentCopy(intents);

    expect(intents.map((intent) => intent.label)).toEqual([
      "Scope the client deck job",
      "Start materials or quote prep",
    ]);
    expect(intents[1].actions.some((action) => action.to === "/utilities/supply-run")).toBe(true);
    expect(intents[1].actions.some((action) => action.to === "/finances")).toBe(true);
    expect(visibleCopy).toContain("draft first, approve before sending");
    expect(visibleCopy).not.toContain("find deck help");
    expect(visibleCopy).not.toContain("do you want");
  });

  it("narrows result count as confidence gets stronger", () => {
    const message =
      "need contractor materials equipment nearby permit prices invoice messages for a project";
    const low = sortScoutInfoDump(message, { confidenceBand: "low" });
    const high = sortScoutInfoDump(message, { confidenceBand: "high" });

    expect(low.length).toBeGreaterThan(high.length);
    expect(high.length).toBeLessThanOrEqual(2);
  });
});
