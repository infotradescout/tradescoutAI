#!/usr/bin/env node

/**
 * generate-sitemap.mjs
 * 
 * Build-time sitemap generator for TradeScout.
 * Extracts all public routes from App.tsx and generates sitemap.xml.
 * Business profiles (/business/:slug) and county pages are dynamically crawlable.
 * 
 * Usage:
 *   node scripts/generate-sitemap.mjs
 * 
 * Output:
 *   client/public/sitemap.xml
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PRODUCTION_URL = 'https://www.thetradescout.com';
const OUTPUT_PATH = resolve(__dirname, '../client/public/sitemap.xml');

// Define public routes (routes that should be indexed).
// Excludes private/auth-only surfaces and dashboard routes.
const STATIC_PUBLIC_ROUTES = [
  { path: '/', priority: 1.0, changefreq: 'daily' },
  
  // Direct Connect
  { path: '/direct-connect', priority: 0.9, changefreq: 'hourly' },
  
  // Contractors
  { path: '/contractors/apply', priority: 0.8, changefreq: 'weekly' },
  
  // Community
  { path: '/community', priority: 0.9, changefreq: 'hourly' },
  { path: '/community-feed', priority: 0.9, changefreq: 'hourly' },
  
  // Marketplace
  { path: '/exchange', priority: 0.7, changefreq: 'daily' },
  { path: '/vehicle-marketplace', priority: 0.6, changefreq: 'daily' },
  { path: '/real-estate-marketplace', priority: 0.6, changefreq: 'daily' },
  { path: '/handmade-marketplace', priority: 0.6, changefreq: 'daily' },
  { path: '/trade-deals', priority: 0.7, changefreq: 'daily' },
  
  // Groups & Organizations
  { path: '/groups', priority: 0.7, changefreq: 'daily' },
  { path: '/county-directory', priority: 0.7, changefreq: 'weekly' },
  { path: '/county-hub', priority: 0.7, changefreq: 'weekly' },
  
  // Help & Info
  { path: '/help', priority: 0.8, changefreq: 'weekly' },
  { path: '/help/how-tradescout-works', priority: 0.8, changefreq: 'weekly' },
    { path: '/how-it-works', priority: 0.9, changefreq: 'weekly' },
      { path: '/trust-model', priority: 0.9, changefreq: 'weekly' },
        { path: '/direct-connect-info', priority: 0.9, changefreq: 'weekly' },
          { path: '/compare/angi', priority: 0.8, changefreq: 'monthly' },
          { path: '/compare/homeadvisor', priority: 0.8, changefreq: 'monthly' },
  { path: '/about', priority: 0.8, changefreq: 'monthly' },
  { path: '/contact', priority: 0.7, changefreq: 'monthly' },
  { path: '/pricing', priority: 0.7, changefreq: 'monthly' },
  
  // Legal
  { path: '/terms', priority: 0.6, changefreq: 'monthly' },
  { path: '/privacy', priority: 0.6, changefreq: 'monthly' },
  { path: '/privacy-request', priority: 0.5, changefreq: 'yearly' },
  { path: '/compliance', priority: 0.5, changefreq: 'monthly' },
  
  // Applications
  { path: '/realtor-application', priority: 0.7, changefreq: 'monthly' },
  { path: '/car-salesman-application', priority: 0.7, changefreq: 'monthly' },
  
  // Features
  { path: '/leaderboard', priority: 0.6, changefreq: 'daily' },
  { path: '/foundation', priority: 0.6, changefreq: 'monthly' },
  { path: '/resource-center', priority: 0.7, changefreq: 'weekly' },
  { path: '/membership-portal', priority: 0.6, changefreq: 'weekly' },
  { path: '/training-center', priority: 0.6, changefreq: 'weekly' },
  { path: '/affiliate', priority: 0.6, changefreq: 'monthly' },
  
  // Placeholder for future foundation pages (will be added when pages exist)
  // { path: '/how-it-works', priority: 0.9, changefreq: 'weekly' },
  // { path: '/trust-model', priority: 0.9, changefreq: 'weekly' },
  // { path: '/compare/angi', priority: 0.8, changefreq: 'monthly' },
  // { path: '/compare/homeadvisor', priority: 0.8, changefreq: 'monthly' },
];

const LANDING_AUDIENCE_KEYS = [
  "contractor",
  "homeowner",
  "realtor",
  "hoa",
  "property-manager",
  "lender",
  "insurance-agent",
  "supplier",
  "affiliate",
];

function extractLandingVariantRoutes() {
  try {
    const sourcePath = resolve(__dirname, "../shared/trades-data.ts");
    const source = readFileSync(sourcePath, "utf-8");
    const slugMatches = [...source.matchAll(/slug:\s*'([^']+)'/g)];
    const slugs = Array.from(new Set(slugMatches.map((m) => String(m[1] || "").trim()))).filter(
      (slug) => slug.length > 0
    );

    const routes = [];

    for (const slug of slugs) {
      routes.push({
        path: `/landing/${slug}`,
        priority: 0.8,
        changefreq: "weekly",
      });
    }

    for (const audienceKey of LANDING_AUDIENCE_KEYS) {
      routes.push({
        path: `/landing/${audienceKey}`,
        priority: 0.8,
        changefreq: "weekly",
      });
      for (const slug of slugs) {
        routes.push({
          path: `/landing/${audienceKey}-${slug}`,
          priority: 0.7,
          changefreq: "weekly",
        });
      }
    }

    return routes;
  } catch (error) {
    console.warn("⚠️ Could not extract landing variant routes from trades-data.", error);
    return [];
  }
}

const PUBLIC_ROUTES = (() => {
  const landingVariantRoutes = extractLandingVariantRoutes();
  const seen = new Set();
  const merged = [];
  for (const route of [...STATIC_PUBLIC_ROUTES, ...landingVariantRoutes]) {
    if (seen.has(route.path)) continue;
    seen.add(route.path);
    merged.push(route);
  }
  return merged;
})();

function generateSitemap() {
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Generate static routes
  const urls = PUBLIC_ROUTES.map(route => {
    return `  <url>
    <loc>${PRODUCTION_URL}${route.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority.toFixed(1)}</priority>
  </url>`;
  }).join('\n');

  // Note: Business profiles (/business/:slug) and county pages (/county/:stateCode/:countySlug)
  // are dynamically crawlable. Search engines will discover them from internal links.
  // 
  // Future enhancement: Add database query to fetch published business profiles
  // and generate explicit <url> entries for each. For now, relying on crawlability
  // from internal links (county pages, service areas, footer explore links).
  //
  // Example future code:
  // const businessProfiles = await fetchPublishedBusinessProfiles();
  // const businessUrls = businessProfiles.map(profile => `  <url>
  //   <loc>${PRODUCTION_URL}/business/${profile.slug}</loc>
  //   <lastmod>${profile.updatedAt}</lastmod>
  //   <changefreq>weekly</changefreq>
  //   <priority>0.7</priority>
  // </url>`).join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
        
${urls}

</urlset>`;

  writeFileSync(OUTPUT_PATH, sitemap, 'utf-8');
  console.log(`✅ Sitemap generated: ${OUTPUT_PATH}`);
  console.log(`📄 ${PUBLIC_ROUTES.length} static URLs included`);
  console.log(`🗺️  County pages (/county/*) and business profiles (/business/*) are dynamically crawlable`);
}

generateSitemap();
