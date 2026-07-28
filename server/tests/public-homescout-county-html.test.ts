import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCountyByFips: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getCountyByFips: mocks.getCountyByFips,
  },
}));

import { buildPublicHomeScoutCountyHtml } from "../publicHomeScoutCountyHtml";
import { upgradePublicSocialPreviewHtml } from "../publicSocialPreviewHtml";
import { resolveSignedSocialPreviewToken } from "../signedSocialPreview";

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta name="description" content="TradeScout" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="TradeScout" />
    <meta property="og:url" content="https://www.thetradescout.com" />
    <meta property="og:image" content="/tradescout-social-preview.png" />
    <meta property="og:image:secure_url" content="/tradescout-social-preview.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="TradeScout" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="TradeScout" />
    <meta name="twitter:image" content="/tradescout-social-preview.png" />
    <meta name="twitter:image:alt" content="TradeScout" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body><div id="root"></div></body>
</html>`;

function signedTokenFromHtml(html: string): string {
  const imageUrl = html.match(
    /<meta property="og:image" content="([^"]*\/images\/social\/card\/([^"]+)\.png)"/
  )?.[1];
  expect(imageUrl).toBeTruthy();
  return new URL(String(imageUrl).replace(/&amp;/g, "&")).pathname
    .replace(/^\/images\/social\/card\//, "")
    .replace(/\.png$/, "");
}

describe("public HomeScout county HTML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "public-homescout-county-test-secret";
    mocks.getCountyByFips.mockResolvedValue({
      id: "county-private-db-id",
      fips: "12033",
      name: "Escambia County",
      stateCode: "FL",
      population: 325_000,
    });
  });

  it("builds county-specific metadata and a county-directory preview context", async () => {
    const html = await buildPublicHomeScoutCountyHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
      stateCode: "fl",
      countyFips: "12033",
    });

    expect(html).toContain("<title>Homes for sale in Escambia County, FL | TradeScout</title>");
    expect(html).toContain(
      'link rel="canonical" href="https://www.thetradescout.com/homescout/FL/12033"'
    );
    expect(html).toContain("Browse active HomeScout property listings in Escambia County, FL.");
    expect(html).toContain('property="og:site_name" content="HomeScout"');
    expect(html).toContain('data-seo-homescout-county="true"');
    expect(html).not.toContain("county-private-db-id");
    expect(html).not.toContain("325000");

    const upgraded = upgradePublicSocialPreviewHtml(html!);
    const resolved = resolveSignedSocialPreviewToken(signedTokenFromHtml(upgraded));
    expect(resolved?.context).toMatchObject({
      kind: "directory",
      title: "Homes for sale in Escambia County, FL",
      brandName: "HomeScout",
      eyebrow: "County listings",
      ctaLabel: "Browse county listings",
      sourceImageUrl: null,
    });
  });

  it("fails closed for malformed, unknown, and state-mismatched counties", async () => {
    const options = {
      origin: "https://www.thetradescout.com",
      templateHtml,
      stateCode: "FL",
      countyFips: "12033",
    };

    mocks.getCountyByFips.mockResolvedValueOnce(undefined);
    await expect(buildPublicHomeScoutCountyHtml(options)).resolves.toBeNull();

    mocks.getCountyByFips.mockResolvedValueOnce({
      fips: "12033",
      name: "Escambia County",
      stateCode: "AL",
    });
    await expect(buildPublicHomeScoutCountyHtml(options)).resolves.toBeNull();

    mocks.getCountyByFips.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(buildPublicHomeScoutCountyHtml(options)).resolves.toBeNull();

    const callsBeforeMalformed = mocks.getCountyByFips.mock.calls.length;
    await expect(
      buildPublicHomeScoutCountyHtml({ ...options, countyFips: "../private" })
    ).resolves.toBeNull();
    expect(mocks.getCountyByFips).toHaveBeenCalledTimes(callsBeforeMalformed);
  });

  it("registers the county renderer after listing detail and before the SPA catch-all", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf8");
    const listingRouteIndex = source.indexOf('app.get("/homescout/listings/:listingId"');
    const countyRouteIndex = source.indexOf('app.get("/homescout/:stateCode/:countyFips"');
    const catchAllIndex = source.indexOf('app.get("*"');

    expect(source).toContain(
      'import { buildPublicHomeScoutCountyHtml } from "./publicHomeScoutCountyHtml"'
    );
    expect(source).toContain("const html = await buildPublicHomeScoutCountyHtml({");
    expect(listingRouteIndex).toBeGreaterThan(-1);
    expect(countyRouteIndex).toBeGreaterThan(listingRouteIndex);
    expect(countyRouteIndex).toBeLessThan(catchAllIndex);
  });
});
