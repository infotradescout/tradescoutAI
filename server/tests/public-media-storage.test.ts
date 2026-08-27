import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { readPublicObjectBuffer, streamPublicObject } from "../publicMediaStorage";

function createApp(client: { send: (command: unknown) => Promise<unknown> }) {
  const app = express();
  const handler = async (req: express.Request, res: express.Response) => {
    const result = await streamPublicObject({
      req,
      res,
      key: "public-media/images/example.webp",
      client,
      bucketName: "existing-production-bucket",
    });
    if (result !== "served" && !res.headersSent) res.status(500).end();
  };
  app.head("/image", handler);
  app.get("/image", handler);
  return app;
}

function publicObject(body = "stone") {
  const bytes = Buffer.from(body);
  return {
    AcceptRanges: "bytes",
    ContentLength: bytes.length,
    ContentType: "image/webp",
    ETag: '"public-etag"',
    LastModified: new Date("2026-08-20T12:00:00.000Z"),
    Body: {
      transformToByteArray: async () => bytes,
    },
  };
}

describe("server object storage public media delivery", () => {
  it("reads a bounded server-owned object without touching local files", async () => {
    const send = vi.fn(async (command: unknown) => {
      if ((command as { constructor: { name: string } }).constructor.name === "HeadObjectCommand") {
        return { ContentLength: 5 };
      }
      return publicObject();
    });

    const body = await readPublicObjectBuffer({
      key: "public-media/images/example.webp",
      maxBytes: 5,
      client: { send },
      bucketName: "existing-production-bucket",
    });

    expect(body).toEqual(Buffer.from("stone"));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("rejects an oversized server-owned object before downloading its body", async () => {
    const send = vi.fn(async () => ({ ContentLength: 6 }));

    const body = await readPublicObjectBuffer({
      key: "public-media/images/example.webp",
      maxBytes: 5,
      client: { send },
      bucketName: "existing-production-bucket",
    });

    expect(body).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("streams public objects with immutable cache and validator headers", async () => {
    const send = vi.fn(async () => publicObject());
    const response = await request(createApp({ send })).get("/image").expect(200);

    expect(response.body).toEqual(Buffer.from("stone"));
    expect(response.headers["content-type"]).toContain("image/webp");
    expect(response.headers["content-length"]).toBe("5");
    expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(response.headers["cdn-cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(response.headers.etag).toBe('"public-etag"');
    expect(response.headers["last-modified"]).toBe("Thu, 20 Aug 2026 12:00:00 GMT");
    expect(response.headers["accept-ranges"]).toBe("bytes");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0][0] as { input: { Key: string } }).input.Key).toBe(
      "public-media/images/example.webp"
    );
  });

  it("supports HEAD without returning object bytes", async () => {
    const send = vi.fn(async (command: unknown) => {
      expect((command as { constructor: { name: string } }).constructor.name).toBe(
        "HeadObjectCommand"
      );
      const { Body: _body, ...head } = publicObject();
      return head;
    });
    const response = await request(createApp({ send })).head("/image").expect(200);

    expect(response.text).toBeUndefined();
    expect(response.headers["content-length"]).toBe("5");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("forwards a valid byte range and returns partial-content headers", async () => {
    const send = vi.fn(async (command: unknown) => {
      expect((command as { input: { Range?: string } }).input.Range).toBe("bytes=1-3");
      return {
        ...publicObject("ton"),
        ContentRange: "bytes 1-3/5",
      };
    });
    const response = await request(createApp({ send }))
      .get("/image")
      .set("Range", "bytes=1-3")
      .expect(206);

    expect(response.headers["content-range"]).toBe("bytes 1-3/5");
    expect(response.body).toEqual(Buffer.from("ton"));
  });

  it("rejects malformed ranges before storage access", async () => {
    const send = vi.fn(async () => publicObject());
    const response = await request(createApp({ send }))
      .get("/image")
      .set("Range", "items=1-2")
      .expect(416);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(send).not.toHaveBeenCalled();
  });

  it("forwards conditional validators and preserves a 304 response", async () => {
    const send = vi.fn(async (command: unknown) => {
      expect((command as { input: { IfNoneMatch?: string } }).input.IfNoneMatch).toBe(
        '"public-etag"'
      );
      throw { $metadata: { httpStatusCode: 304 }, name: "NotModified" };
    });
    const response = await request(createApp({ send }))
      .get("/image")
      .set("If-None-Match", '"public-etag"')
      .expect(304);

    expect(response.text).toBe("");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
