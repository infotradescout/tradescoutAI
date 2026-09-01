import fs from "node:fs";
import path from "node:path";

const read = (relativePath) => fs.readFileSync(path.resolve(relativePath), "utf8");
const fail = (message) => {
  console.error(`FAIL indexability_recovery: ${message}`);
  process.exit(1);
};
const requireText = (source, text, label) => {
  if (!source.includes(text)) fail(`${label} is missing ${JSON.stringify(text)}`);
};

const landingContract = read("shared/publicLandingIndexability.ts");
const landingClient = read("client/src/pages/landing.tsx");
const landingServer = read("server/publicLandingHtml.ts");
const recent = read("server/publicRecentHtml.ts");
const privateShell = read("server/privateShellIndexability.ts");
const server = read("server/index.ts");
const repository = read("server/repositories/sitemapRepository.ts");
const publication = read("server/publicationBusiness.ts");

for (const variant of [
  "contractor",
  "homeowner",
  "realtor",
  "hoa",
  "property-manager",
  "lender",
  "insurance-agent",
  "supplier",
  "affiliate",
  "local-operating-system",
]) {
  requireText(landingContract, `"${variant}"`, "stable landing registry");
}
requireText(landingClient, "resolvePublicLandingIndexability", "hydrated landing");
requireText(landingServer, "resolvePublicLandingIndexability", "server landing");
requireText(landingServer, 'content="noindex,follow"', "server landing robots");

const recentIndexabilityCalls = recent.match(/items\.length > 0/g) || [];
if (recentIndexabilityCalls.length !== 4) {
  fail(`expected four recent-page gates, found ${recentIndexabilityCalls.length}`);
}

for (const prefix of ["/scout", "/auth", "/dashboard", "/account"]) {
  requireText(privateShell, `"${prefix}"`, "private shell registry");
}
requireText(server, '"X-Robots-Tag", "noindex, nofollow, noarchive"', "private shell header");
requireText(server, "applyPrivateShellNoindex(templateHtml)", "private shell HTML");

const sitemapGateCalls = repository.match(/publicBusinessSitemapCrawlabilitySqlPredicate\(/g) || [];
if (sitemapGateCalls.length !== 2) {
  fail(`expected two directory-business sitemap gates, found ${sitemapGateCalls.length}`);
}
requireText(publication, "listingStaleDaysUnclaimed", "sitemap recency policy");
requireText(publication, "listingStaleDaysVerified", "sitemap recency policy");
requireText(publication, "PUBLIC_TRADE_INPUT_SLUGS", "sitemap trade policy");

console.log(
  "PASS indexability_recovery: landing, recent, private-shell, and sitemap contracts are aligned"
);
