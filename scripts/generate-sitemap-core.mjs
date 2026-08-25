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
  '/sitemap-u-profiles.xml',
  '/sitemap-business-profiles.xml',
  '/sitemap-directory-businesses.xml',
  '/sitemap-homescout-counties.xml',
  '/sitemap-homescout-listings.xml',
  '/sitemap-tradepartners.xml',
  '/sitemap-directory-counties.xml',
  '/sitemap-directory-trade-navigation.xml',
  '/sitemap-directory-trades.xml',
  '/sitemap-directory-cities.xml',
  '/sitemap-directory-trade-cities.xml',
  '/sitemap-best-pages.xml',
  '/sitemap-recent-activity.xml',
  '/sitemap-exchange-listings.xml',
  '/sitemap-handmade-products.xml',
  '/sitemap-profile-service-offers.xml',
];

// Canonical public routes only.
// Keep this list focused on high-intent, index-worthy pages.
const STATIC_PUBLIC_ROUTES = [
  { path: '/', priority: 1.0, changefreq: 'daily' },
  { path: '/jw-stone', priority: 0.8, changefreq: 'daily' },
  { path: '/direct-connect', priority: 0.9, changefreq: 'hourly' },
  { path: '/contractors/apply', priority: 0.8, changefreq: 'weekly' },
  { path: '/community', priority: 0.9, changefreq: 'hourly' },
  { path: '/community-feed', priority: 0.9, changefreq: 'hourly' },
  { path: '/exchange', priority: 0.8, changefreq: 'daily' },
  { path: '/exchange/vehicles', priority: 0.8, changefreq: 'daily' },
  { path: '/exchange/business', priority: 0.8, changefreq: 'daily' },
  { path: '/exchange/real-estate', priority: 0.8, changefreq: 'daily' },
  { path: '/exchange/construction', priority: 0.7, changefreq: 'daily' },
  { path: '/exchange/tools', priority: 0.7, changefreq: 'daily' },
  { path: '/exchange/furniture', priority: 0.7, changefreq: 'daily' },
  { path: '/exchange/farm', priority: 0.7, changefreq: 'daily' },
  { path: '/exchange/business-equipment', priority: 0.7, changefreq: 'daily' },
  { path: '/exchange/electronics', priority: 0.7, changefreq: 'daily' },
  { path: '/exchange/sports', priority: 0.7, changefreq: 'daily' },
  { path: '/exchange/collectibles', priority: 0.7, changefreq: 'daily' },
  { path: '/exchange/jewelry', priority: 0.7, changefreq: 'daily' },
  { path: '/exchange/metals', priority: 0.7, changefreq: 'daily' },
  { path: '/exchange/local-food', priority: 0.7, changefreq: 'daily' },
  { path: '/exchange/other', priority: 0.6, changefreq: 'daily' },
  { path: '/vehicle-marketplace', priority: 0.6, changefreq: 'daily' },
  { path: '/homescout-listings', priority: 0.6, changefreq: 'daily' },
  { path: '/handmade-marketplace', priority: 0.6, changefreq: 'daily' },
  { path: '/trade-deals', priority: 0.7, changefreq: 'daily' },
  { path: '/groups', priority: 0.7, changefreq: 'daily' },
  { path: '/county-directory', priority: 0.7, changefreq: 'weekly' },
  { path: '/county-hub', priority: 0.7, changefreq: 'weekly' },
  { path: '/maps', priority: 0.7, changefreq: 'weekly' },
  { path: '/help', priority: 0.8, changefreq: 'weekly' },
  { path: '/help/how-tradescout-works', priority: 0.8, changefreq: 'weekly' },
  { path: '/how-it-works', priority: 0.9, changefreq: 'weekly' },
  { path: '/for-businesses', priority: 0.9, changefreq: 'weekly' },
  { path: '/find-local-businesses', priority: 0.9, changefreq: 'weekly' },
  { path: '/tangipahoa', priority: 0.9, changefreq: 'weekly' },
  { path: '/trade-up-for-trade-schools', priority: 0.7, changefreq: 'monthly' },
  { path: '/trust-model', priority: 0.9, changefreq: 'weekly' },
  { path: '/direct-connect-info', priority: 0.9, changefreq: 'weekly' },
  { path: '/giveaway-rules', priority: 0.5, changefreq: 'monthly' },
  { path: '/compare', priority: 0.8, changefreq: 'weekly' },
  { path: '/compare/angi', priority: 0.8, changefreq: 'monthly' },
  { path: '/compare/home-services', priority: 0.8, changefreq: 'monthly' },
  { path: '/compare/real-estate', priority: 0.8, changefreq: 'monthly' },
  { path: '/compare/community', priority: 0.8, changefreq: 'monthly' },
  { path: '/compare/local-business', priority: 0.8, changefreq: 'monthly' },
  { path: '/compare/coordination', priority: 0.8, changefreq: 'monthly' },
  { path: '/compare/lead-generation', priority: 0.8, changefreq: 'monthly' },
  { path: '/compare/homeadvisor', priority: 0.8, changefreq: 'monthly' },
  { path: '/about', priority: 0.8, changefreq: 'monthly' },
  { path: '/contact', priority: 0.7, changefreq: 'monthly' },
  { path: '/pricing', priority: 0.7, changefreq: 'monthly' },
  { path: '/terms', priority: 0.6, changefreq: 'monthly' },
  { path: '/privacy', priority: 0.6, changefreq: 'monthly' },
  { path: '/privacy-request', priority: 0.5, changefreq: 'yearly' },
  { path: '/compliance', priority: 0.5, changefreq: 'monthly' },
  { path: '/realtor-application', priority: 0.7, changefreq: 'monthly' },
  { path: '/car-salesman-application', priority: 0.7, changefreq: 'monthly' },
  { path: '/leaderboard', priority: 0.6, changefreq: 'daily' },
  { path: '/foundation', priority: 0.6, changefreq: 'monthly' },
  { path: '/resource-center', priority: 0.7, changefreq: 'weekly' },
  { path: '/membership-portal', priority: 0.6, changefreq: 'weekly' },
  { path: '/training-center', priority: 0.6, changefreq: 'weekly' },
  { path: '/trade', priority: 0.8, changefreq: 'daily' },
  { path: '/datasets', priority: 0.7, changefreq: 'weekly' },
  { path: '/datasets/trades', priority: 0.7, changefreq: 'weekly' },
  { path: '/datasets/counties', priority: 0.7, changefreq: 'weekly' },
  { path: '/datasets/cities', priority: 0.7, changefreq: 'weekly' },
  { path: '/affiliate', priority: 0.6, changefreq: 'monthly' },
  { path: '/tradepartners/cumulus-media', priority: 0.8, changefreq: 'weekly' },
  { path: '/tradepartners/cumulus-media/mobile-county-al', priority: 0.8, changefreq: 'weekly' },
  { path: '/tradepartners/cumulus-media/escambia-county-fl', priority: 0.8, changefreq: 'weekly' },
  { path: '/tradepartners/cumulus-media/okaloosa-county-fl', priority: 0.8, changefreq: 'weekly' },
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
    const lastmod = existingLastmodByLoc.get(loc) || today;
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
