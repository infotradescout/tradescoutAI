import { describe, expect, it } from "vitest";
import {
  buildProfilePortfolioItemSlug,
  buildProfilePortfolioShareSearch,
  createProfilePortfolioItemShareMetadata,
  normalizeProfilePortfolioItemSlug,
  resolveProfilePortfolioItem,
} from "@shared/profilePortfolioShare";

const patioProject = {
  title: "Stone Patio Repair",
  description: "Reset loose stone, rebuilt the edge, and cleaned the finished patio.",
  imageUrl: "/uploads/portfolio/stone-patio.webp",
  completionDate: "2026-05-12",
  skills: ["Masonry", "Repair"],
  fromPlatform: true,
  taskId: "task-123",
};

describe("profile portfolio item sharing", () => {
  it("builds a stable human-readable share URL from the item itself", () => {
    const slug = buildProfilePortfolioItemSlug(patioProject);

    expect(slug).toMatch(/^stone-patio-repair-[a-z0-9]{7}$/);
    expect(buildProfilePortfolioItemSlug(patioProject)).toBe(slug);
    expect(buildProfilePortfolioShareSearch(patioProject)).toBe(`?portfolio=${slug}`);
  });

  it("resolves only a real portfolio item with a safe public image", () => {
    const slug = buildProfilePortfolioItemSlug(patioProject);
    expect(resolveProfilePortfolioItem([patioProject], slug)).toMatchObject({
      title: "Stone Patio Repair",
      imageUrl: "/uploads/portfolio/stone-patio.webp",
      fromPlatform: true,
      index: 0,
    });
    expect(
      resolveProfilePortfolioItem([{ ...patioProject, imageUrl: "javascript:alert(1)" }], slug)
    ).toBeNull();
    expect(normalizeProfilePortfolioItemSlug("../../admin")).toBeNull();
  });

  it("uses the portfolio photo and keeps contact protection in social metadata", () => {
    const slug = buildProfilePortfolioItemSlug(patioProject);
    const metadata = createProfilePortfolioItemShareMetadata({
      profileName: "Taylor Helper",
      profileUrl: "https://www.thetradescout.com/helpers/helper-1",
      assetOrigin: "https://www.thetradescout.com",
      portfolioItems: [patioProject],
      itemSlug: slug,
    });

    expect(metadata).toMatchObject({
      itemType: "portfolio",
      itemTitle: "Stone Patio Repair",
      itemSlug: slug,
      title: "Stone Patio Repair by Taylor Helper",
      imageUrl: "https://www.thetradescout.com/uploads/portfolio/stone-patio.webp",
      canonical: `https://www.thetradescout.com/helpers/helper-1?portfolio=${slug}`,
    });
    expect(metadata?.description).toContain(
      "Your contact details stay private until you choose to connect."
    );
    expect(metadata?.description.length).toBeLessThanOrEqual(160);
  });
});
