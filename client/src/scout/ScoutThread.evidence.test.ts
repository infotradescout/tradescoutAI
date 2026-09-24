// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import ScoutThread, {
  EvidenceSourceList,
  inAppScoutResultPath,
  scrollScoutThreadToLatest,
  scrollScoutThreadToNewAnswerStart,
} from "./ScoutThread";
import ScoutSearchDock from "./ScoutSearchDock";
import { ScoutInputRow } from "./ScoutInputRow";
import { cancelScheduledScoutAutoRoute } from "./ScoutOS";
import { validateAction } from "./actionValidation";
import type { ScoutAction, ScoutMessage } from "./state";

function renderThread(
  messages: ScoutMessage[],
  showControllerExtras = false,
  options?: { status?: "idle" | "resolving_context" | "checking_documents" | "ready" }
): string {
  return renderToStaticMarkup(
    React.createElement(ScoutThread, {
      messages,
      status: options?.status ?? "idle",
      showControllerExtras,
      onPrefill: () => undefined,
    })
  );
}

describe("ScoutThread evidence strip", () => {
  it("uses app navigation for validated same-origin HTTPS results only", () => {
    const dealPath = "/deals/00000000-0000-4000-8000-000000000201?county=04013";
    expect(inAppScoutResultPath(`https://tradescout.test${dealPath}`, "https://tradescout.test"))
      .toBe(dealPath);
    expect(inAppScoutResultPath(`https://another.test${dealPath}`, "https://tradescout.test"))
      .toBeNull();
    expect(inAppScoutResultPath("https://tradescout.test/admin/private", "https://tradescout.test"))
      .toBeNull();
  });

  it("renders verified sources as links, context separately, and drops unsafe citations", () => {
    const html = renderToStaticMarkup(
      React.createElement(EvidenceSourceList, {
        sources: [
          {
            title: "Travis County permit guidance",
            url: "https://www.traviscountytx.gov/tnr/development-services",
          },
          {
            title: "Unsafe citation",
            url: "javascript:alert(1)",
            type: "url_citation",
          },
          { title: "TradeScout knowledge context", type: "internal" },
        ],
      })
    );

    expect(html).toContain('href="https://www.traviscountytx.gov/tnr/development-services"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Sources:");
    expect(html).toContain("Context:");
    expect(html).toContain("TradeScout knowledge context");
    expect(html).not.toContain("Unsafe citation");
    expect(html).not.toContain("javascript:");
  });

  it("renders an evidence toggle for assistant messages when controller extras are enabled", () => {
    const assistantMessage: ScoutMessage = {
      id: "a_1",
      role: "assistant",
      content: "Here is the current best path.",
      timestamp: new Date().toISOString(),
      provenance: {
        sourceUsed: "classic_knowledge_pipeline",
        confidenceBand: "medium",
        fallbackUsed: true,
        knowledgeLayer: 3,
        blockingReason: "auth_required",
        sourceTitles: [
          "TradeScout Brain (data folder)",
          "Internet Search (Not Local TradeScout Data)",
        ],
        sources: [
          { title: "TradeScout Brain (data folder)" },
          {
            title: "Internet Search (Not Local TradeScout Data)",
            url: "https://example.gov/current-guidance",
            type: "url_citation",
          },
        ],
        allowedActions: ["ASK_SCOUT"],
      },
    };

    const html = renderThread([assistantMessage], true);

    expect(html).toContain("scout-evidence-strip");
    expect(html).toContain(">Why this helps<");
    // Details are collapsed by default; content renders after a user toggle in the browser.
    expect(html).not.toContain("Source:");
  });

  it("does not render evidence strip for user-only messages", () => {
    const userMessage: ScoutMessage = {
      id: "u_1",
      role: "user",
      content: "find me a roofer",
      timestamp: new Date().toISOString(),
    };

    const html = renderThread([userMessage]);

    expect(html).not.toContain("scout-evidence-strip");
    expect(html).not.toContain("Checked:");
  });

  it("renders action surfaces even when controller extras are disabled", () => {
    const assistantMessage: ScoutMessage = {
      id: "a_actions",
      role: "assistant",
      content: "I prepared your next step.",
      timestamp: new Date().toISOString(),
      resultContract: {
        contract_version: "scout_result.v1",
        intent: "provider_search",
        ambiguity_options: [],
        entities: [],
        evidence: [],
        answer: "I prepared your next step.",
        allowed_actions: [
          {
            action_id: "act_review",
            type: "PREFILL_INPUT",
            label: "Review and send",
            payload: {
              target: "direct_connect_request",
              prefill: {
                scope: "roof repair",
              },
            },
            primary: true,
            requires_confirmation: false,
          },
        ],
        working_memory_update: {},
      },
    };

    const html = renderThread([assistantMessage], false);

    expect(html).toContain('data-testid="scout-primary-next-action"');
    expect(html).toContain("Review and send");
    expect(html).not.toContain("Search with Scout");
  });

  it("labels a mixed county discovery result as local results while rendering its post link", () => {
    const response =
      "This Scout result includes 1 published county post from the last 7 days in Maricopa County, AZ. It does not verify deals, businesses, pages, tools, or other requests. Open Community or Businesses to continue; nothing was sent.";
    const assistantMessage: ScoutMessage = {
      id: "a_county_discovery",
      role: "assistant",
      content: response,
      timestamp: new Date().toISOString(),
      provenance: { sourceUsed: "scout_mixed_discovery_recovery" },
      resultContract: {
        contract_version: "scout_result.v1",
        intent: "provider_search",
        ambiguity_options: [],
        entities: [
          {
            id: "scout-native-published-maricopa",
            type: "community_post",
            name: "Neighborhood tool swap",
            url: "/community/posts/scout-native-published-maricopa",
            match_reasons: ["Published county post", "From the last 7 days"],
          },
        ],
        evidence: [],
        answer: response,
        allowed_actions: [],
        working_memory_update: {},
      },
    };

    const html = renderThread([assistantMessage]);

    expect(html).toContain('class="scout-assistant-bubble__badge">Local results</span>');
    expect(html).not.toContain('class="scout-assistant-bubble__badge">Provider Search</span>');
    expect(html).toContain('href="/community/posts/scout-native-published-maricopa"');
    expect(html).toContain("Neighborhood tool swap");
    expect(html).toContain(
      "Maricopa County, AZ: 1 published post in last 7 days; deals unchecked."
    );
    expect(html).toContain("Other sources unchecked.");
    expect(html).toContain("Nothing sent.");
    expect(html).toContain("More detail");
  });

  it("keeps an unaccompanied result link in the app so Scout can restore it on return", () => {
    const postPath = "/community/posts/scout-native-published-maricopa";
    const message: ScoutMessage = {
      id: "a_result_link",
      role: "assistant",
      content: "One published post matches.",
      timestamp: "2026-09-24T00:00:00Z",
      resultContract: {
        contract_version: "scout_result.v1",
        intent: "provider_search",
        ambiguity_options: [],
        entities: [
          {
            id: "scout-native-published-maricopa",
            type: "community_post",
            name: "Neighborhood tool swap",
            url: postPath,
            match_reasons: ["Published county post"],
          },
        ],
        evidence: [],
        answer: "One published post matches.",
        allowed_actions: [],
        working_memory_update: {},
      },
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const navigate = vi.fn();
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    const previousScrollTo = HTMLElement.prototype.scrollTo;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    HTMLElement.prototype.scrollTo = vi.fn();

    try {
      React.act(() => {
        root.render(
          React.createElement(ScoutThread, {
            messages: [message],
            status: "idle",
            onResultLinkNavigate: navigate,
          })
        );
      });
      const link = container.querySelector<HTMLAnchorElement>(`.scout-result-card__title[href="${postPath}"]`);
      expect(link).not.toBeNull();
      const followedNormally = link!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
      );
      expect(followedNormally).toBe(false);
      expect(navigate).toHaveBeenCalledExactlyOnceWith(postPath);
    } finally {
      React.act(() => root.unmount());
      container.remove();
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
      HTMLElement.prototype.scrollTo = previousScrollTo;
    }
  });

  it("leaves HTTPS result links to native browser navigation", () => {
    const externalUrl = "https://example.com/offer";
    const message: ScoutMessage = {
      id: "a_external_result",
      role: "assistant",
      content: "A linked source is available.",
      timestamp: "2026-09-24T00:00:00Z",
      resultContract: {
        contract_version: "scout_result.v1",
        intent: "provider_search",
        ambiguity_options: [],
        entities: [{ id: "source-1", type: "site", name: "Source", url: externalUrl, match_reasons: [] }],
        evidence: [],
        answer: "A linked source is available.",
        allowed_actions: [],
        working_memory_update: {},
      },
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const navigate = vi.fn();
    const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    const previousScrollTo = HTMLElement.prototype.scrollTo;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    HTMLElement.prototype.scrollTo = vi.fn();
    const observedNative = vi.fn((event: MouseEvent) => {
      expect(event.defaultPrevented).toBe(false);
      event.preventDefault(); // Keep JSDOM from attempting an external navigation.
    });
    document.addEventListener("click", observedNative);

    try {
      React.act(() =>
        root.render(
          React.createElement(ScoutThread, {
            messages: [message],
            status: "idle",
            onResultLinkNavigate: navigate,
          })
        )
      );
      const link = container.querySelector<HTMLAnchorElement>(`.scout-result-card__title[href="${externalUrl}"]`);
      expect(link).not.toBeNull();
      link!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      expect(observedNative).toHaveBeenCalledOnce();
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("click", observedNative);
      React.act(() => root.unmount());
      container.remove();
      HTMLElement.prototype.scrollTo = previousScrollTo;
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });

  it("puts the verified county results and their distinct actions before the expandable explanation", () => {
    const answer =
      "This Scout result includes 1 published county post from the last 7 days in Maricopa County, AZ. It also found 1 posted Scout TradeDeal for Maricopa County, AZ. These are promotional listings; terms and availability are not independently verified. Confirm when each offer ends before acting. Businesses, pages, tools, and other requests were not checked. Nothing was sent.";
    const postPath = "/community/posts/scout-local-post";
    const dealPath = "/deals/00000000-0000-4000-8000-000000000201?county=04013";
    const message: ScoutMessage = {
      id: "a_post_and_deal",
      role: "assistant",
      content: answer,
      provenance: { sourceUsed: "scout_mixed_discovery_recovery" },
      resultContract: {
        contract_version: "scout_result.v1",
        intent: "provider_search",
        ambiguity_options: [],
        entities: [
          {
            id: "scout-local-post",
            type: "community_post",
            name: "Neighborhood tool swap",
            url: postPath,
            match_reasons: ["Published county post", "From the last 7 days in Maricopa County, AZ"],
          },
          {
            id: "00000000-0000-4000-8000-000000000201",
            type: "trade_deal",
            name: "Maricopa tool discount",
            url: dealPath,
            match_reasons: [
              "Promotional TradeDeal; terms and availability are not independently verified",
              "Listed for Maricopa County, AZ",
              "Confirm when the offer ends before acting",
            ],
          },
        ],
        evidence: [],
        answer,
        allowed_actions: [
          {
            action_id: "post",
            type: "NAVIGATE",
            label: "Open matching county post",
            target: postPath,
            primary: true,
            requires_confirmation: false,
          },
          {
            action_id: "deal",
            type: "NAVIGATE",
            label: "Open promotional TradeDeal",
            target: dealPath,
            primary: false,
            requires_confirmation: false,
          },
          {
            action_id: "browse",
            type: "NAVIGATE",
            label: "Open recent Community",
            target: "/community-feed?geo=local&feed=recent",
            primary: false,
            requires_confirmation: false,
          },
        ],
        working_memory_update: {},
      },
    };
    const html = renderToStaticMarkup(
      React.createElement(ScoutThread, {
        messages: [message],
        status: "idle",
        currentTurnPrimaryAction: {
          type: "NAVIGATE",
          label: "Open matching county post",
          to: postPath,
          path: postPath,
          primary: true,
        },
        onAction: () => undefined,
      })
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const cards = Array.from(container.querySelectorAll(".scout-result-card"));
    const labels = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).map(
      (button) => button.textContent?.trim()
    );

    expect(container.textContent).toContain("Maricopa County, AZ: 1 published post in last 7 days");
    expect(container.textContent).toContain("Other sources unchecked. Nothing sent.");
    expect(container.textContent).toContain("2 results from checked sources");
    expect(container.textContent).toContain("See next result");
    expect(cards).toHaveLength(2);
    expect(cards[0]?.textContent).toContain("Published county post");
    expect(cards[0]?.textContent).toContain("Open matching county post");
    expect(cards[1]?.textContent).toContain("Promotional TradeDeal");
    expect(cards[1]?.textContent).toContain("Confirm when the offer ends before acting");
    expect(cards[1]?.textContent).toContain("Open promotional TradeDeal");
    expect(labels.filter((label) => label === "Open matching county post")).toHaveLength(1);
    expect(labels.filter((label) => label === "Open promotional TradeDeal")).toHaveLength(1);
    expect(html.indexOf("scout-assistant-bubble__body")).toBeLessThan(
      html.indexOf("scout-result-card")
    );
    expect(html.indexOf("scout-result-card")).toBeLessThan(html.indexOf("More detail"));
    expect(html.indexOf("More detail")).toBeLessThan(html.indexOf("Why this helps"));
  });

  it("does not turn a rejected business route into a fallback entity link", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const message: ScoutMessage = {
        id: "a_business_links",
        role: "assistant",
        content: "Two public business profiles were listed.",
        resultContract: {
          contract_version: "scout_result.v1",
          intent: "provider_search",
          ambiguity_options: [],
          entities: [
            {
              id: "reserved",
              type: "business",
              name: "Reserved path",
              url: "/business/requests",
              match_reasons: [],
            },
            {
              id: "valid",
              type: "business",
              name: "Maricopa Repair",
              url: "/business/maricopa-repair",
              match_reasons: [],
            },
          ],
          evidence: [],
          answer: "Two public business profiles were listed.",
          allowed_actions: [],
          working_memory_update: {},
        },
      };
      const html = renderThread([message]);
      const container = document.createElement("div");
      container.innerHTML = html;

      expect(container.textContent).toContain("Reserved path");
      expect(container.querySelector('a[href="/business/requests"]')).toBeNull();
      expect(container.querySelector('a[href="/business/maricopa-repair"]')?.textContent).toBe(
        "Maricopa Repair"
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps no-post recovery honest and bounds an unfamiliar recovery format", () => {
    const noPost =
      "This Scout result does not verify a county post from the last 7 days in Maricopa County, AZ. It does not verify deals, businesses, pages, tools, or other requests. Open Community or Businesses to continue; nothing was sent.";
    const recoveryMessage: ScoutMessage = {
      id: "a_no_post",
      role: "assistant",
      content: noPost,
      provenance: { sourceUsed: "scout_mixed_discovery_recovery" },
      resultContract: {
        contract_version: "scout_result.v1",
        intent: "provider_search",
        ambiguity_options: [],
        entities: [],
        evidence: [],
        answer: noPost,
        allowed_actions: [],
        working_memory_update: {},
      },
    };
    const noPostHtml = renderThread([recoveryMessage]);
    expect(noPostHtml).toContain('class="scout-assistant-bubble__badge">Scout update</span>');
    expect(noPostHtml).toContain("Maricopa County, AZ: no post verified in last 7 days;");
    expect(noPostHtml).toContain("Other sources unchecked. Nothing sent.");

    const unfamiliar =
      "Scout checked a changed recovery format and has partial information " +
      "about nearby activity, source coverage, and the next safe step. ".repeat(3) +
      "UNIQUE_TAIL";
    const unfamiliarHtml = renderThread([
      { ...recoveryMessage, id: "a_unfamiliar", content: unfamiliar },
    ]);
    expect(unfamiliarHtml).toContain("More detail");
    expect(unfamiliarHtml).not.toContain("UNIQUE_TAIL");
  });

  it.each([
    {
      name: "a successful county post and deal check with no recent matches",
      message:
        "Scout checked published county posts from the last 7 days in Maricopa County, AZ; none were returned. " +
        "It checked Scout promotions for Maricopa County, AZ; no eligible TradeDeals were returned. Other deal sources were not checked. " +
        "Businesses, pages, tools, and other requests were not checked. Nothing was sent.",
      visible: [
        "Maricopa County, AZ",
        "no published county posts returned in last 7 days",
        "no eligible Scout TradeDeals",
        "Other sources unchecked",
        "Nothing sent",
      ],
      badge: "Scout update",
    },
    {
      name: "an unavailable county post source with no posted TradeDeals",
      message:
        "Published county posts from the last 7 days in Maricopa County, AZ could not be checked right now. " +
        "It checked Scout promotions for Maricopa County, AZ; no eligible TradeDeals were returned. Other deal sources were not checked. " +
        "Businesses, pages, tools, and other requests were not checked. Nothing was sent.",
      visible: [
        "Maricopa County, AZ",
        "published county posts from last 7 days unavailable",
        "no eligible Scout TradeDeals",
        "Other sources unchecked",
        "Nothing sent",
      ],
      badge: "Scout update",
    },
    {
      name: "an unavailable post source with a posted promotion",
      message:
        "Published county posts from the last 7 days in Maricopa County, AZ could not be checked right now. " +
        "It also found 1 posted Scout TradeDeal for Maricopa County, AZ. These are promotional listings; terms and availability are not independently verified. Confirm when each offer ends before acting. " +
        "Businesses, pages, tools, and other requests were not checked. Nothing was sent.",
      visible: [
        "Maricopa County, AZ",
        "published posts from last 7 days unavailable",
        "1 TradeDeal promotion",
        "Terms/end unverified",
        "Other sources unchecked",
        "Nothing sent",
      ],
    },
    {
      name: "a county post and a posted TradeDeal",
      message:
        "This Scout result includes 1 published county post from the last 7 days in Maricopa County, AZ. " +
        "It also found 1 posted Scout TradeDeal for Maricopa County, AZ. These are promotional listings; terms and availability are not independently verified. Confirm when each offer ends before acting. " +
        "Businesses, pages, tools, and other requests were not checked. Nothing was sent.",
      visible: [
        "Maricopa County, AZ",
        "1 published post in last 7 days",
        "1 promotional TradeDeal",
        "Offer unverified; confirm end",
        "Other sources unchecked",
        "Nothing sent",
      ],
      exact:
        "Maricopa County, AZ: 1 published post in last 7 days; 1 promotional TradeDeal. Offer unverified; confirm end. Other sources unchecked. Nothing sent.",
    },
    {
      name: "a posted TradeDeal without a verified county post",
      message:
        "This Scout result does not verify a county post from the last 7 days in Maricopa County, AZ. " +
        "It also found 1 posted Scout TradeDeal for Maricopa County, AZ. These are promotional listings; terms and availability are not independently verified. Confirm when each offer ends before acting. " +
        "Businesses, pages, tools, and other requests were not checked. Nothing was sent.",
      visible: [
        "Maricopa County, AZ",
        "no post verified in last 7 days",
        "1 promotional TradeDeal",
        "Offer unverified; confirm end",
        "Other sources unchecked",
        "Nothing sent",
      ],
      exact:
        "Maricopa County, AZ: no post verified in last 7 days; 1 promotional TradeDeal. Offer unverified; confirm end. Other sources unchecked. Nothing sent.",
    },
    {
      name: "a checked Scout promotion source with no eligible deals",
      message:
        "This Scout result includes 1 published county post from the last 7 days in Maricopa County, AZ. " +
        "It checked Scout promotions for Maricopa County, AZ; no eligible TradeDeals were returned. Other deal sources were not checked. " +
        "Businesses, pages, tools, and other requests were not checked. Nothing was sent.",
      visible: [
        "Maricopa County, AZ",
        "1 published post in last 7 days",
        "no eligible Scout TradeDeals",
        "Other sources unchecked",
        "Nothing sent",
      ],
    },
    {
      name: "an unavailable Scout promotion source",
      message:
        "This Scout result includes 1 published county post from the last 7 days in Maricopa County, AZ. " +
        "Scout promotions could not be checked right now. Businesses, pages, tools, and other requests were not checked. Nothing was sent.",
      visible: [
        "Maricopa County, AZ",
        "1 published post in last 7 days",
        "Scout promotions unavailable",
        "Other sources unchecked",
        "Nothing sent",
      ],
    },
  ])("keeps the collapsed mobile truth for $name", ({ message, visible, badge, exact }) => {
    const html = renderThread([
      {
        id: "a_deal_discovery",
        role: "assistant",
        content: message,
        provenance: { sourceUsed: "scout_mixed_discovery_recovery" },
        resultContract: badge
          ? {
              contract_version: "scout_result.v1",
              intent: "provider_search",
              ambiguity_options: [],
              entities: [],
              evidence: [],
              answer: message,
              allowed_actions: [],
              working_memory_update: {},
            }
          : undefined,
      },
    ]);
    const container = document.createElement("div");
    container.innerHTML = html;
    const body = container.querySelector(".scout-assistant-bubble__body");
    const summary = body?.querySelector("p")?.textContent ?? "";

    expect(summary.length).toBeLessThanOrEqual(150);
    for (const phrase of visible) expect(summary).toContain(phrase);
    if (exact) expect(summary).toBe(exact);
    if (badge) {
      expect(html).toContain(`class="scout-assistant-bubble__badge">${badge}</span>`);
      expect(html).not.toContain('class="scout-assistant-bubble__badge">Local results</span>');
    }
    expect(container.textContent).toContain("More detail");
    expect(summary).not.toContain("This Scout result");
  });

  it("bounds a long county label and never invents one from malformed recovery text", () => {
    const longArea = `${"Long County Name ".repeat(3).trim()}, AZ`;
    const message =
      `Scout checked published county posts from the last 7 days in ${longArea}; none were returned. ` +
      `It checked Scout promotions for ${longArea}; no eligible TradeDeals were returned. ` +
      "Other deal sources were not checked. Nothing was sent.";
    const getSummary = (content: string) => {
      const container = document.createElement("div");
      container.innerHTML = renderThread([
        {
          id: "a_long_county",
          role: "assistant",
          content,
          provenance: { sourceUsed: "scout_mixed_discovery_recovery" },
        },
      ]);
      return container.querySelector(".scout-assistant-bubble__body p")?.textContent ?? "";
    };

    const longSummary = getSummary(message);
    expect(longSummary.length).toBeLessThanOrEqual(150);
    expect(longSummary).toContain("last 7 days");
    expect(longSummary).toContain("Nothing sent");

    const malformedSummary = getSummary(message.replace(longArea, "???"));
    expect(malformedSummary).toContain("your county");
    expect(malformedSummary).not.toContain("???");
    expect(malformedSummary).not.toContain("Maricopa");

    const absentSummary = getSummary(message.replace(longArea, ""));
    expect(absentSummary).toContain("your county");
    expect(absentSummary).toContain("Nothing sent");
  });

  it.each([
    {
      name: "a post, promotional TradeDeal, and public business together",
      post: "This Scout result includes 1 published county post from the last 7 days in Maricopa County, AZ.",
      deal: "It also found 1 posted Scout TradeDeal for Maricopa County, AZ. These are promotional listings; terms and availability are not independently verified. Confirm when each offer ends before acting.",
      business:
        "Scout also found 1 public business profile listed for Maricopa County, AZ. Business profiles were not filtered to this week; check current services and availability before contact.",
      expected: ["1 published post (past 7 days)", "1 Scout TradeDeal promotion", "1 public business", "Offer terms and availability aren't verified", "Businesses aren't limited to this week"],
      excluded: ["businesses were not checked", "1 business (7d)"],
    },
    {
      name: "a public business without a recent post or eligible promotion",
      post: "Scout checked published county posts from the last 7 days in Maricopa County, AZ; none were returned.",
      deal: "It checked Scout promotions for Maricopa County, AZ; no eligible TradeDeals were returned. Other deal sources were not checked.",
      business:
        "Scout also found 1 public business profile listed for Maricopa County, AZ. Business profiles were not filtered to this week; check current services and availability before contact.",
      expected: ["no published posts (past 7 days)", "1 public business", "Businesses aren't limited to this week"],
      excluded: ["businesses were not checked", "1 business (7d)"],
    },
    {
      name: "all three checked sources returning empty",
      post: "Scout checked published county posts from the last 7 days in Maricopa County, AZ; none were returned.",
      deal: "It checked Scout promotions for Maricopa County, AZ; no eligible TradeDeals were returned. Other deal sources were not checked.",
      business:
        "Scout checked public business profiles for Maricopa County, AZ; none were returned.",
      expected: ["no published posts (past 7 days)", "no eligible Scout TradeDeal promotions", "no public business profiles"],
      excluded: ["businesses were not checked", "Other sources unchecked"],
    },
    {
      name: "a public business source error",
      post: "Scout checked published county posts from the last 7 days in Maricopa County, AZ; none were returned.",
      deal: "It checked Scout promotions for Maricopa County, AZ; no eligible TradeDeals were returned. Other deal sources were not checked.",
      business: "Public business profiles for Maricopa County, AZ could not be checked right now.",
      expected: ["no published posts (past 7 days)", "public business profiles could not be checked"],
      excluded: ["businesses were not checked", "no public business profiles"],
    },
    {
      name: "an unchecked public business source",
      post: "This Scout result includes 1 published county post from the last 7 days in Maricopa County, AZ.",
      deal: "It does not verify deals.",
      business: "Businesses were not checked.",
      expected: ["1 published post (past 7 days)", "deals were not checked", "businesses were not checked"],
      excluded: ["no public business profiles"],
    },
  ])(
    "keeps $name distinct from the seven-day post scope",
    ({ post, deal, business, expected, excluded }) => {
      const answer = `${post} ${deal} ${business} Pages, tools, and other requests were not checked. Nothing was sent.`;
      const message: ScoutMessage = {
        id: "a_business_scope",
        role: "assistant",
        content: answer,
        provenance: { sourceUsed: "scout_mixed_discovery_recovery" },
        resultContract: {
          contract_version: "scout_result.v1",
          intent: "provider_search",
          ambiguity_options: [],
          entities: [],
          evidence: [],
          answer,
          allowed_actions: [],
          working_memory_update: {},
        },
      };
      const html = renderThread([message]);
      const container = document.createElement("div");
      container.innerHTML = html;
      const summary = container.querySelector(".scout-assistant-bubble__body p")?.textContent ?? "";

      expect(summary.length).toBeLessThanOrEqual(260);
      expect(summary).toContain("Maricopa County, AZ");
      expect(summary).toContain("Pages, tools and other requests weren't checked. Nothing was sent.");
      for (const phrase of expected) expect(summary).toContain(phrase);
      for (const phrase of excluded) expect(summary).not.toContain(phrase);
      expect(container.textContent).toContain("See source checks and limits");
      expect(container.textContent).toContain("Only published county posts from the past 7 days");
      expect(container.textContent).not.toContain("Why this helps");
    }
  );

  it.each([`${"Long County Name ".repeat(3).trim()}, AZ`, "Maricopa<script>, AZ"])(
    "uses a safe county fallback for a business-aware answer with area %s",
    (area) => {
      const answer =
        `This Scout result includes 1 published county post from the last 7 days in ${area}. ` +
        `It also found 1 posted Scout TradeDeal for ${area}. These are promotional listings; terms and availability are not independently verified. Confirm when each offer ends before acting. ` +
        `Scout also found 1 public business profile listed for ${area}. Business profiles were not filtered to this week; check current services and availability before contact. ` +
        "Pages, tools, and other requests were not checked. Nothing was sent.";
      const html = renderThread([
        {
          id: "a_long_business_area",
          role: "assistant",
          content: answer,
          provenance: { sourceUsed: "scout_mixed_discovery_recovery" },
          resultContract: {
            contract_version: "scout_result.v1",
            intent: "provider_search",
            ambiguity_options: [],
            entities: [],
            evidence: [],
            answer,
            allowed_actions: [],
            working_memory_update: {},
          },
        },
      ]);
      const container = document.createElement("div");
      container.innerHTML = html;
      const summary = container.querySelector(".scout-assistant-bubble__body p")?.textContent ?? "";

      expect(summary.length).toBeLessThanOrEqual(260);
      expect(summary).toContain("your county");
      expect(summary).toContain("1 public business");
      expect(summary).toContain("Nothing was sent.");
      expect(summary).not.toContain("Maricopa County");
    }
  );

  it("keeps positive post and deal summaries scoped when the county label is long or malformed", () => {
    const longArea = `${"Very Long County Name ".repeat(3).trim()}, AZ`;
    const postAndDeal =
      `This Scout result includes 1 published county post from the last 7 days in ${longArea}. ` +
      `It also found 1 posted Scout TradeDeal for ${longArea}. These are promotional listings; terms and availability are not independently verified. Confirm when each offer ends before acting. ` +
      "Businesses, pages, tools, and other requests were not checked. Nothing was sent.";
    const getSummary = (content: string) => {
      const container = document.createElement("div");
      container.innerHTML = renderThread([
        {
          id: "a_positive_long_area",
          role: "assistant",
          content,
          provenance: { sourceUsed: "scout_mixed_discovery_recovery" },
        },
      ]);
      return container.querySelector(".scout-assistant-bubble__body p")?.textContent ?? "";
    };

    const longSummary = getSummary(postAndDeal);
    expect(longSummary.length).toBeLessThanOrEqual(150);
    expect(longSummary).toContain("Very Long County Name");
    expect(longSummary).toContain("..., AZ");
    expect(longSummary).toContain("7-day");
    expect(longSummary).toContain("Offer unverified");
    expect(longSummary).toContain("Nothing sent");

    const malformedPost = getSummary(postAndDeal.replace(longArea, "???"));
    expect(malformedPost).toContain("your county");
    expect(malformedPost).not.toContain("???");
    expect(malformedPost).toContain("Offer unverified");

    const dealOnly = getSummary(
      `This Scout result does not verify a county post from the last 7 days in ???. ` +
        `It also found 1 posted Scout TradeDeal for your county. These are promotional listings; terms and availability are not independently verified. Confirm when each offer ends before acting. ` +
        "Businesses, pages, tools, and other requests were not checked. Nothing was sent."
    );
    expect(dealOnly).toContain("your county");
    expect(dealOnly).toContain("no post verified in last 7 days");
    expect(dealOnly).not.toContain("???");
  });

  it("accepts the explicit broader Community browse action after a checked-empty county result", () => {
    expect(
      validateAction({
        type: "NAVIGATE",
        label: "Browse recent Community beyond my county",
        to: "/community-feed?geo=global&feed=recent",
      })
    ).toMatchObject({ to: "/community-feed?geo=global&feed=recent" });
  });

  it("keeps the county setup action and nothing-sent truth in the collapsed answer", () => {
    const response =
      "Set your county to browse nearby posts. This Scout result does not verify county posts, deals, businesses, pages, tools, or requests. Nothing was sent.";
    const message: ScoutMessage = {
      id: "a_county_missing",
      role: "assistant",
      content: response,
      provenance: { sourceUsed: "scout_mixed_discovery_recovery" },
      resultContract: {
        contract_version: "scout_result.v1",
        intent: "provider_search",
        ambiguity_options: [],
        entities: [],
        evidence: [],
        answer: response,
        allowed_actions: [
          {
            action_id: "set_local_area",
            type: "NAVIGATE",
            label: "Set my local area",
            target: "/settings",
            primary: true,
            requires_confirmation: false,
          },
        ],
        working_memory_update: {},
      },
    };
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(
      React.createElement(ScoutThread, {
        messages: [message],
        status: "idle",
        onAction: () => undefined,
      })
    );

    const summary = container.querySelector(".scout-assistant-bubble__body p")?.textContent ?? "";
    expect(summary.length).toBeLessThanOrEqual(150);
    expect(summary).toContain("Set your county");
    expect(summary).toContain("deals, businesses, pages, tools and requests unchecked");
    expect(summary).toContain("Nothing sent");
    expect(container.textContent).toContain("More detail");
    expect(container.innerHTML).toContain(
      'class="scout-assistant-bubble__badge">Scout update</span>'
    );
    const setupAction = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Set my local area")
    );
    expect(setupAction).toBeDefined();
    expect(setupAction?.disabled).toBe(false);
  });

  it("renders one enabled promoted action while preserving distinct thread actions", () => {
    const currentPrimaryAction: ScoutAction = {
      type: "NAVIGATE",
      label: "Open local Community",
      to: "/community",
      path: "/community",
      primary: true,
    };
    const messages: ScoutMessage[] = [
      {
        id: "u_previous",
        role: "user",
        content: "Show me an earlier option.",
        timestamp: new Date().toISOString(),
      },
      {
        id: "a_previous",
        role: "assistant",
        content: "Here is the earlier result.",
        timestamp: new Date().toISOString(),
        resultContract: {
          contract_version: "scout_result.v1",
          intent: "provider_search",
          ambiguity_options: [],
          entities: [],
          evidence: [],
          answer: "Here is the earlier result.",
          allowed_actions: [
            {
              action_id: "act_previous",
              type: "NAVIGATE",
              label: "Review earlier result",
              target: "/projects",
              primary: true,
              requires_confirmation: false,
            },
          ],
          working_memory_update: {},
        },
      },
      {
        id: "u_current",
        role: "user",
        content: "What should I do now?",
        timestamp: new Date().toISOString(),
      },
      {
        id: "a_current",
        role: "assistant",
        content: "The local Community is ready to open.",
        timestamp: new Date().toISOString(),
        resultContract: {
          contract_version: "scout_result.v1",
          intent: "community_browse",
          ambiguity_options: [],
          entities: [],
          evidence: [],
          answer: "The local Community is ready to open.",
          allowed_actions: [
            {
              action_id: "act_community",
              type: "NAVIGATE",
              label: "Open local Community",
              target: "/community",
              primary: true,
              requires_confirmation: false,
            },
            {
              action_id: "act_exchange",
              type: "NAVIGATE",
              label: "Open Exchange",
              target: "/exchange",
              primary: false,
              requires_confirmation: false,
            },
          ],
          working_memory_update: {},
        },
      },
    ];
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        null,
        React.createElement(ScoutThread, {
          messages,
          status: "idle",
          currentTurnPrimaryAction: currentPrimaryAction,
          onAction: () => undefined,
        })
      )
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const enabledButtonLabels = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
    ).map((button) => button.textContent?.replace(/\s+/g, " ").trim());
    const currentMessage = container.querySelector('[data-scout-message-id="a_current"]');

    expect(enabledButtonLabels.filter((label) => label === "Open local Community")).toHaveLength(1);
    expect(enabledButtonLabels).toContain("Review earlier result");
    expect(enabledButtonLabels).toContain("Open Exchange");
    expect(currentMessage?.textContent).toContain("The local Community is ready to open.");
    expect(currentMessage?.textContent).toContain("Open local Community");
  });

  it("keeps one promoted action when a persisted system update trails the latest assistant", () => {
    const currentPrimaryAction: ScoutAction = {
      type: "NAVIGATE",
      label: "Open local Community",
      to: "/community",
      path: "/community",
      primary: true,
    };
    const messages: ScoutMessage[] = [
      {
        id: "u_before_system",
        role: "user",
        content: "What should I do next?",
        timestamp: new Date().toISOString(),
      },
      {
        id: "a_before_system",
        role: "assistant",
        content: "The local Community is ready to open.",
        timestamp: new Date().toISOString(),
        resultContract: {
          contract_version: "scout_result.v1",
          intent: "community_browse",
          ambiguity_options: [],
          entities: [],
          evidence: [],
          answer: "The local Community is ready to open.",
          allowed_actions: [
            {
              action_id: "act_community_before_system",
              type: "NAVIGATE",
              label: "Open local Community",
              target: "/community",
              primary: true,
              requires_confirmation: false,
            },
          ],
          working_memory_update: {},
        },
      },
      {
        id: "system_saved",
        role: "system",
        content: "Task saved.",
        timestamp: new Date().toISOString(),
      },
    ];
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        null,
        React.createElement(ScoutThread, {
          messages,
          status: "idle",
          currentTurnPrimaryAction: currentPrimaryAction,
          onAction: () => undefined,
        })
      )
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const enabledMatchingActions = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
    ).filter((button) => button.textContent?.trim() === "Open local Community");
    const assistantMessage = container.querySelector('[data-scout-message-id="a_before_system"]');

    expect(enabledMatchingActions).toHaveLength(1);
    expect(assistantMessage?.textContent).toContain("The local Community is ready to open.");
    expect(assistantMessage?.textContent).toContain("Open local Community");
    expect(container.textContent).toContain("Task saved.");
  });

  it("suppresses a sole promoted legacy chip without leaving an empty actions tray", () => {
    const currentPrimaryAction: ScoutAction = {
      type: "NAVIGATE",
      label: "Open Exchange",
      to: "/exchange",
      path: "/exchange",
      primary: true,
    };
    const currentMessage: ScoutMessage = {
      id: "a_legacy_chip",
      role: "assistant",
      content: "Exchange is the validated next step.",
      timestamp: new Date().toISOString(),
      frame: {
        truthLines: [],
        actionChips: [
          {
            id: "legacy-chip-primary",
            label: "Open Exchange",
            kind: "NAVIGATE",
            target: "/exchange",
            priority: "primary",
          },
        ],
      },
    };
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        null,
        React.createElement(ScoutThread, {
          messages: [
            {
              id: "u_legacy_chip",
              role: "user",
              content: "Where should I go next?",
              timestamp: new Date().toISOString(),
            },
            currentMessage,
          ],
          status: "idle",
          showControllerExtras: false,
          currentTurnPrimaryAction: currentPrimaryAction,
          onAction: () => undefined,
        })
      )
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const enabledMatchingActions = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
    ).filter((button) => button.textContent?.trim() === "Open Exchange");
    const renderedCurrentMessage = container.querySelector(
      '[data-scout-message-id="a_legacy_chip"]'
    );

    expect(enabledMatchingActions).toHaveLength(1);
    expect(renderedCurrentMessage?.textContent).toContain("Exchange is the validated next step.");
    expect(renderedCurrentMessage?.querySelector('[aria-label="Next steps"]')).toBeNull();
  });

  it("keeps legacy cluster content and distinct actions when its primary is promoted", () => {
    const currentPrimaryAction: ScoutAction = {
      type: "NAVIGATE",
      label: "Open local Community",
      to: "/community",
      path: "/community",
      primary: true,
    };
    const messages: ScoutMessage[] = [
      {
        id: "u_legacy_previous",
        role: "user",
        content: "Show the earlier result.",
        timestamp: new Date().toISOString(),
      },
      {
        id: "a_legacy_previous",
        role: "assistant",
        content: "Earlier task result.",
        timestamp: new Date().toISOString(),
        clusters: [
          {
            id: "legacy-previous-cluster",
            title: "Earlier result",
            kind: "projects",
            primaryAction: {
              type: "NAVIGATE",
              label: "Review earlier result",
              to: "/projects",
            },
          },
        ],
      },
      {
        id: "u_legacy_current",
        role: "user",
        content: "What is my current next step?",
        timestamp: new Date().toISOString(),
      },
      {
        id: "a_legacy_current",
        role: "assistant",
        content: "Your local result is ready.",
        timestamp: new Date().toISOString(),
        clusters: [
          {
            id: "legacy-current-cluster",
            title: "Local Community result",
            kind: "community",
            body: "The result record remains available here.",
            primaryAction: currentPrimaryAction,
            actions: [
              {
                type: "NAVIGATE",
                label: "Open Exchange",
                to: "/exchange",
              },
            ],
          },
        ],
      },
    ];
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        null,
        React.createElement(ScoutThread, {
          messages,
          status: "idle",
          showControllerExtras: false,
          currentTurnPrimaryAction: currentPrimaryAction,
          onAction: () => undefined,
        })
      )
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const enabledButtonLabels = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
    ).map((button) => button.textContent?.replace(/\s+/g, " ").trim());
    const currentMessage = container.querySelector('[data-scout-message-id="a_legacy_current"]');

    expect(enabledButtonLabels.filter((label) => label === "Open local Community")).toHaveLength(1);
    expect(enabledButtonLabels).toContain("Review earlier result");
    expect(enabledButtonLabels).toContain("Open Exchange");
    expect(currentMessage?.textContent).toContain("Local Community result");
    expect(currentMessage?.textContent).toContain("The result record remains available here.");
    expect(currentMessage?.textContent).toContain("Open local Community");
  });

  it("does not invent default actions for legacy local help cards", () => {
    const assistantMessage: ScoutMessage = {
      id: "a_local_help",
      role: "assistant",
      content: "Here are local help options.",
      timestamp: new Date().toISOString(),
      clusters: [
        {
          id: "pros",
          title: "Roof help nearby",
          kind: "pros",
          body: "Compare local options before contact opens.",
        },
      ],
    };

    const html = renderThread([assistantMessage], false);

    expect(html).toContain("Local help");
    expect(html).not.toContain("Create request");
    expect(html).not.toContain("Browse local help");
    expect(html).not.toContain("Choose next step");
    expect(html).not.toContain("Search with Scout");
  });

  it("summarizes long assistant answers when result cards carry the real next steps", () => {
    const assistantMessage: ScoutMessage = {
      id: "a_summary",
      role: "assistant",
      content:
        "Here is the short version. The longer explanation includes multiple paragraphs, background, tradeoffs, and context that should not dominate the default chat bubble.\n\nSecond paragraph with extra detail that should stay behind the details toggle by default.",
      timestamp: new Date().toISOString(),
      clusters: [
        {
          id: "next",
          title: "Best next step",
          kind: "rules",
          body: "Review what matters before contact.",
        },
      ],
    };

    const html = renderThread([assistantMessage]);

    expect(html).toContain("Here is the short version.");
    expect(html).toContain(">More detail<");
    expect(html).not.toContain("Second paragraph with extra detail");
    expect(html).toContain("Best next step");
  });

  it("uses a neutral loading state without inferred progress or choices", () => {
    const userMessage: ScoutMessage = {
      id: "u_collect",
      role: "user",
      content: "My AC is not cooling",
      timestamp: new Date().toISOString(),
    };

    const html = renderThread([userMessage], false, { status: "checking_documents" });

    expect(html).toContain("Scout is working");
    expect(html).toContain("Nothing will be sent, published, or changed without your approval.");
    expect(html).not.toContain("Request context");
    expect(html).not.toContain("Add location");
    expect(html).not.toContain("Add timing");
  });
});

describe("Scout task work record", () => {
  it("runs the bounded latest-turn effect on mount and rerender", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const prototype = HTMLElement.prototype;
    const scrollToDescriptor = Object.getOwnPropertyDescriptor(prototype, "scrollTo");
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(prototype, "scrollHeight");
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(prototype, "clientHeight");
    const scrollTopDescriptor = Object.getOwnPropertyDescriptor(prototype, "scrollTop");
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    let scrollTop = 0;
    const scrollTo = vi.fn((options: ScrollToOptions) => {
      scrollTop = Math.min(options.top || 0, Math.max(0, scrollHeight - 300));
    });
    let scrollHeight = 640;

    Object.defineProperty(prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    Object.defineProperty(prototype, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });
    Object.defineProperty(prototype, "clientHeight", {
      configurable: true,
      get: () => 300,
    });
    Object.defineProperty(prototype, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    const firstMessage: ScoutMessage = {
      id: "u_effect_1",
      role: "user",
      content: "Start the task.",
      timestamp: new Date().toISOString(),
    };
    const nextMessage: ScoutMessage = {
      id: "a_effect_2",
      role: "assistant",
      content: "Here is the latest result.",
      timestamp: new Date().toISOString(),
    };

    try {
      React.act(() => {
        root.render(
          React.createElement(ScoutThread, {
            messages: [firstMessage],
            status: "idle",
          })
        );
      });
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 640, behavior: "auto" });

      scrollHeight = 1280;
      React.act(() => {
        root.render(
          React.createElement(ScoutThread, {
            messages: [firstMessage, nextMessage],
            status: "idle",
          })
        );
      });
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 1280, behavior: "auto" });
      expect(scrollTo).toHaveBeenCalledTimes(2);
    } finally {
      React.act(() => root.unmount());
      container.remove();
      if (scrollToDescriptor) {
        Object.defineProperty(prototype, "scrollTo", scrollToDescriptor);
      } else {
        delete (prototype as unknown as Record<string, unknown>).scrollTo;
      }
      if (scrollHeightDescriptor) {
        Object.defineProperty(prototype, "scrollHeight", scrollHeightDescriptor);
      } else {
        delete (prototype as unknown as Record<string, unknown>).scrollHeight;
      }
      if (clientHeightDescriptor) {
        Object.defineProperty(prototype, "clientHeight", clientHeightDescriptor);
      } else {
        delete (prototype as unknown as Record<string, unknown>).clientHeight;
      }
      if (scrollTopDescriptor) {
        Object.defineProperty(prototype, "scrollTop", scrollTopDescriptor);
      } else {
        delete (prototype as unknown as Record<string, unknown>).scrollTop;
      }
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });

  it("keeps a sparse record available as an accessible internal work region", () => {
    const html = renderThread([
      {
        id: "u_sparse",
        role: "user",
        content: "Help me compare flooring options.",
        timestamp: new Date().toISOString(),
      },
    ]);

    expect(html).toContain('role="log"');
    expect(html).toContain('aria-label="Conversation and result record"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('data-scout-message-id="u_sparse"');
  });

  it("keeps the first and latest turns in a long record under one scroll owner", () => {
    const messages: ScoutMessage[] = Array.from({ length: 24 }, (_, index) => ({
      id: `turn_${index + 1}`,
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Task update ${index + 1}`,
      timestamp: new Date(2026, 7, 22, 9, index).toISOString(),
    }));

    const html = renderThread(messages);

    expect(html.match(/role="log"/g)).toHaveLength(1);
    expect(html).toContain('data-scout-message-id="turn_1"');
    expect(html).toContain('data-scout-message-id="turn_24"');
    expect(html).toContain("Task update 1");
    expect(html).toContain("Task update 24");
  });

  it("scrolls only the internal thread to its latest content", () => {
    const scrollTo = vi.fn();
    const thread = { scrollHeight: 642, scrollTo } as unknown as HTMLElement;

    scrollScoutThreadToLatest(thread, "auto");

    expect(scrollTo).toHaveBeenCalledWith({ top: 642, behavior: "auto" });
  });

  it("can preserve bounded scrolling for later updates without using page scrolling", () => {
    const scrollTo = vi.fn();
    const thread = { scrollHeight: 1280, scrollTo } as unknown as HTMLElement;

    scrollScoutThreadToLatest(thread, "smooth");

    expect(scrollTo).toHaveBeenCalledWith({ top: 1280, behavior: "smooth" });
  });

  it("aligns a new tall answer at its opening and leaves a short answer at latest", () => {
    const scrollTo = vi.fn();
    const thread = {
      clientHeight: 300,
      scrollTop: 700,
      getBoundingClientRect: () => ({ top: 100 }),
      scrollTo,
    } as unknown as HTMLElement;
    const tallMessage = {
      getBoundingClientRect: () => ({ top: 250, height: 460 }),
    } as unknown as HTMLElement;
    const shortMessage = {
      getBoundingClientRect: () => ({ top: 250, height: 180 }),
    } as unknown as HTMLElement;

    expect(scrollScoutThreadToNewAnswerStart(thread, tallMessage)).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 850, behavior: "auto" });
    scrollTo.mockClear();
    expect(scrollScoutThreadToNewAnswerStart(thread, shortMessage)).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("keeps a tall new answer's opening visible through resize without pulling a reader from history", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const prototype = HTMLElement.prototype;
    const descriptors = {
      clientHeight: Object.getOwnPropertyDescriptor(prototype, "clientHeight"),
      scrollHeight: Object.getOwnPropertyDescriptor(prototype, "scrollHeight"),
      scrollTop: Object.getOwnPropertyDescriptor(prototype, "scrollTop"),
      scrollTo: Object.getOwnPropertyDescriptor(prototype, "scrollTo"),
      getBoundingClientRect: Object.getOwnPropertyDescriptor(prototype, "getBoundingClientRect"),
    };
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    const scrollTo = vi.fn();
    let resizeCallback: ResizeObserverCallback | null = null;
    let scrollTop = 0;
    let scrollHeight = 1000;
    let clientHeight = 300;
    let mounted = false;

    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: TestResizeObserver,
    });
    Object.defineProperty(prototype, "clientHeight", {
      configurable: true,
      get: () => clientHeight,
    });
    Object.defineProperty(prototype, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });
    Object.defineProperty(prototype, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    Object.defineProperty(prototype, "scrollTo", {
      configurable: true,
      value: (options: ScrollToOptions) => {
        scrollTo(options);
        scrollTop = Math.min(options.top || 0, Math.max(0, scrollHeight - clientHeight));
      },
    });
    Object.defineProperty(prototype, "getBoundingClientRect", {
      configurable: true,
      value: function (this: HTMLElement) {
        if (this.classList.contains("scout-thread")) return { top: 100, height: clientHeight };
        if (this.getAttribute("data-scout-message-id") === "a_tall") {
          return { top: 100 + 850 - scrollTop, height: 460 };
        }
        return { top: 100, height: 40 };
      },
    });
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    const user: ScoutMessage = { id: "u_first", role: "user", content: "Find local posts." };
    const tall: ScoutMessage = { id: "a_tall", role: "assistant", content: "A long answer." };
    const later: ScoutMessage = { id: "a_later", role: "assistant", content: "A short update." };

    try {
      React.act(() => {
        root.render(React.createElement(ScoutThread, { messages: [user], status: "idle" }));
      });
      mounted = true;
      expect(scrollTop).toBe(700);

      scrollHeight = 1500;
      scrollTo.mockClear();
      React.act(() => {
        root.render(React.createElement(ScoutThread, { messages: [user, tall], status: "idle" }));
      });
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 850, behavior: "auto" });
      expect(scrollTop).toBe(850);

      scrollTo.mockClear();
      clientHeight = 250;
      React.act(() => {
        resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });
      expect(scrollTo).not.toHaveBeenCalled();
      expect(scrollTop).toBe(850);

      const thread = container.querySelector<HTMLElement>(".scout-thread");
      scrollTop = 300;
      React.act(() => {
        thread?.dispatchEvent(new Event("scroll"));
      });
      scrollTo.mockClear();
      React.act(() => {
        root.render(
          React.createElement(ScoutThread, { messages: [user, tall, later], status: "idle" })
        );
      });
      expect(scrollTo).not.toHaveBeenCalled();
      expect(scrollTop).toBe(300);
    } finally {
      if (mounted) React.act(() => root.unmount());
      container.remove();
      for (const [property, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(prototype, property, descriptor);
        else delete (prototype as unknown as Record<string, unknown>)[property];
      }
      if (resizeObserverDescriptor) {
        Object.defineProperty(globalThis, "ResizeObserver", resizeObserverDescriptor);
      } else {
        delete (globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
      }
      if (previousActEnvironment === undefined) delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      else actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    }
  });

  it("retains a near-latest viewport on resize without pulling a reader from history", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const prototype = HTMLElement.prototype;
    const descriptors = {
      clientHeight: Object.getOwnPropertyDescriptor(prototype, "clientHeight"),
      scrollHeight: Object.getOwnPropertyDescriptor(prototype, "scrollHeight"),
      scrollTop: Object.getOwnPropertyDescriptor(prototype, "scrollTop"),
      scrollTo: Object.getOwnPropertyDescriptor(prototype, "scrollTo"),
    };
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    const observe = vi.fn();
    const disconnect = vi.fn();
    const scrollTo = vi.fn();
    let resizeCallback: ResizeObserverCallback | null = null;
    let clientHeight = 300;
    const scrollHeight = 1000;
    let scrollTop = 0;
    let isMounted = false;

    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe(target: Element) {
        observe(target);
      }

      unobserve() {}

      disconnect() {
        disconnect();
      }
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: TestResizeObserver,
    });
    Object.defineProperty(prototype, "clientHeight", {
      configurable: true,
      get: () => clientHeight,
    });
    Object.defineProperty(prototype, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });
    Object.defineProperty(prototype, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    Object.defineProperty(prototype, "scrollTo", {
      configurable: true,
      value: (options: ScrollToOptions) => {
        scrollTo(options);
        const requestedTop = typeof options.top === "number" ? options.top : scrollTop;
        scrollTop = Math.min(requestedTop, Math.max(0, scrollHeight - clientHeight));
      },
    });
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      React.act(() => {
        root.render(
          React.createElement(ScoutThread, {
            messages: [
              {
                id: "u_resize_anchor",
                role: "user",
                content: "Keep the latest result visible.",
                timestamp: new Date().toISOString(),
              },
            ],
            status: "idle",
          })
        );
      });
      isMounted = true;

      const thread = container.querySelector<HTMLElement>(".scout-thread");
      expect(thread).not.toBeNull();
      expect(observe).toHaveBeenCalledWith(thread);
      expect(scrollTop).toBe(700);

      scrollTo.mockClear();
      clientHeight = 200;
      React.act(() => {
        resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 1000, behavior: "auto" });
      expect(scrollTop).toBe(800);

      scrollTo.mockClear();
      clientHeight = 400;
      React.act(() => {
        resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });
      expect(scrollTop).toBe(600);

      scrollTop = 580;
      React.act(() => {
        thread?.dispatchEvent(new Event("scroll"));
      });
      scrollTo.mockClear();
      clientHeight = 250;
      React.act(() => {
        resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });
      expect(scrollTop).toBe(750);

      scrollTop = 300;
      React.act(() => {
        thread?.dispatchEvent(new Event("scroll"));
      });
      scrollTo.mockClear();
      clientHeight = 350;
      React.act(() => {
        resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });
      expect(scrollTo).not.toHaveBeenCalled();
      expect(scrollTop).toBe(300);

      React.act(() => root.unmount());
      isMounted = false;
      expect(disconnect).toHaveBeenCalledOnce();
    } finally {
      if (isMounted) React.act(() => root.unmount());
      container.remove();
      for (const [property, descriptor] of Object.entries(descriptors)) {
        if (descriptor) {
          Object.defineProperty(prototype, property, descriptor);
        } else {
          delete (prototype as unknown as Record<string, unknown>)[property];
        }
      }
      if (resizeObserverDescriptor) {
        Object.defineProperty(globalThis, "ResizeObserver", resizeObserverDescriptor);
      } else {
        delete (globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
      }
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });
});

describe("Scout active-task auxiliary reachability", () => {
  it("cancels an armed auto-route before New resets the active task", () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    const timerRef = {
      current: window.setTimeout(navigate, 1600),
    };

    try {
      cancelScheduledScoutAutoRoute(timerRef);
      vi.advanceTimersByTime(1600);

      expect(timerRef.current).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps representative auxiliary controls in one bounded region beside a usable sparse record on short mobile", () => {
    const availableCenterHeight = 520;
    const currentTaskHeight = 270;
    const auxiliaryRegionHeight = 110;
    const workRegionFloor = 112;
    const verticalGaps = 16;
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        {
          className: "scout-active-workbench",
          "data-mobile-center-height": availableCenterHeight,
        },
        React.createElement(
          "section",
          { className: "scout-current-task", style: { height: currentTaskHeight } },
          "Current task"
        ),
        React.createElement(
          "section",
          {
            className: "scout-task-auxiliary-region",
            "data-testid": "scout-task-auxiliary-region",
            "aria-label": "Task guidance and controls",
            tabIndex: 0,
            style: {
              flex: "0 1 auto",
              minHeight: 44,
              maxHeight: auxiliaryRegionHeight,
              overflowY: "auto",
              overscrollBehavior: "contain",
            },
          },
          React.createElement(
            "div",
            {
              className: "scout-task-auxiliary-region__priority",
              "data-testid": "scout-priority-navigation",
              style: { position: "sticky", top: 0, zIndex: 2 },
            },
            React.createElement("button", { type: "button" }, "Cancel smart navigation")
          ),
          React.createElement("button", { type: "button" }, "Open launch source"),
          React.createElement("button", { type: "button" }, "Confirm onboarding"),
          React.createElement("button", { type: "button" }, "Pause objective"),
          React.createElement("button", { type: "button" }, "Open watchdog action")
        ),
        React.createElement(
          "section",
          {
            className: "scout-task-work-region",
            style: { flex: "1 1 0", minHeight: workRegionFloor, overflow: "hidden" },
          },
          React.createElement(
            "div",
            { className: "scout-task-work-region__body" },
            React.createElement(
              "div",
              {
                className: "scout-thread scout-thread--task-loop",
                role: "log",
                tabIndex: 0,
                style: { overflowY: "auto" },
              },
              React.createElement("p", null, "One saved Scout update")
            )
          )
        )
      )
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const auxiliaryRegion = container.querySelector<HTMLElement>(
      '[data-testid="scout-task-auxiliary-region"]'
    );
    const priorityAutoRoute = container.querySelector<HTMLElement>(
      '[data-testid="scout-priority-navigation"]'
    );
    const workRegion = container.querySelector<HTMLElement>(".scout-task-work-region");
    const thread = container.querySelector<HTMLElement>(".scout-thread");

    expect(
      currentTaskHeight + auxiliaryRegionHeight + workRegionFloor + verticalGaps
    ).toBeLessThanOrEqual(availableCenterHeight);
    expect(auxiliaryRegion?.getAttribute("aria-label")).toBe("Task guidance and controls");
    expect(auxiliaryRegion?.tabIndex).toBe(0);
    expect(auxiliaryRegion?.style.flex).toBe("0 1 auto");
    expect(auxiliaryRegion?.style.overflowY).toBe("auto");
    expect(auxiliaryRegion?.style.overscrollBehavior).toBe("contain");
    expect(auxiliaryRegion?.querySelectorAll("button")).toHaveLength(5);
    expect(auxiliaryRegion?.firstElementChild).toBe(priorityAutoRoute);
    expect(priorityAutoRoute?.style.position).toBe("sticky");
    expect(priorityAutoRoute?.style.top).toBe("0px");
    expect(priorityAutoRoute?.textContent).toContain("Cancel smart navigation");
    expect(
      Array.from(container.querySelectorAll("button")).every((button) =>
        auxiliaryRegion?.contains(button)
      )
    ).toBe(true);
    expect(workRegion?.style.minHeight).toBe(`${workRegionFloor}px`);
    expect(workRegion?.contains(thread)).toBe(true);
    expect(auxiliaryRegion?.contains(thread)).toBe(false);
    expect(thread?.getAttribute("role")).toBe("log");
    expect(thread?.style.overflowY).toBe("auto");
  });

  it("clears a dynamic multiline dock without taking the short-desktop record below its floor", () => {
    const measuredDockTop = 424;
    const measuredWorkRegionBottom = 441;
    const measuredOverlap = measuredWorkRegionBottom - measuredDockTop;
    const multilineInputHeight = 72;
    const defaultRecordFloor = Math.max(6 * 16, Math.min(600 * 0.2, 12 * 16));
    const constrainedRecordFloor = Math.max(5.5 * 16, Math.min(600 * 0.16, 6 * 16));
    const auxiliaryFloor = 44;
    const defaultWorkbenchTopMargin = 6;
    const compactWorkbenchTopMargin = 0;
    const defaultCurrentTaskPadding = 12;
    const compactCurrentTaskPadding = 8;
    const defaultCurrentTaskGap = 10;
    const compactCurrentTaskGap = 4;
    const reclaimedHeight =
      defaultWorkbenchTopMargin -
      compactWorkbenchTopMargin +
      (defaultCurrentTaskPadding - compactCurrentTaskPadding) * 2 +
      (defaultCurrentTaskGap - compactCurrentTaskGap);
    const constrainedFloorReclaim = defaultRecordFloor - constrainedRecordFloor;
    const textarea = document.createElement("textarea");
    textarea.className = "scout-command-bar__input";
    textarea.style.height = "120px";
    textarea.style.maxHeight = `${multilineInputHeight}px`;
    textarea.style.overflowY = "auto";
    Object.defineProperty(textarea, "clientHeight", {
      configurable: true,
      value: multilineInputHeight,
    });
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      value: 120,
    });

    expect(defaultRecordFloor).toBe(120);
    expect(constrainedRecordFloor).toBe(96);
    expect(auxiliaryFloor).toBe(44);
    expect(textarea.style.height).toBe("120px");
    expect(textarea.style.maxHeight).toBe("72px");
    expect(textarea.style.overflowY).toBe("auto");
    expect(textarea.scrollHeight).toBeGreaterThan(textarea.clientHeight);
    expect(measuredOverlap).toBe(17);
    expect(reclaimedHeight).toBe(20);
    expect(constrainedFloorReclaim).toBe(24);
    expect(
      measuredWorkRegionBottom - reclaimedHeight - constrainedFloorReclaim
    ).toBeLessThanOrEqual(measuredDockTop);

    const measuredBreakpointRectangles = [
      {
        viewport: "1440x730",
        workbenchBottom: 526,
        workBottom: 510,
        threadBottom: 509,
        dockTop: 554,
        threadClientHeight: 40,
        threadScrollHeight: 2760,
        threadScrollTop: 2720,
      },
      {
        viewport: "1440x731",
        workbenchBottom: 479,
        workBottom: 467.19,
        threadBottom: 466.19,
        dockTop: 507,
        threadClientHeight: 90,
        threadScrollHeight: 2760,
        threadScrollTop: 2670,
      },
      {
        viewport: "641x730",
        workbenchBottom: 503.61,
        workBottom: 491.61,
        threadBottom: 490.61,
        dockTop: 558,
        threadClientHeight: 40,
        threadScrollHeight: 2879,
        threadScrollTop: 2839,
      },
      {
        viewport: "641x731",
        workbenchBottom: 456.61,
        workBottom: 452.19,
        threadBottom: 451.19,
        dockTop: 511,
        threadClientHeight: 90,
        threadScrollHeight: 2879,
        threadScrollTop: 2789,
      },
    ];

    expect(measuredBreakpointRectangles.map(({ viewport }) => viewport)).toEqual([
      "1440x730",
      "1440x731",
      "641x730",
      "641x731",
    ]);
    for (const rectangle of measuredBreakpointRectangles) {
      expect(rectangle.workBottom).toBeLessThanOrEqual(rectangle.workbenchBottom);
      expect(rectangle.threadBottom).toBeLessThanOrEqual(rectangle.workbenchBottom);
      expect(rectangle.workBottom).toBeLessThanOrEqual(rectangle.dockTop);
      expect(rectangle.threadBottom).toBeLessThanOrEqual(rectangle.dockTop);
      expect(rectangle.threadScrollTop + rectangle.threadClientHeight).toBe(
        rectangle.threadScrollHeight
      );
    }
  });
});

describe("Scout short-viewport workbench evidence", () => {
  it("records active-task background containment for a non-overflowing no-aux thread", () => {
    // Captured from the real 1440x1000 no-aux page. The baseline establishes a
    // structural page range, not a trusted product-wheel escape. The source
    // contract binds the decorative-background containment rule.
    const beforeCorrection = {
      body: { clientHeight: 1000, scrollHeight: 1200 },
      root: { clientHeight: 1000, scrollHeight: 1200 },
      backgroundLayers: {
        base: [-200, 1200],
        topo: [-80, 1080],
        vignette: [-50, 1050],
      },
      log: { clientHeight: 493, scrollHeight: 493, scrollTop: 0 },
      trustedProductEscapeEstablished: false,
    };
    const corrected = {
      body: { clientHeight: 1000, scrollHeight: 1000 },
      root: { clientHeight: 1000, scrollHeight: 1000 },
      forcedBodyScrollTop: [0, 0],
      bodyScrollTop: [0, 0],
      rootScrollTop: [0, 0],
      documentScrollTop: [0, 0],
      workbenchScrollTop: [0, 0],
      columnScrollTop: [0, 0],
      logScrollTop: [0, 0],
      logRect: [303.641, 797],
      workRect: [248.25, 798],
      dockRect: [842, 934],
    };

    expect(beforeCorrection.log.clientHeight).toBe(beforeCorrection.log.scrollHeight);
    expect(beforeCorrection.body.scrollHeight).toBeGreaterThan(beforeCorrection.body.clientHeight);
    expect(beforeCorrection.root.scrollHeight).toBeGreaterThan(beforeCorrection.root.clientHeight);
    expect(beforeCorrection.backgroundLayers.base).toEqual([-200, 1200]);
    expect(beforeCorrection.trustedProductEscapeEstablished).toBe(false);
    expect(corrected.body.scrollHeight).toBe(corrected.body.clientHeight);
    expect(corrected.root.scrollHeight).toBe(corrected.root.clientHeight);
    for (const scrollPair of [
      corrected.forcedBodyScrollTop,
      corrected.bodyScrollTop,
      corrected.rootScrollTop,
      corrected.documentScrollTop,
      corrected.workbenchScrollTop,
      corrected.columnScrollTop,
      corrected.logScrollTop,
    ]) {
      expect(scrollPair).toEqual([0, 0]);
    }
    expect(corrected.logRect[1]).toBeLessThan(corrected.dockRect[0]);
    expect(corrected.workRect[1]).toBeLessThan(corrected.dockRect[0]);
  });

  it("records the exact adversarial 568x320 browser proof without treating it as a DOM simulation", () => {
    const measured = {
      viewport: { width: 568, height: 320 },
      document: { clientHeight: 320, scrollHeight: 320, scrollY: 0 },
      root: { clientHeight: 210, scrollHeight: 210, scrollTop: 0, overflowY: "hidden" },
      ownerCounts: { task: 1, primary: 1, auxiliary: 1, work: 1, log: 1, composer: 1 },
      dock: { top: 146, bottom: 258, renderedReserve: 112 },
      workbench: {
        top: 58,
        bottom: 246,
        clientHeight: 188,
        scrollHeight: 564,
        protectedHeight: 88,
        paddingBottom: 101,
        scrollPaddingBottom: 100,
      },
      keyboardPrimary: { top: 59.266, bottom: 144.141, height: 84.875, hit: true },
      endpoint: {
        work: { top: 56.953, bottom: 144.953 },
        thread: { top: 112.344, bottom: 143.953 },
      },
    };

    expect(measured.document).toEqual({ clientHeight: 320, scrollHeight: 320, scrollY: 0 });
    expect(measured.root.scrollTop).toBe(0);
    expect(measured.root.overflowY).toBe("hidden");
    expect(Object.values(measured.ownerCounts).every((count) => count === 1)).toBe(true);
    expect(measured.workbench.scrollHeight).toBeGreaterThan(measured.workbench.clientHeight);
    expect(measured.workbench.protectedHeight).toBe(measured.dock.top - measured.workbench.top);
    expect(measured.workbench.paddingBottom).toBe(measured.dock.renderedReserve - 0.75 * 16 + 1);
    expect(measured.workbench.scrollPaddingBottom).toBe(measured.dock.renderedReserve - 0.75 * 16);
    expect(measured.keyboardPrimary.top).toBeGreaterThanOrEqual(measured.workbench.top);
    expect(measured.keyboardPrimary.bottom).toBeLessThanOrEqual(measured.dock.top);
    expect(measured.keyboardPrimary.height).toBeLessThanOrEqual(measured.workbench.protectedHeight);
    expect(measured.keyboardPrimary.hit).toBe(true);
    expect(measured.endpoint.work.bottom).toBeLessThan(measured.dock.top);
    expect(measured.endpoint.thread.bottom).toBeLessThan(measured.dock.top);
  });

  it("records the short-desktop owner handoff and its 480/481 boundary from browser evidence", () => {
    // Captured with Playwright against the adversarial saved-thread fixture. These rows
    // preserve measured browser evidence; they are not a jsdom layout simulation.
    const measured = [
      {
        viewport: "768x320",
        owner: "column",
        clientHeight: 192,
        scrollHeight: 472,
        maxScrollTop: 280,
        paddingBottom: 105,
        scrollPaddingBottom: 104,
        primary: [56, 143],
        work: [55.391, 143.391],
        thread: [110.781, 142.391],
        dockTop: 144,
      },
      {
        viewport: "768x360",
        owner: "column",
        clientHeight: 232,
        scrollHeight: 481,
        maxScrollTop: 249,
        paddingBottom: 105,
        scrollPaddingBottom: 104,
        primary: [96, 183],
        work: [95.188, 183.188],
        thread: [150.578, 182.188],
        dockTop: 184,
      },
      {
        viewport: "768x361",
        owner: "column",
        clientHeight: 233,
        scrollHeight: 481,
        maxScrollTop: 248,
        paddingBottom: 105,
        scrollPaddingBottom: 104,
        primary: [97, 184],
        work: [96.406, 184.406],
        thread: [151.797, 183.406],
        dockTop: 185,
      },
      {
        viewport: "1440x480",
        owner: "column",
        clientHeight: 350,
        scrollHeight: 498,
        maxScrollTop: 148,
        paddingBottom: 105,
        scrollPaddingBottom: 104,
        primary: [149, 230],
        work: [212.594, 300.594],
        thread: [267.984, 299.594],
        dockTop: 304,
      },
      {
        viewport: "1440x481",
        owner: "workbench",
        clientHeight: 159,
        scrollHeight: 311,
        maxScrollTop: 152,
        paddingBottom: 16,
        scrollPaddingBottom: "auto",
        primary: [175, 256],
        work: [173, 261],
        thread: [228.391, 260],
        dockTop: 305,
      },
    ] as const;

    expect(measured.map(({ viewport, owner }) => ({ viewport, owner }))).toEqual([
      { viewport: "768x320", owner: "column" },
      { viewport: "768x360", owner: "column" },
      { viewport: "768x361", owner: "column" },
      { viewport: "1440x480", owner: "column" },
      { viewport: "1440x481", owner: "workbench" },
    ]);
    for (const row of measured) {
      expect(row.scrollHeight - row.clientHeight).toBe(row.maxScrollTop);
      expect(row.primary[0]).toBeLessThan(row.primary[1]);
      expect(row.primary[1]).toBeLessThan(row.dockTop);
      expect(row.work[1]).toBeLessThan(row.dockTop);
      expect(row.thread[1]).toBeLessThan(row.dockTop);
    }
  });

  it("keeps the mobile and short-desktop owner boundaries explicit", () => {
    const mobileCorrectionApplies = (width: number) => width <= 767;
    const mobileClampApplies = (width: number, height: number) =>
      mobileCorrectionApplies(width) && height <= 420;
    const shortDesktopCorrectionApplies = (width: number, height: number) =>
      width >= 768 && height <= 480;
    const shortDesktopClampApplies = shortDesktopCorrectionApplies;
    const boundaries = [
      {
        width: 640,
        height: 420,
        mobileCorrection: true,
        mobileClamp: true,
        shortDesktopCorrection: false,
        shortDesktopClamp: false,
      },
      {
        width: 641,
        height: 421,
        mobileCorrection: true,
        mobileClamp: false,
        shortDesktopCorrection: false,
        shortDesktopClamp: false,
      },
      {
        width: 767,
        height: 420,
        mobileCorrection: true,
        mobileClamp: true,
        shortDesktopCorrection: false,
        shortDesktopClamp: false,
      },
      {
        width: 768,
        height: 420,
        mobileCorrection: false,
        mobileClamp: false,
        shortDesktopCorrection: true,
        shortDesktopClamp: true,
      },
      {
        width: 1440,
        height: 480,
        mobileCorrection: false,
        mobileClamp: false,
        shortDesktopCorrection: true,
        shortDesktopClamp: true,
      },
      {
        width: 1440,
        height: 481,
        mobileCorrection: false,
        mobileClamp: false,
        shortDesktopCorrection: false,
        shortDesktopClamp: false,
      },
    ];

    expect(
      boundaries.map(({ width, height }) => ({
        width,
        height,
        mobileCorrection: mobileCorrectionApplies(width),
        mobileClamp: mobileClampApplies(width, height),
        shortDesktopCorrection: shortDesktopCorrectionApplies(width, height),
        shortDesktopClamp: shortDesktopClampApplies(width, height),
      }))
    ).toEqual(boundaries);
  });
});

describe("Scout fixed search dock reserve", () => {
  it("tracks the rendered dock height without locking it to the measured reserve", () => {
    const shell = document.createElement("div");
    shell.className = "scout-shell--active-task";
    const container = document.createElement("div");
    shell.appendChild(container);
    document.body.appendChild(shell);
    const root = createRoot(container);
    const prototype = HTMLElement.prototype;
    const rectDescriptor = Object.getOwnPropertyDescriptor(prototype, "getBoundingClientRect");
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    const observe = vi.fn();
    const disconnect = vi.fn();
    let resizeCallback: ResizeObserverCallback | null = null;
    let renderedHeight = 92;
    let isMounted = false;

    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe(target: Element) {
        observe(target);
      }

      unobserve() {}

      disconnect() {
        disconnect();
      }
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: TestResizeObserver,
    });
    Object.defineProperty(prototype, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          x: 0,
          y: 0,
          top: 0,
          right: 320,
          bottom: renderedHeight,
          left: 0,
          width: 320,
          height: renderedHeight,
          toJSON: () => ({}),
        }) as DOMRect,
    });
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      React.act(() => {
        root.render(
          React.createElement(ScoutSearchDock, {
            isMobile: false,
            placement: "fixed",
            isBusy: false,
            prefillKey: 0,
            hasMessages: true,
            quickStartPrompts: [],
            onSend: () => undefined,
            onTyping: () => undefined,
          })
        );
      });
      isMounted = true;

      const dock = container.querySelector(".scout-search-dock-fixed");
      expect(observe).toHaveBeenCalledWith(dock);
      expect(shell.style.getPropertyValue("--scout-search-dock-h")).toBe("92px");

      renderedHeight = 148.2;
      React.act(() => {
        resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });

      expect(shell.style.getPropertyValue("--scout-search-dock-h")).toBe("149px");

      renderedHeight = 92;
      React.act(() => {
        resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });
      expect(shell.style.getPropertyValue("--scout-search-dock-h")).toBe("92px");

      React.act(() => root.unmount());
      isMounted = false;
      expect(disconnect).toHaveBeenCalledOnce();
      expect(shell.style.getPropertyValue("--scout-search-dock-h")).toBe("");
    } finally {
      if (isMounted) React.act(() => root.unmount());
      shell.remove();
      if (rectDescriptor) {
        Object.defineProperty(prototype, "getBoundingClientRect", rectDescriptor);
      } else {
        delete (prototype as unknown as Record<string, unknown>).getBoundingClientRect;
      }
      if (resizeObserverDescriptor) {
        Object.defineProperty(globalThis, "ResizeObserver", resizeObserverDescriptor);
      } else {
        delete (globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
      }
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });
});

describe("Scout command bar height reset", () => {
  it("releases the auto-grown textarea height after a successful send", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    const onSend = vi.fn(() => Promise.resolve());
    let isMounted = false;
    window.localStorage.removeItem("scout:prefill:scout-main");
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      React.act(() => {
        root.render(
          React.createElement(ScoutInputRow, {
            isBusy: false,
            prefillKey: 0,
            onSend,
            onTyping: () => undefined,
            quickStartPrompts: [],
          })
        );
      });
      isMounted = true;

      const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      expect(textarea).not.toBeNull();
      expect(valueSetter).toBeTypeOf("function");
      Object.defineProperty(textarea!, "scrollHeight", {
        configurable: true,
        value: 180,
      });

      React.act(() => {
        valueSetter?.call(textarea, "A detailed request that grows the command bar");
        textarea?.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(textarea?.style.height).toBe("120px");

      const sendButton = container.querySelector<HTMLButtonElement>('[aria-label="Start search"]');
      expect(sendButton?.disabled).toBe(false);
      await React.act(async () => {
        sendButton?.click();
        await Promise.resolve();
      });

      expect(onSend).toHaveBeenCalledWith("A detailed request that grows the command bar");
      expect(textarea?.value).toBe("");
      expect(textarea?.style.height).toBe("");

      React.act(() => root.unmount());
      isMounted = false;
    } finally {
      if (isMounted) React.act(() => root.unmount());
      container.remove();
      window.localStorage.removeItem("scout:prefill:scout-main");
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });
});
