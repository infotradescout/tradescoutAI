import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildPublicLandingHtml } from "../publicLandingHtml";
import { AboutExplainerContent } from "../../client/src/pages/about-explainer-content";
import { explainerChapters } from "../../client/src/pages/tradescoutExplainerData";

const templateHtml = '<!doctype html><html><head><title>TradeScout</title></head><body><div id="root"></div></body></html>';
const forbiddenPromises = [
  /contact information opens after acceptance/i,
  /contact opens only after acceptance/i,
  /contact before acceptance/i,
  /reviews a submitted request before direct contact opens/i,
  /stay protected until the requester sends and the business accepts/i,
  /review chosen requests before contact opens/i,
  /a request becomes contact only after both sides choose it/i,
  /a decline does not release private contact information/i,
  /both sides choose before contact opens/i,
  /accept or decline before private contact is released/i,
];

// A chosen recipient gets the submitted contact packet. This does not change
// private-profile visibility or the separate acceptance gate for in-app chat.
describe("public discovery explains the owner's request-contact rule", () => {
  it.each(["/", "/landing", "/lp"])("renders accurate contact facts at %s", async (requestPath) => {
    const html = await buildPublicLandingHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
      requestPath,
    });
    expect(html).toMatch(/Sending a Direct Connect request shares your name and phone number with the businesses you choose/i);
    expect(html).toMatch(/Your details are not published or sent to unrelated businesses/i);
    for (const pattern of forbiddenPromises) expect(html).not.toMatch(pattern);
    expect(html).toContain('href="https://www.thetradescout.com/"');
    expect(html).toContain("Connection Without Compromise");
  });

  it("does not put the old withholding promise in public metadata", async () => {
    const html = await buildPublicLandingHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
      requestPath: "/",
    });
    const descriptions = [...html.matchAll(/<meta[^>]*(?:name|property)="(?:description|og:description|twitter:description)"[^>]*content="([^"]*)"/g)];
    expect(descriptions.length).toBeGreaterThanOrEqual(3);
    for (const match of descriptions) {
      expect(match[1]).toContain("before you send a request");
      expect(match[1]).not.toMatch(/acceptance/i);
    }
  });

  it("keeps the requester in control and does not imply a decline reverses sharing", () => {
    const connect = explainerChapters.find((chapter) => chapter.id === "connect");
    expect(connect).toBeDefined();
    const content = JSON.stringify(connect);
    expect(content).toMatch(/name and phone number/);
    expect(content).toMatch(/selected business/);
    expect(content).toMatch(/Searching or viewing a profile does not share your contact information/);
    expect(content).toMatch(/A decline does not send the request or contact details to another business/);
    expect(content).toMatch(/Unrelated Home Vault records and private documents stay private/);
    for (const pattern of forbiddenPromises) expect(content).not.toMatch(pattern);
  });

  it("retains the existing explainer chapters and does not add a promotional section", () => {
    expect(explainerChapters.map((chapter) => chapter.id)).toEqual([
      "scout", "connect", "businesses", "property", "money", "impact", "trust", "system",
    ]);
    const content = JSON.stringify(explainerChapters);
    for (const pattern of forbiddenPromises) expect(content).not.toMatch(pattern);
  });

  it("renders the same contact rule in About without publishing private records", () => {
    const html = renderToStaticMarkup(createElement(AboutExplainerContent));
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    expect(text).toContain("Sending it shares your name and phone number with the selected business so it can respond.");
    expect(text).toContain("Searching or viewing a profile does not share your contact information.");
    expect(text).toContain("Unrelated Home Vault records and private documents stay private unless the requester chooses to include them.");
    expect(text).toContain("A decline does not send the request or contact details to another business.");
    for (const pattern of forbiddenPromises) expect(text).not.toMatch(pattern);
  });

  it("preserves the About request, messaging, business, and property action links", () => {
    const html = renderToStaticMarkup(createElement(AboutExplainerContent));
    for (const route of ["/direct-connect", "/messages", "/connections", "/claim-my-business", "/homeowner-dashboard"]) {
      expect(html).toContain(`href="https://www.thetradescout.com${route}"`);
    }
    expect(html).toContain('data-about-action-link="02.02"');
    expect(html).toContain('id="connect"');
    expect(html).toContain('id="exchange"');
    expect(html).toContain("Connection Without Compromise");
  });
});
