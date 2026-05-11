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
    expect(intents[0].cluster.items?.some((item) => item.label === "Trust before contact")).toBe(
      true
    );
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

  it("sorts material needs into suppliers, product comparison, Exchange, and Supply Run", () => {
    const intents = sortScoutInfoDump("need lumber joist hangers and fasteners for a deck", {
      confidenceBand: "low",
    });
    const labels = intents.map((intent) => intent.label);
    const visibleCopy = visibleIntentCopy(intents);

    expect(labels).toContain("Local suppliers");
    expect(labels).toContain("Products to compare");
    expect(labels).toContain("Exchange materials");
    expect(labels).toContain("Material list or supplier link");
    expect(
      intents.some((intent) =>
        intent.actions.some((action) => action.to === "/utilities/supply-run")
      )
    ).toBe(true);
    expect(visibleCopy).toContain("supplier stock and prices need confirmation");
    expect(visibleCopy).toContain("scout does not contact, order, invoice, or pay on its own");
    expect(visibleCopy).not.toContain("live inventory");
    expect(visibleCopy).not.toContain("order directly");
    expect(visibleCopy).not.toContain("can pay");
  });

  it("keeps project options while exposing material paths inside them", () => {
    const intents = sortScoutInfoDump("i need to build a deck");
    const actions = intents.flatMap((intent) => intent.actions.map((action) => action.label));
    const primaryItems = intents[0].cluster.items?.map((item) => item.label) || [];

    expect(intents.map((intent) => intent.label)).toEqual(["Plan this project", "Find local help"]);
    expect(actions).toContain("Start a material run");
    expect(actions).toContain("Browse Exchange materials");
    expect(primaryItems).toContain("What you want");
    expect(primaryItems).toContain("What has to be covered");
    expect(primaryItems).toContain("What is realistic");
    expect(primaryItems).toContain("Materials and products");
    expect(primaryItems).toContain("Rules or permits");
  });

  it("puts the most confident path first while carrying secondary angles", () => {
    const intents = sortScoutInfoDump("need a contractor to build a fence and compare prices");

    expect(intents[0].label).toBe("Plan this project");
    expect(intents[0].confidence).toBeGreaterThanOrEqual(intents[1]?.confidence || 0);
    expect(intents[0].cluster.items?.some((item) => item.label === "Price factors")).toBe(true);
    expect(intents[0].cluster.items?.some((item) => item.label === "Rules or permits")).toBe(true);
    expect(intents[0].cluster.items?.length || 0).toBeLessThanOrEqual(8);
  });

  it("sorts permit and code language into rules", () => {
    const intents = sortScoutInfoDump("do I need a permit or inspection for this fence");
    const rulesIntent = intents.find((intent) => intent.id === "rules-permits");

    expect(rulesIntent).toBeTruthy();
    expect(rulesIntent?.cluster.kind).toBe("rules");
    expect(rulesIntent?.actions.some((action) => action.type === "ASK_SCOUT")).toBe(true);
  });

  it("returns two concrete project options instead of asking the user to choose", () => {
    const intents = sortScoutInfoDump("i need to build a deck");
    const visibleCopy = visibleIntentCopy(intents);

    expect(intents.map((intent) => intent.label)).toEqual(["Plan this project", "Find local help"]);
    expect(visibleCopy).not.toContain("do you want");
    expect(visibleCopy).not.toContain("likely type");
    expect(visibleCopy).not.toContain("timing: normal");
    expect(visibleCopy).not.toContain("route");
  });

  it("uses the same two-option pattern for other project actions", () => {
    const intents = sortScoutInfoDump("i need to replace a fence");

    expect(intents.map((intent) => intent.label)).toEqual(["Plan this project", "Find local help"]);
    expect(intents[0].actions.some((action) => action.to === "/utilities/supply-run")).toBe(true);
    expect(
      intents[1].actions.some((action) => action.to === "/direct-connect/pros?trade=fencing")
    ).toBe(true);
  });

  it("prioritizes urgent service help instead of forcing a material/project bundle", () => {
    const intents = sortScoutInfoDump("water leak under sink now need plumbing repair asap");
    const labels = intents.map((intent) => intent.label);
    const actions = intents.flatMap((intent) => intent.actions.map((action) => action.label));
    const visibleCopy = visibleIntentCopy(intents);

    expect(labels).toEqual(["Find local help", "Plan this project"]);
    expect(
      intents[0].actions.some((action) => action.to === "/direct-connect/pros?trade=plumbing")
    ).toBe(true);
    expect(actions).not.toContain("Start a material run");
    expect(actions).not.toContain("Browse Exchange materials");
    expect(visibleCopy).toContain("safety and availability first");
    expect(visibleCopy).toContain("contact gated");
  });

  it("keeps vehicle issues out of generic home project handling", () => {
    const intents = sortScoutInfoDump("brake noise on my truck asap");
    const labels = intents.map((intent) => intent.label);
    const actions = intents.flatMap((intent) => intent.actions.map((action) => action.label));
    const visibleCopy = visibleIntentCopy(intents);

    expect(labels[0]).toBe("Handle the vehicle issue");
    expect(actions).toContain("Open vehicles");
    expect(actions).not.toContain("Start a material run");
    expect(visibleCopy).toContain("vehicle context");
    expect(visibleCopy).not.toContain("plan this project");
  });

  it("treats quote fairness as review work before local contact", () => {
    const intents = sortScoutInfoDump("is this roofing quote fair at $4500");
    const visibleCopy = visibleIntentCopy(intents);

    expect(intents.map((intent) => intent.label)).toEqual(["Check prices"]);
    expect(intents[0].actions.some((action) => action.label === "Review this price")).toBe(true);
    expect(
      intents[0].actions.some((action) => action.to === "/direct-connect/pros?trade=roofing")
    ).toBe(true);
    expect(visibleCopy).toContain("scope before price");
    expect(visibleCopy).toContain("what has to be covered");
    expect(visibleCopy).toContain("no contact opens automatically");
  });

  it("flags expectation, requirements, and feasibility when budget and outcome may conflict", () => {
    const intents = sortScoutInfoDump("need the best fence build done right but budget is tight");
    const visibleCopy = visibleIntentCopy(intents);

    expect(intents[0].label).toBe("Plan this project");
    expect(visibleCopy).toContain("what you want");
    expect(visibleCopy).toContain("what has to be covered");
    expect(visibleCopy).toContain("what is realistic");
    expect(visibleCopy).toContain("budget may limit");
    expect(visibleCopy).not.toContain("do you want");
  });

  it("switches project options when the user is building for a client", () => {
    const intents = sortScoutInfoDump("I am a contractor building a deck for a client");
    const visibleCopy = visibleIntentCopy(intents);

    expect(intents.map((intent) => intent.label)).toEqual([
      "Scope the client job",
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
