#!/usr/bin/env node

/**
 * generate-sitemap.mjs
 *
 * Build-time sitemap generator for TradeScout.
 * Generates a conservative sitemap.xml for canonical public routes.
 */

import './cache-red-graniti-assets.mjs';
import { writeFileSync } from 'fs';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PRODUCTION_URL = 'https://www.thetradescout.com';
const OUTPUT_PATH = resolve(__dirname, '../client/public/sitemap.xml');
const OUTPUT_INDEX_PATH = resolve(__dirname, '../client/public/sitemap-index.xml');

const SUBMITTED_SITEMAP_TARGETS = [
  '/sitemap-core.xml',
];

// Canonical public routes only.
// Keep this list focused on high-intent, index-worthy pages.
const STATIC_PUBLIC_ROUTES = [
  // Updated when the substantive server-rendered homepage body changes.
  { path: '/', priority: 1.0, changefreq: 'daily', lastmod: '2026-08-23' },
  { path: '/datasets', priority: 0.7, changefreq: 'weekly' },
  { path: '/datasets/trades', priority: 0.7, changefreq: 'weekly' },
  { path: '/datasets/counties', priority: 0.7, changefreq: 'weekly' },
  { path: '/datasets/cities', priority: 0.7, changefreq: 'weekly' },
];

const PUBLIC_ROUTES = (() => {
  const seen = new Set();
  const merged = [];
  for (const route of STATIC_PUBLIC_ROUTES) {
    if (seen.has(route.path)) continue;
    seen.add(route.path);
    merged.push(route);
  }
  return merged;
})();

function extractExistingLastmodByLoc() {
  if (!existsSync(OUTPUT_PATH)) return new Map();

  const raw = readFileSync(OUTPUT_PATH, 'utf-8');
  const map = new Map();
  const urlEntryRegex = /<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<lastmod>([^<]+)<\/lastmod>[\s\S]*?<\/url>/g;
  let match;

  while ((match = urlEntryRegex.exec(raw)) !== null) {
    const loc = String(match[1] || '').trim();
    const lastmod = String(match[2] || '').trim();
    if (!loc || !lastmod) continue;
    map.set(loc, lastmod);
  }

  return map;
}

function generateSitemap() {
  const today = new Date().toISOString().split('T')[0];
  const existingLastmodByLoc = extractExistingLastmodByLoc();

  const urls = PUBLIC_ROUTES.map((route) => {
    const loc = `${PRODUCTION_URL}${route.path}`;
    const lastmod = route.lastmod || existingLastmodByLoc.get(loc) || today;
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority.toFixed(1)}</priority>\n  </url>`;
  }).join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9\n        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n\n${urls}\n\n</urlset>`;

  writeFileSync(OUTPUT_PATH, sitemap, 'utf-8');
  const indexTargets = SUBMITTED_SITEMAP_TARGETS.map(
    (targetPath) => `  <sitemap>\n    <loc>${PRODUCTION_URL}${targetPath}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`
  ).join('\n');
  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexTargets}\n</sitemapindex>`;
  writeFileSync(OUTPUT_INDEX_PATH, sitemapIndex, 'utf-8');
  console.log(`Sitemap generated: ${OUTPUT_PATH}`);
  console.log(`Sitemap index generated: ${OUTPUT_INDEX_PATH}`);
  console.log(`${PUBLIC_ROUTES.length} static URLs included`);
}

generateSitemap();
