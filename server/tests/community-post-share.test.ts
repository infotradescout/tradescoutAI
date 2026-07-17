import { describe, expect, it } from "vitest";
import {
  buildCommunityPostPath,
  createCommunityPostShareMetadata,
  listCommunityPostImageUrls,
  normalizeCommunityPostId,
} from "@shared/communityPostShare";

describe("community post sharing", () => {
  it("creates a durable detail path and exact first-image preview", () => {
    const metadata = createCommunityPostShareMetadata({
      origin: "https://www.thetradescout.com",
      post: {
        id: "post-123",
        title: "Stone delivery update",
        content: "The new natural stone delivery arrived this morning.",
        imageUrls: [
          "/uploads/community/stone-delivery.webp",
          "https://images.example.com/second.jpg",
        ],
      },
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        postId: "post-123",
        title: "Stone delivery update",
        canonical: "https://www.thetradescout.com/community/posts/post-123",
        imageUrl: "https://www.thetradescout.com/uploads/community/stone-delivery.webp",
      })
    );
    expect(metadata?.description).toContain(
      "Community actions stay local and protected on TradeScout."
    );
    expect(metadata?.description.length).toBeLessThanOrEqual(160);
    expect(buildCommunityPostPath("post-123")).toBe("/community/posts/post-123");
  });

  it("filters unsafe and duplicate images", () => {
    expect(
      listCommunityPostImageUrls([
        "/uploads/community/one.jpg",
        "/uploads/community/one.jpg",
        "javascript:alert(1)",
        "https://images.example.com/two.webp",
        "\\private\\file.jpg",
      ])
    ).toEqual(["/uploads/community/one.jpg", "https://images.example.com/two.webp"]);
  });

  it("rejects malformed post identifiers", () => {
    expect(normalizeCommunityPostId("post_abc-123")).toBe("post_abc-123");
    expect(normalizeCommunityPostId("../private")).toBeNull();
    expect(buildCommunityPostPath("../private")).toBe("");
    expect(
      createCommunityPostShareMetadata({
        origin: "https://www.thetradescout.com",
        post: { id: "../private", content: "Private" },
      })
    ).toBeNull();
  });
});
