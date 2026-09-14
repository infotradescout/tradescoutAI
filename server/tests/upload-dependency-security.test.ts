import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";
import rawMulter from "multer";
import request from "supertest";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import multipartUpload, { MAX_MULTIPART_ARRAY_INDEX } from "../utils/multipartUpload";

function uploadApp(upload: ReturnType<typeof multipartUpload>) {
  const app = express();
  app.get("/health", (_req, res) => res.sendStatus(204));
  app.post("/upload", upload.single("file"), (req, res) => {
    res.json({ size: req.file?.size ?? 0, title: req.body.title ?? null });
  });
  app.use(
    (
      error: { code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res
        .status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400)
        .json({ code: error.code || "UPLOAD_REJECTED" });
    }
  );
  return app;
}

function fields(names: string[]) {
  const boundary = "dependency-security-boundary";
  const body =
    names
      .map((name) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\nx\r\n`)
      .join("") + `--${boundary}--\r\n`;
  return { boundary, body };
}

async function waitUntil(ready: () => boolean, message: string) {
  const until = Date.now() + 3000;
  while (!ready() && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 10));
  expect(ready(), message).toBe(true);
}

describe("patched multipart upload dependencies", () => {
  it("routes crafted field overflow to the application error handler and keeps serving", async () => {
    // Upstream GHSA-wc9g-mqfw-jrwm reproducer. The production helper also
    // rejects the first field using its stricter index bound.
    const app = uploadApp(rawMulter({ storage: rawMulter.memoryStorage() }));
    const payload = fields(["items[4294967294]", "items[]"]);
    const response = await request(app)
      .post("/upload")
      .set("Content-Type", `multipart/form-data; boundary=${payload.boundary}`)
      .send(payload.body);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_FIELD_NAME");
    await request(app).get("/health").expect(204);
  });

  it.each(["items[4294967294]", "items[nested][99999999]"])(
    "bounds sparse array input %s in the shared route helper",
    async (name) => {
      const app = uploadApp(multipartUpload({ storage: multipartUpload.memoryStorage() }));
      const payload = fields([name]);
      const response = await request(app)
        .post("/upload")
        .set("Content-Type", `multipart/form-data; boundary=${payload.boundary}`)
        .send(payload.body);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("LIMIT_FIELD_ARRAY_INDEX");
      await request(app).get("/health").expect(204);
    }
  );

  it("preserves valid uploads, an exact file limit, and ordinary fields", async () => {
    const app = uploadApp(
      multipartUpload({
        storage: multipartUpload.memoryStorage(),
        limits: { fileSize: 8, files: 1 },
      })
    );
    const response = await request(app)
      .post("/upload")
      .field("title", "Saved file")
      .field(`items[${MAX_MULTIPART_ARRAY_INDEX}]`, "allowed")
      .attach("file", Buffer.from("12345678"), "proof.txt")
      .expect(200);
    expect(response.body).toEqual({ size: 8, title: "Saved file" });
  });

  it("enforces the original file-size limit after an asynchronous filter accepts", async () => {
    const app = uploadApp(
      multipartUpload({
        storage: multipartUpload.memoryStorage(),
        limits: { fileSize: 8 },
        fileFilter: (_req, _file, callback) => {
          setTimeout(() => callback(null, true), 20);
        },
      })
    );
    const response = await request(app)
      .post("/upload")
      .attach("file", Buffer.alloc(1024), "oversized.bin")
      .expect(413);
    expect(response.body.code).toBe("LIMIT_FILE_SIZE");
    await request(app).get("/health").expect(204);
  });

  it("preserves each route's file-type filter", async () => {
    const app = uploadApp(
      multipartUpload({
        storage: multipartUpload.memoryStorage(),
        fileFilter: (_req, file, callback) =>
          file.mimetype === "image/png"
            ? callback(null, true)
            : callback(new Error("Only PNG uploads are supported")),
      })
    );
    await request(app)
      .post("/upload")
      .attach("file", Buffer.from("text"), { filename: "wrong.txt", contentType: "text/plain" })
      .expect(400);
  });

  it("closes the actual disk stream and removes its partial file after a client abort", async () => {
    const parent = path.resolve("test-results");
    fs.mkdirSync(parent, { recursive: true });
    const directory = fs.mkdtempSync(path.join(parent, "multipart-abort-"));
    const streams: fs.WriteStream[] = [];
    const original = fs.createWriteStream;
    const streamSpy = vi
      .spyOn(fs, "createWriteStream")
      .mockImplementation((...args: Parameters<typeof fs.createWriteStream>) => {
        const stream = original(...args);
        if (String(args[0]).startsWith(directory + path.sep)) streams.push(stream);
        return stream;
      });
    const app = uploadApp(multipartUpload({ dest: directory }));
    const server = app.listen(0, "127.0.0.1");
    let upload: http.ClientRequest | undefined;
    try {
      await new Promise<void>((resolve) => server.once("listening", resolve));
      const port = (server.address() as { port: number }).port;
      const boundary = "abort-proof";
      const preamble = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="partial.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`;
      upload = http.request({
        host: "127.0.0.1",
        port,
        method: "POST",
        path: "/upload",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": 1024 * 1024,
        },
      });
      upload.on("error", () => {});
      upload.write(preamble);
      upload.write(Buffer.alloc(4096, 1));
      await waitUntil(
        () => streams.some((stream) => stream.bytesWritten > 0),
        "the fixture must reach real disk storage"
      );
      upload.destroy();
      await waitUntil(
        () => streams.length === 1 && streams.every((stream) => stream.closed),
        "aborted upload disk descriptors must close"
      );
      await waitUntil(
        () => fs.readdirSync(directory).length === 0,
        "partial upload must be removed"
      );
      await request(app).get("/health").expect(204);
    } finally {
      upload?.destroy();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
      streamSpy.mockRestore();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("patched native image decoder", () => {
  it.each(["png", "jpeg", "webp", "avif"] as const)(
    "decodes and resizes real %s image bytes",
    async (format) => {
      const encoded = await sharp({
        create: { width: 32, height: 24, channels: 3, background: { r: 40, g: 80, b: 120 } },
      })
        .toFormat(format)
        .toBuffer();
      const decoded = await sharp(encoded).metadata();
      expect([decoded.width, decoded.height]).toEqual([32, 24]);
      const result = await sharp(encoded)
        .resize(16, 12)
        .png()
        .toBuffer({ resolveWithObject: true });
      expect([result.info.width, result.info.height, result.info.format]).toEqual([16, 12, "png"]);
      expect(result.data.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
  );

  it("rejects malformed image input and continues decoding subsequent valid input", async () => {
    await expect(sharp(Buffer.from("not an image")).resize(16).toBuffer()).rejects.toThrow();
    const result = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    expect((await sharp(result).metadata()).width).toBe(2);
  });
});
