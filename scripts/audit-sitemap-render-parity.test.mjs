import assert from "node:assert/strict";
import test from "node:test";

import { auditSitemapRenderParity } from "./audit-sitemap-render-parity.mjs";

function response(body, status = 200, contentType = "text/html", headers = {}) {
  return new Response(body, {
    status,
    headers: { "content-type": contentType, ...headers },
  });
}

function substantiveHtml(
  url,
  text = "Source-backed local business facts and verified public directory details. ".repeat(5)
) {
  return `<!doctype html><html><head><link href="${url}" rel="canonical"><meta content="index,follow" name="robots"></head><body><main data-seo-business="true"><h1>Public directory record</h1><p>${text}</p></main></body></html>`;
}

test("recursively proves each unique advertised URL is canonical, indexable, and substantive", async () => {
  const responses = new Map([
    [
      "https://example.test/sitemap.xml",
      response(
        `<sitemapindex><sitemap><loc>https://example.test/sitemap-core.xml</loc></sitemap><sitemap><loc>https://example.test/sitemap-business.xml</loc></sitemap></sitemapindex>`,
        200,
        "application/xml"
      ),
    ],
    [
      "https://example.test/sitemap-core.xml",
      response(
        `<urlset><url><loc>https://example.test/</loc></url></urlset>`,
        200,
        "application/xml"
      ),
    ],
    [
      "https://example.test/sitemap-business.xml",
      response(
        `<urlset><url><loc>https://example.test/business/alpha</loc></url></urlset>`,
        200,
        "application/xml"
      ),
    ],
    ["https://example.test/", response(substantiveHtml("https://example.test/"))],
    [
      "https://example.test/business/alpha",
      response(substantiveHtml("https://example.test/business/alpha")),
    ],
  ]);

  const result = await auditSitemapRenderParity({
    sitemapUrl: "https://example.test/sitemap.xml",
    fetchImpl: async (url) => {
      const item = responses.get(String(url));
      assert.ok(item, `unexpected fetch: ${url}`);
      return item.clone();
    },
  });

  assert.equal(result.ok, true, result.failures.join("\n"));
  assert.equal(result.sitemapCount, 3);
  assert.equal(result.urlCount, 2);
});

test("fails when an advertised page renders noindex and thin", async () => {
  const responses = new Map([
    [
      "https://example.test/sitemap.xml",
      response(
        `<urlset><url><loc>https://example.test/business/thin</loc></url></urlset>`,
        200,
        "application/xml"
      ),
    ],
    [
      "https://example.test/business/thin",
      response(
        `<!doctype html><html><head><link rel="canonical" href="https://example.test/business/thin"><meta name="robots" content="noindex,nofollow"></head><body><h1>Thin</h1></body></html>`
      ),
    ],
  ]);

  const result = await auditSitemapRenderParity({
    sitemapUrl: "https://example.test/sitemap.xml",
    fetchImpl: async (url) => responses.get(String(url)).clone(),
  });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("robots noindex")));
  assert.ok(result.failures.some((failure) => failure.includes("robots nofollow")));
  assert.ok(
    result.failures.some((failure) => failure.includes("missing fact-bearing data-seo main"))
  );
  assert.ok(
    result.failures.some((failure) => failure.includes("thin visible text in fact-bearing region"))
  );
});

test("fails when X-Robots-Tag blocks indexing or link following", async () => {
  const pageUrl = "https://example.test/business/header-blocked";
  const responses = new Map([
    [
      "https://example.test/sitemap.xml",
      response(`<urlset><url><loc>${pageUrl}</loc></url></urlset>`, 200, "application/xml"),
    ],
    [
      pageUrl,
      response(substantiveHtml(pageUrl), 200, "text/html", {
        "x-robots-tag": "googlebot: noindex, nofollow",
      }),
    ],
  ]);

  const result = await auditSitemapRenderParity({
    sitemapUrl: "https://example.test/sitemap.xml",
    fetchImpl: async (url) => responses.get(String(url)).clone(),
  });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("X-Robots-Tag noindex")));
  assert.ok(result.failures.some((failure) => failure.includes("X-Robots-Tag nofollow")));
});

test("does not let SPA shell copy conceal a thin fact-bearing main", async () => {
  const pageUrl = "https://example.test/business/shell-padded";
  const shellCopy = "Navigation, account, footer, and application shell copy. ".repeat(20);
  const html = `<!doctype html><html><head><link rel="canonical" href="${pageUrl}"><meta name="robots" content="index,follow"></head><body><header>${shellCopy}</header><main data-seo-business="true"><h1>Thin fact</h1><p>One fact.</p></main><footer>${shellCopy}</footer></body></html>`;
  const responses = new Map([
    [
      "https://example.test/sitemap.xml",
      response(`<urlset><url><loc>${pageUrl}</loc></url></urlset>`, 200, "application/xml"),
    ],
    [pageUrl, response(html)],
  ]);

  const result = await auditSitemapRenderParity({
    sitemapUrl: "https://example.test/sitemap.xml",
    fetchImpl: async (url) => responses.get(String(url)).clone(),
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((failure) => failure.includes("thin visible text in fact-bearing region"))
  );
});

test("fails duplicate content ownership across child feeds", async () => {
  const duplicateUrl = "https://example.test/u/linked-business";
  const responses = new Map([
    [
      "https://example.test/sitemap.xml",
      response(
        `<sitemapindex><sitemap><loc>https://example.test/a.xml</loc></sitemap><sitemap><loc>https://example.test/b.xml</loc></sitemap></sitemapindex>`,
        200,
        "application/xml"
      ),
    ],
    [
      "https://example.test/a.xml",
      response(`<urlset><url><loc>${duplicateUrl}</loc></url></urlset>`, 200, "application/xml"),
    ],
    [
      "https://example.test/b.xml",
      response(`<urlset><url><loc>${duplicateUrl}</loc></url></urlset>`, 200, "application/xml"),
    ],
    [duplicateUrl, response(substantiveHtml(duplicateUrl))],
  ]);

  const result = await auditSitemapRenderParity({
    sitemapUrl: "https://example.test/sitemap.xml",
    fetchImpl: async (url) => responses.get(String(url)).clone(),
  });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("duplicate URL")));
});
