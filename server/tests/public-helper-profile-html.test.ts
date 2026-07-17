import { describe, expect, it, vi } from "vitest";
import { buildProfilePortfolioItemSlug } from "@shared/profilePortfolioShare";

vi.mock("../db", () => ({ db: {} }));

import {
  renderPublicHelperProfileHtml,
  type PublicHelperProfileRecord,
} from "../publicHelperProfileHtml";

const portfolioItem = {
  title: "Stone Patio Repair",
  description: "Reset loose stone and rebuilt the edge.",
  imageUrl: "/uploads/portfolio/stone-patio.webp",
  completionDate: "2026-05-12",
  skills: ["Masonry"],
  fromPlatform: true,
  taskId: "task-123",
};

const helper: PublicHelperProfileRecord = {
  id: "helper-1",
  firstName: "Taylor",
  lastName: "Helper",
  profileImageUrl: "/uploads/helpers/taylor.webp",
  bio: "Local repair helper.",
  skills: ["Masonry", "Repair"],
  portfolioItems: [portfolioItem],
  isActive: true,
};

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
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="TradeScout" />
    <meta name="twitter:image" content="/tradescout-social-preview.png" />
    <meta name="twitter:image:alt" content="TradeScout" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body><div id="root"></div></body>
</html>`;

describe("public helper profile HTML", () => {
  it("renders the exact portfolio image in social preview metadata", () => {
    const slug = buildProfilePortfolioItemSlug(portfolioItem);
    const html = renderPublicHelperProfileHtml({
      worker: helper,
      origin: "https://www.thetradescout.com",
      templateHtml,
      portfolioSlug: slug,
    });

    expect(html).toContain(
      'property="og:title" content="Stone Patio Repair by Taylor Helper | TradeScout"'
    );
    expect(html).toContain(
      'property="og:image" content="https://www.thetradescout.com/uploads/portfolio/stone-patio.webp"'
    );
    expect(html).toContain(
      `property="og:url" content="https://www.thetradescout.com/helpers/helper-1?portfolio=${slug}"`
    );
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain('name="tradescout:profile-item" content="portfolio"');
    expect(html).toContain('"@type":"CreativeWork"');
    expect(html).not.toContain('property="og:image:width"');
  });

  it("falls back to helper-level metadata for an unknown portfolio item", () => {
    const html = renderPublicHelperProfileHtml({
      worker: helper,
      origin: "https://www.thetradescout.com",
      templateHtml,
      portfolioSlug: "unknown-item-1234567",
    });

    expect(html).toContain('property="og:title" content="Taylor Helper | TradeScout"');
    expect(html).toContain(
      'property="og:image" content="https://www.thetradescout.com/uploads/helpers/taylor.webp"'
    );
    expect(html).toContain('property="og:type" content="profile"');
    expect(html).not.toContain('name="tradescout:profile-item"');
  });
});
