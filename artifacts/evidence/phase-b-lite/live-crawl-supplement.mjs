#!/usr/bin/env node
/**
 * Supplemental pass: recursively expand nested sitemaps + sample missing families.
 * Merges into phase-b-lite-live.latest.json/.md
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ORIGIN = "https://www.thetradescout.com";
const UA_BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const UA_GOOGLEBOT_SMARTPHONE =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 25000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractAll(html, re) {
  const out = [];
  let m;
  const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((m = r.exec(html)) !== null) out.push(m[1]);
  return out;
}

function parseSitemapLocs(xml) {
  return extractAll(xml, /<loc>\s*([^<]+)\s*<\/loc>/gi).map((u) => u.trim());
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
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

function uniqueBodyLen(text) {
  return new Set(text.toLowerCase().split(/\s+/).filter(Boolean)).size;
}

function hasSubstantiveListings(html, text) {
  const score = [
    /listing|contractor|supplier|business|profile|directory|results?/i.test(text),
    (html.match(/itemtype=["'][^"']*LocalBusiness/gi) || []).length > 0,
    (html.match(/class=["'][^"']*(card|listing|result|directory)[^"']*["']/gi) || []).length >= 3,
    /"@type"\s*:\s*"(LocalBusiness|Organization|Product|Service)"/i.test(html),
    (html.match(/href=["']\/u\/[^"']+["']/gi) || []).length >= 2,
  ].filter(Boolean).length;
  return { present: score >= 2, score };
}

function routeFamily(urlPath) {
  const p = urlPath.split("?")[0] || "/";
  if (p === "/" || p === "") return "homepage";
  if (p === "/robots.txt") return "robots";
  if (/sitemap/i.test(p)) return "sitemap";
  if (p.startsWith("/u/")) return "profile_u";
  if (p.startsWith("/business/")) return "legacy_business";
  if (p.startsWith("/landing")) return "landing";
  if (p.startsWith("/trade")) return "trade_geo";
  if (p.startsWith("/county/")) return "county";
  if (p.startsWith("/city/")) return "city";
  if (p.startsWith("/homescout")) return "homescout";
  if (p.startsWith("/tradepartners") || /direct-?connect/i.test(p)) return "direct_connect";
  if (p.startsWith("/scout")) return "scout";
  if (/^\/(login|signup|sign-in|register|auth)/i.test(p)) return "auth";
  if (/^\/(dashboard|account|business-dashboard|my-tradescout|settings)/i.test(p))
    return "account_dashboard";
  if (/^\/(community|community-feed)/i.test(p)) return "community";
  if (/^\/(exchange|tradedeals)/i.test(p)) return "exchange";
  if (/search|q=|filter|category=/i.test(urlPath)) return "search_filter";
  if (p.startsWith("/best/")) return "best_pages";
  if (p.startsWith("/datasets/")) return "datasets";
  return "other";
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
    chain.push({ url: current, status: res.status, location: loc || null });
    if ([301, 302, 303, 307, 308].includes(res.status) && loc) {
      current = new URL(loc, current).href;
      continue;
    }
    lastRes = res;
    body = await res.text();
    break;
  }
  const headers = {};
  if (lastRes) for (const [k, v] of lastRes.headers.entries()) headers[k.toLowerCase()] = v;
  return { ok: true, error: null, chain, finalUrl: current, status: lastRes?.status ?? null, headers, body };
}

function analyzeHtml(url, family, fetchResult, sitemapUrlSet) {
  const html = fetchResult.body || "";
  const isHtml = /text\/html|application\/xhtml/i.test(fetchResult.headers["content-type"] || "");
  const text = isHtml ? stripTags(html) : html.slice(0, 5000);
  const listing = isHtml ? hasSubstantiveListings(html, text) : { present: false, score: 0 };
  const soft404Hints = [];
  if (fetchResult.status === 200 && isHtml) {
    if (/page not found|doesn't exist|does not exist|no results|nothing found|0 results|no businesses/i.test(text))
      soft404Hints.push("empty_or_not_found_copy");
    if (uniqueBodyLen(text) < 80) soft404Hints.push("very_thin_unique_words");
    if (!listing.present && ["trade_geo", "county", "city"].includes(family))
      soft404Hints.push("directory_shell_no_listings");
    if (/coming soon|under construction|no businesses yet/i.test(text))
      soft404Hints.push("placeholder_copy");
  }
  const pathOnly = new URL(url).pathname + (new URL(url).search || "");
  const candidates = [url, url.replace(/\/$/, ""), `${ORIGIN}${pathOnly}`, `${ORIGIN}${pathOnly}`.replace(/\/$/, "")];
  const inSitemap = candidates.some((c) => sitemapUrlSet.has(c));
  return {
    url,
    routeFamily: family,
    status: fetchResult.status,
    finalUrl: fetchResult.finalUrl,
    redirectChain: fetchResult.chain,
    contentType: fetchResult.headers["content-type"] || null,
    xRobotsTag: fetchResult.headers["x-robots-tag"] || null,
    metaRobots: isHtml ? metaContent(html, "robots") : null,
    googlebotMeta: isHtml ? metaContent(html, "googlebot") : null,
    canonical: isHtml ? linkRel(html, "canonical") : null,
    title: isHtml ? firstTagText(html, "title") : null,
    metaDescription: isHtml ? (metaContent(html, "description") || "").slice(0, 400) || null : null,
    h1: isHtml ? firstTagText(html, "h1") : null,
    approxUniqueBodyWords: uniqueBodyLen(text),
    approxBodyChars: text.length,
    substantiveListings: listing.present,
    listingSignalScore: listing.score,
    inSitemap,
    soft404Hints,
    error: fetchResult.error,
    sampleText: text.slice(0, 500),
  };
}

function uaDiffNotes(browser, bot) {
  const notes = [];
  for (const k of [
    "status",
    "finalUrl",
    "xRobotsTag",
    "metaRobots",
    "googlebotMeta",
    "canonical",
    "title",
    "h1",
    "approxUniqueBodyWords",
    "substantiveListings",
  ]) {
    if (JSON.stringify(browser[k]) !== JSON.stringify(bot[k])) {
      notes.push(`${k}: browser=${JSON.stringify(browser[k])} | googlebot=${JSON.stringify(bot[k])}`);
    }
  }
  return notes;
}

function sitemapPatterns(urls, limit = 20) {
  const buckets = new Map();
  for (const u of urls) {
    try {
      const p = new URL(u).pathname;
      let key = p;
      if (p.startsWith("/u/")) key = "/u/{slug}";
      else if (p.startsWith("/business/")) key = "/business/{slug}";
      else if (p.startsWith("/trade/")) {
        const parts = p.split("/").filter(Boolean);
        if (parts.length === 2) key = "/trade/{trade}";
        else if (parts.length === 3) key = "/trade/{trade}/{state}";
        else if (parts.length >= 4) key = "/trade/{trade}/{state}/{countyOrCity+}";
      } else if (p.startsWith("/county/")) key = "/county/{state}/{county}";
      else if (p.startsWith("/city/")) key = "/city/{state}/{city}";
      else if (p.startsWith("/landing/")) key = "/landing/{slug}";
      else if (p.startsWith("/homescout/listings/")) key = "/homescout/listings/{id}";
      else if (p.startsWith("/homescout/")) key = "/homescout/{state}/{fips}";
      else if (p.startsWith("/tradepartners/")) key = "/tradepartners/{slug}";
      else if (p.startsWith("/exchange/") && p !== "/exchange/") key = "/exchange/{cat}/{id}";
      else if (p.startsWith("/best/")) key = "/best/{...}";
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

function jaccardPhrases(a, b, n = 5) {
  const grams = (t) => {
    const w = t.toLowerCase().split(/\s+/).filter((x) => x.length > 2);
    const s = new Set();
    for (let i = 0; i <= w.length - n; i++) s.add(w.slice(i, i + n).join(" "));
    return s;
  };
  const A = grams(a);
  const B = grams(b);
  if (!A.size || !B.size) return { jaccard: 0, shared: 0 };
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return { jaccard: shared / (A.size + B.size - shared), shared };
}

async function expandSitemaps(seedUrls) {
  const queue = [...seedUrls];
  const seen = new Set();
  const pageUrls = new Set();
  const byFile = {};
  let guard = 0;
  while (queue.length && guard < 80) {
    guard++;
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    console.log("Sitemap:", url);
    const r = await fetchFollow(url, UA_BROWSER);
    if (r.status !== 200) {
      byFile[url] = { error: r.status || r.error };
      continue;
    }
    const locs = parseSitemapLocs(r.body || "");
    const isIndex = /<sitemapindex/i.test(r.body || "");
    byFile[url] = { count: locs.length, isIndex };
    for (const loc of locs) {
      if (/sitemap.*\.xml/i.test(loc) || /\/sitemap-/i.test(loc)) {
        if (!seen.has(loc)) queue.push(loc);
      } else {
        pageUrls.add(loc);
      }
    }
    await sleep(80);
  }
  return { pageUrls, byFile, fetched: [...seen] };
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
    _botHtml: gRes.body || "",
    _browserHtml: bRes.body || "",
  };
}

function esc(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

async function main() {
  const latestPath = path.join(__dirname, "phase-b-lite-live.latest.json");
  const report = require(latestPath);
  report.supplementAt = new Date().toISOString();
  report.supplementNote =
    "Recursive nested sitemap expansion + additional route-family samples. Googlebot HTML used for landing near-dupe (SSR).";

  const seeds = [
    `${ORIGIN}/sitemap.xml`,
    `${ORIGIN}/sitemap-index.xml`,
    `${ORIGIN}/sitemap-profiles.xml`,
    `${ORIGIN}/sitemap-u-profiles.xml`,
    `${ORIGIN}/sitemap-business-profiles.xml`,
    `${ORIGIN}/sitemap-directory-businesses.xml`,
    `${ORIGIN}/sitemap-directory-trades.xml`,
    `${ORIGIN}/sitemap-directory-trades-0.xml`,
    `${ORIGIN}/sitemap-directory-cities.xml`,
    `${ORIGIN}/sitemap-directory-cities-0.xml`,
    `${ORIGIN}/sitemap-directory-trade-cities.xml`,
    `${ORIGIN}/sitemap-directory-trade-cities-0.xml`,
    `${ORIGIN}/sitemap-best-pages.xml`,
    `${ORIGIN}/sitemap-best-trade-counties.xml`,
    `${ORIGIN}/sitemap-best-trade-cities.xml`,
  ];

  const { pageUrls, byFile, fetched } = await expandSitemaps(seeds);
  const all = [...pageUrls];
  report.sitemap.expanded = {
    fetchedSitemapFiles: fetched.length,
    byFile,
    totalPageUrls: all.length,
    patterns: sitemapPatterns(all),
  };
  const sitemapUrlSet = new Set(all);

  // Sample buckets
  const pick = (pred, n) => all.filter(pred).slice(0, n).map((u) => new URL(u).pathname + new URL(u).search);
  const extra = new Set([
    "/landing",
    "/tradepartners/escambia-fl",
    "/trade",
    "/county/al/baldwin",
    "/county/al/mobile",
    "/direct-connect",
    "/directconnect",
    "/auth",
    "/auth/login",
    ...pick((u) => new URL(u).pathname.startsWith("/u/"), 5),
    ...pick((u) => new URL(u).pathname.startsWith("/business/"), 3),
    ...pick((u) => /^\/trade\/[^/]+\/[^/]+\/[^/]+/.test(new URL(u).pathname), 4),
    ...pick((u) => new URL(u).pathname.startsWith("/city/"), 3),
    ...pick((u) => new URL(u).pathname.startsWith("/best/"), 3),
    ...pick((u) => new URL(u).pathname.startsWith("/homescout/listings/"), 2),
    ...pick((u) => new URL(u).pathname.startsWith("/county/"), 2),
    ...pick((u) => /exchange\//.test(new URL(u).pathname) && new URL(u).pathname !== "/exchange", 1),
  ]);

  // Discover landings / search / DC from /landing and /trade Googlebot HTML
  for (const probe of ["/landing", "/trade", "/"]) {
    const r = await fetchFollow(`${ORIGIN}${probe}`, UA_GOOGLEBOT_SMARTPHONE);
    const hrefs = extractAll(r.body || "", /href=["']([^"'#]+)["']/gi);
    for (const h of hrefs) {
      try {
        const abs = new URL(h, ORIGIN);
        if (abs.origin !== ORIGIN) continue;
        const p = abs.pathname + abs.search;
        if (/^\/landing\//i.test(p)) extra.add(p.split("?")[0]);
        if (/direct|tradepartner/i.test(p)) extra.add(p.split("?")[0]);
        if (/[?&](q|query|filter|category|near)=/i.test(p)) extra.add(p);
        if (/\/search/i.test(p)) extra.add(p.split("?")[0]);
      } catch {
        /* ignore */
      }
    }
  }

  // Avoid re-sampling exact URLs already in report
  const already = new Set(report.samples.map((s) => s.url));
  const toSample = [...extra].filter((p) => !already.has(p.startsWith("http") ? p : `${ORIGIN}${p}`));

  console.log(`Supplemental samples: ${toSample.length}`);
  const newSamples = [];
  for (const p of toSample) {
    console.log(" ", p);
    try {
      const row = await dualFetch(p, sitemapUrlSet);
      // strip heavy html before persist
      const persist = { ...row };
      delete persist._botHtml;
      delete persist._browserHtml;
      newSamples.push(persist);
      report.samples.push(persist);

      for (const side of ["browser", "googlebot"]) {
        const s = row[side];
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
          ["trade_geo", "landing", "profile_u", "legacy_business", "county", "city", "best_pages"].includes(
            s.routeFamily
          )
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
        report.hypotheses.uaCloakingOrDiff.push({ url: row.url, notes: row.uaDiffNotes });
      }
    } catch (err) {
      report.errors.push({ url: p, error: String(err?.message || err) });
    }
    await sleep(120);
  }

  // Recompute landing vs homepage using Googlebot SSR bodies
  const homeBot = await fetchFollow(`${ORIGIN}/`, UA_GOOGLEBOT_SMARTPHONE);
  const homeText = stripTags(homeBot.body || "");
  const landingUrls = [
    ...new Set(
      report.samples.filter((s) => s.routeFamily === "landing").map((s) => s.url)
    ),
  ];
  report.landingVsHomepage = [];
  for (const lu of landingUrls) {
    const landBot = await fetchFollow(lu, UA_GOOGLEBOT_SMARTPHONE);
    const landText = stripTags(landBot.body || "");
    const sim = jaccardPhrases(homeText, landText, 5);
    const landH1 = firstTagText(landBot.body || "", "h1");
    const homeH1 = firstTagText(homeBot.body || "", "h1");
    const landTitle = firstTagText(landBot.body || "", "title");
    const homeTitle = firstTagText(homeBot.body || "", "title");
    // Phrase substitution: same H1 or very high overlap with only title slug differing
    const sameH1 = !!(homeH1 && landH1 && homeH1 === landH1);
    report.landingVsHomepage.push({
      landingUrl: lu,
      jaccard5gram: Number(sim.jaccard.toFixed(4)),
      shared5grams: sim.shared,
      homeUniqueWords: uniqueBodyLen(homeText),
      landingUniqueWords: uniqueBodyLen(landText),
      homeTitle,
      landingTitle: landTitle,
      homeH1,
      landingH1: landH1,
      sameH1AsHomepage: sameH1,
      nearDuplicateSuspect: sim.jaccard >= 0.35 || sameH1,
      note: sameH1
        ? "Googlebot SSR: identical H1 to homepage — phrase/title substitution landing"
        : sim.jaccard >= 0.35
          ? "High 5-gram overlap with homepage (Googlebot SSR)"
          : "Lower overlap with homepage on Googlebot SSR 5-grams",
    });
  }

  // Rebuild byRouteFamily
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
      canonicalBot: s.googlebot.canonical,
      title: s.googlebot.title || s.browser.title,
      h1: s.googlebot.h1 || s.browser.h1,
      uniqueWordsBrowser: s.browser.approxUniqueBodyWords,
      uniqueWordsBot: s.googlebot.approxUniqueBodyWords,
      listingsBot: s.googlebot.substantiveListings,
      inSitemap: s.browser.inSitemap || s.googlebot.inSitemap,
      soft404HintsBot: s.googlebot.soft404Hints,
      uaDiffers: s.uaDiffers,
      uaDiffNotes: (s.uaDiffNotes || []).slice(0, 8),
      redirectBrowser: s.browser.redirectChain?.map((c) => `${c.status}`).join(">") || "",
      redirectBot: s.googlebot.redirectChain?.map((c) => `${c.status}`).join(">") || "",
    });
  }
  report.byRouteFamily = byFamily;
  report.sitemap.totalUrlCountExpanded = all.length;
  report.sitemap.patternsExpanded = sitemapPatterns(all);

  // Strengthen GSC asks with concrete path examples from live sitemap
  const uSamples = all.filter((u) => new URL(u).pathname.startsWith("/u/")).slice(0, 5);
  const bizSamples = all.filter((u) => new URL(u).pathname.startsWith("/business/")).slice(0, 5);
  const tradeDeep = all.filter((u) => /^\/trade\/[^/]+\/[^/]+\/[^/]+/.test(new URL(u).pathname)).slice(0, 5);
  report.liveSitemapExamples = { profiles_u: uSamples, business: bizSamples, tradeDeep };

  const TS = new Date().toISOString().replace(/[:.]/g, "-");
  const md = renderMarkdown(report);
  await fs.writeFile(path.join(__dirname, "phase-b-lite-live.latest.json"), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(__dirname, "phase-b-lite-live.latest.md"), md);
  await fs.writeFile(path.join(__dirname, `phase-b-lite-live-supplement-${TS}.json`), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(__dirname, `phase-b-lite-live-supplement-${TS}.md`), md);
  console.log("Updated latest report. New samples:", newSamples.length, "Expanded page URLs:", all.length);
}

function renderMarkdown(r) {
  const lines = [];
  lines.push(`# Phase B-lite LIVE Production Crawl — TradeScout`);
  lines.push("");
  lines.push(`- **Site:** ${r.site}`);
  lines.push(`- **Crawled at:** ${r.crawledAt}`);
  lines.push(`- **Supplement at:** ${r.supplementAt || "n/a"}`);
  lines.push(`- **Disclaimer:** ${r.disclaimer}`);
  lines.push("");
  lines.push(`## Executive verdict (live HTTP only)`);
  lines.push("");
  lines.push(
    `- **noindex on public templates sampled:** mostly absent. Sampled published surfaces use \`index, follow\`. Exception: missing \`/u/*\` returns **404 + meta robots=noindex,follow** (correct).`
  );
  lines.push(
    `- **Thin / soft-404 hypothesis (stronger):** Googlebot-rendered \`/trade/*\` shells are still thin (~76–132 unique words) with weak listing signals; many county shells need review. Browser UA often sees SPA chrome only (~21–29 words) while Googlebot gets SSR HTML — compare **googlebot** columns for indexability.`
  );
  lines.push(
    `- **Near-duplicate landings (strong):** Googlebot SSR landings share homepage H1 and high 5-gram overlap; titles look phrase-substituted. Homepage canonical points to \`/landing\`.`
  );
  lines.push(
    `- **robots.txt:** Disallows \`/scout/\`, \`/dashboard/\`, \`/auth/\`, \`/api/\`, \`/admin/\`, etc. Public directory paths are Allow'd.`
  );
  lines.push("");
  lines.push(`## User-Agents`);
  lines.push("");
  lines.push(`- Browser: \`${r.userAgents.browser}\``);
  lines.push(`- Googlebot smartphone: \`${r.userAgents.googlebotSmartphone}\``);
  lines.push("");
  lines.push(`## Sitemap`);
  lines.push("");
  lines.push(`- Index: ${r.sitemap.indexUrl || "(not found)"}`);
  lines.push(`- First-pass child counts (index level): see prior byChild`);
  lines.push(`- **Expanded page URLs (recursive):** **${r.sitemap.totalUrlCountExpanded ?? r.sitemap.expanded?.totalPageUrls ?? "n/a"}**`);
  lines.push("");
  lines.push(`### Expanded patterns`);
  lines.push("");
  for (const p of r.sitemap.patternsExpanded || r.sitemap.expanded?.patterns || []) {
    lines.push(`- \`${p.pattern}\`: ${p.count}`);
  }
  lines.push("");
  if (r.sitemap.expanded?.byFile) {
    lines.push(`### Sitemap files fetched (recursive)`);
    lines.push("");
    for (const [k, v] of Object.entries(r.sitemap.expanded.byFile)) {
      lines.push(`- \`${k}\`: ${JSON.stringify(v)}`);
    }
    lines.push("");
  }
  lines.push(`### Live sitemap examples`);
  lines.push("");
  lines.push(`- /u/*: ${(r.liveSitemapExamples?.profiles_u || []).join(", ") || "(none found)"}`);
  lines.push(`- /business/*: ${(r.liveSitemapExamples?.business || []).join(", ") || "(none found)"}`);
  lines.push(`- deep /trade/*: ${(r.liveSitemapExamples?.tradeDeep || []).join(", ") || "(none found)"}`);
  lines.push("");
  lines.push(`## robots.txt (summary)`);
  lines.push("");
  lines.push(`- Status: ${r.robots?.status}`);
  lines.push(`- Sitemap directives: ${(r.robots?.sitemapDirectives || []).join(", ")}`);
  lines.push(`- Notable Disallow: /api/, /admin/, /dashboard/, /settings/, /messages/, /scout/, /auth/`);
  lines.push(`- Notable Allow: /u/, /business/, /trade/, /county/, /city/, /exchange/, /homescout/, /tradepartners/`);
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
      lines.push(`| googlebot meta | — | ${row.googlebotMeta ?? "—"} |`);
      lines.push(`| Canonical | ${row.canonicalBrowser ?? "—"} | ${row.canonicalBot ?? "—"} |`);
      lines.push(`| Title | ${esc(row.title)} | (prefer bot) |`);
      lines.push(`| H1 | ${esc(row.h1)} | (prefer bot) |`);
      lines.push(`| Unique body words | ${row.uniqueWordsBrowser ?? row.uniqueWords} | ${row.uniqueWordsBot ?? "—"} |`);
      lines.push(`| Substantive listings (bot) | — | ${row.listingsBot ?? row.listings} |`);
      lines.push(`| In sitemap? | ${row.inSitemap} | — |`);
      lines.push(`| Soft-404 hints (bot) | — | ${(row.soft404HintsBot || row.soft404Hints || []).join("; ") || "—"} |`);
      lines.push(`| UA differs? | ${row.uaDiffers} | ${(row.uaDiffNotes || []).slice(0, 4).join("; ") || "—"} |`);
      lines.push("");
    }
  }
  lines.push(`## Landing vs homepage near-duplicate (Googlebot SSR)`);
  lines.push("");
  for (const d of r.landingVsHomepage || []) {
    lines.push(
      `- **${d.landingUrl}**: jaccard5=${d.jaccard5gram}, shared=${d.shared5grams}, sameH1=${d.sameH1AsHomepage}, suspect=${d.nearDuplicateSuspect} — ${d.note}`
    );
    lines.push(`  - titles: home="${esc(d.homeTitle)}" vs landing="${esc(d.landingTitle)}"`);
    lines.push(`  - h1: home="${esc(d.homeH1)}" vs landing="${esc(d.landingH1)}"`);
    lines.push(`  - unique words: home=${d.homeUniqueWords} landing=${d.landingUniqueWords}`);
  }
  lines.push("");
  lines.push(`## Strongest live evidence`);
  lines.push("");
  lines.push(`### noindex hypothesis`);
  lines.push("");
  const noidx = r.hypotheses.noindexEvidence || [];
  if (!noidx.length) lines.push("_None on sampled URLs._");
  else {
    const uniq = new Map();
    for (const e of noidx) uniq.set(`${e.url}|${e.metaRobots}|${e.status}`, e);
    for (const e of uniq.values()) {
      lines.push(
        `- ${e.url} status=${e.status} meta=${e.metaRobots} x-robots=${e.xRobotsTag} (${e.ua})`
      );
    }
  }
  lines.push("");
  lines.push(`### thin-page / soft-404 hypothesis (Googlebot-weighted)`);
  lines.push("");
  const thinBot = (r.hypotheses.thinPageEvidence || []).filter((e) => e.ua === "googlebot");
  if (!thinBot.length) lines.push("_No googlebot thin signals under thresholds._");
  else
    for (const e of thinBot.slice(0, 50)) {
      lines.push(
        `- ${e.url} words=${e.uniqueWords} listings=${e.listings} hints=${(e.hints || []).join(",") || "—"} h1="${esc(e.h1)}" title="${esc(e.title)}"`
      );
    }
  lines.push("");
  lines.push(`### UA differences (material)`);
  lines.push("");
  lines.push(
    `_Pattern:_ On SSR public marketing/directory routes, browser UA often receives thin SPA shell; Googlebot smartphone receives fuller HTML (h1 + body). Not claimed as malicious cloaking — treat as bot SSR / dynamic rendering. Indexability judgments must use Googlebot column._`
  );
  lines.push("");
  lines.push(`## Exact next URL samples needed from Search Console exports`);
  lines.push("");
  for (const n of r.nextSearchConsoleUrlSamplesNeeded || []) {
    lines.push(`1. **${n.need}**`);
    lines.push(`   - Why: ${n.why}`);
    lines.push(`   - Export: ${n.exportHint}`);
  }
  lines.push("");
  lines.push(`Also pull example URLs matching these live sitemap shapes if GSC reasons cite them:`);
  lines.push(`- ${(r.liveSitemapExamples?.profiles_u || []).slice(0, 3).join(", ") || "/u/{slug}"}`);
  lines.push(`- ${(r.liveSitemapExamples?.business || []).slice(0, 3).join(", ") || "/business/{slug}"}`);
  lines.push(`- ${(r.liveSitemapExamples?.tradeDeep || []).slice(0, 3).join(", ") || "/trade/{trade}/{state}/..."}`);
  lines.push(`- /county/{st}/{county}, /landing/*, /tradepartners/*`);
  lines.push("");
  lines.push(`## Repro`);
  lines.push("");
  lines.push("```bash");
  lines.push("node artifacts/evidence/phase-b-lite/live-crawl.mjs");
  lines.push("node artifacts/evidence/phase-b-lite/live-crawl-supplement.mjs");
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
