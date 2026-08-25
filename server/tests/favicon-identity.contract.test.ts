import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("canonical favicon identity", () => {
  it("ships a valid 32px ICO at the exact crawler-requested path", () => {
    const iconPath = path.resolve(process.cwd(), "client/public/favicon.ico");
    const icon = fs.readFileSync(iconPath);

    expect(icon.readUInt16LE(0)).toBe(0);
    expect(icon.readUInt16LE(2)).toBe(1);
    expect(icon.readUInt16LE(4)).toBe(1);
    expect(icon[6]).toBe(32);
    expect(icon[7]).toBe(32);

    const imageLength = icon.readUInt32LE(14);
    const imageOffset = icon.readUInt32LE(18);
    expect(imageLength).toBeGreaterThan(0);
    expect(imageOffset + imageLength).toBe(icon.length);
    expect(icon.subarray(imageOffset, imageOffset + 8).toString("hex")).toBe(
      "89504e470d0a1a0a"
    );
  });
});
