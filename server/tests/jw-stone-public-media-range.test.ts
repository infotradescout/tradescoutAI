import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { streamPublicObject } from "../publicMediaStorage";

function createApp(
  client: { send: (command: unknown) => Promise<unknown> },
  key: string
) {
  const app = express();
  app.get("/asset", async (req, res) => {
    const result = await streamPublicObject({
      req,
      res,
      key,
      client,
      bucketName: "existing-production-bucket",
    });
    if (result !== "served" && !res.headersSent) res.status(500).end();
  });
  return app;
}

function publicObject(body: string, contentType: string) {
  const bytes = Buffer.from(body);
  return {
    AcceptRanges: "bytes",
    ContentLength: bytes.length,
    ContentType: contentType,
    Body: {
      transformToByteArray: async () => bytes,
    },
  };
}

describe("JW Stone public-media range delivery", () => {
  it("returns a complete still image when a browser requests a byte range", async () => {
    const key = "public-media/images/businesses/jw-stone/color-collage/01-white.webp";
    const send = vi.fn(async (command: unknown) => {
      const input = (command as { input: { Key: string; Range?: string } }).input;
      expect(input.Key).toBe(key);
      expect(input.Range).toBeUndefined();
      return publicObject("complete-stone-image", "image/webp");
    });

    const response = await request(createApp({ send }, key))
      .get("/asset")
      .set("Range", "bytes=0-2178")
      .expect(200);

    expect(response.body).toEqual(Buffer.from("complete-stone-image"));
    expect(response.headers["accept-ranges"]).toBe("none");
    expect(response.headers["content-range"]).toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps byte-range seeking for the JW Stone hero video", async () => {
    const key = "public-media/images/businesses/jw-stone/video/hero.mp4";
    const send = vi.fn(async (command: unknown) => {
      const input = (command as { input: { Key: string; Range?: string } }).input;
      expect(input.Key).toBe(key);
      expect(input.Range).toBe("bytes=0-2");
      return {
        ...publicObject("vid", "video/mp4"),
        ContentRange: "bytes 0-2/9",
      };
    });

    const response = await request(createApp({ send }, key))
      .get("/asset")
      .set("Range", "bytes=0-2")
      .expect(206);

    expect(response.body).toEqual(Buffer.from("vid"));
    expect(response.headers["accept-ranges"]).toBe("bytes");
    expect(response.headers["content-range"]).toBe("bytes 0-2/9");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
