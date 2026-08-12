import path from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderProfileAppIconPng } from "../socialPreviewCardRenderer";

describe("profile app icon renderer", () => {
  const publicRoots = [path.resolve(process.cwd(), "client/public")];

  it.each([192, 512])("renders a square %ipx icon from the profile logo", async (size) => {
    const png = await renderProfileAppIconPng(
      {
        brandName: "JR's Auto Glass",
        logoUrl: "https://www.thetradescout.com/images/businesses/jrs-auto-glass/logo.webp",
        accentColor: "#d92727",
      },
      size,
      { publicRoots }
    );
    const metadata = await sharp(png).metadata();
    const initialsFallback = await renderProfileAppIconPng(
      { brandName: "JR's Auto Glass", accentColor: "#d92727" },
      size,
      { publicRoots }
    );

    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(size);
    expect(metadata.height).toBe(size);
    expect(png.length).toBeGreaterThan(1_000);
    expect(png.equals(initialsFallback)).toBe(false);
  });

  it("renders profile initials when no logo is configured", async () => {
    const png = await renderProfileAppIconPng(
      { brandName: "Precision Aerial Services", accentColor: "#1b5b8c" },
      192,
      { publicRoots }
    );
    const metadata = await sharp(png).metadata();

    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(192);
    expect(metadata.height).toBe(192);
  });
});
