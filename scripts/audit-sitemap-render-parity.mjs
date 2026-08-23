const DEFAULT_MINIMUM_TEXT_CHARACTERS = 180;
const DEFAULT_MAX_SITEMAPS = 1_000;
const DEFAULT_MAX_URLS = 100_000;
const DEFAULT_CONCURRENCY = 8;
const CRAWLER_USER_AGENT = "Googlebot/2.1 (+http://www.google.com/bot.html)";

function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function extractLocs(xml) {
  return [...String(xml || "").matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)]
    .map((match) => decodeXml(match[1]).trim())
    .filter(Boolean);
}

function normalizeUrl(value) {
  const url = new URL(value);
  url.hash = "";
  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

function readAttribute(tag, name) {
  const match = String(tag || "").match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i")
  );
  return match ? decodeXml(match[1] ?? match[2] ?? "") : null;
}

function readCanonical(html) {
  for (const match of String(html || "").matchAll(/<link\b[^>]*>/gi)) {
    const rel = readAttribute(match[0], "rel");
    if (rel?.toLowerCase().split(/\s+/).includes("canonical")) {
      return readAttribute(match[0], "href");
    }
  }
  return null;
}

function readRobots(html) {
  for (const match of String(html || "").matchAll(/<meta\b[^>]*>/gi)) {
    if (readAttribute(match[0], "name")?.toLowerCase() === "robots") {
      return readAttribute(match[0], "content") || "";
    }
  }
  return "";
}

function hasBlockingRobotsDirective(value, directive) {
  const normalized = String(value || "").toLowerCase();
  return new RegExp(`\\b(?:${directive}|none)\\b`, "i").test(normalized);
}

function factBearingSeoRegion(html) {
  return (
    String(html || "").match(
      /<main\b(?=[^>]*\bdata-seo-[a-z0-9-]+\s*=)[^>]*>[\s\S]*?<\/main>/i
    )?.[0] || null
  );
}

function visibleTextLength(html) {
  return decodeXml(
    String(html || "")
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim().length;
}

function renderFailures(url, response, html, minimumTextCharacters) {
  const failures = [];
  if (response.status !== 200) {
    failures.push(`HTTP ${response.status}`);
    return failures;
  }

  const canonical = readCanonical(html);
  if (!canonical) {
    failures.push("missing canonical");
  } else {
    try {
      if (normalizeUrl(canonical) !== normalizeUrl(url)) {
        failures.push(`canonical mismatch (${canonical})`);
      }
    } catch {
      failures.push(`invalid canonical (${canonical})`);
    }
  }

  const robots = readRobots(html).toLowerCase();
  if (hasBlockingRobotsDirective(robots, "noindex")) {
    failures.push(`robots noindex (${robots})`);
  }
  if (hasBlockingRobotsDirective(robots, "nofollow")) {
    failures.push(`robots nofollow (${robots})`);
  }

  const xRobotsTag = response.headers?.get?.("x-robots-tag") || "";
  if (hasBlockingRobotsDirective(xRobotsTag, "noindex")) {
    failures.push(`X-Robots-Tag noindex (${xRobotsTag})`);
  }
  if (hasBlockingRobotsDirective(xRobotsTag, "nofollow")) {
    failures.push(`X-Robots-Tag nofollow (${xRobotsTag})`);
  }

  const seoRegion = factBearingSeoRegion(html);
  if (!seoRegion) {
    failures.push("missing fact-bearing data-seo main");
  }
  if (!seoRegion || !/<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(seoRegion)) {
    failures.push("missing H1");
  }
  const textLength = visibleTextLength(seoRegion || "");
  if (textLength < minimumTextCharacters) {
    failures.push(
      `thin visible text in fact-bearing region (${textLength} < ${minimumTextCharacters})`
    );
  }
  return failures;
}

async function mapConcurrent(items, concurrency, callback) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), Math.max(1, items.length)) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await callback(items[index], index);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

export async function auditSitemapRenderParity({
  sitemapUrl,
  fetchImpl = globalThis.fetch,
  minimumTextCharacters = DEFAULT_MINIMUM_TEXT_CHARACTERS,
  maxSitemaps = DEFAULT_MAX_SITEMAPS,
  maxUrls = DEFAULT_MAX_URLS,
  concurrency = DEFAULT_CONCURRENCY,
} = {}) {
  if (!sitemapUrl) throw new Error("sitemapUrl is required");
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl is required");

  const sitemapQueue = [normalizeUrl(sitemapUrl)];
  const visitedSitemaps = new Set();
  const contentOwners = new Map();
  const discoveryFailures = [];

  while (sitemapQueue.length > 0) {
    const current = sitemapQueue.shift();
    if (visitedSitemaps.has(current)) {
      discoveryFailures.push(`${current}: duplicate/cyclic sitemap reference`);
      continue;
    }
    visitedSitemaps.add(current);
    if (visitedSitemaps.size > maxSitemaps) {
      throw new Error(`sitemap safety bound exceeded (${maxSitemaps})`);
    }

    let response;
    let xml;
    try {
      response = await fetchImpl(current, {
        headers: { "user-agent": CRAWLER_USER_AGENT },
      });
      xml = await response.text();
    } catch (error) {
      discoveryFailures.push(
        `${current}: fetch failed (${error instanceof Error ? error.message : String(error)})`
      );
      continue;
    }
    if (response.status !== 200) {
      discoveryFailures.push(`${current}: HTTP ${response.status}`);
      continue;
    }

    const locs = extractLocs(xml);
    if (/<sitemapindex\b/i.test(xml)) {
      for (const loc of locs) {
        try {
          sitemapQueue.push(normalizeUrl(new URL(loc, current).toString()));
        } catch {
          discoveryFailures.push(`${current}: invalid child sitemap URL (${loc})`);
        }
      }
      continue;
    }
    if (!/<urlset\b/i.test(xml)) {
      discoveryFailures.push(`${current}: response is neither sitemapindex nor urlset`);
      continue;
    }
    for (const loc of locs) {
      let normalized;
      try {
        normalized = normalizeUrl(new URL(loc, current).toString());
      } catch {
        discoveryFailures.push(`${current}: invalid content URL (${loc})`);
        continue;
      }
      const previousOwner = contentOwners.get(normalized);
      if (previousOwner) {
        discoveryFailures.push(`${normalized}: duplicate URL in ${previousOwner} and ${current}`);
      } else {
        contentOwners.set(normalized, current);
        if (contentOwners.size > maxUrls) {
          throw new Error(`URL safety bound exceeded (${maxUrls})`);
        }
      }
    }
  }

  const contentUrls = [...contentOwners.keys()];
  const renderResults = await mapConcurrent(contentUrls, concurrency, async (url) => {
    try {
      const response = await fetchImpl(url, {
        headers: { "user-agent": CRAWLER_USER_AGENT },
        redirect: "manual",
      });
      const html = await response.text();
      return renderFailures(url, response, html, minimumTextCharacters).map(
        (failure) => `${url}: ${failure}`
      );
    } catch (error) {
      return [`${url}: fetch failed (${error instanceof Error ? error.message : String(error)})`];
    }
  });
  const failures = [...discoveryFailures, ...renderResults.flat()];

  return {
    ok: failures.length === 0,
    sitemapCount: visitedSitemaps.size,
    urlCount: contentUrls.length,
    failures,
  };
}

async function main() {
  const sitemapUrl = process.argv[2] || process.env.SITEMAP_PARITY_URL;
  if (!sitemapUrl) {
    throw new Error("Usage: node scripts/audit-sitemap-render-parity.mjs <absolute-sitemap-url>");
  }
  const result = await auditSitemapRenderParity({ sitemapUrl });
  if (!result.ok) {
    console.error(
      `FAIL sitemap_render_parity: ${result.failures.length} failure(s) across ${result.sitemapCount} sitemap(s) and ${result.urlCount} URL(s)`
    );
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `PASS sitemap_render_parity: ${result.urlCount} URL(s) across ${result.sitemapCount} sitemap(s)`
  );
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href
) {
  main().catch((error) => {
    console.error(
      `FAIL sitemap_render_parity: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  });
}
