import { describe, expect, it } from "vitest";
import {
  buildHandmadeProductPath,
  listHandmadeProductImageUrls,
  normalizeHandmadeProductId,
} from "@shared/handmadeProductShare";

describe("Handmade product sharing helpers", () => {
  it("builds a stable product detail path", () => {
    expect(buildHandmadeProductPath("product-123")).toBe("/handmade/products/product-123");
    expect(normalizeHandmadeProductId("product_456")).toBe("product_456");
  });

  it("rejects unsafe identifiers", () => {
    expect(buildHandmadeProductPath("../private-product")).toBeNull();
    expect(buildHandmadeProductPath("product/child")).toBeNull();
    expect(buildHandmadeProductPath("")).toBeNull();
  });

  it("uses the primary image first, deduplicates, and drops unsafe image values", () => {
    expect(
      listHandmadeProductImageUrls({
        primaryImageUrl: "/uploads/handmade/oak-board.jpg",
        images: [
          "/uploads/handmade/oak-board.jpg",
          "https://images.example.com/oak-board-detail.webp",
          "javascript:alert(1)",
          "//unsafe.example.com/image.jpg",
          "bad\\path.jpg",
        ],
      })
    ).toEqual([
      "/uploads/handmade/oak-board.jpg",
      "https://images.example.com/oak-board-detail.webp",
    ]);
  });
});
