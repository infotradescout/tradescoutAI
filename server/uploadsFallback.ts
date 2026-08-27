import type { Express, Request, Response } from "express";
import express from "express";
import fs from "fs";
import path from "path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;
const COMMON_IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp", ".avif"];

function sanitizeUploadRelativePath(raw: string): string {
  const normalized = String(raw || "")
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");
  const parts = normalized
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.some((p) => p === "." || p === "..")) return "";
  return parts.join("/");
}

function buildCandidateRelativePaths(uploadPath: string): string[] {
  const clean = sanitizeUploadRelativePath(uploadPath);
  if (!clean) return [];

  const parts = clean.split("/");
  const fileName = parts[parts.length - 1] || "";
  const baseName = fileName.replace(/\.[a-z0-9]+$/i, "");

  const candidates = new Set<string>([clean]);

  if (baseName && baseName !== fileName) {
    const withNoExt = [...parts.slice(0, -1), baseName].join("/");
    candidates.add(withNoExt);
  }

  // If request has no extension, try common image variants.
  if (baseName === fileName) {
    for (const ext of COMMON_IMAGE_EXTS) {
      const withExt = [...parts.slice(0, -1), `${baseName}${ext}`].join("/");
      candidates.add(withExt);
    }
  }

  return Array.from(candidates);
}

function createR2ClientIfConfigured(): { client: S3Client; bucketName: string } | null {
  const accountId = String(process.env.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucketName = String(process.env.R2_BUCKET_NAME || "").trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) return null;

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucketName };
}

async function streamFromR2IfPresent(
  req: Request,
  res: Response,
  r2: { client: S3Client; bucketName: string },
  uploadPath: string
): Promise<boolean> {
  const candidates = buildCandidateRelativePaths(uploadPath);
  for (const relative of candidates) {
    const key = `uploads/${relative}`;
    try {
      const object = await r2.client.send(
        new GetObjectCommand({
          Bucket: r2.bucketName,
          Key: key,
        })
      );

      if (object.ContentType) {
        res.setHeader("Content-Type", object.ContentType);
      }
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

      const body: any = object.Body;
      if (body && typeof body.pipe === "function") {
        body.pipe(res);
        return true;
      }
      if (body && typeof body.transformToByteArray === "function") {
        const bytes = await body.transformToByteArray();
        res.status(200).send(Buffer.from(bytes));
        return true;
      }
      return false;
    } catch (error: any) {
      const statusCode = Number(error?.$metadata?.httpStatusCode || 0);
      const code = String(error?.Code || error?.name || "");
      const notFoundLike = statusCode === 404 || code === "NoSuchKey" || code === "NotFound";
      if (notFoundLike) continue;
      console.error("[uploads-fallback] R2 fetch failed", { key, error });
      return false;
    }
  }
  return false;
}

export function registerUploadsFallback(
  app: Express,
  options?: { legacyJwStoneRoots?: string[] }
) {
  const uploadsPath = path.resolve(process.env.UPLOAD_DIR || "./public/uploads");
  const legacyJwStoneRoots = (
    options?.legacyJwStoneRoots || [
      path.join(process.cwd(), "dist/public/images/businesses/jw-stone"),
      path.join(process.cwd(), "client/public/images/businesses/jw-stone"),
    ]
  ).map((root) => path.resolve(root));

  // Keep direct disk serving first for fast path.
  app.use(
    "/uploads",
    express.static(uploadsPath, {
      maxAge: process.env.NODE_ENV === "production" ? "1y" : "0",
    })
  );

  // Miss handler: try extension variants and R2 object keys.
  app.get("/uploads/*", async (req, res) => {
    try {
      const requested = String(req.path || "").replace(/^\/uploads\/?/, "");
      const candidates = buildCandidateRelativePaths(requested);

      // Local disk fallback (handles extension mismatch and moved naming).
      for (const relative of candidates) {
        const fullPath = path.resolve(uploadsPath, relative);
        if (!fullPath.startsWith(path.resolve(uploadsPath) + path.sep)) continue;
        if (fs.existsSync(fullPath)) {
          return res.sendFile(fullPath);
        }
      }

      // R2 fallback (handles cases where DB has /uploads/... but objects live in R2).
      const r2 = createR2ClientIfConfigured();
      if (r2) {
        const streamed = await streamFromR2IfPresent(req, res, r2, requested);
        if (streamed) return;
      }

      // During the one-time JW Stone asset migration, serve the old bundled
      // bytes only for the new /uploads/jw-stone/... namespace. This keeps the
      // URL cutover lossless while R2 fills; R2 remains the preferred source.
      const jwStonePrefix = "jw-stone/";
      if (requested.startsWith(jwStonePrefix)) {
        const legacyRelative = requested.slice(jwStonePrefix.length);
        const legacyCandidates = buildCandidateRelativePaths(legacyRelative);
        for (const root of legacyJwStoneRoots) {
          for (const relative of legacyCandidates) {
            const fullPath = path.resolve(root, relative);
            if (!fullPath.startsWith(root + path.sep)) continue;
            if (fs.existsSync(fullPath)) {
              res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
              res.setHeader("X-TradeScout-JW-Asset-Recovery", "legacy-static");
              return res.sendFile(fullPath);
            }
          }
        }
      }

      // Avoid noisy broken-image UX for known image requests.
      if (IMAGE_EXT_RE.test(requested)) {
        return res.redirect(302, "/icon-192.png");
      }

      return res.status(404).send("Not found");
    } catch (error) {
      console.error("[uploads-fallback] Unexpected error:", error);
      return res.status(404).send("Not found");
    }
  });
}