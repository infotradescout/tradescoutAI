import type { Express, Request, Response, NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import { formatTradeScoutTitle } from "../shared/brand";

/** Existing public informational pages only; never infer publication from a URL. */
export const PUBLIC_INFORMATION_PAGES = {
  "/about": {
    title: "About TradeScout | Connection Without Compromise",
    description: "A complete plain-language explanation of TradeScout for requesters, businesses, property owners, communities, and Exchange participants.",
    heading: "About TradeScout",
    paragraphs: [
      "TradeScout connects people who need local help with businesses and professionals. Scout helps explain the next step, while Direct Connect keeps the request and its context together.",
      "Browse public business profiles, review available work and trust information, and describe the work you need before starting a connection. Publishing a profile does not give anyone unrestricted access to your contact information.",
    ],
    links: [["/find-local-businesses", "Find local businesses"], ["/for-businesses", "TradeScout for businesses"], ["/direct-connect-info", "How Direct Connect works"], ["/trust-model", "Understand the trust model"], ["/pricing", "Platform pricing"]],
  },
  "/pricing": {
    title: "TradeScout Pricing | Free Forever",
    description: "TradeScout is free forever. No sold leads, no paid ranking, and no payment required to connect.",
    heading: "TradeScout pricing",
    paragraphs: [
      "TradeScout is free forever. Use the platform without a subscription, access tier, lead fee, or charge to connect. Payment does not buy trust, organic ranking, routing, or someone else's contact information.",
      "Sponsored offers stay labeled and separate from earned trust and organic ranking. The pricing page explains what free access includes and how TradeScout earns revenue.",
      "TradeScout does not charge to unlock features, ranking, or contact access. Treat requests for those payments in TradeScout's name as suspicious.",
    ],
    links: [["/direct-connect-info", "How free connections work"], ["/for-businesses", "Business participation"], ["/trust-model", "Trust and ranking rules"], ["/help", "Get help"]],
  },
  "/help": {
    title: "Help Center – Articles and Guides | TradeScout",
    description: "Use TradeScout Help to understand core flows, resolve blockers quickly, and move from discovery to action with Scout and Direct Connect.",
    heading: "TradeScout Help Home",
    paragraphs: [
      "Start with Scout and describe your goal in plain language when you need help finding the next step. Browse business information for context, then use Direct Connect when you are ready to start a request.",
      "The help center explains requests, contact, messaging limits, and pausing or restarting work. The trust model and platform pricing pages explain the rules before you take action.",
    ],
    links: [["/help/how-tradescout-works", "How TradeScout works"], ["/direct-connect-info", "Request-to-contact flow"], ["/find-local-businesses", "Find a business"], ["/for-businesses", "Help for businesses"], ["/trust-model", "Trust rules"], ["/pricing", "Pricing"]],
  },
  "/trust-model": {
    title: "TradeScout Trust Model | Verified Local Help and Public Trust Rules",
    description: "Learn how TradeScout uses identity and credential verification, work history, recommendations, and public trust rules to help users make safer local decisions.",
    heading: "Trust, Not Payment",
    paragraphs: [
      "Review the identity and credential information, work history, community recommendations, and dispute information available for a local professional. Consider the actual evidence on the profile rather than assuming every provider has the same credentials.",
      "Payment does not improve trust standing or move a provider ahead in organic ranking. Direct Connect uses the job and the provider's relevant information to help find an appropriate local match.",
    ],
    links: [["/find-local-businesses", "Review local business profiles"], ["/direct-connect-info", "How requests are matched"], ["/pricing", "Pricing and sponsored offers"], ["/help", "Help center"]],
  },
  "/direct-connect-info": {
    title: "Direct Connect | Request Trusted Local Help | TradeScout",
    description: "TradeScout Direct Connect helps you request local help, hear back from a small set of good-fit pros, and avoid spammy lead-generation platforms.",
    heading: "Direct Connect",
    paragraphs: [
      "Describe the work you need, your area, timing, and any budget you choose to include. Direct Connect helps route the request to a small set of local professionals who fit the job rather than broadcasting it everywhere.",
      "Providers can review the details and decide whether they can help. You choose who to talk to, with the request context kept together. Contact remains governed by the request and its acceptance flow.",
      "TradeScout does not sell leads or charge to send a request or unlock contact. The actual request tool is separate from this informational page.",
    ],
    links: [["/direct-connect", "Start a Direct Connect request"], ["/find-local-businesses", "Browse local businesses first"], ["/trust-model", "Review matching and trust rules"], ["/help", "Request help"]],
  },
} as const;

export type PublicInformationPath = keyof typeof PUBLIC_INFORMATION_PAGES;
const CANONICAL_ORIGIN = "https://www.thetradescout.com";
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
export function resolvePublicInformationPath(value: string): PublicInformationPath | null {
  const normalized = value.endsWith("/") ? value.slice(0, -1) : value;
  return Object.prototype.hasOwnProperty.call(PUBLIC_INFORMATION_PAGES, normalized) ? normalized as PublicInformationPath : null;
}
function setTag(html: string, identity: RegExp, tag: string): string {
  const without = html.replace(identity, "");
  return without.replace(/<\/head>/i, `${tag}\n</head>`);
}

/** A useful, visible first response for people and crawlers; application modules stay intact. */
export function buildPublicInformationHtml(template: string, route: PublicInformationPath): string {
  if (!Object.prototype.hasOwnProperty.call(PUBLIC_INFORMATION_PAGES, route)) throw new Error("Unapproved public information route");
  if (!/<\/head>/i.test(template) || !/<div\b[^>]*\bid=["']root["'][^>]*>\s*<\/div>/i.test(template)) throw new Error("Expected application HTML template with empty root");
  const page = PUBLIC_INFORMATION_PAGES[route];
  const title = formatTradeScoutTitle(page.title);
  const canonical = CANONICAL_ORIGIN + route;
  let html = setTag(template, /<title\b[^>]*>[\s\S]*?<\/title>/gi, `<title>${escapeHtml(title)}</title>`);
  html = setTag(html, /<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/gi, `<link rel="canonical" href="${canonical}" />`);
  for (const [attribute, name, value] of [
    ["name", "description", page.description], ["name", "robots", "index, follow, max-image-preview:large"],
    ["property", "og:title", title], ["property", "og:description", page.description], ["property", "og:url", canonical], ["property", "og:type", "website"],
    ["name", "twitter:title", title], ["name", "twitter:description", page.description],
  ]) {
    const key = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = setTag(html, new RegExp(`<meta\\b[^>]*\\b${attribute}\\s*=\\s*["']${key}["'][^>]*>`, "gi"), `<meta ${attribute}="${name}" content="${escapeHtml(value)}" />`);
  }
  const summary = `<main data-public-information-page="true" class="max-w-4xl mx-auto px-4 py-12 text-white"><nav aria-label="TradeScout"><a href="/">TradeScout</a></nav><h1>${escapeHtml(page.heading)}</h1>${page.paragraphs.map(text => `<p>${escapeHtml(text)}</p>`).join("")}<nav aria-label="Next steps">${page.links.map(([href, text]) => `<p><a href="${escapeHtml(href)}">${escapeHtml(text)}</a></p>`).join("")}</nav></main>`;
  html = html.replace(/<div\b([^>]*\bid=["']root["'][^>]*)>\s*<\/div>/i, (_match, attributes: string) => `<div${attributes}>${summary}</div>`);
  // There is now useful content even without JavaScript; remove only obsolete shell placeholders.
  html = html.replace(/\s*<div id="ts-boot-fallback"[\s\S]*?<\/section>\s*<\/div>\s*/i, "")
    .replace(/\s*<div id="ts-landing-fallback"[\s\S]*?<\/div>\s*/i, "")
    .replace(/\s*<noscript>\s*<div id="ts-boot-fallback-noscript"[\s\S]*?<\/noscript>\s*/i, "");
  const structured = JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", "@id": `${canonical}#webpage`, name: title, description: page.description, url: canonical }).replace(/</g, "\\u003c");
  return html.replace(/<\/head>/i, `<script type="application/ld+json" data-public-information-schema="true">${structured}</script>\n</head>`);
}

type Dependencies = { readTemplate: () => string };
let cachedTemplate: string | null = null;
const defaults: Dependencies = { readTemplate: () => cachedTemplate ||= fs.readFileSync(path.resolve(process.cwd(), "dist/public/index.html"), "utf8") };

/** Called before aliases/static fallback. No database access, new authority, or customer mutations. */
export function registerPublicInformationRoutes(app: Express, overrides: Partial<Dependencies> = {}): void {
  const dependencies = { ...defaults, ...overrides };
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const route = resolvePublicInformationPath(req.path);
    if (!route) return next();
    const host = String(req.headers.host || "").toLowerCase().split(":")[0];
    const approvedHosts = new Set(["www.thetradescout.com", "thetradescout.com", "localhost", "127.0.0.1", String(process.env.RENDER_EXTERNAL_HOSTNAME || "").toLowerCase()].filter(Boolean));
    if (!approvedHosts.has(host)) return next();
    if (req.path !== route) {
      const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      return res.redirect(308, route + query);
    }
    try {
      const html = buildPublicInformationHtml(dependencies.readTemplate(), route);
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      // Canonicals always point to production. Preview/local responses are not additional indexable sites.
      if (host !== "www.thetradescout.com" && host !== "thetradescout.com") res.setHeader("X-Robots-Tag", "noindex");
      return res.status(200).type("html").send(html);
    } catch (error) {
      console.error("[public-information] Rendering failed", error);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", "noindex");
      return res.status(503).type("text").send("This page could not load. Please try again.");
    }
  });
}
