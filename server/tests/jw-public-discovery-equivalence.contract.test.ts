import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPublicJwStoneMarketplaceHtml,
  JW_STONE_MARKETPLACE_PLATFORM_URL,
} from "../publicJwStoneMarketplaceHtml";
import { preparePublicSeoHtmlForUserAgent } from "../publicSeoHtml";

const templateHtml = fs.readFileSync(path.resolve(process.cwd(), "client/index.html"), "utf8");

const USER_AGENTS = {
  browser:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  oaiSearchBot:
    "Mozilla/5.0 AppleWebKit/537.36 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
  gptBot: "Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.2; +https://openai.com/gptbot)",
  chatGptUser:
    "Mozilla/5.0 AppleWebKit/537.36 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
} as const;

function extractCanonical(html: string): string | null {
  const match = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i);
  return match?.[1] || null;
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractH1(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match?.[1]?.replace(/<[^>]+>/g, "").trim() || null;
}

/** Normalized public fact set — compare across UAs instead of raw hashes. */
function extractPublicFactSet(html: string) {
  const jsonLd = extractJsonLd(html);
  return {
    canonical: extractCanonical(html),
    h1: extractH1(html),
    hasJwMarker: /data-seo-jw-stone-marketplace/i.test(html),
    hasBusinessIdentity: /JW Stone/i.test(html),
    hasInventoryCue: /Current Inventory|stone collection|Browse the full JW Stone collection/i.test(
      html
    ),
    hasContactCue: /ask JW Stone|ask about a material|Start a Request|Contact/i.test(html),
    hasManagedPhone: /\(850\) 543-0748/.test(html),
    hasManagedEmail: /contact@thetradescout\.com/i.test(html),
    hasPrivateOwnerEmail: /wagner@jwstonellc\.com/i.test(html),
    hasEmptyRootOnly:
      /<div id="root">\s*<\/div>/i.test(html) && !/data-seo-jw-stone-marketplace/i.test(html),
    hasJsRequiredOnlyBody:
      /JavaScript is required/i.test(html) && !/data-seo-jw-stone-marketplace/i.test(html),
    jsonLdType: jsonLd?.["@type"] ?? null,
    jsonLdName: jsonLd?.name ?? null,
    jsonLdUrl: jsonLd?.url ?? null,
    hasPrivateFields: /homeId|serialNumber|vault|privateStreet|directConnectPhone/i.test(html),
    hasBotOnlyClaimMarkers: /bot-only|crawler-exclusive|GPTBot caused/i.test(html),
  };
}

describe("JW Stone public discovery equivalence (Phase 3A)", () => {
  const rawHtml = buildPublicJwStoneMarketplaceHtml({
    templateHtml,
    origin: "https://www.thetradescout.com",
    collectionUrl: JW_STONE_MARKETPLACE_PLATFORM_URL,
  });

  it.each([
    ["generic browser", USER_AGENTS.browser],
    ["OAI-SearchBot", USER_AGENTS.oaiSearchBot],
    ["GPTBot", USER_AGENTS.gptBot],
    ["ChatGPT-User", USER_AGENTS.chatGptUser],
  ] as const)("%s receives fact-bearing initial HTML with shared public facts", (_label, ua) => {
    const html = preparePublicSeoHtmlForUserAgent(rawHtml, ua);
    const facts = extractPublicFactSet(html);

    expect(facts.canonical).toBe("https://www.thetradescout.com/jw-stone");
    expect(facts.h1).toBe("Natural stone, selected at the source.");
    expect(facts.hasJwMarker).toBe(true);
    expect(facts.hasBusinessIdentity).toBe(true);
    expect(facts.hasInventoryCue).toBe(true);
    expect(facts.hasContactCue).toBe(true);
    expect(facts.hasManagedPhone).toBe(true);
    expect(facts.hasManagedEmail).toBe(true);
    expect(facts.hasPrivateOwnerEmail).toBe(false);
    expect(facts.hasEmptyRootOnly).toBe(false);
    expect(facts.hasJsRequiredOnlyBody).toBe(false);
    expect(facts.jsonLdType).toBe("CollectionPage");
    expect(facts.jsonLdName).toBe("JW Stone | Stone Discovery");
    expect(facts.jsonLdUrl).toBe("https://www.thetradescout.com/jw-stone");
    expect(facts.hasPrivateFields).toBe(false);
    expect(facts.hasBotOnlyClaimMarkers).toBe(false);
  });

  it("keeps material public facts identical across the four UA categories", () => {
    const sets = Object.values(USER_AGENTS).map((ua) =>
      extractPublicFactSet(preparePublicSeoHtmlForUserAgent(rawHtml, ua))
    );
    const [first, ...rest] = sets;
    for (const next of rest) {
      expect(next).toEqual(first);
    }
  });

  it("does not invent availability, price, or exclusivity claims in any UA response", () => {
    for (const ua of Object.values(USER_AGENTS)) {
      const html = preparePublicSeoHtmlForUserAgent(rawHtml, ua);
      expect(html).not.toMatch(/\$\d|price on request|exclusive inventory|guaranteed in stock/i);
      expect(html).not.toMatch(/Call for availability/i);
    }
  });

  it("preserves client module boot for browser UA and strips it for crawler UAs", () => {
    const withModule = rawHtml.includes('type="module"')
      ? rawHtml
      : rawHtml.replace(
          "</body>",
          '<script type="module" crossorigin src="/assets/index-test.js"></script></body>'
        );

    const browserHtml = preparePublicSeoHtmlForUserAgent(withModule, USER_AGENTS.browser);
    const botHtml = preparePublicSeoHtmlForUserAgent(withModule, USER_AGENTS.gptBot);

    expect(browserHtml).toMatch(/type=["']module["']/i);
    expect(botHtml).not.toMatch(/type=["']module["'][^>]*src=/i);
    expect(browserHtml).toContain("clip:rect(0,0,0,0)");
    expect(botHtml).not.toContain("clip:rect(0,0,0,0)");
  });
});
