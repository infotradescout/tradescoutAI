#!/usr/bin/env node
/**
 * Phase B-lite LIVE production crawl — TradeScout Search Index Recovery
 * READ-ONLY remote audit. Does not modify application code.
 *
 * Usage: node live-crawl.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = "https://www.thetradescout.com";
const OUT_DIR = __dirname;
const TS = new Date().toISOString().replace(/[:.]/g, "-");

const UA_BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const UA_GOOGLEBOT_SMARTPHONE =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1200;
const FETCH_TIMEOUT_MS = 25000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function routeFamily(urlPath) {
  const p = urlPath.split("?")[0] || "/";
  if (p === "/" || p === "") return "homepage";
  if (p === "/robots.txt") return "robots";
  if (/sitemap/i.test(p)) return "sitemap";
  if (p.startsWith("/u/")) return "profile_u";
  if (p.startsWith("/business/")) return "legacy_business";
  if (p.startsWith("/landing/")) return "landing";
  if (p.startsWith("/trade/")) return "trade_geo";
  if (p.startsWith("/scout")) return "scout";
  if (/direct-?connect|tradepartner|express/i.test(p)) return "direct_connect";
  if (/^\/(login|signup|sign-in|register|auth)/i.test(p)) return "auth";
  if (/^\/(dashboard|account|business-dashboard|my-tradescout|settings)/i.test(p))
    return "account_dashboard";
  if (/^\/(community|community-feed)/i.test(p)) return "community";
  if (/^\/(exchange|tradedeals)/i.test(p)) return "exchange";
  if (/search|filter|\?/i.test(urlPath) && /q=|query=|filter|category|near/i.test(urlPath))
    return "search_filter";
  return "other";
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html, nameOrProp) {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${nameOrProp}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${nameOrProp}["'][^>]*>`,
    "i"
  );
  const m = html.match(re);
  return m ? (m[1] || m[2] || "").trim() : null;
}

function linkRel(html, rel) {
  const re = new RegExp(
    `<link[^>]+rel=["']${rel}["'][^>]*href=["']([^"']+)["'][^>]*>|<link[^>]+href=["']([^"']+)["'][^>]*rel=["']${rel}["'][^>]*>`,
    "i"
  );
  const m = html.match(re);
  return m ? (m[1] || m[2] || "").trim() : null;
}

function firstTagText(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = html.match(re);
  return m ? stripTags(m[1]).slice(0, 300) : null;
}

function extractAll(html, re) {
  const out = [];
  let m;
  const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = r.exec(html)) !== null) out.push(m[1]);
  return out;
}

function uniqueBodyLen(text) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  return new Set(words).size;
}

function hasSubstantiveListings(html, text) {
  const signals = [
    /listing|contractor|supplier|business|profile|directory|results?/i.test(text),
    (html.match(/itemtype=["'][^"']*LocalBusiness/gi) || []).length > 0,
    (html.match(/class=["'][^"']*(card|listing|result|directory)[^"']*["']/gi) || []).length >= 3,
    /"@type"\s*:\s*"(LocalBusiness|Organization|Product|Service)"/i.test(html),
    (html.match(/href=["']\/u\/[^"']+["']/gi) || []).length >= 2,
  ];
  const score = signals.filter(Boolean).length;
  return { present: score >= 2, score, signals: score };
}

function jaccardPhrases(a, b, n = 5) {
  const grams = (t) => {
    const w = t.toLowerCase().split(/\s+/).filter((x) => x.length > 2);
    const s = new Set();
    for (let i = 0; i <= w.length - n; i++) s.add(w.slice(i, i + n).join(" "));
    return s;
  };
  const A = grams(a);
  const B = grams(b);
  if (!A.size || !B.size) return { jaccard: 0, shared: 0, a: A.size, b: B.size };
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return {
    jaccard: shared / (A.size + B.size - shared),
    shared,
    a: A.size,
    b: B.size,
  };
}

async function fetchFollow(url, ua, maxRedirects = 8) {
  const chain = [];
  let current = url;
  let lastRes = null;
  let body = "";
  for (let hop = 0; hop <= maxRedirects; hop++) {
    let attempt = 0;
    let res;
    while (true) {
      attempt++;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        res = await fetch(current, {
          method: "GET",
          redirect: "manual",
          headers: {
            "User-Agent": ua,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        break;
      } catch (err) {
        clearTimeout(timer);
        if (attempt >= MAX_RETRIES) {
          return {
            ok: false,
            error: String(err?.message || err),
            chain,
            finalUrl: current,
            status: null,
            headers: {},
            body: "",
          };
        }
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
    const loc = res.headers.get("location");
    chain.push({
      url: current,
      status: res.status,
      location: loc || null,
    });
    if ([301, 302, 303, 307, 308].includes(res.status) && loc) {
      current = new URL(loc, current).href;
      continue;
    }
    lastRes = res;
    body = await res.text();
    break;
  }
  const headers = {};
  if (lastRes) {
    for (const [k, v] of lastRes.headers.entries()) headers[k.toLowerCase()] = v;
  }
  return {
    ok: true,
    error: null,
    chain,
    finalUrl: current,
    status: lastRes?.status ?? null,
    headers,
    body,
  };
}

function analyzeHtml(url, family, fetchResult, sitemapUrlSet) {
  const html = fetchResult.body || "";
  const isHtml = /text\/html|application\/xhtml/i.test(
    fetchResult.headers["content-type"] || ""
  );
  const text = isHtml ? stripTags(html) : html.slice(0, 5000);
  const listing = isHtml
    ? hasSubstantiveListings(html, text)
    : { present: false, score: 0, signals: 0 };
  const title = isHtml ? firstTagText(html, "title") : null;
  const h1 = isHtml ? firstTagText(html, "h1") : null;
  const metaRobots = isHtml ? metaContent(html, "robots") : null;
  const googlebotMeta = isHtml ? metaContent(html, "googlebot") : null;
  const canonical = isHtml ? linkRel(html, "canonical") : null;
  const description = isHtml ? metaContent(html, "description") : null;
  const xRobots = fetchResult.headers["x-robots-tag"] || null;
  const pathOnly = new URL(url).pathname + (new URL(url).search || "");
  const inSitemap =
    sitemapUrlSet.has(url) ||
    sitemapUrlSet.has(url.replace(/\/$/, "")) ||
    sitemapUrlSet.has(`${ORIGIN}${pathOnly}`) ||
    sitemapUrlSet.has(`${ORIGIN}${pathOnly}`.replace(/\/$/, ""));

  // Soft-404 heuristics
  const soft404Hints = [];
  if (fetchResult.status === 200 && isHtml) {
    if (/page not found|doesn't exist|does not exist|no results|nothing found|0 results/i.test(text))
      soft404Hints.push("empty_or_not_found_copy");
    if (uniqueBodyLen(text) < 80) soft404Hints.push("very_thin_unique_words");
    if (!listing.present && family === "trade_geo") soft404Hints.push("trade_shell_no_listings");
    if (/coming soon|under construction|no businesses yet/i.test(text))
      soft404Hints.push("placeholder_copy");
  }

  return {
    url,
    routeFamily: family,
    status: fetchResult.status,
    finalUrl: fetchResult.finalUrl,
    redirectChain: fetchResult.chain,
    contentType: fetchResult.headers["content-type"] || null,
    xRobotsTag: xRobots,
    metaRobots,
    googlebotMeta,
    canonical,
    title,
    metaDescription: description ? description.slice(0, 400) : null,
    h1,
    approxUniqueBodyWords: uniqueBodyLen(text),
    approxBodyChars: text.length,
    substantiveListings: listing.present,
    listingSignalScore: listing.score,
    inSitemap,
    soft404Hints,
    error: fetchResult.error,
    sampleText: text.slice(0, 400),
  };
}

function uaDiffNotes(browser, bot) {
  const notes = [];
  const keys = [
    "status",
    "finalUrl",
    "contentType",
    "xRobotsTag",
    "metaRobots",
    "googlebotMeta",
    "canonical",
    "title",
    "h1",
    "approxUniqueBodyWords",
    "substantiveListings",
  ];
  for (const k of keys) {
    if (JSON.stringify(browser[k]) !== JSON.stringify(bot[k])) {
      notes.push(`${k}: browser=${JSON.stringify(browser[k])} | googlebot=${JSON.stringify(bot[k])}`);
    }
  }
  // redirect chain length/status
  const bChain = (browser.redirectChain || []).map((c) => c.status).join(">");
  const gChain = (bot.redirectChain || []).map((c) => c.status).join(">");
  if (bChain !== gChain) notes.push(`redirectStatuses: browser=${bChain} | googlebot=${gChain}`);
  return notes;
}

function parseSitemapLocs(xml) {
  return extractAll(xml, /<loc>\s*([^<]+)\s*<\/loc>/gi).map((u) => u.trim());
}

function sitemapPatterns(urls, limit = 12) {
  const buckets = new Map();
  for (const u of urls) {
    try {
      const p = new URL(u).pathname;
      let key = p;
      if (p.startsWith("/u/")) key = "/u/{slug}";
      else if (p.startsWith("/trade/")) {
        const parts = p.split("/").filter(Boolean);
        key = "/trade/" + parts.slice(1).map((_, i) => `{seg${i + 1}}`).join("/");
        // coarsen: /trade/{state}/{county?}/{cat?}
        if (parts.length === 2) key = "/trade/{state}";
        else if (parts.length === 3) key = "/trade/{state}/{countyOrCat}";
        else if (parts.length >= 4) key = "/trade/{state}/{county}/{category+}";
      } else if (p.startsWith("/landing/")) key = `/landing/${p.split("/")[2] || "{slug}"}`;
      else if (p.startsWith("/business/")) key = "/business/{slug}";
      buckets.set(key, (buckets.get(key) || 0) + 1);
    } catch {
      /* ignore */
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([pattern, count]) => ({ pattern, count }));
}

function discoverLinks(html, base) {
  const hrefs = extractAll(html, /href=["']([^"'#]+)["']/gi);
  const out = [];
  for (const h of hrefs) {
    try {
      const abs = new URL(h, base);
      if (abs.origin === new URL(base).origin) out.push(abs.pathname + abs.search);
    } catch {
      /* ignore */
    }
  }
  return [...new Set(out)];
}

async function dualFetch(urlPath, sitemapUrlSet) {
  const url = urlPath.startsWith("http") ? urlPath : `${ORIGIN}${urlPath}`;
  const family = routeFamily(new URL(url).pathname + new URL(url).search);
  const [bRes, gRes] = await Promise.all([
    fetchFollow(url, UA_BROWSER),
    fetchFollow(url, UA_GOOGLEBOT_SMARTPHONE),
  ]);
  const browser = analyzeHtml(url, family, bRes, sitemapUrlSet);
  const googlebot = analyzeHtml(url, family, gRes, sitemapUrlSet);
  const uaDiff = uaDiffNotes(browser, googlebot);
  return {
    url,
    routeFamily: family,
    browser,
    googlebot,
    uaDiffers: uaDiff.length > 0,
    uaDiffNotes: uaDiff,
  };
}

async function main() {
  const report = {
    phase: "B-lite LIVE production crawl",
    site: ORIGIN,
    crawledAt: new Date().toISOString(),
    disclaimer:
      "Live HTTP sample only. Does not claim Search Console indexed/excluded counts (e.g. July 9) are current. No Validate Fix requested.",
    userAgents: {
      browser: UA_BROWSER,
      googlebotSmartphone: UA_GOOGLEBOT_SMARTPHONE,
    },
    sitemap: {
      indexUrl: null,
      childSitemaps: [],
      totalUrlCount: 0,
      byChild: {},
      patterns: [],
      sampleUrls: {},
    },
    robots: null,
    discovery: {
      navLinks: [],
      homepageLinksOfInterest: [],
    },
    samples: [],
    landingVsHomepage: [],
    hypotheses: {
      noindexEvidence: [],
      thinPageEvidence: [],
      soft404Evidence: [],
      uaCloakingOrDiff: [],
    },
    nextSearchConsoleUrlSamplesNeeded: [],
    errors: [],
  };

  // --- robots.txt ---
  console.log("Fetching robots.txt...");
  const robotsRes = await fetchFollow(`${ORIGIN}/robots.txt`, UA_BROWSER);
  report.robots = {
    status: robotsRes.status,
    finalUrl: robotsRes.finalUrl,
    body: (robotsRes.body || "").slice(0, 8000),
    sitemapDirectives: (robotsRes.body || "")
      .split(/\r?\n/)
      .filter((l) => /^sitemap:/i.test(l.trim()))
      .map((l) => l.replace(/^sitemap:\s*/i, "").trim()),
  };

  // --- sitemaps ---
  const candidateIndexes = [
    ...report.robots.sitemapDirectives,
    `${ORIGIN}/sitemap-index.xml`,
    `${ORIGIN}/sitemap.xml`,
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  let indexXml = "";
  let indexUrl = null;
  for (const cand of candidateIndexes) {
    console.log("Trying sitemap:", cand);
    const r = await fetchFollow(cand, UA_BROWSER);
    if (r.status === 200 && /<urlset|<sitemapindex/i.test(r.body || "")) {
      indexUrl = r.finalUrl || cand;
      indexXml = r.body;
      break;
    }
  }
  report.sitemap.indexUrl = indexUrl;
  const sitemapUrlSet = new Set();
  const childSitemaps = [];

  if (indexXml && /<sitemapindex/i.test(indexXml)) {
    const children = parseSitemapLocs(indexXml);
    childSitemaps.push(...children);
  } else if (indexXml && /<urlset/i.test(indexXml)) {
    const locs = parseSitemapLocs(indexXml);
    locs.forEach((u) => sitemapUrlSet.add(u));
    report.sitemap.byChild[indexUrl] = locs.length;
  }

  report.sitemap.childSitemaps = childSitemaps;

  // Fetch child sitemaps (cap to avoid huge run; prefer profiles/trade/landing)
  const prioritized = [...childSitemaps].sort((a, b) => {
    const score = (u) => {
      let s = 0;
      if (/profile/i.test(u)) s += 5;
      if (/trade/i.test(u)) s += 4;
      if (/landing/i.test(u)) s += 3;
      if (/business/i.test(u)) s += 2;
      return -s;
    };
    return score(a) - score(b);
  });

  const childrenToFetch = prioritized.slice(0, 25);
  for (const child of childrenToFetch) {
    console.log("Fetching child sitemap:", child);
    const r = await fetchFollow(child, UA_BROWSER);
    if (r.status !== 200) {
      report.sitemap.byChild[child] = { error: r.status || r.error };
      continue;
    }
    const locs = parseSitemapLocs(r.body || "");
    report.sitemap.byChild[child] = locs.length;
    locs.forEach((u) => sitemapUrlSet.add(u));
    const name = child.split("/").pop() || child;
    report.sitemap.sampleUrls[name] = locs.slice(0, 8);
  }

  // If index was urlset only, samples already set
  const allSitemapUrls = [...sitemapUrlSet];
  report.sitemap.totalUrlCount = allSitemapUrls.length;
  report.sitemap.patterns = sitemapPatterns(allSitemapUrls);
  report.sitemap.fetchedChildCount = childrenToFetch.length;
  report.sitemap.listedChildCount = childSitemaps.length;

  // --- homepage discovery ---
  console.log("Fetching homepage for discovery...");
  const homeBrowser = await fetchFollow(`${ORIGIN}/`, UA_BROWSER);
  const homeLinks = discoverLinks(homeBrowser.body || "", `${ORIGIN}/`);
  report.discovery.navLinks = homeLinks.slice(0, 200);
  const interest = homeLinks.filter((p) =>
    /direct|scout|landing|trade|community|exchange|login|signup|dashboard|account|business|search|u\//i.test(
      p
    )
  );
  report.discovery.homepageLinksOfInterest = interest;

  // Discover Direct Connect path
  const dcCandidates = interest.filter((p) =>
    /direct|tradepartner|express|connect/i.test(p)
  );
  // Also scan HTML for known phrases
  const dcFromHtml = extractAll(
    homeBrowser.body || "",
    /(?:href=["'])(\/[^"']*(?:direct-connect|direct_connect|tradepartner|trade-partner)[^"']*)/gi
  );

  // Build sample URL list
  const seedPaths = new Set([
    "/",
    "/robots.txt",
    "/sitemap-index.xml",
    "/sitemap.xml",
    "/scout",
    "/landing/homeowner-hvac",
    "/landing/supplier-addition-contractor",
    "/u/does-not-exist-phase-b-lite-audit-404",
    "/login",
    "/signup",
    "/dashboard",
    "/account",
    "/business-dashboard",
    "/my-tradescout",
    "/community",
    "/community-feed",
    "/exchange",
    "/exchange/list",
    "/tradedeals",
  ]);

  for (const p of [...dcCandidates, ...dcFromHtml]) seedPaths.add(p.split("?")[0]);

  // Landing pages from sitemap / homepage
  const landingFromSitemap = allSitemapUrls
    .filter((u) => {
      try {
        return new URL(u).pathname.startsWith("/landing/");
      } catch {
        return false;
      }
    })
    .slice(0, 8);
  for (const u of landingFromSitemap) seedPaths.add(new URL(u).pathname);

  const landingFromHome = interest.filter((p) => p.startsWith("/landing/")).slice(0, 6);
  for (const p of landingFromHome) seedPaths.add(p.split("?")[0]);

  // Profiles from sitemap
  const profiles = allSitemapUrls.filter((u) => {
    try {
      return new URL(u).pathname.startsWith("/u/");
    } catch {
      return false;
    }
  });
  for (const u of profiles.slice(0, 5)) seedPaths.add(new URL(u).pathname);

  // Legacy business
  const businesses = allSitemapUrls.filter((u) => {
    try {
      return new URL(u).pathname.startsWith("/business/");
    } catch {
      return false;
    }
  });
  for (const u of businesses.slice(0, 3)) seedPaths.add(new URL(u).pathname);
  if (!businesses.length) {
    // try discovering from HTML
    const bizLinks = homeLinks.filter((p) => p.startsWith("/business/")).slice(0, 2);
    for (const p of bizLinks) seedPaths.add(p);
    seedPaths.add("/business/does-not-exist-phase-b-lite");
  }

  // Trade geo samples — diversify state/county/category
  const trades = allSitemapUrls.filter((u) => {
    try {
      return new URL(u).pathname.startsWith("/trade/");
    } catch {
      return false;
    }
  });
  const tradeByDepth = { 2: [], 3: [], 4: [] };
  for (const u of trades) {
    const parts = new URL(u).pathname.split("/").filter(Boolean);
    const d = Math.min(parts.length, 4);
    if (tradeByDepth[d] && tradeByDepth[d].length < 3) tradeByDepth[d].push(new URL(u).pathname);
  }
  for (const arr of Object.values(tradeByDepth)) for (const p of arr) seedPaths.add(p);

  // Soft-404 candidates: pick trade URLs that look sparse later; also empty-looking paths
  if (trades.length) {
    // take a few from end of list (often long-tail)
    for (const u of trades.slice(-5)) seedPaths.add(new URL(u).pathname);
  }

  // Search/filter if discoverable
  const searchLinks = [
    ...homeLinks.filter((p) => /search|q=|filter|category=/i.test(p)),
    ...extractAll(homeBrowser.body || "", /(?:href=["'])(\/[^"']*(?:\?[^"']*(?:q|query|filter|category)=)[^"']*)/gi),
  ].slice(0, 5);
  for (const p of searchLinks) seedPaths.add(p);

  // Known auth paths from discovery only
  for (const p of interest.filter((x) =>
    /login|signup|sign-in|register|dashboard|account|my-tradescout/i.test(x)
  )) {
    seedPaths.add(p.split("?")[0]);
  }

  const sampleList = [...seedPaths];
  console.log(`Sampling ${sampleList.length} URLs x 2 UAs...`);

  for (const p of sampleList) {
    process.stdout.write(`  ${p}\n`);
    try {
      const row = await dualFetch(p, sitemapUrlSet);
      report.samples.push(row);

      // Hypotheses
      for (const side of ["browser", "googlebot"]) {
        const s = row[side];
        const tag = `${side}:${s.url}`;
        if (
          /noindex/i.test(s.xRobotsTag || "") ||
          /noindex/i.test(s.metaRobots || "") ||
          /noindex/i.test(s.googlebotMeta || "")
        ) {
          report.hypotheses.noindexEvidence.push({
            url: s.url,
            ua: side,
            xRobotsTag: s.xRobotsTag,
            metaRobots: s.metaRobots,
            googlebotMeta: s.googlebotMeta,
            status: s.status,
          });
        }
        if (
          s.status === 200 &&
          (s.approxUniqueBodyWords < 100 || s.soft404Hints.length) &&
          ["trade_geo", "landing", "profile_u", "legacy_business"].includes(s.routeFamily)
        ) {
          report.hypotheses.thinPageEvidence.push({
            url: s.url,
            ua: side,
            uniqueWords: s.approxUniqueBodyWords,
            listings: s.substantiveListings,
            hints: s.soft404Hints,
            title: s.title,
            h1: s.h1,
          });
        }
        if (s.soft404Hints.length) {
          report.hypotheses.soft404Evidence.push({
            url: s.url,
            ua: side,
            status: s.status,
            hints: s.soft404Hints,
          });
        }
      }
      if (row.uaDiffers) {
        report.hypotheses.uaCloakingOrDiff.push({
          url: row.url,
          notes: row.uaDiffNotes,
        });
      }
    } catch (err) {
      report.errors.push({ url: p, error: String(err?.message || err) });
    }
    await sleep(150);
  }

  // Landing vs homepage near-duplicate
  const homeSample = report.samples.find((s) => s.routeFamily === "homepage");
  const homeText = homeSample?.browser?.sampleText
    ? stripTags(
        (
          await fetchFollow(`${ORIGIN}/`, UA_BROWSER)
        ).body || ""
      )
    : "";
  // Reuse full home text from earlier fetch
  const homeFullText = stripTags(homeBrowser.body || "");
  const landingSamples = report.samples.filter((s) => s.routeFamily === "landing");
  for (const ls of landingSamples) {
    const landRes = await fetchFollow(ls.url, UA_BROWSER);
    const landText = stripTags(landRes.body || "");
    const sim = jaccardPhrases(homeFullText, landText, 5);
    // Phrase substitution: shared bigrams of brand boilerplate
    const homeTitle = homeSample?.browser?.title;
    const landTitle = ls.browser?.title;
    report.landingVsHomepage.push({
      landingUrl: ls.url,
      jaccard5gram: Number(sim.jaccard.toFixed(4)),
      shared5grams: sim.shared,
      homeUniqueWords: uniqueBodyLen(homeFullText),
      landingUniqueWords: ls.browser?.approxUniqueBodyWords,
      homeTitle,
      landingTitle: landTitle,
      homeH1: homeSample?.browser?.h1,
      landingH1: ls.browser?.h1,
      nearDuplicateSuspect: sim.jaccard >= 0.35,
      note:
        sim.jaccard >= 0.35
          ? "High 5-gram overlap with homepage — possible template/phrase-substitution landing"
          : "Lower overlap with homepage on sampled 5-grams",
    });
  }

  // Group findings by route family
  const byFamily = {};
  for (const s of report.samples) {
    const f = s.routeFamily;
    if (!byFamily[f]) byFamily[f] = [];
    byFamily[f].push({
      url: s.url,
      statusBrowser: s.browser.status,
      statusBot: s.googlebot.status,
      xRobotsBrowser: s.browser.xRobotsTag,
      xRobotsBot: s.googlebot.xRobotsTag,
      metaRobotsBrowser: s.browser.metaRobots,
      metaRobotsBot: s.googlebot.metaRobots,
      googlebotMeta: s.googlebot.googlebotMeta,
      canonicalBrowser: s.browser.canonical,
      title: s.browser.title,
      h1: s.browser.h1,
      uniqueWords: s.browser.approxUniqueBodyWords,
      listings: s.browser.substantiveListings,
      inSitemap: s.browser.inSitemap,
      soft404Hints: s.browser.soft404Hints,
      uaDiffers: s.uaDiffers,
      uaDiffNotes: s.uaDiffNotes.slice(0, 8),
      redirectBrowser: s.browser.redirectChain?.map((c) => `${c.status}`).join(">") || "",
      redirectBot: s.googlebot.redirectChain?.map((c) => `${c.status}`).join(">") || "",
    });
  }
  report.byRouteFamily = byFamily;

  // Next GSC URL samples needed
  report.nextSearchConsoleUrlSamplesNeeded = [
    {
      need: "Excluded by 'noindex' tag — sample of affected URLs by template",
      why: "Confirm whether noindex is concentrated on /trade/*, /landing/*, /u/*, or auth shells",
      exportHint: "Coverage/Page indexing > Excluded > Excluded by ‘noindex’ tag > Export examples",
    },
    {
      need: "Crawled – currently not indexed — /trade/* long-tail samples",
      why: "Strongest soft-404/thin hypothesis for geo shells; need GSC-selected URLs not inventable from sitemap alone",
      exportHint: "Page indexing > Crawled - currently not indexed > filter path /trade/",
    },
    {
      need: "Duplicate without user-selected canonical — landing vs home",
      why: "Validate phrase-substitution landings GSC treats as duplicates of /",
      exportHint: "Page indexing > Duplicate without user-selected canonical (or Google chose different canonical)",
    },
    {
      need: "Soft 404 examples (if reason present)",
      why: "Correlate empty trade/location shells with GSC soft-404 classification",
      exportHint: "Page indexing > Soft 404",
    },
    {
      need: "Alternate page with proper canonical set — /business/* vs /u/*",
      why: "Legacy business URL fate vs published profiles",
      exportHint: "Page indexing > Alternate page with proper canonical tag",
    },
    {
      need: "Blocked by robots.txt (if any) — account/auth paths",
      why: "Separate intentional deindex of private app chrome from public directory loss",
      exportHint: "Page indexing > Blocked by robots.txt",
    },
    {
      need: "Discovered – currently not indexed — sitemap-submitted /u/* not yet crawled",
      why: "Distinguish crawl-budget/discovery lag from noindex/thin",
      exportHint: "Page indexing > Discovered - currently not indexed; filter /u/",
    },
  ];

  // Write JSON + MD
  const jsonPath = path.join(OUT_DIR, `phase-b-lite-live-${TS}.json`);
  const mdPath = path.join(OUT_DIR, `phase-b-lite-live-${TS}.md`);
  const latestJson = path.join(OUT_DIR, "phase-b-lite-live.latest.json");
  const latestMd = path.join(OUT_DIR, "phase-b-lite-live.latest.md");

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(latestJson, JSON.stringify(report, null, 2), "utf8");

  const md = renderMarkdown(report);
  await fs.writeFile(mdPath, md, "utf8");
  await fs.writeFile(latestMd, md, "utf8");

  console.log("\nWrote:", mdPath);
  console.log("Wrote:", jsonPath);
}

function renderMarkdown(r) {
  const lines = [];
  lines.push(`# Phase B-lite LIVE Production Crawl — TradeScout`);
  lines.push("");
  lines.push(`- **Site:** ${r.site}`);
  lines.push(`- **Crawled at:** ${r.crawledAt}`);
  lines.push(`- **Disclaimer:** ${r.disclaimer}`);
  lines.push("");
  lines.push(`## User-Agents`);
  lines.push("");
  lines.push(`- Browser: \`${r.userAgents.browser}\``);
  lines.push(`- Googlebot smartphone: \`${r.userAgents.googlebotSmartphone}\``);
  lines.push("");
  lines.push(`## Sitemap`);
  lines.push("");
  lines.push(`- Index: ${r.sitemap.indexUrl || "(not found)"}`);
  lines.push(`- Child sitemaps listed: ${r.sitemap.listedChildCount ?? r.sitemap.childSitemaps.length}`);
  lines.push(`- Child sitemaps fetched: ${r.sitemap.fetchedChildCount ?? "n/a"}`);
  lines.push(`- Total URLs collected (fetched children): **${r.sitemap.totalUrlCount}**`);
  lines.push("");
  lines.push(`### Child sitemap URL counts`);
  lines.push("");
  for (const [k, v] of Object.entries(r.sitemap.byChild || {})) {
    lines.push(`- \`${k}\`: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
  lines.push("");
  lines.push(`### URL patterns (sampled set)`);
  lines.push("");
  for (const p of r.sitemap.patterns || []) {
    lines.push(`- \`${p.pattern}\`: ${p.count}`);
  }
  lines.push("");
  lines.push(`### Sample URLs by child`);
  lines.push("");
  for (const [name, urls] of Object.entries(r.sitemap.sampleUrls || {})) {
    lines.push(`**${name}**`);
    for (const u of urls) lines.push(`- ${u}`);
    lines.push("");
  }
  lines.push(`## robots.txt`);
  lines.push("");
  lines.push(`- Status: ${r.robots?.status}`);
  lines.push(`- Sitemap directives: ${(r.robots?.sitemapDirectives || []).join(", ") || "(none)"}`);
  lines.push("");
  lines.push("```");
  lines.push((r.robots?.body || "").slice(0, 4000));
  lines.push("```");
  lines.push("");
  lines.push(`## Discovery (homepage)`);
  lines.push("");
  lines.push(`Interest links: ${(r.discovery.homepageLinksOfInterest || []).slice(0, 40).join(", ") || "(none)"}`);
  lines.push("");
  lines.push(`## Findings by route family`);
  lines.push("");
  for (const [family, rows] of Object.entries(r.byRouteFamily || {})) {
    lines.push(`### ${family} (${rows.length})`);
    lines.push("");
    for (const row of rows) {
      lines.push(`#### ${row.url}`);
      lines.push("");
      lines.push(`| Field | Browser | Googlebot |`);
      lines.push(`|---|---|---|`);
      lines.push(`| Status | ${row.statusBrowser} | ${row.statusBot} |`);
      lines.push(`| Redirect | ${row.redirectBrowser} | ${row.redirectBot} |`);
      lines.push(`| X-Robots-Tag | ${row.xRobotsBrowser ?? "—"} | ${row.xRobotsBot ?? "—"} |`);
      lines.push(`| meta robots | ${row.metaRobotsBrowser ?? "—"} | ${row.metaRobotsBot ?? "—"} |`);
      lines.push(`| googlebot meta | ${row.googlebotMeta ?? "—"} | (same col / see JSON) |`);
      lines.push(`| Canonical | ${row.canonicalBrowser ?? "—"} | — |`);
      lines.push(`| Title | ${esc(row.title)} | — |`);
      lines.push(`| H1 | ${esc(row.h1)} | — |`);
      lines.push(`| Unique body words (approx) | ${row.uniqueWords} | — |`);
      lines.push(`| Substantive listings? | ${row.listings} | — |`);
      lines.push(`| In sitemap? | ${row.inSitemap} | — |`);
      lines.push(`| Soft-404 hints | ${(row.soft404Hints || []).join("; ") || "—"} | — |`);
      lines.push(`| UA differs? | ${row.uaDiffers} | ${row.uaDiffNotes?.length ? row.uaDiffNotes.join("; ") : "—"} |`);
      lines.push("");
    }
  }
  lines.push(`## Landing vs homepage near-duplicate`);
  lines.push("");
  if (!(r.landingVsHomepage || []).length) {
    lines.push("_No landing samples compared._");
  } else {
    for (const d of r.landingVsHomepage) {
      lines.push(`- **${d.landingUrl}**: jaccard5=${d.jaccard5gram}, shared=${d.shared5grams}, suspect=${d.nearDuplicateSuspect} — ${d.note}`);
      lines.push(`  - titles: home="${esc(d.homeTitle)}" vs landing="${esc(d.landingTitle)}"`);
      lines.push(`  - h1: home="${esc(d.homeH1)}" vs landing="${esc(d.landingH1)}"`);
    }
  }
  lines.push("");
  lines.push(`## Strongest live evidence`);
  lines.push("");
  lines.push(`### noindex hypothesis`);
  lines.push("");
  if (!(r.hypotheses.noindexEvidence || []).length) {
    lines.push("_No noindex found on sampled URLs (X-Robots-Tag / meta robots / googlebot meta)._");
  } else {
    for (const e of r.hypotheses.noindexEvidence) {
      lines.push(
        `- ${e.ua} ${e.url} status=${e.status} x-robots=${e.xRobotsTag} meta=${e.metaRobots} googlebot=${e.googlebotMeta}`
      );
    }
  }
  lines.push("");
  lines.push(`### thin-page / soft-404 hypothesis`);
  lines.push("");
  const thin = r.hypotheses.thinPageEvidence || [];
  if (!thin.length) lines.push("_No strong thin-page signals on sampled public templates (threshold uniqueWords<100 or soft404 hints)._");
  else for (const e of thin.slice(0, 40)) {
    lines.push(
      `- ${e.ua} ${e.url} words=${e.uniqueWords} listings=${e.listings} hints=${(e.hints||[]).join(",")||"—"} title="${esc(e.title)}"`
    );
  }
  lines.push("");
  lines.push(`### UA differences (browser vs Googlebot smartphone)`);
  lines.push("");
  const diffs = r.hypotheses.uaCloakingOrDiff || [];
  if (!diffs.length) lines.push("_No material UA differences on sampled fields._");
  else for (const d of diffs.slice(0, 40)) {
    lines.push(`- ${d.url}`);
    for (const n of d.notes.slice(0, 6)) lines.push(`  - ${n}`);
  }
  lines.push("");
  lines.push(`## Exact next URL samples needed from Search Console exports`);
  lines.push("");
  for (const n of r.nextSearchConsoleUrlSamplesNeeded || []) {
    lines.push(`1. **${n.need}**`);
    lines.push(`   - Why: ${n.why}`);
    lines.push(`   - Export: ${n.exportHint}`);
  }
  lines.push("");
  lines.push(`## Repro`);
  lines.push("");
  lines.push("```bash");
  lines.push("node artifacts/evidence/phase-b-lite/live-crawl.mjs");
  lines.push("```");
  lines.push("");
  lines.push(`Errors: ${(r.errors || []).length ? JSON.stringify(r.errors) : "none"}`);
  lines.push("");
  return lines.join("\n");
}

function esc(s) {
  return String(s ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
