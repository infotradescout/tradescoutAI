import { describe, expect, it } from "vitest";
import {
  driveIdFromInventoryImagePath,
  formatSlabDimension,
  parseSlabDimension,
  resolveSlabDimensionForInventoryImage,
  resolveSlabDimensionsLabel,
} from "./slabDimensions";
import { getCatalogItemById } from "./catalog";

describe("JW Stone slab dimensions from Drive source evidence", () => {
  it("parses cleaned and messy Drive filenames", () => {
    expect(parseSlabDimension("Marble_Alabama-White_123x70.jpg")).toEqual({
      widthIn: 123,
      heightIn: 70,
    });
    expect(parseSlabDimension("MATRIX BASALT  126X78 14 slabs.jpg")).toEqual({
      widthIn: 126,
      heightIn: 78,
    });
    expect(parseSlabDimension("Blue flower 129.5”X80.5 (48 slabs).jpg")).toEqual({
      widthIn: 129.5,
      heightIn: 80.5,
    });
    expect(parseSlabDimension("Blue Fantasy (dual finish) - 126 x 79.jpg")).toEqual({
      widthIn: 126,
      heightIn: 79,
    });
    expect(parseSlabDimension("granite-126x76-6")).toEqual({
      widthIn: 126,
      heightIn: 76,
    });
    expect(parseSlabDimension("close look only")).toBeNull();
  });

  it("formats inches for customer meta", () => {
    expect(formatSlabDimension({ widthIn: 126, heightIn: 78 })).toBe('126×78"');
    expect(formatSlabDimension({ widthIn: 129.5, heightIn: 80.5 })).toBe('129.5×80.5"');
  });

  it("extracts Drive ids from inventory image paths", () => {
    expect(
      driveIdFromInventoryImagePath(
        "/images/businesses/jw-stone/inventory-source/1ZcGVAg76xGKbQ1l9v7kO64Qqf-Nt-U74.webp"
      )
    ).toBe("1ZcGVAg76xGKbQ1l9v7kO64Qqf-Nt-U74");
  });

  it("returns scale evidence only for the exact source photo", () => {
    expect(
      resolveSlabDimensionForInventoryImage(
        "/images/businesses/jw-stone/inventory-source/does-not-exist.webp"
      )
    ).toBeNull();
    expect(
      resolveSlabDimensionForInventoryImage(
        "/images/businesses/jw-stone/inventory-source/1D8bvWASTFtKs4ri4KK553drHwWXeAzxQ.webp"
      )
    ).toEqual({ widthIn: 130, heightIn: 77.5 });
  });

  it("surfaces Matrix Basalt sizes from reconciled Drive source names", () => {
    const stone = getCatalogItemById("matrix-basalt");
    expect(stone?.slabDimensions).toMatch(/126×78"|127×77\.5"/);
  });

  it("surfaces New Arrival sizes from reconciliation evidence keys when needed", () => {
    const stone = getCatalogItemById("trending-selection-01");
    expect(stone?.slabDimensions).toBe('126×76"');
  });

  it("resolves directly from image paths without inventing stones", () => {
    expect(
      resolveSlabDimensionsLabel({
        slug: "matrix-basalt",
        images: [
          "/images/businesses/jw-stone/inventory-source/1ZcGVAg76xGKbQ1l9v7kO64Qqf-Nt-U74.webp",
        ],
      })
    ).toBe('126×78"');
  });
});
