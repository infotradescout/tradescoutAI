import { describe, expect, it } from "vitest";
import {
  buildContractorPhotoShareSearch,
  createContractorPhotoShareMetadata,
  listContractorProjectPhotos,
  resolveContractorProjectPhoto,
} from "@shared/contractorPhotoShare";

describe("contractor project photo sharing", () => {
  it("creates stable, individually shareable photos and ignores unsafe values", () => {
    const photos = [
      "/uploads/contractors/patio.webp",
      "https://images.example.com/kitchen.jpg",
      "javascript:alert(1)",
      "",
    ];
    const firstPass = listContractorProjectPhotos(photos);
    const secondPass = listContractorProjectPhotos([...photos].reverse());

    expect(firstPass).toHaveLength(2);
    expect(firstPass[0]).toMatchObject({
      title: "Project photo 1",
      imageUrl: "/uploads/contractors/patio.webp",
      imageAlt: "Project photo 1 from this local provider",
    });
    expect(firstPass[0].slug).toMatch(/^project-photo-[a-z0-9]{7}$/);
    expect(secondPass.map((item) => item.slug)).toEqual(
      expect.arrayContaining(firstPass.map((item) => item.slug))
    );
    expect(resolveContractorProjectPhoto(photos, firstPass[0].slug)?.imageUrl).toBe(
      "/uploads/contractors/patio.webp"
    );
  });

  it("uses the selected photo as the exact social preview", () => {
    const photos = ["/uploads/contractors/patio.webp"];
    const item = listContractorProjectPhotos(photos)[0];
    const metadata = createContractorPhotoShareMetadata({
      contractorName: "River City Masonry",
      contractorUrl: "https://www.thetradescout.com/contractors/river-city-masonry",
      assetOrigin: "https://www.thetradescout.com",
      photos,
      itemSlug: item.slug,
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        itemType: "contractor-photo",
        itemSlug: item.slug,
        title: "Project photo 1 by River City Masonry",
        imageUrl: "https://www.thetradescout.com/uploads/contractors/patio.webp",
        canonical: `https://www.thetradescout.com/contractors/river-city-masonry?gallery=${item.slug}`,
      })
    );
    expect(metadata?.description).toBe("View Project photo 1 from River City Masonry.");
    expect(metadata?.description.length).toBeLessThanOrEqual(160);
    expect(buildContractorPhotoShareSearch(item.slug)).toBe(`?gallery=${item.slug}`);
  });

  it("rejects unknown and malformed selectors", () => {
    const photos = ["/uploads/contractors/patio.webp"];
    expect(resolveContractorProjectPhoto(photos, "../private")).toBeNull();
    expect(buildContractorPhotoShareSearch("../private")).toBe("");
    expect(
      createContractorPhotoShareMetadata({
        contractorName: "River City Masonry",
        contractorUrl: "https://www.thetradescout.com/contractors/river-city-masonry",
        assetOrigin: "https://www.thetradescout.com",
        photos,
        itemSlug: "unknown-photo",
      })
    ).toBeNull();
  });
});
