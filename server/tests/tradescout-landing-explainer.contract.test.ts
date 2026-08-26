import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TradeScoutLandingPage from "../../client/src/pages/TradeScoutLandingPage";
import { explainerChapters } from "../../client/src/pages/tradescoutExplainerData";
import { buildPublicLandingHtml } from "../publicLandingHtml";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("TradeScout plain-language landing explainer", () => {
  const landingSource = read("client/src/pages/TradeScoutLandingPage.tsx");
  const landingStyles = read("client/src/pages/TradeScoutLandingPage.css");
  const fallbackSource = read("server/publicLandingHtml.ts");

  it("keeps the eight canonical explainer chapters in order", () => {
    expect(explainerChapters.map((chapter) => chapter.navLabel)).toEqual([
      "Scout",
      "Requests & contact",
      "Business home",
      "Home & property",
      "Money",
      "Community",
      "CVS",
      "Every feature",
    ]);
  });

  it("keeps the full feature inventory and named TradeScout differentiators", () => {
    const features = explainerChapters.flatMap((chapter) =>
      chapter.topics.flatMap((topic) => topic.features || [])
    );

    expect(features).toHaveLength(68);
    const featureNames = features.map((feature) => feature.name);
    expect(featureNames).toEqual(
      expect.arrayContaining([
        "Direct Connect",
        "Community Verification Score (CVS)",
        "Emergency directory",
        "Custom domain",
        "Selective Inheritance",
      ])
    );
    expect(featureNames).not.toContain("Social publishing and external auto-sharing");
  });

  it("renders the complete explainer without tabs, hidden panels, or collapsed feature copy", () => {
    const renderedHtml = renderToStaticMarkup(React.createElement(TradeScoutLandingPage));
    const topicCount = explainerChapters.reduce(
      (total, chapter) => total + chapter.topics.length,
      0
    );

    expect(renderedHtml.match(/class="ts-explainer-chapter"/g)).toHaveLength(8);
    expect(renderedHtml.match(/class="ts-topic-section"/g)).toHaveLength(topicCount);
    expect(renderedHtml.match(/class="ts-feature-card"/g)).toHaveLength(68);

    for (const chapter of explainerChapters) {
      expect(renderedHtml).toContain(chapter.title);
      for (const topic of chapter.topics) {
        expect(renderedHtml).toContain(topic.label);
      }
    }

    expect(renderedHtml).not.toContain('role="tab"');
    expect(renderedHtml).not.toContain('hidden=""');
    expect(renderedHtml).not.toContain("<details");
    expect(landingSource).not.toContain("useState");
    expect(landingSource).toContain('window.addEventListener("hashchange", scrollToCurrentAnchor)');
    expect(landingSource).toContain('window.addEventListener("popstate", scrollToCurrentAnchor)');
    expect(landingSource).toContain("event.preventDefault()");
    expect(landingSource).toContain('window.history.pushState(null, "", nextHash)');
    expect(landingSource).toContain('document.getElementById("root")');
    expect(landingSource).toContain('document.getElementById("top")');
    expect(landingSource).toContain('surface.style.scrollBehavior = "auto"');
    expect(landingSource).toContain('scrollIntoView({ block: "start", behavior: "auto" })');
    expect(landingSource).toContain("scrollRoot.scrollTop = Math.max(0, nextScrollTop)");
    expect(landingSource).not.toContain("iframe");
    expect(landingSource).not.toContain("mrplatypus4777.chatgpt.site");
  });

  it("keeps the header home link and footer back-to-top link unambiguous", () => {
    expect(landingSource).toContain('aria-label={backToTop ? "Back to top" : "TradeScout home"}');
  });

  it("lets the hero shrink and stacks its actions so mobile calls to action never clip", () => {
    expect(landingStyles).toMatch(
      /\.ts-hero-copy\s*\{[^}]*\bwidth:\s*100%;[^}]*\bmin-width:\s*0;[^}]*\}/
    );
    expect(landingStyles).toMatch(
      /\.ts-hero-actions\s*\{[^}]*\bwidth:\s*100%;[^}]*\bflex-direction:\s*column;[^}]*\}/
    );
  });

  it("keeps pricing in the approved reveal order", () => {
    const madeYouLook = landingSource.indexOf("Made you look.");
    const freeForever = landingSource.indexOf("TradeScout is free forever.");
    const revenueLink = landingSource.indexOf("See how we earn revenue here");

    expect(madeYouLook).toBeGreaterThan(-1);
    expect(freeForever).toBeGreaterThan(madeYouLook);
    expect(revenueLink).toBeGreaterThan(freeForever);
  });

  it("gives crawlers the same eight-part story and Selective Inheritance definition", () => {
    for (const hash of [
      "#scout",
      "#connect",
      "#businesses",
      "#property",
      "#money",
      "#impact",
      "#trust",
      "#system",
    ]) {
      expect(fallbackSource).toContain(`/${hash}`);
    }
    expect(fallbackSource).toContain("Selective Inheritance");
    expect(fallbackSource).toContain("useful, provable information from an outside source");
  });

  it("gives crawlers the same complete chapter, topic, and feature inventory", async () => {
    const html = await buildPublicLandingHtml({
      origin: "https://www.thetradescout.com",
      requestPath: "/landing",
      templateHtml:
        '<!doctype html><html><head><title>TradeScout</title></head><body><div id="root"></div></body></html>',
    });
    const topicCount = explainerChapters.reduce(
      (total, chapter) => total + chapter.topics.length,
      0
    );

    expect(html.match(/data-explainer-chapter="true"/g)).toHaveLength(8);
    expect(html.match(/data-explainer-topic="true"/g)).toHaveLength(topicCount);
    expect(html.match(/data-explainer-feature="true"/g)).toHaveLength(68);

    for (const chapter of explainerChapters) {
      expect(html).toContain(chapter.title);
      for (const topic of chapter.topics) {
        expect(html).toContain(topic.label);
      }
    }
  });
});
