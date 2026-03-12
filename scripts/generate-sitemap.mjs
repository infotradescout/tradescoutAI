#!/usr/bin/env node

/**
 * generate-sitemap.mjs
 *
 * Build-time sitemap generator for TradeScout.
 * Generates a conservative sitemap.xml for canonical public routes.
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PRODUCTION_URL = 'https://www.thetradescout.com';
const OUTPUT_PATH = resolve(__dirname, '../client/public/sitemap.xml');
const OUTPUT_INDEX_PATH = resolve(__dirname, '../client/public/sitemap-index.xml');

const SITEMAP_INDEX_TARGETS = [
  '/sitemap-core.xml',
  '/sitemap-profiles.xml',
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
];

// Canonical public routes only.
// Keep this list focused on high-intent, index-worthy pages.
const STATIC_PUBLIC_ROUTES = [
  { path: '/', priority: 1.0, changefreq: 'daily' },
  { path: '/landing', priority: 0.9, changefreq: 'daily' },
  { path: '/direct-connect', priority: 0.9, changefreq: 'hourly' },
  { path: '/contractors/apply', priority: 0.8, changefreq: 'weekly' },
  { path: '/community', priority: 0.9, changefreq: 'hourly' },
  { path: '/community-feed', priority: 0.9, changefreq: 'hourly' },
  { path: '/exchange', priority: 0.7, changefreq: 'daily' },
  { path: '/vehicle-marketplace', priority: 0.6, changefreq: 'daily' },
  { path: '/real-estate-marketplace', priority: 0.6, changefreq: 'daily' },
  { path: '/handmade-marketplace', priority: 0.6, changefreq: 'daily' },
  { path: '/trade-deals', priority: 0.7, changefreq: 'daily' },
  { path: '/groups', priority: 0.7, changefreq: 'daily' },
  { path: '/county-directory', priority: 0.7, changefreq: 'weekly' },
  { path: '/county-hub', priority: 0.7, changefreq: 'weekly' },
  { path: '/help', priority: 0.8, changefreq: 'weekly' },
  { path: '/help/how-tradescout-works', priority: 0.8, changefreq: 'weekly' },
  { path: '/how-it-works', priority: 0.9, changefreq: 'weekly' },
  { path: '/trust-model', priority: 0.9, changefreq: 'weekly' },
  { path: '/direct-connect-info', priority: 0.9, changefreq: 'weekly' },
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

function generateSitemap() {
  const now = new Date().toISOString().split('T')[0];

  const urls = PUBLIC_ROUTES.map((route) => {
    return `  <url>\n    <loc>${PRODUCTION_URL}${route.path}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority.toFixed(1)}</priority>\n  </url>`;
  }).join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9\n        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n\n${urls}\n\n</urlset>`;

  writeFileSync(OUTPUT_PATH, sitemap, 'utf-8');
  const indexTargets = SITEMAP_INDEX_TARGETS.map(
    (path) => `  <sitemap>\n    <loc>${PRODUCTION_URL}${path}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`
  ).join('\n');
  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexTargets}\n</sitemapindex>`;
  writeFileSync(OUTPUT_INDEX_PATH, sitemapIndex, 'utf-8');
  console.log(`Sitemap generated: ${OUTPUT_PATH}`);
  console.log(`Sitemap index generated: ${OUTPUT_INDEX_PATH}`);
  console.log(`${PUBLIC_ROUTES.length} static URLs included`);
}

generateSitemap();
